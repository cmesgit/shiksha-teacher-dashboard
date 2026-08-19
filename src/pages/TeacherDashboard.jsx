// ============================================================
// TEACHER — src/pages/TeacherDashboard.jsx  (FULL REPLACEMENT)
// ============================================================
//
// Rebuilt to match Academy Dashboard.dc.html's Teacher view exactly
// (verified against screenshots/teacher-01-dashboard.png): greeting + stat
// row (unchanged from the 2026-07-25 pass), then Today's Sessions (was the
// old teal "Upcoming Live Sessions" card carousel), Grading Queue, a
// 360px-tall Assignments/Quizzes ⟷ Recent Activity subgrid, and a rail of
// Calendar → Schedule → Batch Progress. The standalone "Notifications" rail
// card is gone — the design has no such card, and Recent Activity in the
// main column already surfaces the same feed.
//
// Row/tag/button/chip classes (.ac-row, .ac-tag--*, .ac-seg, .ac-btn,
// .subj-chip--N) come from styles/academyScreens.css, the shared vocabulary
// already used by every other converted screen — this page reuses it rather
// than inventing its own row shape.
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import "../styles/academyScreens.css";
import "../styles/dashboard.css";
import { useAuth } from "../contexts/AuthContext";
import { HOME_URL } from "../config/urls";

import NavIcon from "../components/NavIcon";
import CalendarWidget from "../components/CalendarWidget";
import AcademyRejectionBanner from "../components/AcademyRejectionBanner";
import BatchProgressSummary from "../components/BatchProgressSummary";
import { subjectChipSlot } from "../utils/subjectChips";
import { fmtClockTime, dayLabel, startsInText } from "../utils/sessionTime";

import api from "../api/apiClient";
import useNotificationSocket from "../hooks/useNotificationSocket";
import { LoadingState } from "../components/StateViews";

const DATE_FORMAT = { day: "2-digit", month: "short", year: "numeric" };

// WS events that mean "your academy slices changed".
const REFRESH_TYPES = new Set(["ASSIGNMENT", "QUIZ", "SESSION", "SUBMISSION"]);

// Quizzes have no due date (product decision — a quiz stays attemptable
// indefinitely once published), so they're not date-scheduled events: no
// calendar dots, no schedule-rail entries, no due/overdue chip on their
// Assignments/Quizzes rail row. They still get their own tab in that row.
const SCHEDULE_TYPE_FILTERS = [
  { value: "all",             label: "All" },
  { value: "assignment",      label: "Assign" },
  { value: "live-session",    label: "Live" },
  { value: "private-session", label: "Private" },
];

// One vocabulary for calendar dots, schedule-row chips and activity icons —
// declared once so the three stay in step.
const TYPE_META = {
  "live-session":    { label: "Live",     chipBg: "#e6f4f6", chipColor: "#13899b" },
  "assignment":      { label: "Assign",   chipBg: "#ecf8ee", chipColor: "#2f9d42" },
  "private-session": { label: "Private",  chipBg: "#fef3ec", chipColor: "#c2701c" },
};
const OVERDUE_CHIP = { bg: "#fef2f2", color: "#dc2626" };

const ACTIVITY_ICON = {
  SESSION:    { icon: "video", bg: "#e6f4f6", color: "#13899b" },
  QUIZ:       { icon: "help",  bg: "#f1e9fb", color: "#7c3aed" },
  ASSIGNMENT: { icon: "file",  bg: "#e8edfb", color: "#1d4ed8" },
  SUBMISSION: { icon: "check", bg: "#fef9ec", color: "#b45309" },
};
const DEFAULT_ACTIVITY_ICON = { icon: "bell", bg: "#eef1f2", color: "#6b7c83" };

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", DATE_FORMAT);
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

function initialsOf(name) {
  return (name || "")
    .trim().split(/\s+/).slice(0, 2)
    .map((w) => w[0]).join("").toUpperCase() || "S";
}

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

// A session can really be cancelled/completed/live — the design's static
// prototype only ever shows a "Remind me" button (no such backend feature
// exists), so this keeps the row shape but wires the REAL action: start/
// join the session, same rule the dedicated Live Sessions page uses.
function sessionCanJoin(s) {
  if (s.status === "CANCELLED") return false;
  if (s.teacher_left_at) {
    const mins = (Date.now() - new Date(s.teacher_left_at).getTime()) / 60000;
    if (mins > 60) return false;
  }
  return true;
}
function sessionActionLabel(s) {
  if (s.status === "CANCELLED") return "Cancelled";
  if (s.status === "COMPLETED") return "Ended";
  return s.live ? "Join" : "Start";
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

// ── Shared row renderers (desktop + mobile both use these) ─────────
function SessionRow({ s, onAction }) {
  const start = new Date(s.dateTime);
  const slot = subjectChipSlot(s.subject);
  const batchLine = s.batch_name
    ? `${s.batch_name}${s.batch_student_count != null ? ` · ${s.batch_student_count} students` : ""}`
    : "";
  const canJoin = sessionCanJoin(s);
  const label = sessionActionLabel(s);

  return (
    <div className="ac-row">
      <div className="ac-row__when">
        <div className="ac-row__time">{fmtClockTime(start)}</div>
        <div className="ac-row__day">{dayLabel(start).toUpperCase()}</div>
      </div>
      <div className="ac-row__divider" />
      <div className="ac-row__body">
        <div className="ac-row__meta">
          <span className={`subj-chip subj-chip--${slot}`}>{s.subject}</span>
          <span className="dash-when">· starts {startsInText(start)}</span>
        </div>
        <div className="ac-row__topic">{s.topic}</div>
        {batchLine && <div className="ac-row__sub">{batchLine}</div>}
      </div>
      <div className="ac-row__actions">
        <button
          type="button"
          className="dash-sessBtn"
          disabled={!canJoin || label === "Ended"}
          onClick={() => onAction(s)}
        >
          {label}
        </button>
      </div>
    </div>
  );
}

function WorkRow({ item, kind, onOpen }) {
  const isQuiz = kind === "quizzes";
  const overdue = !isQuiz && item.due && new Date(item.due) < new Date();
  const slot = subjectChipSlot(item.subject_name);
  return (
    <div className="ac-row" onClick={onOpen} style={{ cursor: "pointer" }}>
      <div className="ac-row__body">
        <div className="dash-workRow__top">
          <span className={`subj-chip subj-chip--${slot}`}>{item.subject_name || kind}</span>
          {!isQuiz && (
            <span className={`ac-tag ${overdue ? "ac-tag--danger" : "ac-tag--success"}`}>
              {overdue ? "Overdue" : `Due ${formatDate(item.due)}`}
            </span>
          )}
        </div>
        <div className="ac-row__topic">{item.title}</div>
        <div className="ac-row__sub">{isQuiz ? "Quiz" : "Assignment"}</div>
      </div>
    </div>
  );
}

function ActivityRow({ item, onRead }) {
  const meta = ACTIVITY_ICON[item.raw_type] || DEFAULT_ACTIVITY_ICON;
  return (
    <div className="dash-actRow" onClick={() => onRead?.(item.id)}>
      <div className="dash-actRow__icon" style={{ background: meta.bg, color: meta.color }}>
        <NavIcon name={meta.icon} size={14} color={meta.color} />
      </div>
      <div className="dash-actRow__body">
        <div className="dash-actRow__title">{item.title}</div>
        {item.subject && <div className="dash-actRow__meta">{item.subject}</div>}
        <div className="dash-actRow__time">{timeAgo(item.created_at)}</div>
      </div>
      {item.unread && <span className="dash-actRow__dot" />}
    </div>
  );
}

function ScheduleRow({ item, onClick }) {
  const d = new Date(item.date);
  const meta = TYPE_META[item.type] || TYPE_META.assignment;
  const overdue = new Date(item.date) < new Date() && item.type === "assignment";
  const chip = overdue ? OVERDUE_CHIP : { bg: meta.chipBg, color: meta.chipColor };
  return (
    <button type="button" className="dash-schedRow" onClick={onClick}>
      <div className="dash-schedRow__when">
        <div className="dash-schedRow__day">{d.getDate()}</div>
        <div className="dash-schedRow__mon">{d.toLocaleDateString("en-GB", { month: "short" })}</div>
      </div>
      <div className="dash-schedRow__body">
        <div className="dash-schedRow__title">{item.title}</div>
        <div className="dash-schedRow__sub">{formatDate(item.date)}</div>
      </div>
      <span className="dash-schedRow__chip" style={{ background: chip.bg, color: chip.color }}>
        {overdue ? "Overdue" : meta.label}
      </span>
    </button>
  );
}

export default function TeacherDashboard() {
  const outletContext = useOutletContext();
  const active        = outletContext?.active || "sessions";
  const navigate       = useNavigate();
  const { teacherInfo, user } = useAuth();

  // Fail CLOSED. This used to default to "approved" for "older /me/ shapes",
  // which meant any response missing `tracks` (a serializer change, a partial
  // cache, a failed refresh) silently opened the Academy dashboard to
  // non-faculty — defeating AcademyGate below, the only real gate on this
  // screen. Matches TrackSwitcher, which already defaults to "locked".
  const academyStatus = teacherInfo?.tracks?.academy ?? "locked";
  const rejectionReason = teacherInfo?.academy_rejection_reason || "";

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia("(max-width: 768px)").matches
  );

  const [selectedDate, setSelectedDate]             = useState(null);
  const [scheduleTypeFilter, setScheduleTypeFilter] = useState("all");
  const [listTab, setListTab]                       = useState("assignments"); // merged Assignments/Quizzes card
  const [batchStats, setBatchStats]                 = useState(null);

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

  // Stat row's "Active batches" / "Students taught" — the dashboard payload
  // doesn't carry batch stats, so this fetches the same endpoint
  // BatchProgressSummary already calls independently for its own widget
  // (see src/components/BatchProgressSummary.jsx). Duplicate network call,
  // same precedent already established on this page.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/courses/teacher/my-batches/");
        if (!cancelled) setBatchStats(res.data?.stats || null);
      } catch (err) {
        console.error("Failed to load batch stats", err);
        if (!cancelled) setBatchStats(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const sessions        = data?.sessions         ?? [];
  const allSessions     = data?.all_sessions     ?? sessions;
  const assignments     = data?.assignments      ?? [];
  const quizzes         = data?.quizzes          ?? [];
  const privateSessions = data?.private_sessions ?? [];
  const gradingQueue    = data?.grading_queue    ?? [];
  const gradingCount    = data?.grading_count    ?? gradingQueue.length;
  const recentActivity  = data?.schedule         ?? [];

  const nowStat = new Date();
  const todaySessions = useMemo(
    () => allSessions.filter((s) => isSameDay(new Date(s.dateTime), nowStat)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allSessions]
  );

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
    privateSessions.forEach((ps) => add(ps.date, "private-session"));
    allSessions.forEach((s)     => add(s.dateTime, "live-session"));
    return map;
  }, [assignments, privateSessions, allSessions]);

  // ── unified schedule ───────────────────────────────────────────────
  const scheduleItems = useMemo(() => {
    const items = [];
    allSessions.forEach((s) =>
      items.push({
        id:    `session-${s.id}`,
        type:  "live-session",
        title: `${s.subject} - ${s.topic}`,
        date:  s.dateTime,
        link:  `/teacher/live/${s.id}`,
      }));
    assignments.forEach((a) =>
      items.push({
        id:    `assignment-${a.id}`,
        type:  "assignment",
        title: a.title,
        date:  a.due,
        link:  a.subject_id ? `/teacher/classes/${a.subject_id}/assignments` : null,
      }));
    privateSessions.forEach((ps) =>
      items.push({
        id:    `private-${ps.id}`,
        type:  "private-session",
        title: `${ps.subject} (${ps.student})`,
        date:  ps.date,
        link:  `/teacher/private-sessions/scheduled/${ps.id}`,
      }));
    items.sort((a, b) => new Date(a.date) - new Date(b.date));
    return items;
  }, [allSessions, assignments, privateSessions]);

  const filteredSchedule = scheduleItems.filter((item) => {
    if (selectedDate && !isSameDay(new Date(item.date), selectedDate)) return false;
    if (scheduleTypeFilter !== "all" && item.type !== scheduleTypeFilter) return false;
    return true;
  });

  const handleDateSelect = (date) => {
    if (selectedDate && isSameDay(selectedDate, date)) setSelectedDate(null);
    else setSelectedDate(date);
  };

  // ── greeting + stat row (mockup) — derived from real data ──────────
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = (
    user?.name || user?.full_name || user?.username ||
    (user?.email ? user.email.split("@")[0] : "") || "Teacher"
  ).trim().split(/\s+/)[0];
  const todaySessionsCount = todaySessions.length;
  const submissionsToGradeCount = gradingCount;
  const statCards = [
    { icon: "video",  iconBg: "#e6f4f6", iconColor: "#13899b", value: todaySessionsCount,          label: "Sessions today" },
    { icon: "check",  iconBg: "#fef9ec", iconColor: "#b45309", value: submissionsToGradeCount,     label: "Submissions to grade" },
    { icon: "layers", iconBg: "#e6edee", iconColor: "#425f7f", value: batchStats?.active_batches ?? 0, label: "Active batches" },
    { icon: "users",  iconBg: "#e8edfb", iconColor: "#1d4ed8", value: batchStats?.students ?? 0,       label: "Students taught" },
  ];

  // ── gates before content ───────────────────────────────────────────
  if (academyStatus !== "approved") {
    return <AcademyGate status={academyStatus} reason={rejectionReason} />;
  }

  if (loading) {
    return <LoadingState label="Loading your dashboard" />;
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

  const goToSession = (s) => navigate(`/teacher/live/${s.id}`);

  // ── MOBILE (design is a 1240px-desktop-only prototype — silent on
  // mobile, so this keeps the existing lightweight tabbed fallback, just
  // rendered with the same row components as desktop) ──────────────────
  if (isMobile) {
    return (
      <div className="dashboard">
        {active === "sessions" && (
          <div className="dash-card">
            <h4>Upcoming Live Sessions</h4>
            <div className="dash-list">
              {sessions.length === 0 && <p>No sessions this week</p>}
              {sessions.map((s) => <SessionRow key={s.id} s={s} onAction={goToSession} />)}
            </div>
          </div>
        )}

        {active === "assignments" && (
          <div className="dash-card">
            <h4>Assignments</h4>
            <div className="dash-list">
              {assignments.length === 0 && <p>No assignments</p>}
              {assignments.map((a) => (
                <WorkRow key={a.id} item={a} kind="assignments"
                  onOpen={() => a.subject_id && navigate(`/teacher/classes/${a.subject_id}/assignments`)} />
              ))}
            </div>
          </div>
        )}

        {active === "quizzes" && (
          <div className="dash-card">
            <h4>Quizzes</h4>
            <div className="dash-list">
              {quizzes.length === 0 && <p>No quizzes</p>}
              {quizzes.map((q) => (
                <WorkRow key={q.id} item={q} kind="quizzes"
                  onOpen={() => q.subject_id && navigate(`/teacher/classes/${q.subject_id}/quizzes`)} />
              ))}
            </div>
          </div>
        )}

        {active === "notifications" && (
          <div className="dash-card">
            <h4>Notifications</h4>
            <div className="dash-list">
              {notifications.length === 0 && <p>No notifications</p>}
              {notifications.map((item) => <ActivityRow key={item.id} item={item} onRead={markOneRead} />)}
            </div>
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
  const todayShort = nowStat
    .toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
    .replace(",", "");

  return (
    <div className="dashboard">

      <AcademyRejectionBanner />

      {/* Greeting */}
      <div className="dash-greeting">
        <h1>{greeting}, {firstName}</h1>
        <p>
          You have <strong className="dash-greeting__hi">{todaySessionsCount} sessions today</strong> and{" "}
          <strong className="dash-greeting__amber">{gradingCount} submissions</strong> waiting for review.
        </p>
      </div>

      {/* Stat row */}
      <div className="dash-stats">
        {statCards.map((st) => (
          <div className="dash-stat" key={st.label}>
            <div className="dash-stat__icon" style={{ background: st.iconBg, color: st.iconColor }}>
              <NavIcon name={st.icon} size={18} color={st.iconColor} />
            </div>
            <div>
              <div className="dash-stat__value">{st.value}</div>
              <div className="dash-stat__label">{st.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="dash-grid">
      <div className="dash-col dash-col--main">

      {/* Faculty ⟷ Expert switch lives in the shared header (TrackSwitcher). */}

      {/* Today's Sessions */}
      <div className="dash-card">
        <div className="dash-card-header">
          <h3 className="dash-section-title">Today's Sessions</h3>
          <span className="dash-remaining">{todayShort}</span>
        </div>
        <div className="dash-list">
          {todaySessions.length === 0 && <p>No sessions today</p>}
          {todaySessions.map((s) => <SessionRow key={s.id} s={s} onAction={goToSession} />)}
        </div>
      </div>

      {/* Grading Queue — submissions awaiting review (real data) */}
      <div className="dash-card">
        <div className="dash-card-header">
          <h4>Grading Queue</h4>
          <span className="dash-pendingPill">{gradingCount} pending</span>
        </div>
        <div className="dash-card-body">
          {gradingQueue.length === 0 && (
            <p className="dash-allCaughtUp">
              <NavIcon name="check" size={15} color="var(--success)" /> All caught up
            </p>
          )}
          {gradingQueue.map((g) => (
            <div key={g.id} className="grade-item" style={{ marginBottom: 8 }}>
              <div className="grade-item__avatar">{initialsOf(g.student)}</div>
              <div className="grade-item__body">
                <div className="grade-item__student">
                  {g.student} <span className="grade-item__batch">· {g.subject}</span>
                </div>
                <div className="grade-item__meta">{g.title}</div>
              </div>
              <span className="grade-item__time">{timeAgo(g.submitted_at)}</span>
              <button
                type="button"
                className="grade-item__btn"
                onClick={() => {
                  if (g.subject_id && g.assignment_id) {
                    navigate(`/teacher/classes/${g.subject_id}/assignments/${g.assignment_id}/submissions`);
                  }
                }}
              >
                Grade
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Assignments/Quizzes toggle + Recent Activity, side by side */}
      <div className="dash-subgrid">

        {/* Assignments/Quizzes — merged tabbed card */}
        <div className="dash-card dash-card--fixed360">
          <div className="dash-card-header" style={{ marginBottom: 10 }}>
            <div className="ac-seg" role="tablist" aria-label="Assignments or quizzes">
              <button type="button" role="tab" aria-selected={listTab === "assignments"}
                className={`ac-seg__btn ${listTab === "assignments" ? "is-active" : ""}`}
                onClick={() => setListTab("assignments")}>
                Assignments
              </button>
              <button type="button" role="tab" aria-selected={listTab === "quizzes"}
                className={`ac-seg__btn ${listTab === "quizzes" ? "is-active" : ""}`}
                onClick={() => setListTab("quizzes")}>
                Quizzes
              </button>
            </div>
          </div>
          <div className="dash-card-body">
            <div className="dash-list">
              {listTab === "assignments" ? (
                <>
                  {assignments.length === 0 && <p>No assignments</p>}
                  {assignments.map((a) => (
                    <WorkRow key={a.id} item={a} kind="assignments"
                      onOpen={() => a.subject_id && navigate(`/teacher/classes/${a.subject_id}/assignments`)} />
                  ))}
                </>
              ) : (
                <>
                  {quizzes.length === 0 && <p>No quizzes</p>}
                  {quizzes.map((q) => (
                    <WorkRow key={q.id} item={q} kind="quizzes"
                      onOpen={() => q.subject_id && navigate(`/teacher/classes/${q.subject_id}/quizzes`)} />
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity — raw Activity feed (data.schedule), distinct
            from the client-built `scheduleItems` the rail's Schedule card
            uses; this reads the API's due-date-ordered Activity slice
            directly and renders it as a recency feed instead. */}
        <div className="dash-card dash-card--fixed360">
          <div className="dash-card-header">
            <h4>Recent Activity</h4>
          </div>
          <div className="dash-card-body">
            {recentActivity.length === 0 && <p>No recent activity</p>}
            {recentActivity.map((item) => <ActivityRow key={item.id} item={item} />)}
          </div>
        </div>

      </div>{/* /dash-subgrid */}

      </div>{/* /dash-col--main */}

      <div className="dash-col dash-col--rail">

      {/* Calendar */}
      <CalendarWidget
        events={calendarEvents}
        selectedDate={selectedDate}
        onDateSelect={handleDateSelect}
      />

      {/* Schedule */}
      <div className="dash-card">
        <div className="dash-card-header">
          <h4>
            Schedule
            {selectedDate && (
              <span style={{ fontWeight: 500, fontSize: 10.5, marginLeft: 6, color: "var(--ink-muted)" }}>
                {selectedDate.toLocaleDateString("en-GB", DATE_FORMAT)}
              </span>
            )}
          </h4>
        </div>
        <div className="dash-schedChips">
          {SCHEDULE_TYPE_FILTERS.map((f) => (
            <button type="button" key={f.value}
              className={`ac-pill ac-pill--sm ${scheduleTypeFilter === f.value ? "is-active" : ""}`}
              onClick={() => setScheduleTypeFilter(f.value)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="dash-card-body">
          <div className="dash-list">
            {filteredSchedule.length === 0 && <p>Nothing scheduled</p>}
            {filteredSchedule.map((item) => (
              <ScheduleRow key={item.id} item={item} onClick={() => { if (item.link) navigate(item.link); }} />
            ))}
          </div>
        </div>
      </div>

      <BatchProgressSummary />

      </div>{/* /dash-col--rail */}
      </div>{/* /dash-grid */}

    </div>
  );
}
