import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState, useCallback, useRef } from "react";
import { IoChevronBack } from "react-icons/io5";
import { FiMoreHorizontal } from "react-icons/fi";
import api from "../api/apiClient";
import "../styles/academyScreens.css";
import "../styles/liveSessions.css";
import { LoadingState, EmptyState, ErrorState } from "../components/StateViews";
import { subjectChipPalette } from "../utils/subjectChips";
import { fmtClockTime, dayLabel, startsInText } from "../utils/sessionTime";
import ScheduleSessionModal from "../components/live/ScheduleSessionModal";
import NotesViewModal from "../components/live/NotesViewModal";

const WS_HOST = import.meta.env.VITE_WS_HOST || "api.shikshacom.com";

function getLiveDuration(startTime) {
  const diffMinutes = Math.floor((Date.now() - new Date(startTime).getTime()) / 60000);
  if (diffMinutes < 60) return `${diffMinutes} min live`;
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  return `${hours}h ${mins}m live`;
}

// The WS broadcast's `can_join` is computed outside any DRF request, so its
// `request.user.has_role("TEACHER")` branch never fires there — the pushed
// value always falls through to the generic student -15min timing rule.
// Teachers need their own rule: not cancelled, and no expired teacher_left_at
// grace window (no start-time gate — a teacher can join anytime).
function teacherCanJoin(session) {
  if (session.status === "CANCELLED") return false;
  if (session.teacher_left_at) {
    const mins = (Date.now() - new Date(session.teacher_left_at).getTime()) / 60000;
    if (mins > 60) return false;
  }
  return true;
}

function normalizeSession(session) {
  return { ...session, can_join: teacherCanJoin(session) };
}

const UPCOMING_STATUSES = new Set([
  "LIVE",
  "PAUSED",
  "RECONNECTING",
  "SCHEDULED",
  "WAITING_FOR_TEACHER",
]);

// Only the statuses actually rendered through the pill branch below (see
// LiveSessionRow) — SCHEDULED/LIVE/COMPLETED each get their own plain-text
// or dedicated-pill treatment instead. Colors are the design spec's semantic
// tokens (mirrors the same mapping on the student side).
const STATUS_CONFIG = {
  PAUSED: { label: "Paused", color: "#c2701c", bg: "#fef3ec" },
  RECONNECTING: { label: "Reconnecting", color: "#c2701c", bg: "#fef3ec" },
  WAITING_FOR_TEACHER: { label: "Starting soon", color: "#1d4ed8", bg: "#e8edfb" },
  CANCELLED: { label: "Cancelled", color: "#dc2626", bg: "#fef2f2" },
};

function LiveSessionRow({ session, tick, onStart, onOpenRecording, onOpenNotes, onOpenDetail, onEdit, onCancel, onEnd, menuOpen, onToggleMenu }) {
  void tick;

  const status = session.computed_status;
  const start = new Date(session.start_time);
  const chip = subjectChipPalette(session.subject_name || session.subject_id);
  const batchLine = session.batch_name
    ? `${session.batch_name}${session.batch_student_count != null ? ` · ${session.batch_student_count} students` : ""}`
    : session.course_name;

  let metaNode;
  if (status === "SCHEDULED") {
    metaNode = <span className="liveSessionRow__meta-text">starts {startsInText(start)}</span>;
  } else if (status === "LIVE") {
    metaNode = (
      <span className="liveSessionRow__statusPill liveSessionRow__statusPill--live">
        Live now · {getLiveDuration(session.start_time)}
      </span>
    );
  } else if (status === "COMPLETED") {
    metaNode = <span className="liveSessionRow__meta-text">ended</span>;
  } else {
    const cfg = STATUS_CONFIG[status];
    metaNode = (
      <span className="liveSessionRow__statusPill" style={{ background: cfg.bg, color: cfg.color }}>
        {cfg.label}
      </span>
    );
  }

  const canManage = ["SCHEDULED", "WAITING_FOR_TEACHER", "LIVE", "PAUSED", "RECONNECTING"].includes(status);
  const isLive = ["LIVE", "PAUSED", "RECONNECTING"].includes(status);
  // Mirrors the backend's own reschedule gate (livestream/views.py
  // reschedule_live_session): only while still SCHEDULED — once a session is
  // waiting/live/paused it's effectively already started, so editing its
  // time no longer makes sense.
  const canEdit = status === "SCHEDULED";

  return (
    <div
      className="liveSessionRow"
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetail(session)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenDetail(session); } }}
    >
      <div className="liveSessionRow__time">
        <strong>{fmtClockTime(start)}</strong>
        <span className="liveSessionRow__day">{dayLabel(start)}</span>
      </div>
      <div className="liveSessionRow__divider" />
      <div className="liveSessionRow__body">
        <div className="liveSessionRow__metaRow">
          <span className="liveSessionRow__chip" style={{ background: chip.bg, color: chip.ink }}>
            {session.subject_name}
          </span>
          {metaNode}
        </div>
        <div className="liveSessionRow__topic">{session.title}</div>
        <div className="liveSessionRow__teacher">{batchLine}</div>
      </div>

      {/* The design's row carries ONE visible action (dc.html's Live Sessions
          row template). Cancel/End/Edit/Notes sit behind the overflow menu,
          reusing the same .ac-menuWrap "Manage" pattern Assignments already
          uses for the same reason. Row click (above) opens the detail page;
          stopPropagation here keeps that from also firing on every button. */}
      <div className="liveSessionRow__actions" onClick={(e) => e.stopPropagation()}>
        {status === "COMPLETED" ? (
          <button
            type="button"
            className="liveSessionRow__btn liveSessionRow__btn--outline"
            onClick={() => onOpenRecording(session)}
          >
            Recording
          </button>
        ) : status === "CANCELLED" ? (
          <button type="button" className="liveSessionRow__btn liveSessionRow__btn--outline" disabled>
            Cancelled
          </button>
        ) : (
          <button
            type="button"
            className="liveSessionRow__btn liveSessionRow__btn--primary"
            disabled={!session.can_join}
            onClick={() => onStart(session)}
          >
            Start
          </button>
        )}

        {(canManage || status === "COMPLETED") && (
          <div className="ac-menuWrap">
            <button
              type="button"
              className="ac-btn ac-btn--icon"
              aria-label="More actions"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => onToggleMenu(session.id)}
            >
              <FiMoreHorizontal size={13} aria-hidden="true" />
            </button>
            {menuOpen && (
              <div className="ac-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className="ac-menu__item"
                  onClick={() => { onToggleMenu(null); onOpenDetail(session); }}
                >
                  View details
                </button>
                {canEdit && (
                  <button
                    type="button"
                    role="menuitem"
                    className="ac-menu__item"
                    onClick={() => { onToggleMenu(null); onEdit(session); }}
                  >
                    Edit / reschedule
                  </button>
                )}
                {canManage && (
                  <button
                    type="button"
                    role="menuitem"
                    className="ac-menu__item ac-menu__item--danger"
                    onClick={() => { onToggleMenu(null); (isLive ? onEnd(session.id) : onCancel(session.id)); }}
                  >
                    {isLive ? "End session" : "Cancel session"}
                  </button>
                )}
                {status === "COMPLETED" && (
                  <button
                    type="button"
                    role="menuitem"
                    className="ac-menu__item"
                    onClick={() => { onToggleMenu(null); onOpenNotes(session); }}
                  >
                    Notes
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LiveSessions() {
  const navigate = useNavigate();
  const { subjectId } = useParams();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("upcoming");
  const [pastSearch, setPastSearch] = useState("");
  const [pastSort, setPastSort] = useState("newest");
  const [tick, setTick] = useState(0);
  const [showSchedule, setShowSchedule] = useState(false);
  const [editSession, setEditSession] = useState(null);
  const [notesSession, setNotesSession] = useState(null);
  const [rowMenu, setRowMenu] = useState(null);
  const wsRefs = useRef([]);

  const toggleRowMenu = (id) => setRowMenu((prev) => (id === null ? null : (prev === id ? null : id)));

  // A row's overflow menu closes on outside click or Escape — same pattern
  // Assignments.jsx uses for its own .ac-menuWrap.
  useEffect(() => {
    if (!rowMenu) return;
    const onDown = (e) => { if (!e.target.closest?.(".ac-menuWrap")) setRowMenu(null); };
    const onKey = (e) => { if (e.key === "Escape") setRowMenu(null); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [rowMenu]);

  const fetchSessions = useCallback(async () => {
    try {
      setError(null);

      const url = subjectId
        ? `/livestream/teacher/sessions/?subject_id=${subjectId}`
        : `/livestream/teacher/sessions/`;

      const res = await api.get(url);
      const data = Array.isArray(res.data) ? res.data : [];
      setSessions(data.map(normalizeSession));
    } catch (err) {
      console.error(err);
      setError("Failed to load sessions.");
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    fetchSessions();

    // WS updates (below) are primary now; this is just a fallback safety net.
    const interval = setInterval(fetchSessions, 60000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  // Real-time session list updates. Resolve which course(s) this teacher's
  // sessions live under via /courses/teacher/my-classes/ (no new endpoint —
  // already used elsewhere, e.g. ClassPickerLanding.jsx), then open one
  // socket per distinct course: a teacher can teach across multiple courses,
  // and the per-subject route (:subjectId) still only needs its one course.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      let courseIds = [];
      let allowedSubjectIds = null;

      try {
        const res = await api.get("/courses/teacher/my-classes/");
        const classes = Array.isArray(res.data) ? res.data : [];

        if (subjectId) {
          const mine = classes.find((c) => String(c.subject_id) === String(subjectId));
          if (mine) courseIds = [mine.course_id];
          allowedSubjectIds = new Set([String(subjectId)]);
        } else {
          courseIds = [...new Set(classes.map((c) => c.course_id))];
          allowedSubjectIds = new Set(classes.map((c) => String(c.subject_id)));
        }
      } catch (err) {
        console.error("Failed to resolve course ids for live updates:", err);
        return;
      }

      if (cancelled || courseIds.length === 0) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";

      wsRefs.current = courseIds.map((courseId) => {
        const ws = new WebSocket(`${protocol}//${WS_HOST}/ws/course-sessions/${courseId}/`);
        ws.onmessage = (e) => {
          let msg;
          try { msg = JSON.parse(e.data); } catch { return; }
          if (msg.type !== "session_list_update") return;

          const updated = msg.data;
          if (allowedSubjectIds && !allowedSubjectIds.has(String(updated.subject_id))) return;

          const normalized = normalizeSession(updated);
          setSessions((prev) => {
            const exists = prev.find((s) => s.id === normalized.id);
            if (!exists) return [...prev, normalized];
            return prev.map((s) => (s.id === normalized.id ? { ...s, ...normalized } : s));
          });
        };
        ws.onerror = () => {};
        return ws;
      });
    })();

    return () => {
      cancelled = true;
      wsRefs.current.forEach((ws) => ws.close());
      wsRefs.current = [];
    };
  }, [subjectId]);

  // Forces a re-render every minute so live-duration/relative-time text stays current.
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const handleCancel = async (sessionId) => {
    if (!window.confirm("Are you sure you want to cancel this session?")) return;
    try {
      await api.post(`/livestream/sessions/${sessionId}/cancel/`);
      fetchSessions();
    } catch (err) {
      console.error("Failed to cancel session:", err);
      alert(err.response?.data?.detail || "Failed to cancel session.");
    }
  };

  const handleEnd = async (sessionId) => {
    if (!window.confirm("End this session permanently? Students will be disconnected.")) return;
    try {
      await api.post(`/livestream/sessions/${sessionId}/end/`);
    } catch (err) {
      console.error("Failed to end session:", err);
      const msg = err.response?.data?.detail || "";
      if (msg && msg !== "Session already completed.") alert(msg);
    } finally {
      fetchSessions();
    }
  };

  const handleStart = (session) => {
    if (!session.can_join) return;
    navigate(`/teacher/live/${session.id}`);
  };

  const handleOpenRecording = (session) => {
    navigate(`/teacher/classes/${session.subject_id}/session-recordings`);
  };

  const handleOpenNotes = (session) => setNotesSession(session);

  const handleOpenDetail = (session) => navigate(`/teacher/live-sessions/${session.id}/detail`);

  const handleScheduled = () => {
    setShowSchedule(false);
    setEditSession(null);
    // The create/reschedule endpoints' responses are minimal; the WS
    // broadcast they trigger will normally update `sessions` on its own —
    // this is just a fallback in case that message is delayed.
    fetchSessions();
  };

  const statusPriority = {
    LIVE: 1, WAITING_FOR_TEACHER: 2, RECONNECTING: 2, PAUSED: 2, SCHEDULED: 3,
  };

  const upcomingRows = sessions
    .filter((s) => UPCOMING_STATUSES.has(s.computed_status))
    .sort((a, b) => {
      const diff = (statusPriority[a.computed_status] ?? 99) - (statusPriority[b.computed_status] ?? 99);
      if (diff !== 0) return diff;
      return new Date(a.start_time) - new Date(b.start_time);
    });

  const pastRows = sessions
    .filter((s) => !UPCOMING_STATUSES.has(s.computed_status))
    .filter((s) => {
      if (!pastSearch.trim()) return true;
      const term = pastSearch.trim().toLowerCase();
      const haystack = [s.title, s.subject_name, s.batch_name].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(term);
    })
    .sort((a, b) => {
      const diff = new Date(b.start_time) - new Date(a.start_time);
      return pastSort === "newest" ? diff : -diff;
    });

  const rows = tab === "upcoming" ? upcomingRows : pastRows;

  if (loading) return <div className="liveSessionsPage"><LoadingState label="Loading sessions" /></div>;
  if (error) return <div className="liveSessionsPage"><ErrorState message={error} onRetry={fetchSessions} /></div>;

  return (
    <div className="liveSessionsPage">
      {subjectId && (
        <button className="liveSessionsPage__back" onClick={() => navigate(`/teacher/classes/${subjectId}`)}>
          <IoChevronBack /> Back
        </button>
      )}

      <div className="liveSessionsPage__head">
        <div>
          <h1 className="liveSessionsPage__title">Live Sessions</h1>
          <p className="liveSessionsPage__sub">Your scheduled classes across batches.</p>
        </div>
        <div className="liveSessionsPage__controls">
          <button type="button" className="liveSessionsPage__scheduleBtn" onClick={() => setShowSchedule(true)}>
            + Schedule session
          </button>
          <div className="liveSessionsTabs">
            <button
              type="button"
              className={`liveSessionsTabs__btn${tab === "upcoming" ? " is-active" : ""}`}
              onClick={() => setTab("upcoming")}
            >
              Upcoming
            </button>
            <button
              type="button"
              className={`liveSessionsTabs__btn${tab === "past" ? " is-active" : ""}`}
              onClick={() => setTab("past")}
            >
              Past
            </button>
          </div>
        </div>
      </div>

      {tab === "past" && (
        <div className="liveSessionsSearchBar">
          <input
            type="text"
            className="liveSessionsSearchBar__input"
            placeholder="Search past sessions…"
            value={pastSearch}
            onChange={(e) => setPastSearch(e.target.value)}
          />
          <select
            className="liveSessionsSearchBar__sort"
            value={pastSort}
            onChange={(e) => setPastSort(e.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      )}

      <section className="liveSessionsListCard">
        {rows.length === 0 ? (
          <EmptyState
            plain
            icon="video"
            title={
              tab === "past"
                ? pastSearch.trim() ? "No sessions match your search" : "No past sessions yet"
                : "No live sessions scheduled"
            }
            message={
              tab === "past"
                ? "Completed and cancelled sessions will show up here."
                : "Schedule a live session to see it here."
            }
            action={tab === "upcoming" ? { label: "Schedule a live session", onClick: () => setShowSchedule(true) } : undefined}
          />
        ) : (
          <div className="liveSessionsList">
            {rows.map((s) => (
              <LiveSessionRow
                key={s.id}
                session={s}
                tick={tick}
                onStart={handleStart}
                onOpenRecording={handleOpenRecording}
                onOpenNotes={handleOpenNotes}
                onOpenDetail={handleOpenDetail}
                onEdit={setEditSession}
                onCancel={handleCancel}
                onEnd={handleEnd}
                menuOpen={rowMenu === s.id}
                onToggleMenu={toggleRowMenu}
              />
            ))}
          </div>
        )}
      </section>

      {showSchedule && (
        <ScheduleSessionModal
          initialSubjectId={subjectId}
          onClose={() => setShowSchedule(false)}
          onScheduled={handleScheduled}
        />
      )}

      {editSession && (
        <ScheduleSessionModal
          editSession={editSession}
          onClose={() => setEditSession(null)}
          onScheduled={handleScheduled}
        />
      )}

      {notesSession && (
        <NotesViewModal sessionId={notesSession.id} onClose={() => setNotesSession(null)} />
      )}
    </div>
  );
}
