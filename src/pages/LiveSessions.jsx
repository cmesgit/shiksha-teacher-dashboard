import { useNavigate, useParams } from "react-router-dom";
import { Fragment, useEffect, useState, useCallback, useRef, useMemo } from "react";
import { IoChevronBack } from "react-icons/io5";
import { FiMoreHorizontal } from "react-icons/fi";
import api from "../api/apiClient";
import "../styles/academyScreens.css";
import "../styles/liveSessions.css";
import { LoadingState, EmptyState, ErrorState } from "../components/StateViews";
import { useToast } from "../contexts/ToastContext";
import { subjectChipPalette } from "../utils/subjectChips";
import { fmtClockTime, dayLabel, startsInText } from "../utils/sessionTime";
import AcademyRail from "../components/academy/AcademyRail";
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
// or dedicated-pill treatment instead.
//
// These six values used to be literal hexes that happened to equal
// --warning/--info/--danger and their -soft pairs, which broke the app's
// no-raw-hex rule and, more concretely, meant this screen did not follow the
// dark theme: the tokens flip, the literals did not.
const STATUS_CONFIG = {
  PAUSED: { label: "Paused", color: "var(--warning)", bg: "var(--warning-soft)" },
  RECONNECTING: { label: "Reconnecting", color: "var(--warning)", bg: "var(--warning-soft)" },
  WAITING_FOR_TEACHER: { label: "Starting soon", color: "var(--info)", bg: "var(--info-soft)" },
  CANCELLED: { label: "Cancelled", color: "var(--danger)", bg: "var(--danger-soft)" },
};

function LiveSessionRow({ session, tick, onStart, onOpenRecording, onOpenNotes, onOpenDetail, onEdit, onCancel, onEnd, menuOpen, onToggleMenu }) {
  void tick;

  const status = session.computed_status;
  const start = new Date(session.start_time);
  const chip = subjectChipPalette(session.subject_name || session.subject_id);
  // Course AND batch, not one-or-the-other: when a batch existed the course
  // vanished, so two same-subject rows from different courses were identical.
  const batchLine = [
    session.course_name,
    session.batch_name
      ? `${session.batch_name}${session.batch_student_count != null ? ` · ${session.batch_student_count} students` : ""}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

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
  const { showToast } = useToast();

  const [sessions, setSessions] = useState([]);
  // Rail only: which past sessions already have a recording. Its own request
  // because no session field answers this — the join lives on the recording
  // (SessionRecording.live_session), not the session. `null` means "not
  // answered yet or the call failed", which the rail renders as an honest
  // unknown rather than as "nothing to upload".
  const [recordedSessionIds, setRecordedSessionIds] = useState(null);
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

  // Deliberately NOT folded into fetchSessions: the list must render even if
  // this 403s or the teacher has no recordings yet. A rail card is not worth
  // failing the screen for.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/courses/teacher/recordings/all/");
        const rows = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        if (cancelled) return;
        setRecordedSessionIds(
          new Set(rows.map((r) => r.live_session).filter(Boolean).map(String))
        );
      } catch (err) {
        console.error("Failed to load recordings for the rail:", err);
        if (!cancelled) setRecordedSessionIds(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
      showToast({ type: "error", message: err.response?.data?.detail || "Failed to cancel session." });
    }
  };

  const handleEnd = async (sessionId) => {
    if (!window.confirm("End this session permanently? Students will be disconnected.")) return;
    try {
      await api.post(`/livestream/sessions/${sessionId}/end/`);
    } catch (err) {
      console.error("Failed to end session:", err);
      const msg = err.response?.data?.detail || "";
      if (msg && msg !== "Session already completed.") showToast({ type: "error", message: msg });
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
  // Unfiltered, for the tab badge — see the Past button below.
  const pastTotal = sessions.filter((s) => !UPCOMING_STATUSES.has(s.computed_status)).length;

  // ── Day grouping ────────────────────────────────────────────────────────
  // The design groups rows under Today / Tomorrow / Later this week. The row
  // itself already shows a per-row day via dayLabel(), but that emits "Tmrw"
  // and a bare weekday — fine inside a dense row, wrong as a section heading,
  // so the headings get their own full-word vocabulary rather than reusing it.
  //
  // Grouping follows the ACTIVE SORT rather than imposing a date order:
  // upcomingRows is sorted by status first (live sessions float to the top),
  // so re-sorting by day here would silently move a live session below a
  // scheduled one. Groups are therefore emitted in first-appearance order.
  const dayGroups = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const headingFor = (dt) => {
      const d0 = new Date(dt);
      d0.setHours(0, 0, 0, 0);
      const diff = Math.round((d0 - startOfToday) / 86400000);
      if (diff === 0) return "Today";
      if (diff === 1) return "Tomorrow";
      if (diff === -1) return "Yesterday";
      if (diff > 1 && diff <= 7) return "Later this week";
      if (diff < -1 && diff >= -7) return "Earlier this week";
      return dt.toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric",
      });
    };

    const order = [];
    const byHeading = new Map();
    for (const s of rows) {
      const dt = new Date(s.start_time);
      const key = Number.isNaN(dt.getTime()) ? "Scheduled" : headingFor(dt);
      if (!byHeading.has(key)) { byHeading.set(key, []); order.push(key); }
      byHeading.get(key).push(s);
    }
    return order.map((label) => ({ label, items: byHeading.get(label) }));
  }, [rows]);

  // ── Right rail ──────────────────────────────────────────────────────────
  // Spec: Academy Lists.dc.html, role=teacher screen=live — "Next class",
  // "This week", "Recordings to upload". All three are derived from data this
  // screen already has; none needed a new endpoint.
  //
  // The design's third "This week" stat is "Average attendance 93%".
  // ATTENDANCE DOES NOT EXIST in this backend — no model, field, endpoint or
  // aggregate — so it renders as an explicit unknown instead of a number.
  // LiveSessionAttendance is LiveKit room-presence telemetry for one call,
  // not a roll-call, and has no denominator or "attended" threshold.
  const railItems = useMemo(() => {
    const now = Date.now();

    // Monday-start week, matching how the teacher UIs elsewhere talk about
    // "this week".
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const inThisWeek = (s) => {
      const t = new Date(s.start_time).getTime();
      return t >= weekStart.getTime() && t < weekEnd.getTime();
    };

    // ── 1. Next class / Live now ──
    const next = upcomingRows[0];
    let callout = null;
    if (next) {
      const isLive = next.computed_status === "LIVE";
      const students = next.batch_student_count;
      const where = next.batch_name || next.course_name || "This class";
      const parts = [];
      if (next.title) parts.push(next.title);
      if (typeof students === "number") {
        parts.push(`${students} student${students === 1 ? "" : "s"} ${next.batch_name ? "are in this batch" : "are enrolled"}`);
      }
      // startsInText() returns a bare phrase — "in 25 min", or "in progress"
      // once the start time has passed — so the verb belongs here. Printing it
      // raw gave "Class 11 Science — Demo Course in progress", which reads as
      // a missing word rather than a status.
      const startedAt = new Date(next.start_time);
      const overdue = startedAt.getTime() <= now;
      callout = {
        kind: "callout",
        tone: isLive ? "teal" : "info",
        kicker: isLive ? "Live now" : "Next class",
        title: isLive
          ? `${where} is live`
          : overdue
            // Scheduled, its slot has arrived, nobody has started it. Naming
            // the time is more use than "in progress", which it is not.
            ? `${where} was due at ${fmtClockTime(startedAt)}`
            : `${where} starts ${startsInText(startedAt)}`,
        // Same honesty note the v2 dashboard hero carries: the design puts
        // "Start class" on a session 25 minutes out, and pressing it opens a
        // room no student can enter yet.
        text:
          parts.join(". ") + (parts.length ? "." : "") +
          (!isLive && !overdue && startedAt.getTime() - now > 15 * 60000
            ? " Opening the room now won’t let students in — they can join from 15 minutes before the start time."
            : ""),
        btn: {
          label: isLive ? "Join class" : "Start class",
          onClick: () => handleStart(next),
          // NOT gated on the start time. teacherCanJoin() deliberately has no
          // start-time rule — a teacher may open the room whenever they like;
          // it only refuses a cancelled session or an expired teacher_left_at
          // grace window. T−15m is the rule for STUDENTS being admitted, which
          // is a different claim, and the note below is where that gets said.
          disabled: !next.can_join,
        },
      };
    }

    // ── 2. This week ──
    const weekSessions = sessions.filter(
      (s) => inThisWeek(s) && s.computed_status !== "CANCELLED"
    );
    const taught = weekSessions.filter((s) => s.computed_status === "COMPLETED").length;
    const thisWeek = {
      kind: "card",
      title: "This week",
      kv: [
        { k: "Sessions scheduled", v: String(weekSessions.length) },
        { k: "Taught so far", v: String(taught) },
        {
          k: "Average attendance",
          unavailable: true,
          reason: "Attendance isn't tracked yet, so this can't be calculated.",
        },
      ],
    };

    // ── 3. Recordings to upload ──
    // A past session with no SessionRecording pointing at it. Unknown until
    // the recordings call lands — and an unknown must not render as "all
    // caught up", which is the opposite claim.
    const endedWithoutRecording =
      recordedSessionIds === null
        ? null
        : sessions
            .filter((s) => s.computed_status === "COMPLETED")
            .filter((s) => !recordedSessionIds.has(String(s.id)))
            .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))
            .slice(0, 4);

    const initials = (s) =>
      (s.batch_name || s.subject_name || "?")
        .replace(/[^A-Za-z0-9 ]/g, " ")
        .split(/\s+/).filter(Boolean).slice(0, 2)
        .map((w) => w[0].toUpperCase()).join("") || "?";

    const toUpload = {
      kind: "card",
      title: "Recordings to upload",
      rows: (endedWithoutRecording || []).map((s) => ({
        key: s.id,
        lead: initials(s),
        title: s.title,
        sub: `${dayLabel(new Date(s.start_time))} ${fmtClockTime(new Date(s.start_time))} · no recording yet`,
        action: {
          label: "Upload",
          // UploadRecording reads its prefill from router state, not the
          // query string, and passes live_session_id through to the save
          // call — so the recording lands attached to this session.
          onClick: () => navigate(
            `/teacher/classes/${s.subject_id}/session-recordings/upload`,
            { state: { live_session_id: s.id, title: s.title } },
          ),
        },
      })),
      empty: endedWithoutRecording === null
        ? "Couldn't check which sessions have recordings."
        : "Every finished session has a recording.",
    };

    return [callout, thisWeek, toUpload];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, upcomingRows, recordedSessionIds, tick, navigate]);

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
              <span className="liveSessionsTabs__count">{upcomingRows.length}</span>
            </button>
            <button
              type="button"
              className={`liveSessionsTabs__btn${tab === "past" ? " is-active" : ""}`}
              onClick={() => setTab("past")}
            >
              Past
              {/* The PAST count is deliberately the UNFILTERED total. pastRows
                  has the search term applied, so using it would make the tab
                  label count down as the teacher types — a tab count answers
                  "how much is in here", not "how much matches". */}
              <span className="liveSessionsTabs__count">{pastTotal}</span>
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

      <div className="ac-railLayout">
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
            {dayGroups.map((group) => (
              <Fragment key={group.label}>
                {/* One group means the heading says nothing the list doesn't
                    already — skip it rather than print a lone "Today". */}
                {dayGroups.length > 1 && (
                  <div className="liveSessionsList__dayHead">
                    <span>{group.label}</span>
                    <span className="liveSessionsList__dayCount">{group.items.length}</span>
                  </div>
                )}
                {group.items.map((s) => (
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
              </Fragment>
            ))}
          </div>
        )}
      </section>

      {/* The rail is derived from the SAME `sessions` array the list uses, so
          it stays correct on a WS update without its own refetch. It is
          suppressed on the Past tab: every card answers a question about what
          is coming up or still owed, which a historical view does not ask. */}
      {tab === "upcoming" && <AcademyRail items={railItems} />}
      </div>

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
