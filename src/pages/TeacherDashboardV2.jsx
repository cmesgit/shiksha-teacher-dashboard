// ============================================================
// TEACHER — src/pages/TeacherDashboardV2.jsx
// ============================================================
//
// The Dashboards v2 teacher home. Spec of record:
//   design_handoff_dashboards_v2/README.md  (+ its Reality corrections)
//   source/Dashboard Home.dc.html, role="teacher"
//
// Ships at /teacher/v2 alongside the existing TeacherDashboard so the
// redesign can be reviewed without regressing the live home.
//
// ── Panels and where their data comes from ──────────────────────────────
//   hero   NEXT CLASS ........ /dashboard/ sessions[]   (see the T−15m note)
//   today  merged timeline ... sessions + private_sessions + assignments
//   a      Quick actions ..... routes; each needs a subject — see below
//   b      Grading queue ..... /dashboard/ grading_queue[] + grading_count
//   c      Batch progress .... /courses/teacher/my-batches/
//   d      Attendance ........ DOES NOT EXIST — honest empty state
//   cal    month calendar .... the three date-bearing collections
//
// ── Three things the design gets wrong that this file deliberately does
//    NOT reproduce ─────────────────────────────────────────────────────
//
// 1. "Start class" is not always available. The design draws an unconditional
//    maroon "Start class" on a session 25 minutes out. There is no start
//    endpoint — joining IS starting — and the LIVE flip, actual_started_at
//    and the student "now LIVE" push are all gated to T−15min
//    (livestream/views.py:1420, `in_class_window`); students are refused
//    403 "Too early" before that. So at T−25m that button would put the
//    teacher alone in a room, change no status and notify nobody.
//    sessionCanJoin/sessionActionLabel are carried over verbatim from
//    TeacherDashboard.jsx — they already model this correctly.
//
// 2. "Class 10 A · 28 students" is not a thing. There is no section concept
//    on Batch; prod batches are all named "Batch 2026–27", and TWO prod
//    courses are titled "Class 10" (CBSE and MBSE) so the board is the only
//    tiebreaker. Rows render batch + course + board via batchLine(), never a
//    bare invented section name. batch_student_count is also null for
//    course-wide sessions, which are common — the count is omitted, not
//    guessed.
//
// 3. Attendance (88%, "3 students below 75%") does not exist in any form.
//    See the student file and ATTENDANCE_TRACKING_TODO.md.
//
// Also note the grading queue's own backend bug, which this screen makes more
// visible by promoting the panel: _ungraded_submissions_q (dashboard/views.py
// :423) is subject-level with no batch clause, while the per-object gate is
// batch-aware — so a batch-scoped teacher can see a count that includes rows
// whose Grade button will 403. Fixing that is a backend phase; until then the
// panel footnote says the count spans every batch of the subject.

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/apiClient";
import { useTeacherClasses } from "../contexts/TeacherClassesContext";
import useTheme from "../hooks/useTheme";
import CommandPalette from "../components/CommandPalette";
import "../styles/dashboardV2.css";

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

const EVENT_KINDS = {
  live: { cls: "dv2-dot-live", label: "Live" },
  assignment: { cls: "dv2-dot-assign", label: "Assignment" },
  "assignment-overdue": { cls: "dv2-dot-overdue", label: "Closed" },
  private: { cls: "dv2-dot-private", label: "Private" },
};

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const parseDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const clockTime = (d) =>
  d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true })
    .toUpperCase().replace(" ", "");

function startsIn(d) {
  const mins = Math.round((d.getTime() - Date.now()) / 60000);
  if (mins < 0) return "in progress";
  if (mins < 60) return `starts in ${mins}m`;
  if (mins < 1440) return `starts in ${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `starts ${d.toLocaleDateString("en-GB", { weekday: "short" })}`;
}

function timeAgo(v) {
  const d = parseDate(v);
  if (!d) return "";
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

/* A subject name is not an identity in this catalogue — 33 of 93 live subject
   names span more than one course, and "Mathematics" spans twelve. Anything
   naming a class must carry the course, and the course must carry its board. */
function batchLine(s) {
  const bits = [];
  if (s.batch_name) bits.push(s.batch_name);
  const course = [s.course_title, s.board_name].filter(Boolean).join(" · ");
  if (course) bits.push(course);
  // null for course-wide sessions, which are the common case on prod.
  if (s.batch_student_count != null) {
    bits.push(`${s.batch_student_count} student${s.batch_student_count === 1 ? "" : "s"}`);
  }
  return bits.join(" · ");
}

/* Carried over from TeacherDashboard.jsx verbatim. A session can really be
   cancelled/completed/live, and the teacher can rejoin for an hour after
   leaving — the design's single always-on "Start class" models none of it. */
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

function buildToday(sessions, assignments, privateSessions, now) {
  const items = [];

  for (const s of sessions) {
    const when = parseDate(s.dateTime || s.start_time);
    if (!when || !sameDay(when, now)) continue;
    items.push({
      key: `s-${s.id}`,
      when,
      subject: s.subject,
      kind: s.live ? "Live now" : `Live class · ${startsIn(when)}`,
      title: s.topic,
      sub: batchLine(s),
      action: sessionActionLabel(s),
      disabled: !sessionCanJoin(s),
      primary: true,
      to: `/teacher/live-sessions/${s.id}`,
      live: !!s.live,
    });
  }

  for (const p of privateSessions) {
    const when = parseDate(p.date && p.time ? `${p.date}T${p.time}` : p.date);
    if (!when || !sameDay(when, now)) continue;
    items.push({
      key: `p-${p.id}`,
      when,
      subject: p.subject,
      kind: "Private session",
      title: p.session_type || "Private session",
      sub: p.student || "",
      action: "Details",
      to: `/teacher/private-sessions`,
    });
  }

  for (const a of assignments) {
    const when = parseDate(a.due);
    if (!when || !sameDay(when, now)) continue;
    items.push({
      key: `a-${a.id}`,
      when,
      subject: a.subject_name,
      kind: "Assignment closes",
      title: a.title,
      // The design shows "19 of 28 submitted". The denominator is on neither
      // /dashboard/ nor /assignments/teacher/all/ — it needs a per-assignment
      // roster call. Showing the numerator alone beats inventing a cohort.
      sub: "",
      action: "View",
      to: `/teacher/assignments`,
    });
  }

  return items.sort((x, y) => x.when - y.when);
}

export default function TeacherDashboardV2() {
  const navigate = useNavigate();
  const { classes } = useTeacherClasses();
  const { theme, toggleTheme } = useTheme();

  const [data, setData] = useState(null);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [actionSubject, setActionSubject] = useState("");

  const now = useMemo(() => new Date(), []);
  const abortRef = useRef(null);

  const fetchAll = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError("");
    try {
      const res = await api.get("/dashboard/", { signal: controller.signal });
      setData(res.data);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError("Couldn't load your dashboard.");
      console.error("Failed to load teacher dashboard", err);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }

    // Batch progress is a separate call and must not blank the page if it 404s.
    try {
      const b = await api.get("/courses/teacher/my-batches/", { signal: controller.signal });
      // Shape is { groups: [{ course_id, course_title, board, batches: [...] }],
      // stats: {...} } — NOT a bare array, and the course key is `board`, not
      // `board_name` as it is on the /dashboard/ serializers.
      const flat = [];
      for (const group of b.data?.groups ?? []) {
        for (const batch of group.batches || []) {
          flat.push({ ...batch, courseTitle: group.course_title, board: group.board });
        }
      }
      setBatches(flat);
    } catch {
      if (!controller.signal.aborted) setBatches([]);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    return () => abortRef.current?.abort();
  }, [fetchAll]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.key === "Escape") {
        setPaletteOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const sessions = data?.sessions ?? [];
  const assignments = data?.assignments ?? [];
  const privateSessions = data?.private_sessions ?? [];
  const gradingQueue = data?.grading_queue ?? [];
  const gradingCount = data?.grading_count ?? gradingQueue.length;

  // NEXT CLASS = the live one if there is one, else the soonest still ahead.
  const heroSession = useMemo(() => {
    const live = sessions.find((s) => s.live);
    if (live) return live;
    return [...sessions]
      .map((s) => ({ s, d: parseDate(s.dateTime || s.start_time) }))
      .filter((x) => x.d && x.d >= now && x.s.status !== "CANCELLED")
      .sort((a, b) => a.d - b.d)[0]?.s ?? null;
  }, [sessions, now]);

  const todayItems = useMemo(
    () => buildToday(sessions, assignments, privateSessions, now),
    [sessions, assignments, privateSessions, now]
  );
  const todaySessions = todayItems.filter((i) => i.kind !== "Assignment closes").length;
  const todayDeadlines = todayItems.length - todaySessions;

  const calendar = useMemo(() => {
    const base = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const year = base.getFullYear(), month = base.getMonth();
    const firstDow = (base.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const marks = {};
    const mark = (d, kind) => {
      if (!d || d.getFullYear() !== year || d.getMonth() !== month) return;
      (marks[d.getDate()] ||= new Set()).add(kind);
    };
    sessions.forEach((s) => mark(parseDate(s.dateTime || s.start_time), "live"));
    privateSessions.forEach((p) =>
      mark(parseDate(p.date && p.time ? `${p.date}T${p.time}` : p.date), "private"));
    assignments.forEach((a) => {
      const d = parseDate(a.due);
      mark(d, d && d < now ? "assignment-overdue" : "assignment");
    });
    return { year, month, firstDow, daysInMonth, marks };
  }, [sessions, assignments, privateSessions, monthOffset, now]);

  /* Quick actions are not one-click: three of the four need a :subjectId, and
     "Schedule session" is a MODAL on /teacher/live-sessions, not a route. With
     one class we can go straight there; with several the teacher picks first,
     which is what the existing screens already do. */
  const subjectOptions = useMemo(
    () => (classes || []).map((c) => ({
      id: c.subjectId,
      label: [c.subjectName, c.courseTitle, c.board].filter(Boolean).join(" · "),
    })),
    [classes]
  );
  const chosenSubject = actionSubject || (subjectOptions.length === 1 ? subjectOptions[0].id : "");

  const QUICK_ACTIONS = [
    { label: "Schedule session", to: () => "/teacher/live-sessions", needsSubject: false },
    { label: "Create assignment", to: (s) => `/teacher/classes/${s}/assignments/create`, needsSubject: true },
    { label: "New quiz", to: (s) => `/teacher/quizzes/create/${s}`, needsSubject: true },
    { label: "Upload material", to: (s) => `/teacher/classes/${s}/study-materials/upload`, needsSubject: true },
  ];

  if (loading) return <div className="dv2-screen"><p className="dv2-empty">Loading…</p></div>;

  if (error) {
    return (
      <div className="dv2-screen">
        <div className="dv2-retry">
          <p>{error}</p>
          <button className="dv2-btn dv2-btn-primary" onClick={fetchAll}>Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dv2-screen" data-dv2-role="teacher">
      <header className="dv2-topbar">
        <button
          type="button"
          className="dv2-search"
          onClick={() => setPaletteOpen(true)}
          aria-label="Search classes, assignments, people"
        >
          <span>Search classes, assignments, people</span>
          <kbd>Ctrl K</kbd>
        </button>

        <div className="dv2-topbar-actions">
          <button
            type="button"
            className="dv2-icon-btn"
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            aria-pressed={theme === "dark"}
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </div>
      </header>

      <div className="dv2-grid">
        {/* hero — NEXT CLASS */}
        <section className="dv2-panel dv2-hero" style={{ gridArea: "hero" }}>
          {heroSession ? (() => {
            const when = parseDate(heroSession.dateTime || heroSession.start_time);
            const canJoin = sessionCanJoin(heroSession);
            return (
              <>
                <span className={heroSession.live ? "dv2-live-chip" : "dv2-eyebrow"}>
                  {heroSession.live ? "LIVE NOW" : "NEXT CLASS"}
                </span>
                {when && (
                  <p className="dv2-hero-meta">
                    {heroSession.live ? `In progress, started ${clockTime(when)}` : startsIn(when)}
                  </p>
                )}
                <h2 className="dv2-hero-title">
                  {heroSession.subject} — {heroSession.topic}
                </h2>
                {batchLine(heroSession) && (
                  <p className="dv2-hero-sub">{batchLine(heroSession)}</p>
                )}
                <button
                  className="dv2-btn dv2-btn-primary"
                  disabled={!canJoin}
                  onClick={() => navigate(`/teacher/live-sessions/${heroSession.id}`)}
                >
                  {sessionActionLabel(heroSession)}
                </button>
                {/* The design says "Start class" on a session 25 minutes out.
                    Students cannot join until T−15m and the room does not go
                    LIVE before then, so say what starting early actually does. */}
                {!heroSession.live && when && when.getTime() - Date.now() > 15 * 60000 && (
                  <p className="dv2-footnote">
                    Opening the room now won’t let students in — they can join
                    from 15 minutes before the start time.
                  </p>
                )}
              </>
            );
          })() : (
            <>
              <h2 className="dv2-hero-title">No class scheduled</h2>
              <p className="dv2-hero-sub">Nothing coming up on your timetable.</p>
            </>
          )}
        </section>

        {/* today */}
        <section className="dv2-panel" style={{ gridArea: "today" }}>
          <div className="dv2-panel-head">
            <h3>Today</h3>
            <span className="dv2-panel-meta">
              {todaySessions} {todaySessions === 1 ? "session" : "sessions"} · {todayDeadlines}{" "}
              {todayDeadlines === 1 ? "deadline" : "deadlines"}
            </span>
          </div>

          {todayItems.length === 0 ? (
            <p className="dv2-empty">Nothing scheduled today.</p>
          ) : (
            <ul className="dv2-timeline">
              {todayItems.map((it) => (
                <li key={it.key} className="dv2-tl-row">
                  <time className="dv2-tl-time">{clockTime(it.when)}</time>
                  <div className="dv2-tl-body">
                    <span className="dv2-chip dv2-chip-subject">{it.subject}</span>
                    <span className={`dv2-tl-kind${it.live ? " is-live" : ""}`}>{it.kind}</span>
                    <p className="dv2-tl-title">{it.title}</p>
                    {it.sub && <p className="dv2-tl-person">{it.sub}</p>}
                  </div>
                  <button
                    className={`dv2-btn ${it.primary && !it.disabled ? "dv2-btn-primary" : "dv2-btn-ghost"}`}
                    disabled={it.disabled}
                    onClick={() => navigate(it.to)}
                  >
                    {it.action}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* a — Quick actions */}
        <section className="dv2-panel" style={{ gridArea: "a" }}>
          <div className="dv2-panel-head"><h3>Quick actions</h3></div>

          {subjectOptions.length > 1 && (
            <label className="dv2-field">
              <span>For which class?</span>
              <select
                value={chosenSubject}
                onChange={(e) => setActionSubject(e.target.value)}
              >
                <option value="">Choose a class…</option>
                {subjectOptions.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </label>
          )}

          <div className="dv2-actions">
            {QUICK_ACTIONS.map((qa) => {
              const blocked = qa.needsSubject && !chosenSubject;
              return (
                <button
                  key={qa.label}
                  className="dv2-btn dv2-btn-ghost"
                  disabled={blocked}
                  title={blocked ? "Choose a class first" : undefined}
                  onClick={() => navigate(qa.to(chosenSubject))}
                >
                  {qa.label}
                </button>
              );
            })}
          </div>

          {subjectOptions.length === 0 && (
            <p className="dv2-empty">
              You aren’t assigned to a class yet, so there’s nothing to add content to.
            </p>
          )}
        </section>

        {/* b — Grading queue */}
        <section className="dv2-panel" style={{ gridArea: "b" }}>
          <div className="dv2-panel-head">
            <h3>Grading queue</h3>
            <span className="dv2-panel-meta">{gradingCount} pending</span>
          </div>

          {gradingQueue.length === 0 ? (
            <p className="dv2-empty">Nothing waiting to be graded.</p>
          ) : (
            <>
              <ul className="dv2-list">
                {gradingQueue.map((g) => (
                  <li key={g.id} className="dv2-list-row">
                    <span className="dv2-chip dv2-chip-sq dv2-chip-subject">
                      {(g.student || "?").trim().slice(0, 1).toUpperCase()}
                    </span>
                    <div className="dv2-list-body">
                      {/* No batch field on this serializer — subject + course
                          + board is the most specific label available, and a
                          subject name alone is ambiguous across courses. */}
                      <p className="dv2-list-title">{g.student}</p>
                      <p className="dv2-list-meta">
                        {[g.title, timeAgo(g.submitted_at)].filter(Boolean).join(" · ")}
                      </p>
                      <p className="dv2-list-meta">
                        {[g.subject, g.course_title, g.board_name].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <button
                      className="dv2-btn dv2-btn-ghost"
                      onClick={() => navigate(`/teacher/assignments/${g.assignment_id}/submissions`)}
                    >
                      Grade
                    </button>
                  </li>
                ))}
              </ul>
              <p className="dv2-footnote">
                Counts every batch of each subject you teach.
              </p>
            </>
          )}
        </section>

        {/* c — Batch progress */}
        <section className="dv2-panel" style={{ gridArea: "c" }}>
          <div className="dv2-panel-head"><h3>Batch progress</h3></div>
          {batches.length === 0 ? (
            <p className="dv2-empty">No batch progress recorded yet.</p>
          ) : (
            <>
              <ul className="dv2-progress">
                {batches.map((b) => (
                  <li key={b.id}>
                    <div className="dv2-progress-head">
                      <span>{[b.name, b.courseTitle, b.board].filter(Boolean).join(" · ")}</span>
                      <b>{b.percent}%</b>
                    </div>
                    <div className="dv2-bar"><i style={{ width: `${b.percent}%` }} /></div>
                    <span className="dv2-progress-meta">
                      {b.chapters_done} of {b.chapters_total} chapters taught
                    </span>
                  </li>
                ))}
              </ul>
              {/* chapters_total counts every chapter of every subject in the
                  course, not just the ones this teacher owns — so a Physics
                  teacher's bar partly measures other people's syllabus. */}
              <p className="dv2-footnote">Across all subjects in the course.</p>
            </>
          )}
        </section>

        {/* d — Attendance (does not exist) */}
        <section className="dv2-panel" style={{ gridArea: "d" }}>
          <div className="dv2-panel-head"><h3>Attendance</h3></div>
          <p className="dv2-empty">
            Attendance isn’t tracked yet. Who joined a live class is recorded,
            but there’s no roll-call to average across a batch.
          </p>
        </section>

        {/* cal */}
        <section className="dv2-panel dv2-cal" style={{ gridArea: "cal" }}>
          <div className="dv2-cal-head">
            <button className="dv2-icon-btn" onClick={() => setMonthOffset((m) => m - 1)} aria-label="Previous month">‹</button>
            <strong>{MONTHS[calendar.month]} {calendar.year}</strong>
            <button className="dv2-icon-btn" onClick={() => setMonthOffset((m) => m + 1)} aria-label="Next month">›</button>
          </div>

          <div className="dv2-cal-grid" role="grid">
            {WEEKDAYS.map((w) => <span key={w} className="dv2-cal-dow">{w}</span>)}
            {Array.from({ length: calendar.firstDow }).map((_, i) => <span key={`pad-${i}`} />)}
            {Array.from({ length: calendar.daysInMonth }).map((_, i) => {
              const day = i + 1;
              const kinds = calendar.marks[day];
              const isToday = monthOffset === 0 && day === now.getDate();
              return (
                <span key={day} className={`dv2-cal-day${isToday ? " is-today" : ""}`}>
                  {day}
                  {kinds && (
                    <span className="dv2-cal-dots">
                      {[...kinds].map((k) => <i key={k} className={EVENT_KINDS[k].cls} />)}
                    </span>
                  )}
                </span>
              );
            })}
          </div>

          <div className="dv2-cal-legend">
            {Object.entries(EVENT_KINDS).map(([k, v]) => (
              <span key={k}><i className={v.cls} />{v.label}</span>
            ))}
          </div>
        </section>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
