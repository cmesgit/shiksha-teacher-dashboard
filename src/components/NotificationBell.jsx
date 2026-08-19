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
import useNotificationNavigator from "../shared/useNotificationNavigator";

// Landing route per track for the cross-track peek. Unlike the student
// app there is nothing to persist here — the route IS the track, so
// navigating re-scopes the bell on its own.
const TRACK_HOME = {
  academy: "/teacher/dashboard",
  skill: "/teacher/expert/bookings",
};

const TRACK_LABEL = {
  academy: "Academy",
  skill: "Skill Dev",
};

const TYPE_ICONS = {
  ASSIGNMENT:      "📝",
  QUIZ:            "📊",
  SESSION:         "🎥",
  SUBMISSION:      "📬",
  PRIVATE_SESSION: "🔒",
  MATERIAL:        "📚",
};

const TYPE_COLORS = {
  ASSIGNMENT:      "#f59e0b",
  QUIZ:            "#8b5cf6",
  SESSION:         "#ef4444",
  SUBMISSION:      "#2563eb",
  PRIVATE_SESSION: "#015865",
  MATERIAL:        "#0d9488",
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

  // Track comes from the ROUTE, not from teacherInfo.active_track. This app
  // mounts two route-scoped layouts (TeacherLayout / SkillDevLayout behind
  // RequireTrack), so the URL *is* the track. `active_track` is a server
  // field that lags in-app navigation: sitting on /teacher/expert/* with
  // active_track still "academy" used to send "See all" to the Academy
  // inbox. Sourced from the navigator hook so the bell and the Comm Center
  // list can never disagree about which track is live.
  const { openLink, activeTrack } = useNotificationNavigator();
  const isSkillActive = activeTrack === "skill";
  const otherTrack = isSkillActive ? "academy" : "skill";

  const {
    notifications,
    unreadCount,
    crossTrackUnread,
    loading,
    markAllRead,
    markOneRead,
    clearNotifications,
  } = useNotificationSocket({ track: activeTrack });

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

    // notifications-app events (counseling.*, forum.*, ...) carry a
    // link_url. The /counselor/... → /teacher/counsellor/... mapping and
    // the unrecognised-path fallback both live in the navigator hook now,
    // shared with the Comm Center list.
    if (link_url && link_url.startsWith("/")) {
      if (openLink(link_url)) { setOpen(false); return; }
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
      // MATERIAL rows come from the REST feed with no link_url (the
      // ActivitySerializer has no such field), so this branch — not
      // openLink above — is what routes them on a reloaded page.
      else if (type === "MATERIAL")   navigate(`/teacher/classes/${subject_id}/study-materials`);
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
        {/* The badge above is TRACK-SCOPED, so an unread notification in the
            other track produced no signal at all on the closed bell — the
            "N new in <track>" peek inside the dropdown was undiscoverable
            unless you already thought to open it. This dot says "there is
            something in the other track" without faking an in-track count. */}
        {crossTrackUnread > 0 && (
          <span className="notif-bell-crossdot" title={`${crossTrackUnread} new in ${TRACK_LABEL[otherTrack]}`} />
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

          {/* Cross-track peek — the bell is scoped to the track whose
              routes you're on, so without this an Academy faculty member
              who is also a Skill Dev expert would never see a booking
              come in. Navigating re-scopes the bell automatically. */}
          {crossTrackUnread > 0 && (
            <button
              className="notif-bell-crosstrack"
              onClick={() => { setOpen(false); navigate(TRACK_HOME[otherTrack]); }}
            >
              <span className="notif-bell-crosstrack__icon">↪</span>
              {crossTrackUnread} new in {TRACK_LABEL[otherTrack]}
            </button>
          )}

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
