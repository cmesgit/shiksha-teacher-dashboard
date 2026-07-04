// ============================================================
// TEACHER — src/pages/TeacherDashboard.jsx  (FULL REPLACEMENT)
// ============================================================
//
// WHAT CHANGED vs the previous version
// ────────────────────────────────────
// 1. TRACK GATE. The academy dashboard now checks
//    teacherInfo.tracks.academy BEFORE rendering (locked / pending /
//    rejected each get a proper state card with the admin's rejection
//    reason and a re-apply CTA) and honors the new backend responses:
//      409 wrong_dashboard      → route to /teacher/expert (skill side)
//      403 academy_not_approved → gate card
//    A skill-only expert deep-linking to /teacher/dashboard no longer
//    sees an empty academy shell — the "which teacher am I?" confusion
//    is answered on-screen.
// 2. ONE NOTIFICATION SOURCE. The old page merged data.notifications
//    (REST) with the WS list using JSON.stringify dedupe keys —
//    guaranteed duplicates, un-markable ghosts. The singleton
//    useNotificationSocket store (already profile/context-isolated
//    server-side) is now the only source; the merge is gone.
// 3. CANONICAL TYPES. Filters, labels and colors all use the UPPERCASE
//    vocabulary the normalized hook emits — the notification type
//    filter matches real data for the first time.
// 4. LIVE REVALIDATION. A SUBMISSION / ASSIGNMENT / QUIZ / SESSION push
//    while the page is open triggers a debounced silent refetch, so
//    "X Remaining" and the lists stay true without a reload.
// 5. ERROR ≠ EMPTY. Fetch failure renders a retry card instead of a
//    silent empty dashboard; loading uses a skeleton line, not a
//    dead-end "Loading...".
// 6. startsIn is computed client-side (the API never sent one — the
//    desktop cards were rendering `undefined`), quizzes get the same
//    Due/Overdue pills as assignments (design parity), the resize
//    listener is a matchMedia subscription, and unused `isBoth` is gone
//    (the header TrackSwitcher owns track UI).
//
// Layout, class names and child components are unchanged — this is a
// rewiring, not a redesign.

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import "../styles/dashboard.css";
import { useAuth } from "../contexts/AuthContext";
import { HOME_URL } from "../config/urls";

import LiveSessionCard  from "../components/LiveSessionCard";
import CalendarWidget   from "../components/CalendarWidget";
import AssignmentItem   from "../components/AssignmentItem";
import ActivityItem     from "../components/ActivityItem";
import AcademyRejectionBanner from "../components/AcademyRejectionBanner";

import api from "../api/apiClient";
import useNotificationSocket from "../hooks/useNotificationSocket";

const DATE_FORMAT = { day: "2-digit", month: "short", year: "numeric" };
const DATETIME_FORMAT = {
  day: "2-digit", month: "short", year: "numeric",
  hour: "2-digit", minute: "2-digit", hour12: true,
};

// Canonical (UPPERCASE) — matches the normalized hook + new serializers.
const NOTIF_FILTERS = [
  { value: "all",        label: "All" },
  { value: "ASSIGNMENT", label: "Assignment" },
  { value: "SESSION",    label: "Live Session" },
  { value: "QUIZ",       label: "Quiz" },
  { value: "SUBMISSION", label: "Submissions" },
];

// WS events that mean "your academy slices changed".
const REFRESH_TYPES = new Set(["ASSIGNMENT", "QUIZ", "SESSION", "SUBMISSION"]);

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-GB", DATE_FORMAT);
}

function formatDateTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("en-GB", DATETIME_FORMAT);
}

function toDateKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startsInLabel(dateStr, now) {
  const t = new Date(dateStr);
  if (Number.isNaN(t.getTime())) return "";
  const diffMins = Math.round((t - now) / 60000);
  if (diffMins < 0)  return "In progress";
  if (diffMins < 60) return `Starts in ${diffMins} min`;
  return `Starts in ${Math.floor(diffMins / 60)}h`;
}

// ── Track gate card (pending / rejected / locked academy) ──────────
function AcademyGate({ status, reason }) {
  const copy = {
    pending: {
      title: "Your Faculty application is in review",
      body:  "Our team is reviewing your Academy (faculty) application. You'll be notified here the moment it's approved.",
      cta:   null,
    },
    rejected: {
      title: "Your Faculty application wasn't approved",
      body:  reason
        ? `Reviewer note: ${reason}`
        : "You can update your details and re-apply from the Faculty application page.",
      cta:   { label: "Re-apply as Faculty", href: `${HOME_URL}/become-faculty` },
    },
    locked: {
      title: "Academy track not added yet",
      body:  "This account teaches on the Skill Dev track. Add the Academy (faculty) track to teach board classes 8–12 here.",
      cta:   { label: "Apply for the Faculty track", href: `${HOME_URL}/become-faculty` },
    },
  }[status] || null;

  if (!copy) return null;

  return (
    <div className="dashboard">
      <div className="dash-card" style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", padding: "32px 28px" }}>
        <h3 style={{ marginBottom: 10 }}>{copy.title}</h3>
        <p style={{ color: "#5b6b74", fontSize: 14, lineHeight: 1.55 }}>{copy.body}</p>
        {copy.cta && (
          <a href={copy.cta.href} className="dash-pill pill-active"
             style={{ display: "inline-block", marginTop: 18, textDecoration: "none", padding: "10px 18px" }}>
            {copy.cta.label}
          </a>
        )}
      </div>
    </div>
  );
}

export default function TeacherDashboard() {
  const outletContext = useOutletContext();
  const active        = outletContext?.active || "sessions";
  const navigate      = useNavigate();
  const { teacherInfo } = useAuth();

  const academyStatus = teacherInfo?.tracks?.academy ?? "approved"; // older /me/ shapes: assume approved
  const rejectionReason = teacherInfo?.academy_rejection_reason || "";

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia("(max-width: 768px)").matches
  );

  const [assignFilter, setAssignFilter]             = useState(null);
  const [quizFilter, setQuizFilter]                 = useState(null);
  const [activityFilter, setActivityFilter]         = useState("all");
  const [selectedDate, setSelectedDate]             = useState(null);
  const [scheduleTypeFilter, setScheduleTypeFilter] = useState("all");

  // Singleton, server-isolated notification store (bell shares it).
  const { notifications, markOneRead, onEvent } = useNotificationSocket();

  // ── data fetch (abortable, retryable, WS-revalidated) ─────────────
  const abortRef = useRef(null);
  const fetchDashboard = useCallback(async ({ silent = false } = {}) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (!silent) { setLoading(true); setError(""); }
    try {
      const res = await api.get("/dashboard/", { signal: controller.signal });
      setData(res.data);
      setError("");
    } catch (err) {
      if (controller.signal.aborted) return;
      const code = err?.response?.data?.code;
      if (code === "wrong_dashboard") {           // skill-track token → skill home
        navigate("/teacher/expert", { replace: true });
        return;
      }
      if (code === "academy_not_approved") {
        // Gate below renders from teacherInfo; just stop loading.
        setData(null);
        setError("");
      } else if (!silent) {
        setError("Couldn't load your dashboard.");
      }
      console.error("Dashboard error:", err);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchDashboard();
    return () => abortRef.current?.abort();
  }, [fetchDashboard]);

  // Debounced silent refetch when a relevant push arrives.
  useEffect(() => {
    let t = null;
    const off = onEvent((n) => {
      if (!REFRESH_TYPES.has(n?.type)) return;
      clearTimeout(t);
      t = setTimeout(() => fetchDashboard({ silent: true }), 1500);
    });
    return () => { off(); clearTimeout(t); };
  }, [onEvent, fetchDashboard]);

  // matchMedia beats resize-thrash.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const sessions        = data?.sessions         ?? [];
  const allSessions     = data?.all_sessions     ?? sessions;
  const assignments     = data?.assignments      ?? [];
  const quizzes         = data?.quizzes          ?? [];
  const privateSessions = data?.private_sessions ?? [];

  // ── calendar events ────────────────────────────────────────────────
  const calendarEvents = useMemo(() => {
    const map = {};
    const now = new Date();
    const add = (dateStr, type) => {
      const key = toDateKey(dateStr);
      if (!key) return;
      if (!map[key]) map[key] = [];
      if (!map[key].includes(type)) map[key].push(type);
    };
    assignments.forEach((a) =>
      add(a.due, new Date(a.due) < now ? "assignment-overdue" : "assignment"));
    quizzes.forEach((q) =>
      add(q.due, new Date(q.due) < now ? "quiz-overdue" : "quiz"));
    privateSessions.forEach((ps) => add(ps.date, "private-session"));
    allSessions.forEach((s)     => add(s.dateTime, "live-session"));
    return map;
  }, [assignments, quizzes, privateSessions, allSessions]);

  // ── unified schedule ───────────────────────────────────────────────
  const scheduleItems = useMemo(() => {
    const now = new Date();
    const items = [];
    allSessions.forEach((s) =>
      items.push({
        id:         `session-${s.id}`,
        type:       "live-session",
        title:      `${s.subject} - ${s.topic}`,
        date:       s.dateTime,
        labelColor: "yellow",
        link:       `/teacher/live/${s.id}`,
      }));
    assignments.forEach((a) =>
      items.push({
        id:         `assignment-${a.id}`,
        type:       "assignment",
        title:      a.title,
        date:       a.due,
        labelColor: new Date(a.due) < now ? "red" : "green",
        link:       a.subject_id ? `/teacher/classes/${a.subject_id}/assignments` : null,
      }));
    quizzes.forEach((q) =>
      items.push({
        id:         `quiz-${q.id}`,
        type:       "quiz",
        title:      q.title,
        date:       q.due,
        labelColor: new Date(q.due) < now ? "red" : "purple",
        link:       q.subject_id ? `/teacher/classes/${q.subject_id}/quizzes` : null,
      }));
    privateSessions.forEach((ps) =>
      items.push({
        id:         `private-${ps.id}`,
        type:       "private-session",
        title:      `${ps.subject} (${ps.student})`,
        date:       ps.date,
        labelColor: "orange",
        link:       `/teacher/private-sessions/scheduled/${ps.id}`,
      }));
    items.sort((a, b) => new Date(a.date) - new Date(b.date));
    return items;
  }, [allSessions, assignments, quizzes, privateSessions]);

  // ── filters ────────────────────────────────────────────────────────
  const toggleFilter = (current, value, setter) =>
    setter(current === value ? null : value);

  const byDueFilter = (list, filter) => {
    if (!filter) return list;
    const now = new Date();
    return list.filter((x) => {
      const due = x.due ? new Date(x.due) : null;
      if (!due || Number.isNaN(due.getTime())) return filter === "due";
      return filter === "overdue" ? due < now : due >= now;
    });
  };

  const filteredAssignments = byDueFilter(assignments, assignFilter);
  const filteredQuizzes     = byDueFilter(quizzes, quizFilter);

  const filteredActivities = notifications.filter(
    (item) => activityFilter === "all" || item.type === activityFilter
  );

  const filteredSchedule = scheduleItems.filter((item) => {
    if (selectedDate && !isSameDay(new Date(item.date), selectedDate)) return false;
    if (scheduleTypeFilter !== "all" && item.type !== scheduleTypeFilter) return false;
    return true;
  });

  const handleDateSelect = (date) => {
    if (selectedDate && isSameDay(selectedDate, date)) setSelectedDate(null);
    else setSelectedDate(date);
  };

  // ── gates before content ───────────────────────────────────────────
  if (academyStatus !== "approved") {
    return <AcademyGate status={academyStatus} reason={rejectionReason} />;
  }

  if (loading) {
    return (
      <div className="dashboard">
        <div className="dash-card"><p>Loading your dashboard…</p></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard">
        <div className="dash-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <p style={{ margin: 0 }}>{error}</p>
          <button type="button" className="dash-pill pill-active"
                  onClick={() => fetchDashboard()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const nowForLabels = new Date();

  const renderSessionCard = (s) => (
    <LiveSessionCard
      key={s.id}
      subject={s.subject}
      topic={s.topic}
      startsIn={startsInLabel(s.dateTime, nowForLabels)}
      timing={formatDateTime(s.dateTime)}
    />
  );

  const notificationList = (list) => (
    <>
      {list.length === 0 && <p>No notifications</p>}
      {list.map((item) => (
        <ActivityItem key={item.id} notification={item} onRead={markOneRead} />
      ))}
    </>
  );

  // ── MOBILE ────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="dashboard">
        {active === "sessions" && (
          <div className="dash-card">
            <h4>Upcoming Live Sessions</h4>
            {sessions.length === 0 && <p>No sessions this week</p>}
            {sessions.map(renderSessionCard)}
          </div>
        )}

        {active === "assignments" && (
          <div className="dash-card">
            <h4>Assignments</h4>
            {filteredAssignments.length === 0 && <p>No assignments</p>}
            {filteredAssignments.map((a) => (
              <AssignmentItem key={a.id} id={a.id} title={a.title}
                subject={a.subject_name} dueDate={formatDate(a.due)}
                subjectId={a.subject_id} />
            ))}
          </div>
        )}

        {active === "quizzes" && (
          <div className="dash-card">
            <h4>Quizzes</h4>
            {filteredQuizzes.length === 0 && <p>No quizzes</p>}
            {filteredQuizzes.map((q) => (
              <AssignmentItem key={q.id} id={q.id} title={q.title}
                subject={q.subject_name} dueDate={formatDate(q.due)}
                subjectId={q.subject_id} />
            ))}
          </div>
        )}

        {active === "notifications" && (
          <div className="dash-card">
            <h4>Notifications</h4>
            {notificationList(filteredActivities)}
          </div>
        )}

        {active === "calendar" && (
          <CalendarWidget
            events={calendarEvents}
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
          />
        )}
      </div>
    );
  }

  // ── DESKTOP ───────────────────────────────────────────────────────
  return (
    <div className="dashboard">

      <AcademyRejectionBanner />

      {/* Faculty ⟷ Expert switch lives in the shared header (TrackSwitcher). */}

      {/* Row 1: Live Sessions */}
      <div className="dash-live-section">
        <div className="dash-live-header">
          <h3 className="dash-section-title">Upcoming Live Sessions</h3>
          <div className="dash-remaining">{sessions.length} Remaining</div>
        </div>
        <div className="dash-live-row">
          {sessions.length === 0 && <p>No sessions this week</p>}
          {sessions.map(renderSessionCard)}
        </div>
      </div>

      {/* Calendar */}
      <CalendarWidget
        events={calendarEvents}
        selectedDate={selectedDate}
        onDateSelect={handleDateSelect}
      />

      {/* Assignments */}
      <div className="dash-card">
        <div className="dash-card-header">
          <h4>Assignments</h4>
          <div className="dash-pills">
            <button type="button"
              className={`dash-pill pill-due ${assignFilter === "due" ? "pill-active" : ""}`}
              onClick={() => toggleFilter(assignFilter, "due", setAssignFilter)}>
              Due
            </button>
            <button type="button"
              className={`dash-pill pill-overdue ${assignFilter === "overdue" ? "pill-active" : ""}`}
              onClick={() => toggleFilter(assignFilter, "overdue", setAssignFilter)}>
              Overdue
            </button>
          </div>
        </div>
        <div className="dash-card-body">
          {filteredAssignments.length === 0 && <p>No assignments</p>}
          {filteredAssignments.map((a) => (
            <AssignmentItem key={a.id} id={a.id} title={a.title}
              subject={a.subject_name} dueDate={formatDate(a.due)}
              subjectId={a.subject_id} />
          ))}
        </div>
      </div>

      {/* Quizzes — now with the same Due/Overdue pills as assignments */}
      <div className="dash-card">
        <div className="dash-card-header">
          <h4>Quizzes</h4>
          <div className="dash-pills">
            <button type="button"
              className={`dash-pill pill-due ${quizFilter === "due" ? "pill-active" : ""}`}
              onClick={() => toggleFilter(quizFilter, "due", setQuizFilter)}>
              Due
            </button>
            <button type="button"
              className={`dash-pill pill-overdue ${quizFilter === "overdue" ? "pill-active" : ""}`}
              onClick={() => toggleFilter(quizFilter, "overdue", setQuizFilter)}>
              Overdue
            </button>
          </div>
        </div>
        <div className="dash-card-body">
          {filteredQuizzes.length === 0 && <p>No quizzes</p>}
          {filteredQuizzes.map((q) => (
            <AssignmentItem key={q.id} id={q.id} title={q.title}
              subject={q.subject_name} dueDate={formatDate(q.due)}
              subjectId={q.subject_id} />
          ))}
        </div>
      </div>

      {/* Notifications — single, server-isolated source */}
      <div className="dash-card">
        <div className="dash-card-header">
          <h4>Notifications</h4>
          <select className="dash-filter" value={activityFilter}
            aria-label="Filter notifications"
            onChange={(e) => setActivityFilter(e.target.value)}>
            {NOTIF_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
        <div className="dash-card-body">
          {notificationList(filteredActivities)}
        </div>
      </div>

      {/* Schedule */}
      <div className="dash-card">
        <div className="dash-card-header">
          <h4>
            Schedule
            {selectedDate && (
              <span style={{ fontWeight: 400, fontSize: "0.8rem", marginLeft: 8 }}>
                — {selectedDate.toLocaleDateString("en-GB", DATE_FORMAT)}
              </span>
            )}
          </h4>
          <select className="dash-filter" value={scheduleTypeFilter}
            aria-label="Filter schedule"
            onChange={(e) => setScheduleTypeFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="assignment">Assignment</option>
            <option value="live-session">Live Session</option>
            <option value="private-session">Private Session</option>
            <option value="quiz">Quiz</option>
          </select>
        </div>
        <div className="dash-card-body">
          {filteredSchedule.length === 0 && <p>No schedule</p>}
          {filteredSchedule.map((item) => (
            <ActivityItem
              key={item.id}
              date={formatDate(item.date)}
              label={item.type}
              labelColor={item.labelColor}
              lines={[item.title]}
              onClick={() => { if (item.link) navigate(item.link); }}
            />
          ))}
        </div>
      </div>

    </div>
  );
}
