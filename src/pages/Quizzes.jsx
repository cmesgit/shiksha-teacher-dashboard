// src/pages/Quizzes.jsx
// ──────────────────────────────────────────────────────────────────────────
// Academy "Quizzes" (teacher) — ONE flat, filterable list of every quiz across
// every class the teacher takes. Matches the design handoff's Quizzes screen
// (Academy Dashboard.dc.html lines 827–868), teacher branch: a "+ Create quiz"
// head button, a subject-pill row on the left, and a "View results" action per
// quiz. Quizzes have no due date (product decision: they don't expire), so
// there is no Upcoming/Completed filter — one list, newest first.
//
// This screen used to be scoped to a route param — reachable only via
// Classes → a class → Quiz. It now stands alone as a nav destination. The
// :subjectId param is still read, but only to preselect that subject's pill so
// older deep links keep landing somewhere sensible.
//
// Data: the subject list comes from TeacherClassesContext (one shared
// GET /courses/teacher/my-classes/, not ours to fire), then ONE
// GET /teacher/quizzes/all/ for every subject the teacher is assigned to.
// The old per-subject fan-out survives as a 404-only fallback for backends
// that predate that endpoint — see api/batchedList.js for why only a 404.
//
// Layout: T1 (design_handoff_quiz_system §T1, Phase 6) — a stat strip, a
// segmented type filter, and ROWS. It was a 3-up card grid until Phase 6.
//
// Why rows: a card had room for one status chip, so it showed review_status —
// which conflated two independent things. A teacher's own quiz, live for
// their own class, read "Pending review" because its QUESTIONS were queued
// for the shared ShikshaCom bank. Phase 1 removed the admin from the
// teacher's own classroom; this screen was still saying otherwise. Rows carry
// both states side by side, in the same shape, because neither outranks the
// other.
//
// Actions: Results / Edit inline, the rest behind the ⋯ overflow, reusing the
// Manage▾ pattern the design already uses on the Study Materials row. There is
// deliberately no "Submit for review" — assigning happens in the builder now.
// ──────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiMoreHorizontal, FiClock, FiHelpCircle } from "react-icons/fi";
import toast from "react-hot-toast";
import api from "../api/apiClient";
import { fetchBatchedOrFanOut } from "../api/batchedList";
import { useTeacherClasses } from "../contexts/TeacherClassesContext";
import { LoadingState, ErrorState, EmptyState } from "../components/StateViews";
import ConfirmDialog from "../components/ConfirmDialog";
import { subjectChipSlot } from "../utils/subjectChips";
import "../styles/academyScreens.css";
import "../styles/quizzes.css";
import "../styles/quizzes-t1.css";

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";

const num = (v) => (typeof v === "number" ? v.toFixed(1) : "—");
const pct = (v) => (typeof v === "number" ? `${v.toFixed(0)}%` : "—");

/** average_score is RAW MARKS, not a percentage — `total_marks` is its
 *  denominator, which is exactly why the serializer exposes it. Passing the
 *  mark straight through a percent formatter is the bug the serializer's own
 *  comment warns about: a 3-mark quiz averaging 8 rendered as "8%" instead of
 *  a (nonsensical, but honest) ratio. Falls back to "—" rather than guessing
 *  when the denominator is missing or zero. */
function scorePct(score, totalMarks) {
  if (typeof score !== "number" || !totalMarks) return "—";
  // Clamped at 100, matching QuizDashboardSerializer.get_best_score and the
  // student result views. A stored score can exceed the current total when
  // marks were edited after an attempt was sat; showing "283%" would be
  // technically faithful and completely useless to a teacher.
  return `${Math.round(Math.min(100, (score / totalMarks) * 100))}%`;
}
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The site-bank chip. Reported in priority order, not as a sum: a quiz with
 *  questions in several states shows the one that needs the teacher's
 *  attention first — changes requested outranks awaiting, which outranks
 *  already-accepted. "Not suggested" only when nothing was ever offered. */
function bankChipFor(q) {
  if (q.bank_changes_requested) {
    const n = q.bank_changes_requested;
    return { label: `${n} ${n === 1 ? "needs" : "need"} changes`, tone: "danger" };
  }
  if (q.bank_suggested) {
    return { label: `${q.bank_suggested} awaiting curation`, tone: "warning" };
  }
  if (q.bank_accepted) {
    return { label: `${q.bank_accepted} in site bank`, tone: "success" };
  }
  return { label: "Not suggested", tone: "neutral" };
}

/** The meta line's timing clause — what this type actually enforces. */
function timingRule(q) {
  if ((q.quiz_type || "practice") === "mock") {
    const parts = [];
    if (q.time_limit_minutes) parts.push(`${q.time_limit_minutes} min`);
    parts.push(q.max_attempts === 1 ? "one attempt" : `${q.max_attempts} attempts`);
    return parts.join(", ");
  }
  return "unlimited retries";
}

export default function Quizzes() {
  const navigate = useNavigate();
  const { subjectId } = useParams();
  const {
    classes,
    loading: classesLoading,
    error: classesError,
    reload: reloadClasses,
  } = useTeacherClasses();

  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [duplicatingId, setDuplicatingId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  // Which card's overflow menu is open (the design's card footer has room
  // for one button, so the rest live behind this).
  const [openMenu, setOpenMenu] = useState(null);
  // Deleting is destructive, so it confirms first — same ConfirmDialog
  // pattern as Assignments.jsx, not a native window.confirm().
  const [confirmDlg, setConfirmDlg] = useState(null);

  // "" = all subjects. Seeded from the route so a deep link preselects.
  const [subjectFilter, setSubjectFilter] = useState(subjectId ? String(subjectId) : "");
  // T1 (Phase 6). Null until the strip's two side requests land; the cards
  // render "—" rather than 0 in the meantime, so a slow response never reads
  // as "you have no questions in the bank".
  const [attemptStats, setAttemptStats] = useState(null);
  const [bankSummary, setBankSummary] = useState(null);
  const [typeFilter, setTypeFilter] = useState("all"); // all | practice | mock

  const createRef = useRef(null);

  useEffect(() => {
    setSubjectFilter(subjectId ? String(subjectId) : "");
  }, [subjectId]);

  // The same subject can appear under more than one course; fan out once per
  // distinct subject so a quiz never arrives twice.
  const subjects = useMemo(() => {
    const seen = new Map();
    for (const c of classes || []) {
      const key = c.subjectId == null ? null : String(c.subjectId);
      if (key && !seen.has(key)) seen.set(key, c);
    }
    return [...seen.values()];
  }, [classes]);

  const fetchForSubject = useCallback(
    (subject) =>
      api
        .get(`/teacher/subjects/${subject.subjectId}/quizzes/`)
        .then((res) => {
          const data = res.data?.results || res.data || [];
          return (Array.isArray(data) ? data : []).map((q) => ({
            ...q,
            subjectId: subject.subjectId,
            subjectName: q.subject_name || subject.subjectName,
          }));
        })
        // One failing subject shows as empty rather than rejecting the screen.
        .catch(() => []),
    []
  );

  useEffect(() => {
    if (classesLoading) return;
    if (subjects.length === 0) {
      setQuizzes([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // ONE request for every subject the teacher is assigned to; the
        // per-subject fan-out is a 404-only fallback (see api/batchedList.js).
        const byId = new Map(subjects.map((c) => [String(c.subjectId), c]));
        const rows = await fetchBatchedOrFanOut(
          "/teacher/quizzes/all/",
          (q) => ({
            ...q,
            subjectId: q.subject_id,
            subjectName: q.subject_name || byId.get(String(q.subject_id))?.subjectName,
          }),
          async () => (await Promise.all(subjects.map(fetchForSubject))).flat()
        );
        if (cancelled) return;
        setQuizzes(rows);

        // T1's stat strip. Deliberately NOT awaited with the list above: the
        // strip is decoration on top of the list, so a failure here must
        // degrade the cards to "—" rather than blank the whole screen.
        Promise.allSettled([
          api.get("/teacher/quizzes/stats/"),
          api.get("/teacher/question-bank/summary/"),
        ]).then(([s, b]) => {
          if (cancelled) return;
          if (s.status === "fulfilled") setAttemptStats(s.value.data);
          if (b.status === "fulfilled") setBankSummary(b.value.data);
        });
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load quizzes", err);
        setError("Failed to load your quizzes.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [classesLoading, subjects, fetchForSubject]);

  // Close the create-quiz subject menu on an outside click.
  useEffect(() => {
    if (!createOpen) return;
    const onDown = (e) => {
      if (createRef.current && !createRef.current.contains(e.target)) setCreateOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [createOpen]);

  // Same for a card's overflow menu — outside click or Escape closes it.
  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e) => {
      if (!e.target.closest?.(".ac-menuWrap")) setOpenMenu(null);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpenMenu(null); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenu]);

  // ── Actions ────────────────────────────────────────────────────────────
  const doDelete = async (quiz, force) => {
    setDeletingId(quiz.id);
    try {
      await api.delete(`/teacher/quizzes/${quiz.id}/delete/${force ? "?force=true" : ""}`);
      setQuizzes((prev) => prev.filter((q) => q.id !== quiz.id));
      setConfirmDlg(null);
      toast.success("Quiz deleted.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete quiz.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDelete = async (quiz) => {
    if (!quiz.is_published) {
      setConfirmDlg({
        title: "Delete this quiz?",
        message: `“${quiz.title}” will be permanently removed.`,
        confirmLabel: "Delete quiz",
        danger: true,
        onConfirm: () => doDelete(quiz, false),
      });
      return;
    }

    // Published — try without force first; only escalate to a stronger
    // confirmation if the backend reports existing student attempts
    // (409 requires_force), so a quiz nobody has taken yet deletes with
    // just the ordinary confirm above.
    setDeletingId(quiz.id);
    try {
      await api.delete(`/teacher/quizzes/${quiz.id}/delete/`);
      setQuizzes((prev) => prev.filter((q) => q.id !== quiz.id));
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.requires_force) {
        const count = err.response.data.attempt_count;
        setConfirmDlg({
          title: "Delete this quiz?",
          message:
            `This quiz has ${count} student attempt${count === 1 ? "" : "s"}. Deleting it will ` +
            `permanently remove ALL student scores and attempt history. This can't be undone.`,
          confirmLabel: "Delete quiz",
          danger: true,
          onConfirm: () => doDelete(quiz, true),
        });
      } else {
        toast.error(err.response?.data?.detail || "Failed to delete quiz.");
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleDuplicate = async (quiz) => {
    setDuplicatingId(quiz.id);
    try {
      const res = await api.post(`/teacher/quizzes/${quiz.id}/duplicate/`);
      toast.success("Quiz duplicated — editing the copy now.");
      navigate(`/teacher/quizzes/${res.data.id}/edit`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to duplicate quiz.");
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleView = (quiz) => {
    navigate(
      quiz.is_published
        ? `/teacher/quizzes/${quiz.id}`
        : `/teacher/quizzes/${quiz.id}/draft`
    );
  };

  const goCreate = (sid) => {
    setCreateOpen(false);
    navigate(`/teacher/quizzes/create/${sid}`);
  };

  // "+ Create quiz" needs a subject. Use the selected pill, or the only class
  // there is; otherwise offer a picker rather than a dead button.
  const createSubjectId =
    subjectFilter || (subjects.length === 1 ? String(subjects[0].subjectId) : "");

  const onCreateClick = () => {
    if (createSubjectId) goCreate(createSubjectId);
    else setCreateOpen((o) => !o);
  };

  // ── Derived rows ───────────────────────────────────────────────────────
  // Quizzes don't expire (no due date), so there's no Active/Past split any
  // more — one flat list, most recently created first.
  const decorated = useMemo(() => {
    return (quizzes || []).map((q) => {
      const questions = q.questions_count ?? 0;
      return {
        ...q,
        // Design's card subtitle is "{class} · avg {score}%" — this app has
        // no batch on a Quiz (unlike Assignment/LiveSession), so course_title
        // is the closest real substitute for "which class" a subtitle can
        // show without fabricating a batch name.
        meta: [
          q.course_title || null,
          q.total_attempts > 0 ? `avg ${pct(q.average_score)}` : null,
          plural(questions, "question"),
        ].filter(Boolean).join(" · "),
        stateLabel: q.created_at ? `Created ${fmtDate(q.created_at)}` : "",
        // ── T1's two chips ─────────────────────────────────────────────
        // The whole point of this screen: assignment state and site-bank
        // state are INDEPENDENT, and the old single "Pending review" chip
        // conflated them — a teacher's own live quiz looked like it was
        // waiting on an admin when only its questions were.
        assignChip: q.is_assigned
          ? {
              label: q.batch_count
                ? `Live for ${plural(q.batch_count, "batch").replace("batchs", "batches")}`
                : "Live for all batches",
              tone: "success",
            }
          : { label: "Draft — not assigned", tone: "neutral" },
        bankChip: bankChipFor(q),
        t1Meta: [
          q.course_title || null,
          plural(questions, "question"),
          timingRule(q),
          ...(q.chapter_tags || []).map((t) => t.label).filter(Boolean),
          q.no_specific_chapter ? "No specific chapter" : null,
        ].filter(Boolean).join(" · "),
        perf:
          q.total_attempts > 0
            ? `Avg ${num(q.average_score)} (range ${num(q.lowest_score)}–${num(q.highest_score)}) · ` +
              `${pct(q.submission_rate)} submitted · ${plural(q.total_attempts, "attempt")}`
            : null,
      };
    });
  }, [quizzes]);

  // Only offer a pill for subjects that actually have a quiz.
  const subjectsWithQuizzes = useMemo(() => {
    const ids = new Set(decorated.map((q) => String(q.subjectId)));
    return subjects.filter((s) => ids.has(String(s.subjectId)));
  }, [subjects, decorated]);

  const rows = useMemo(
    () =>
      decorated
        .filter((q) => !subjectFilter || String(q.subjectId) === subjectFilter)
        .filter((q) => typeFilter === "all" || (q.quiz_type || "practice") === typeFilter)
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)),
    [decorated, subjectFilter, typeFilter]
  );

  /* ── T1 stat strip (Phase 6) ────────────────────────────────────────────
   * "Live for my batches" is counted here rather than fetched: the quiz list
   * is unpaginated, so this count is complete and costs no extra request.
   * The other three come from the two side calls; each renders "—" until its
   * response lands. */
  const stats = useMemo(() => {
    const live = decorated.filter((q) => q.is_assigned).length;
    const d = attemptStats?.attempts_delta;
    return [
      {
        key: "live",
        label: "Live for my batches",
        value: live,
        note: "no approval needed",
        tone: "success",
      },
      {
        key: "attempts",
        label: "Attempts this week",
        value: attemptStats?.attempts_this_week,
        note:
          d == null ? "vs last week"
            : d === 0 ? "same as last week"
              : `${d > 0 ? "+" : ""}${d} vs last week`,
        tone: d == null ? "muted" : d < 0 ? "warning" : "success",
      },
      {
        key: "inbank",
        label: "In the ShikshaCom bank",
        value: bankSummary?.accepted,
        note: bankSummary ? `of ${bankSummary.total} you wrote` : "of your questions",
        tone: "muted",
      },
      {
        key: "awaiting",
        label: "Awaiting curation",
        value: bankSummary?.suggested,
        note: "admin reviews these",
        tone: bankSummary?.suggested ? "warning" : "muted",
      },
    ];
  }, [decorated, attemptStats, bankSummary]);

  // ── States ─────────────────────────────────────────────────────────────
  if (classesLoading || loading) {
    return <div className="ac-screen"><LoadingState label="Loading quizzes" /></div>;
  }
  if (classesError) {
    return (
      <div className="ac-screen">
        <ErrorState message={classesError} onRetry={reloadClasses} />
      </div>
    );
  }
  if (error) {
    return <div className="ac-screen"><ErrorState message={error} /></div>;
  }
  if (subjects.length === 0) {
    return (
      <div className="ac-screen">
        <EmptyState
          icon="quiz"
          title="No classes yet"
          message="Quizzes appear here once you're assigned a class to teach."
          action={{ label: "Go to Classes", to: "/teacher/classes" }}
        />
      </div>
    );
  }

  return (
    <div className="ac-screen">
      <div className="ac-head">
        <div>
          <h1 className="ac-head__title">Tests &amp; quizzes</h1>
          {/* The sub is the screen's whole argument: Phase 1 removed the
              admin from the teacher's own classroom, and this line is where
              a teacher who remembers the old flow finds that out. */}
          <p className="ac-head__sub">
            Yours to run. Nothing here waits on an admin — approval only
            matters for the shared ShikshaCom bank.
          </p>
        </div>
        <div className="ac-head__actions">
          <div className="ac-menuWrap" ref={createRef}>
            {/* dc.html hardcodes #425f7f (slate --primary) for every
                content-creation head button (+ Create quiz, + Upload
                recording, + Upload material) — same convention Assignments.jsx
                documents; only the role-differentiated "+ Schedule session"
                uses --action (teacher maroon). ac-headBtn defaults to
                --action, so this needs the primary modifier explicitly. */}
            <button type="button" className="ac-headBtn ac-headBtn--primary" onClick={onCreateClick}>
              + Create quiz
            </button>
            {createOpen && (
              <div className="ac-menu qz-menu" role="menu">
                {subjects.map((s) => (
                  <button
                    key={s.subjectId}
                    type="button"
                    role="menuitem"
                    className="ac-menu__item ac-menu__item--stacked"
                    onClick={() => goCreate(s.subjectId)}
                  >
                    <span>{s.subjectName || "Subject"}</span>
                    {s.courseTitle && <span className="ac-menu__item__meta">{s.courseTitle}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="qt-strip">
        {stats.map((s) => (
          <div className="qt-stat" key={s.key}>
            <div className="qt-stat__label">{s.label}</div>
            <div className="qt-stat__value">{s.value ?? "—"}</div>
            <div className={`qt-stat__note qt-stat__note--${s.tone}`}>{s.note}</div>
          </div>
        ))}
      </div>

      <div className="ac-filterBar">
        <div className="qt-seg" role="tablist" aria-label="Test type">
          {[
            { id: "all", label: "All" },
            { id: "practice", label: "Practice quizzes" },
            { id: "mock", label: "Mock tests" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={typeFilter === t.id}
              className={`qt-seg__btn${typeFilter === t.id ? " is-active" : ""}`}
              onClick={() => setTypeFilter(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="ac-pills">
          <button
            type="button"
            className={`ac-pill${subjectFilter === "" ? " is-active" : ""}`}
            onClick={() => setSubjectFilter("")}
          >
            All
          </button>
          {subjectsWithQuizzes.map((s) => (
            <button
              key={s.subjectId}
              type="button"
              className={`ac-pill${subjectFilter === String(s.subjectId) ? " is-active" : ""}`}
              onClick={() => setSubjectFilter(String(s.subjectId))}
            >
              {[s.subjectName || "Subject", s.courseTitle].filter(Boolean).join(" · ")}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <section className="ac-listCard">
          <EmptyState
            plain
            icon="quiz"
            title="Nothing here"
            message="No quizzes yet. Use “+ Create quiz” to make one."
          />
        </section>
      ) : (
        // T1 (Phase 6) replaces the card grid with rows. A card could show one
        // status; this screen has to show two independent ones — live for my
        // batches, and site-bank state — which is the entire point of it.
        <section className="ac-listCard">
          {rows.map((quiz) => {
            const canEdit =
              quiz.review_status === "draft" || quiz.review_status === "rejected";
            const isMock = (quiz.quiz_type || "practice") === "mock";

            return (
              <div key={quiz.id} className="ac-row ac-row--flush qt-row">
                <span className={`qt-kind qt-kind--${isMock ? "mock" : "practice"}`}>
                  {isMock ? <FiClock size={17} /> : <FiHelpCircle size={17} />}
                </span>

                <div className="qt-row__body">
                  <div className="qt-row__titleLine">
                    <span className="qt-row__title">{quiz.title}</span>
                    <span className={`subj-chip subj-chip--${subjectChipSlot(quiz.subjectName)} qt-kindChip`}>
                      {isMock ? "Mock test" : "Practice"}
                    </span>
                  </div>
                  <div className="qt-row__meta" title={quiz.perf || ""}>{quiz.t1Meta}</div>
                  <div className="qt-row__chips">
                    <span className={`qt-chip qt-chip--${quiz.assignChip.tone}`}>
                      {quiz.assignChip.label}
                    </span>
                    <span
                      className={`qt-chip qt-chip--${quiz.bankChip.tone}`}
                      title="Site-bank status — independent of whether this test is live for your class"
                    >
                      {quiz.bankChip.label}
                    </span>
                  </div>
                </div>

                <div className="qt-row__score">
                  <div className="qt-row__scoreVal">
                    {quiz.total_attempts > 0
                      ? scorePct(quiz.average_score, quiz.total_marks)
                      : "—"}
                  </div>
                  <div className="qt-row__scoreLbl">avg score</div>
                </div>

                <div className="qt-row__actions">
                  <button
                    type="button"
                    className="ac-btn"
                    onClick={() => navigate(`/teacher/quizzes/${quiz.id}/submissions`)}
                  >
                    Results
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      className="ac-btn"
                      onClick={() => navigate(`/teacher/quizzes/${quiz.id}/edit`)}
                    >
                      Edit
                    </button>
                  )}
                  <div className="ac-menuWrap">
                    <button
                      type="button"
                      className="ac-cardBtn ac-cardBtn--icon"
                      aria-label={`More actions for ${quiz.title}`}
                      aria-haspopup="menu"
                      aria-expanded={openMenu === quiz.id}
                      onClick={() => setOpenMenu(openMenu === quiz.id ? null : quiz.id)}
                    >
                      <FiMoreHorizontal size={13} />
                    </button>
                    {openMenu === quiz.id && (
                      <div className="ac-menu" role="menu">
                        <button
                          type="button"
                          role="menuitem"
                          className="ac-menu__item"
                          onClick={() => { setOpenMenu(null); handleView(quiz); }}
                        >
                          {quiz.is_assigned ? "View quiz" : "Preview quiz"}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="ac-menu__item"
                          onClick={() => { setOpenMenu(null); handleDuplicate(quiz); }}
                          disabled={duplicatingId === quiz.id}
                        >
                          {duplicatingId === quiz.id ? "Duplicating…" : "Duplicate quiz"}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="ac-menu__item ac-menu__item--danger"
                          onClick={() => { setOpenMenu(null); handleDelete(quiz); }}
                          disabled={deletingId === quiz.id}
                        >
                          {deletingId === quiz.id ? "Deleting…" : "Delete quiz"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <ConfirmDialog
        dialog={confirmDlg && { ...confirmDlg, busy: deletingId != null }}
        onClose={() => setConfirmDlg(null)}
      />
    </div>
  );
}
