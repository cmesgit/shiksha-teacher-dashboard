// ============================================================
// TEACHER-DASHBOARD — src/components/NotificationBell.jsx
//
// NOTE: this file and the student dashboard's NotificationBell.jsx
// share the same render markup but have INTENTIONALLY DIVERGENT
// click handlers, because the teacher app is mounted under /teacher
// while the student app routes live at root. If you change handler
// behaviour here, mirror the equivalent change in
// shiksha-student-dashboard/src/components/NotificationBell.jsx.
// ============================================================

import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { IoNotificationsOutline, IoNotificationsSharp } from "react-icons/io5";
import useNotificationSocket from "../hooks/useNotificationSocket";
import { useAuth } from "../contexts/AuthContext";

const TYPE_ICONS = {
  ASSIGNMENT:      "📝",
  QUIZ:            "📊",
  SESSION:         "🎥",
  SUBMISSION:      "📬",
  PRIVATE_SESSION: "🔒",
};

const TYPE_COLORS = {
  ASSIGNMENT:      "#f59e0b",
  QUIZ:            "#8b5cf6",
  SESSION:         "#ef4444",
  SUBMISSION:      "#2563eb",
  PRIVATE_SESSION: "#015865",
};

function timeAgo(isoString) {
  if (!isoString) return "";
  const diff = Math.floor((Date.now() - new Date(isoString)) / 1000);
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const { teacherInfo } = useAuth();
  const isSkillActive = teacherInfo?.active_track === "skill";

  const {
    notifications,
    unreadCount,
    loading,
    markAllRead,
    markOneRead,
    clearNotifications,
  } = useNotificationSocket();

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    setOpen((prev) => !prev);
    if (!open && unreadCount > 0) markAllRead();
  };

  const handleNotifClick = (notif) => {
    const { type, subject_id, id, object_id, is_private_session, is_group_session, is_skill_session, link_url } = notif;
    if (id) markOneRead(id);

    // Teacher app is mounted under /teacher — every navigate() must include
    // that prefix or it falls through to the root RedirectToMainLogin and
    // the user lands on a blank page.

    // Chat links are a bare conversation path (/chat/<id>) that doesn't
    // match any route in this app, and don't start with /teacher, so they
    // used to fall into the counsellor-schedule catch-all below. ChatPanel
    // opens a conversation via router state, not a URL param.
    if (link_url) {
      const chatMatch = link_url.match(/^\/chat\/([^/?]+)/);
      if (chatMatch) {
        navigate("/teacher/chat", { state: { conversationId: chatMatch[1] } });
        setOpen(false);
        return;
      }
    }

    // notifications-app events (counseling.*, forum.*, ...) carry a
    // link_url. The backend's counsellor-facing paths are /counselor/...
    // (app-agnostic, no /teacher prefix) — map them into this app's route
    // space. Anything else with a link_url that already looks like a real
    // in-app path (e.g. future /teacher/... or /forum/... verbs) is used
    // as-is; anything unrecognised falls back to the counsellor schedule
    // rather than a dead route.
    if (link_url && link_url.startsWith("/")) {
      const mapped = link_url
        .replace(/^\/counselor\/appointments/, "/teacher/counsellor/appointments")
        .replace(/^\/counselor\/availability/, "/teacher/counsellor/availability")
        .replace(/^\/counselor\/apply/, "/teacher/counsellor")
        .replace(/^\/counselor$/, "/teacher/counsellor");
      navigate(mapped.startsWith("/teacher") ? mapped : "/teacher/counsellor");
      setOpen(false);
      return;
    }

    // Live session (scheduled or "now LIVE") notifications carry the real
    // LiveSession id as object_id — route into the detail page (scoped to
    // the subject when known) instead of the bare list.
    if (type === "SESSION" && !is_group_session && !is_private_session && !is_skill_session && object_id) {
      navigate(
        subject_id
          ? `/teacher/classes/${subject_id}/live-sessions/${object_id}/detail`
          : `/teacher/live-sessions/${object_id}/detail`
      );
      setOpen(false);
      return;
    }

    // Private session: teacher's page is at /teacher/private-sessions.
    if (is_private_session || type === "PRIVATE_SESSION") {
      navigate("/teacher/private-sessions");
      setOpen(false);
      return;
    }

    // Group session notifications come over the wire as type === "SESSION" with
    // the is_group_session flag (set in group_session_views._notify_user). Route
    // them to the Group Sessions page instead of /teacher/live-sessions.
    if (is_group_session) {
      navigate("/teacher/group-sessions");
      setOpen(false);
      return;
    }

    // Skill-Dev (expert 1-on-1) session notifications — confirm/decline/
    // cancel/complete/reschedule all carry this flag. No per-booking detail
    // route exists on this side, so always land on the bookings list.
    if (is_skill_session) {
      navigate("/teacher/expert/bookings");
      setOpen(false);
      return;
    }

    if (subject_id) {
      if (type === "ASSIGNMENT")      navigate(`/teacher/classes/${subject_id}/assignments`);
      else if (type === "QUIZ")       navigate(`/teacher/classes/${subject_id}/quizzes`);
      else if (type === "SUBMISSION") {
        // SUBMISSION carries the PARENT object id in `id`. For an assignment
        // submission that's the assignment id; for a quiz submission it's the
        // quiz id. Backend marks quiz submissions with subtype="quiz_submission"
        // (activity/signals.py:quiz_submitted) so we can route correctly.
        if (notif.subtype === "quiz_submission") {
          navigate(`/teacher/classes/${subject_id}/quizzes`);
        } else if (id) {
          navigate(`/teacher/classes/${subject_id}/assignments/${id}/submissions`);
        } else {
          navigate(`/teacher/classes/${subject_id}/assignments`);
        }
      }
      else if (type === "SESSION")    navigate(`/teacher/classes/${subject_id}/live-sessions`);
      else                            navigate(`/teacher/classes/${subject_id}`);
    } else {
      // No subject_id — always navigate somewhere so the click is never
      // a no-op (avoids the blank-handler equivalent of the original
      // root-redirect bug).
      const fallback = {
        ASSIGNMENT: "/teacher/dashboard",
        QUIZ:       "/teacher/dashboard",
        SUBMISSION: "/teacher/dashboard",
        SESSION:    "/teacher/live-sessions",
      };
      navigate(fallback[type] || "/teacher/dashboard");
    }
    setOpen(false);
  };

  // Derive display type — backend sends SESSION with is_private_session flag
  const getDisplayType = (notif) =>
    notif.is_private_session ? "PRIVATE_SESSION" : notif.type;

  // Skill-Dev bookings are calendar events, not a live video call — reserve
  // 🎥 for actual join-now live/group sessions so the icon matches the event.
  const iconFor = (notif) =>
    notif.is_skill_session ? "📅" : (TYPE_ICONS[getDisplayType(notif)] || "🔔");

  return (
    <div className="notif-bell-wrap" ref={ref}>
      <button className="notif-bell-btn" onClick={handleOpen}>
        {unreadCount > 0 ? (
          <IoNotificationsSharp size={22} color="#f59e0b" />
        ) : (
          <IoNotificationsOutline size={22} />
        )}
        {unreadCount > 0 && (
          <span className="notif-bell-badge">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notif-bell-dropdown">
          <div className="notif-bell-header">
            <span>Notifications</span>
            {notifications.length > 0 && (
              <button className="notif-clear-btn" onClick={clearNotifications}>
                Clear
              </button>
            )}
          </div>

          <div className="notif-bell-list">
            {loading ? (
              <div className="notif-bell-empty">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="notif-bell-empty">No notifications</div>
            ) : (
              notifications.map((notif, i) => {
                const displayType = getDisplayType(notif);
                return (
                  <div
                    key={notif.id || i}
                    className={`notif-bell-item ${!notif.is_read ? "notif-bell-item--unread" : ""}`}
                    onClick={() => handleNotifClick(notif)}
                    style={{
                      borderLeft: `3px solid ${TYPE_COLORS[displayType] || "#6b7280"}`,
                      cursor: "pointer",
                    }}
                  >
                    <span className="notif-bell-icon" style={{ fontSize: 16 }}>
                      {iconFor(notif)}
                    </span>
                    <div className="notif-bell-content">
                      <p className="notif-bell-title">{notif.title}</p>
                      {notif.subject_name && (
                        <p className="notif-bell-subject">{notif.subject_name}</p>
                      )}
                      <p className="notif-bell-time">
                        {timeAgo(notif.created_at)}
                      </p>
                    </div>
                    {!notif.is_read && (
                      <span className="notif-bell-dot" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          <button
            className="notif-bell-seeall"
            onClick={() => {
              setOpen(false);
              navigate(isSkillActive ? "/teacher/expert/inbox?view=notifications" : "/teacher/chat?view=notifications");
            }}
          >
            See all in Communication Center
          </button>
        </div>
      )}
    </div>
  );
}
