// ============================================================
// TEACHER — src/pages/TeacherDashboard.jsx  (FULL REPLACEMENT)
// ============================================================

import { useState, useEffect, useMemo } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import "../styles/dashboard.css";
import { useAuth } from "../contexts/AuthContext";

import LiveSessionCard  from "../components/LiveSessionCard";
import CalendarWidget   from "../components/CalendarWidget";
import AssignmentItem   from "../components/AssignmentItem";
import ActivityItem     from "../components/ActivityItem";

import api from "../api/apiClient";
import useNotificationSocket from "../hooks/useNotificationSocket";

const NOTIFICATION_LABELS = {
  ASSIGNMENT: "Assignment",
  SESSION:    "Live Session",
  QUIZ:       "Quiz",
  SUBMISSION: "Submission",
};

const NOTIFICATION_COLORS = {
  ASSIGNMENT: "green",
  SESSION:    "yellow",
  QUIZ:       "purple",
  SUBMISSION: "blue",
};

const DATE_FORMAT = { day: "2-digit", month: "short", year: "numeric" };

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-GB", DATE_FORMAT);
}

function toDateKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function TeacherDashboard() {
  const outletContext = useOutletContext();
  const active        = outletContext?.active || "sessions";
  const navigate      = useNavigate();
  const { teacherInfo } = useAuth();
  const isBoth = teacherInfo?.type === "BOTH";

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const [assignFilter, setAssignFilter]           = useState(null);
  const [activityFilter, setActivityFilter]       = useState("all");
  const [selectedDate, setSelectedDate]           = useState(null);
  const [scheduleTypeFilter, setScheduleTypeFilter] = useState("all");

  // Notification hook — live WS notifications + markOneRead
  const { notifications: liveNotifications, markOneRead } = useNotificationSocket();

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await api.get("/dashboard/");
        setData(res.data);
      } catch (err) {
        console.error("Dashboard error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetch_();
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const sessions        = data?.sessions         ?? [];
  const allSessions     = data?.all_sessions     ?? sessions;
  const assignments     = data?.assignments      ?? [];
  const quizzes         = data?.quizzes          ?? [];
  const privateSessions = data?.private_sessions ?? [];
  const apiNotifications = data?.notifications ?? [];

  // Merge live WS notifications with REST API ones, deduped by id.
  // Live ones come first so new private session events appear instantly.
  const notifications = (() => {
    const seen = new Set();
    const merged = [];
    for (const n of [...liveNotifications, ...apiNotifications]) {
      const key = n.id || JSON.stringify(n);
      if (!seen.has(key)) { seen.add(key); merged.push(n); }
    }
    return merged;
  })();

  // Calendar events — FIX: live sessions now included
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
      add(a.due, new Date(a.due) < now ? "assignment-overdue" : "assignment")
    );
    quizzes.forEach((q) =>
      add(q.due, new Date(q.due) < now ? "quiz-overdue" : "quiz")
    );
    privateSessions.forEach((ps) => add(ps.date, "private-session"));
    allSessions.forEach((s)     => add(s.dateTime, "live-session")); // FIX
    return map;
  }, [assignments, quizzes, privateSessions, allSessions]);

  // Unified schedule
  const scheduleItems = useMemo(() => {
    const items = [];
    allSessions.forEach((s) =>
      items.push({
        id:         `session-${s.id}`,
        type:       "live-session",
        title:      `${s.subject} - ${s.topic}`,
        date:       s.dateTime,
        labelColor: "yellow",
        link:       `/teacher/live/${s.id}`,
      })
    );
    assignments.forEach((a) =>
      items.push({
        id:         `assignment-${a.id}`,
        type:       "assignment",
        title:      a.title,
        date:       a.due,
        labelColor: new Date(a.due) < new Date() ? "red" : "green",
        link:       a.subject_id ? `/teacher/classes/${a.subject_id}/assignments` : null,
      })
    );
    quizzes.forEach((q) =>
      items.push({
        id:         `quiz-${q.id}`,
        type:       "quiz",
        title:      q.title,
        date:       q.due,
        labelColor: new Date(q.due) < new Date() ? "red" : "purple",
        link:       q.subject_id ? `/teacher/classes/${q.subject_id}/quizzes` : null,
      })
    );
    privateSessions.forEach((ps) =>
      items.push({
        id:         `private-${ps.id}`,
        type:       "private-session",
        title:      `${ps.subject} (${ps.student})`,
        date:       ps.date,
        labelColor: "orange",
        link:       `/teacher/private-sessions/scheduled/${ps.id}`,
      })
    );
    items.sort((a, b) => new Date(a.date) - new Date(b.date));
    return items;
  }, [allSessions, assignments, quizzes, privateSessions]);

  if (loading) return <div className="dashboard">Loading...</div>;

  const toggleFilter = (current, value, setter) =>
    setter(current === value ? null : value);

  const filteredAssignments = assignFilter
    ? assignments.filter((a) =>
        assignFilter === "overdue"
          ? new Date(a.due) < new Date()
          : new Date(a.due) >= new Date()
      )
    : assignments;

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

  // ── MOBILE ────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="dashboard">
        {active === "sessions" && (
          <div className="dash-card">
            <h4>Upcoming Live Sessions</h4>
            {sessions.length === 0 && <p>No sessions</p>}
            {sessions.map((s) => (
              <LiveSessionCard
                key={s.id}
                subject={s.subject}
                topic={s.topic}
                timing={new Date(s.dateTime).toLocaleString("en-GB", {
                  day: "2-digit", month: "short", year: "numeric",
                  hour: "2-digit", minute: "2-digit", hour12: true,
                })}
              />
            ))}
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

        {/* FIX: quizzes case was missing — tab showed blank */}
        {active === "quizzes" && (
          <div className="dash-card">
            <h4>Quizzes</h4>
            {quizzes.length === 0 && <p>No quizzes</p>}
            {quizzes.map((q) => (
              <AssignmentItem key={q.id} id={q.id} title={q.title}
                subject={q.subject_name} dueDate={formatDate(q.due)}
                subjectId={q.subject_id} />
            ))}
          </div>
        )}

        {active === "notifications" && (
          <div className="dash-card">
            <h4>Notifications</h4>
            {filteredActivities.length === 0 && <p>No notifications</p>}
            {filteredActivities.map((item) => (
              <ActivityItem
                key={item.id}
                notification={item}
                onRead={markOneRead}
              />
            ))}
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

  // ── DESKTOP ───────────────────────────────────────────────
  return (
    <div className="dashboard">

      {/* Dashboard type switcher — only visible for TYPE_BOTH teachers */}
      {isBoth && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          marginBottom: 18, padding: "10px 16px",
          background: "#f9fafb", border: "1px solid #e5e7eb",
          borderRadius: 14,
        }}>
          <span style={{ fontSize: 12.5, color: "#6b7280", fontWeight: 600, marginRight: 4 }}>
            Dashboard:
          </span>
          {/* Academic is active here */}
          <button style={{
            padding: "6px 16px", borderRadius: 9, fontSize: 12.5, fontWeight: 700,
            background: "#125027", color: "#fff",
            border: "1.5px solid #125027", cursor: "default",
          }}>
            📚 Academic
          </button>
          <button
            onClick={() => navigate("/teacher/expert")}
            style={{
              padding: "6px 16px", borderRadius: 9, fontSize: 12.5, fontWeight: 700,
              background: "transparent", color: "#125027",
              border: "1.5px solid rgba(9,62,5,.2)", cursor: "pointer",
              transition: ".15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(18,80,39,.06)"; e.currentTarget.style.borderColor = "#1b9c85"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(9,62,5,.2)"; }}
          >
            🎯 Skills (Expert)
          </button>
        </div>
      )}

      {/* Row 1: Live Sessions */}
      <div className="dash-live-section">
        <div className="dash-live-header">
          <h3 className="dash-section-title">Upcoming Live Sessions</h3>
          <div className="dash-remaining">{sessions.length} Remaining</div>
        </div>
        <div className="dash-live-row">
          {sessions.length === 0 && <p>No sessions today</p>}
          {sessions.map((s) => (
            <LiveSessionCard
              key={s.id}
              subject={s.subject}
              topic={s.topic}
              startsIn={s.startsIn}
              timing={s.timing || new Date(s.dateTime).toLocaleString("en-GB", {
                day: "2-digit", month: "short", year: "numeric",
                hour: "2-digit", minute: "2-digit", hour12: true,
              })}
            />
          ))}
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

      {/* FIX: Quizzes card — was missing on desktop */}
      <div className="dash-card">
        <div className="dash-card-header">
          <h4>Quizzes</h4>
        </div>
        <div className="dash-card-body">
          {quizzes.length === 0 && <p>No quizzes</p>}
          {quizzes.map((q) => (
            <AssignmentItem key={q.id} id={q.id} title={q.title}
              subject={q.subject_name} dueDate={formatDate(q.due)}
              subjectId={q.subject_id} />
          ))}
        </div>
      </div>

      {/* Notifications — FIX: uses notification prop for expand support */}
      <div className="dash-card">
        <div className="dash-card-header">
          <h4>Notifications</h4>
          <select className="dash-filter" value={activityFilter}
            onChange={(e) => setActivityFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="ASSIGNMENT">Assignment</option>
            <option value="SESSION">Live Session</option>
            <option value="QUIZ">Quiz</option>
            <option value="SUBMISSION">Submissions</option>
          </select>
        </div>
        <div className="dash-card-body">
          {filteredActivities.length === 0 && <p>No notifications</p>}
          {filteredActivities.map((item) => (
            <ActivityItem
              key={item.id}
              notification={item}
              onRead={markOneRead}
            />
          ))}
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
