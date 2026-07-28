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
// Layout: the design's 3-up card grid (.ac-cardGrid / .ac-card), matching
// dc.html line 847 exactly — chip + status chip on top, title + meta, then a
// footer with one status line and ONE action.
//
// That single footer button is the constraint worth knowing about: this screen
// has up to four actions (view / submit for review / view results / delete).
// The button therefore shows whichever one this quiz's state actually calls
// for — results when published, submit when draft or rejected, preview
// otherwise — and the remainder sit behind an overflow menu beside it, reusing
// the Manage▾ pattern the design already uses on the Study Materials row.
// ──────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiMoreHorizontal } from "react-icons/fi";
import toast from "react-hot-toast";
import api from "../api/apiClient";
import { fetchBatchedOrFanOut } from "../api/batchedList";
import { useTeacherClasses } from "../contexts/TeacherClassesContext";
import { LoadingState, ErrorState, EmptyState } from "../components/StateViews";
import ConfirmDialog from "../components/ConfirmDialog";
import { subjectChipSlot } from "../utils/subjectChips";
import "../styles/academyScreens.css";
import "../styles/quizzes.css";

// Admin verification status → label + the shared .ac-tag--* tone.
const STATUS_META = {
  draft:    { label: "Draft",             tone: "neutral" },
  pending:  { label: "Pending review",    tone: "warning" },
  approved: { label: "✓ Published",       tone: "success" },
  rejected: { label: "Changes requested", tone: "danger"  },
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";

const num = (v) => (typeof v === "number" ? v.toFixed(1) : "—");
const pct = (v) => (typeof v === "number" ? `${v.toFixed(0)}%` : "—");
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

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
  const [publishingId, setPublishingId] = useState(null);
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
  const handlePublish = async (quiz) => {
    setPublishingId(quiz.id);
    try {
      await api.patch(`/teacher/quizzes/${quiz.id}/publish/`);
      // Re-read only the subject that changed (1 request, not another fan-out).
      const subject =
        subjects.find((s) => String(s.subjectId) === String(quiz.subjectId)) || {
          subjectId: quiz.subjectId,
          subjectName: quiz.subjectName,
        };
      const fresh = await fetchForSubject(subject);
      setQuizzes((prev) => [
        ...prev.filter((q) => String(q.subjectId) !== String(quiz.subjectId)),
        ...fresh,
      ]);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to publish quiz.");
    } finally {
      setPublishingId(null);
    }
  };

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
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)),
    [decorated, subjectFilter]
  );

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

  const headSub = decorated.length
    ? `${plural(decorated.length, "quiz").replace("quizs", "quizzes")} across ${plural(
        subjectsWithQuizzes.length, "class").replace("classs", "classes")}.`
    : "Create a quiz and it will show up here.";

  return (
    <div className="ac-screen">
      <div className="ac-head">
        <div>
          <h1 className="ac-head__title">Quizzes</h1>
          <p className="ac-head__sub">{headSub}</p>
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
                    className="ac-menu__item"
                    onClick={() => goCreate(s.subjectId)}
                  >
                    {s.subjectName || "Subject"}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="ac-filterBar">
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
              {s.subjectName || "Subject"}
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
        // The design renders quizzes as a 3-up card grid (dc.html line 847),
        // not rows: chip + status on top, title + meta, then a footer with one
        // status line and one action.
        <div className="ac-cardGrid">
          {rows.map((quiz) => {
            const meta = STATUS_META[quiz.review_status] || STATUS_META.draft;
            const canPublish =
              quiz.review_status === "draft" || quiz.review_status === "rejected";
            const noQuestions = (quiz.questions_count ?? 0) === 0;

            // The design's card footer has exactly ONE button, so the primary
            // action is whatever this quiz's state actually calls for. The rest
            // move into the overflow menu beside it — the same Manage pattern
            // the design uses on the Study Materials row.
            const primary = quiz.is_published
              ? {
                  label: "View results",
                  onClick: () => navigate(`/teacher/quizzes/${quiz.id}/submissions`),
                }
              : canPublish
                ? {
                    label:
                      publishingId === quiz.id
                        ? "Submitting…"
                        : quiz.review_status === "rejected"
                          ? "Resubmit"
                          : "Submit for review",
                    onClick: () => handlePublish(quiz),
                    disabled: publishingId === quiz.id || noQuestions,
                    title: noQuestions
                      ? "Add at least one question before submitting"
                      : "Send to admin for verification",
                  }
                : { label: "Preview", onClick: () => handleView(quiz) };

            return (
              <div key={quiz.id} className="ac-card">
                <div className="ac-card__top">
                  <span className={`subj-chip subj-chip--${subjectChipSlot(quiz.subjectName)}`}>
                    {quiz.subjectName || "Subject"}
                  </span>
                  <span
                    className={`ac-tag ac-tag--${meta.tone}`}
                    title={quiz.review_note || ""}
                  >
                    {meta.label}
                  </span>
                </div>

                <div>
                  <div className="ac-card__title">{quiz.title}</div>
                  <div className="ac-card__meta" title={quiz.perf || ""}>{quiz.meta}</div>
                  {quiz.review_status === "rejected" && quiz.review_note && (
                    <div className="ac-card__meta qz-note">“{quiz.review_note}”</div>
                  )}
                </div>

                <div className="ac-card__foot">
                  {/* Design's footer text is just the due/held date
                      (dc.html's q.footText) — the fuller performance
                      breakdown lives in the subtitle's hover title instead
                      of crowding this single line. */}
                  <span className="ac-card__footText">{quiz.stateLabel}</span>
                  <div className="ac-card__actions">
                    <div className="ac-menuWrap">
                      <button
                        type="button"
                        className="ac-cardBtn ac-cardBtn--icon"
                        aria-label="More actions"
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
                            {quiz.is_published ? "View quiz" : "Preview quiz"}
                          </button>
                          {canPublish && (
                            <button
                              type="button"
                              role="menuitem"
                              className="ac-menu__item"
                              onClick={() => { setOpenMenu(null); navigate(`/teacher/quizzes/${quiz.id}/edit`); }}
                            >
                              Edit quiz
                            </button>
                          )}
                          <button
                            type="button"
                            role="menuitem"
                            className="ac-menu__item"
                            onClick={() => { setOpenMenu(null); handleDuplicate(quiz); }}
                            disabled={duplicatingId === quiz.id}
                          >
                            {duplicatingId === quiz.id ? "Duplicating…" : "Duplicate quiz"}
                          </button>
                          {quiz.is_published && (
                            <button
                              type="button"
                              role="menuitem"
                              className="ac-menu__item"
                              onClick={() => { setOpenMenu(null); navigate(`/teacher/quizzes/${quiz.id}/analytics`); }}
                            >
                              Analytics
                            </button>
                          )}
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
                    <button
                      type="button"
                      className="ac-cardBtn ac-cardBtn--primary"
                      onClick={primary.onClick}
                      disabled={primary.disabled}
                      title={primary.title}
                    >
                      {primary.label}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <ConfirmDialog
        dialog={confirmDlg && { ...confirmDlg, busy: deletingId != null }}
        onClose={() => setConfirmDlg(null)}
      />
    </div>
  );
}
