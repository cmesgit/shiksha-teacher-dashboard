// src/pages/Assignments.jsx
// ──────────────────────────────────────────────────────────────────────────
// Academy "Assignments" (teacher) — ONE flat, subject-filtered list of every
// assignment across every class the teacher takes. Matches the design handoff's
// Assignments screen (Academy Dashboard.dc.html lines 1731–1774), teacher
// branch: status chips + "+ New assignment" live in the head, the subject pills
// sit in the filter bar, and the student-only status <select> is not rendered.
//
// There is no class-picker step any more. The screen is reached straight from
// the nav with no :subjectId; the param is still read so the old deep link
// /teacher/classes/:subjectId/assignments simply preselects that subject's pill.
//
// Data: the subject list comes from TeacherClassesContext (one shared
// GET /courses/teacher/my-classes/, already made by the provider — this screen
// must not repeat it). Assignments then come from ONE
// GET /assignments/teacher/all/ covering every subject the teacher is assigned
// to. The old per-subject fan-out survives as a 404-only fallback for backends
// that predate that endpoint — see api/batchedList.js for why only a 404.
// ──────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { FiEdit2, FiTrash2, FiMoreHorizontal } from "react-icons/fi";
import api from "../api/apiClient";
import { fetchBatchedOrFanOut, fanOutPerSubject } from "../api/batchedList";
import { useTeacherClasses } from "../contexts/TeacherClassesContext";
import { LoadingState, ErrorState, EmptyState } from "../components/StateViews";
import ConfirmDialog from "../components/ConfirmDialog";
import { subjectChipSlot } from "../utils/subjectChips";
import "../styles/academyScreens.css";

// The design's teacher head chips are a BATCH filter, not a status one:
// AP_CHIPS is ["All", "10-A", "10-B", "9-A"] for a teacher (dc.html line 3276)
// and is matched against the row's meta line. Assignment.batch drives this;
// NULL batch means course-wide, shown as "All batches".
const ALL_BATCHES = "All";

const fmtDue = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";

export default function Assignments() {
  const navigate = useNavigate();
  const { subjectId } = useParams();
  const { classes, loading: classesLoading, error: classesError } = useTeacherClasses();

  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [batchFilter, setBatchFilter] = useState(ALL_BATCHES);
  // "" = all subjects. Seeded from the route so a deep link preselects.
  const [subjectFilter, setSubjectFilter] = useState(subjectId ? String(subjectId) : "");

  const [deletingId, setDeletingId] = useState(null); // which row is mid-delete
  // Which row's overflow menu is open — the design's row has one visible
  // action, so edit/delete live behind this.
  const [rowMenu, setRowMenu] = useState(null);
  // Deleting is destructive, so it confirms first. The design's own pattern for
  // this is a modal ("Delete this file?", 400px, red icon tile), not an inline
  // strip — ConfirmDialog is that modal.
  const [confirmDlg, setConfirmDlg] = useState(null);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const newMenuRef = useRef(null);

  useEffect(() => {
    setSubjectFilter(subjectId ? String(subjectId) : "");
  }, [subjectId]);

  // ── Fetch: ONE request for every subject the teacher is assigned to ─────
  // /assignments/teacher/all/ returns the lot. The per-subject fan-out is kept
  // only as a fallback for backends that predate it — see api/batchedList.js
  // for why that fallback is 404-only.
  useEffect(() => {
    if (classesLoading) return;
    if (!classes || classes.length === 0) {
      setAssignments([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchAll() {
      setLoading(true);
      setError(null);
      try {
        const rows = await fetchBatchedOrFanOut(
          "/assignments/teacher/all/",
          // The batched endpoint reports its own subject per row.
          (a) => ({ ...a, subjectId: a.subject_id, subjectName: a.subject_name }),
          () =>
            fanOutPerSubject(
              classes,
              (c) => `/assignments/teacher/subject/${c.subjectId}/`,
              (a, c) => ({ ...a, subjectId: c.subjectId, subjectName: c.subjectName })
            )
        );
        if (cancelled) return;
        setAssignments(rows);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load assignments", err);
        setError("Failed to load assignments.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [classes, classesLoading]);

  // Close the "+ New assignment" subject menu on an outside click / Escape.
  useEffect(() => {
    if (!newMenuOpen) return;
    const onDown = (e) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target)) setNewMenuOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setNewMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [newMenuOpen]);

  // A row's overflow menu closes on outside click or Escape.
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

  const now = Date.now();

  // Decorate once: the design's single meta line + the sort bucket.
  //
  // The status tag itself is NOT an open/closed indicator — dc.html maps every
  // teacher assignment row to a single "active" status (line 3285: `.map((a)
  // => ({ ...a, st: "active" }))`), which always renders as `Due {date}` in
  // teal (AP_ST.active = { bg: "#e6f4f6", ink: "#13899b" }, line 3287), even
  // for the mock's own overdue example (assignment #3, due two days ago —
  // still tagged "Due 23 Jul", never "Overdue"/"Closed"). A teacher isn't
  // racing their own deadline, so the tag just restates when it's due; the
  // meta line below it carries the batch/submission context instead (a.meta
  // in the design, e.g. "Class 10-A · 18/32 submitted" — no due date there,
  // since the tag already shows it).
  //
  // `overdue` is still tracked, but only to bucket rows in the sort below —
  // it never reaches the UI as a color or label.
  const decorated = useMemo(
    () =>
      assignments.map((a) => {
        const dueTs = a.due_date ? new Date(a.due_date).getTime() : null;
        const overdue = dueTs != null && dueTs < now;
        const meta = [
          a.batch_name || null,
          a.chapter_name || null,
          a.total_submissions > 0
            ? `${a.total_submissions} submission${a.total_submissions === 1 ? "" : "s"}`
            : "No submissions yet",
        ]
          .filter(Boolean)
          .join(" · ");
        return {
          ...a,
          dueTs,
          overdue,
          stLabel: a.due_date ? `Due ${fmtDue(a.due_date)}` : "No due date",
          meta,
        };
      }),
    [assignments, now]
  );

  // Batch chips, from the batches that actually appear in the list. The design
  // hardcodes ["All","10-A","10-B","9-A"]; deriving them keeps the control
  // truthful for any timetable.
  const batchChips = useMemo(() => {
    const names = [...new Set(decorated.map((a) => a.batch_name).filter(Boolean))].sort();
    return [ALL_BATCHES, ...names];
  }, [decorated]);

  // Only offer a pill for subjects that actually have an assignment.
  const subjectsWithWork = useMemo(() => {
    const ids = new Set(decorated.map((a) => String(a.subjectId)));
    return (classes || []).filter((c) => ids.has(String(c.subjectId)));
  }, [classes, decorated]);

  const rows = useMemo(
    () =>
      decorated
        .filter((a) => !subjectFilter || String(a.subjectId) === subjectFilter)
        .filter((a) => batchFilter === ALL_BATCHES || (a.batch_name || "") === batchFilter)
        .sort((a, b) => {
          // Not-yet-due first (soonest deadline first), then overdue (most recent first).
          if (a.overdue !== b.overdue) return a.overdue ? 1 : -1;
          if (a.dueTs == null) return 1;
          if (b.dueTs == null) return -1;
          return a.overdue ? b.dueTs - a.dueTs : a.dueTs - b.dueTs;
        }),
    [decorated, subjectFilter, batchFilter]
  );

  // ── Create / edit / delete ──────────────────────────────────────────────
  const createFor = (sid) => navigate(`/teacher/classes/${sid}/assignments/create`);

  // Creating needs a subject. If a pill is active (or there's only one class)
  // that's unambiguous; otherwise the button opens a subject menu.
  const createSubjectId =
    subjectFilter || (classes && classes.length === 1 ? classes[0].subjectId : null);

  const handleNewClick = () => {
    if (createSubjectId) createFor(createSubjectId);
    else setNewMenuOpen((o) => !o);
  };

  const handleEdit = (a) =>
    navigate(`/teacher/classes/${a.subjectId}/assignments/create`, { state: a });

  const handleDeleteConfirm = async (assignmentId) => {
    setDeletingId(assignmentId);
    try {
      await api.delete(`/assignments/teacher/${assignmentId}/delete/`);
      setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
      toast.success("Assignment deleted.");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Delete failed.");
    } finally {
      setDeletingId(null);
      setConfirmDlg(null);
    }
  };

  const askDelete = (a) =>
    setConfirmDlg({
      title: "Delete this assignment?",
      message:
        `“${a.title}” will be removed for every student in ` +
        `${a.batch_name || a.subjectName || "this class"}. This can't be undone.`,
      confirmLabel: "Delete assignment",
      danger: true,
      onConfirm: () => handleDeleteConfirm(a.id),
    });

  // ── States ──────────────────────────────────────────────────────────────
  if (classesLoading || loading) {
    return <div className="ac-screen"><LoadingState label="Loading assignments" /></div>;
  }
  if (classesError || error) {
    return <div className="ac-screen"><ErrorState message={classesError || error} /></div>;
  }
  if (!classes || classes.length === 0) {
    return (
      <div className="ac-screen">
        <EmptyState
          icon="file"
          title="No classes yet"
          message="You aren't assigned to any classes, so there's nothing to set work for."
        />
      </div>
    );
  }

  const activeSubjectName =
    subjectFilter
      ? classes.find((c) => String(c.subjectId) === subjectFilter)?.subjectName
      : null;
  const sub = activeSubjectName
    ? `${rows.length} assignment${rows.length === 1 ? "" : "s"} in ${activeSubjectName}.`
    : `${decorated.length} assignment${decorated.length === 1 ? "" : "s"} across ${classes.length} class${classes.length === 1 ? "" : "es"}.`;

  return (
    <div className="ac-screen">
      <div className="ac-head">
        <div>
          <h1 className="ac-head__title">Assignments</h1>
          <p className="ac-head__sub">{sub}</p>
        </div>

        <div className="ac-head__actions">
          <div className="ac-pills">
            {batchChips.map((b) => (
              <button
                key={b}
                type="button"
                className={`ac-pill ac-pill--sm${batchFilter === b ? " is-active" : ""}`}
                onClick={() => setBatchFilter(b)}
              >
                {b === ALL_BATCHES ? "All" : b}
              </button>
            ))}
          </div>

          <div className="ac-menuWrap" ref={newMenuRef}>
            {/* dc.html hardcodes #425f7f (slate --primary) for this button
                (line 1740), same as every other content-creation head button
                (+ Create quiz, + Upload recording, + Upload material) — only
                the role-differentiated "+ Schedule session" uses --action.
                ac-headBtn defaults to --action, so this needs the primary
                modifier explicitly. */}
            <button
              type="button"
              className="ac-headBtn ac-headBtn--primary"
              onClick={handleNewClick}
              aria-haspopup={createSubjectId ? undefined : "menu"}
              aria-expanded={createSubjectId ? undefined : newMenuOpen}
            >
              + New assignment
            </button>
            {newMenuOpen && !createSubjectId && (
              <div className="ac-menu" role="menu">
                {classes.map((c) => (
                  <button
                    key={c.subjectId}
                    type="button"
                    role="menuitem"
                    className="ac-menu__item"
                    onClick={() => { setNewMenuOpen(false); createFor(c.subjectId); }}
                  >
                    {c.subjectName}
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
          {subjectsWithWork.map((c) => (
            <button
              key={c.subjectId}
              type="button"
              className={`ac-pill${subjectFilter === String(c.subjectId) ? " is-active" : ""}`}
              onClick={() => setSubjectFilter(String(c.subjectId))}
            >
              {c.subjectName}
            </button>
          ))}
        </div>
      </div>

      <section className="ac-listCard">
        <div className="ac-list">
          {rows.length === 0 ? (
            <div className="ac-emptyRow">
              {batchFilter === ALL_BATCHES
                ? "No assignments yet. Create one and it'll show up here."
                : `No assignments for ${batchFilter}.`}
            </div>
          ) : (
            rows.map((a) => (
              <div key={a.id} className="ac-row ac-row--tall">
                <div className="ac-row__body">
                  <div className="ac-row__meta">
                    <span className={`subj-chip subj-chip--${subjectChipSlot(a.subjectName)}`}>
                      {a.subjectName}
                    </span>
                    {/* Always teal/"Due {date}" — see the decorated useMemo above
                        for why this never turns into an Overdue/Closed color. */}
                    <span className="ac-tag ac-tag--teal">{a.stLabel}</span>
                  </div>
                  <div className="ac-row__topic">{a.title}</div>
                  {a.meta && <div className="ac-row__sub">{a.meta}</div>}
                </div>

                {/* The design's row carries ONE action (dc.html line 1766),
                    labelled "Review" for the teacher branch (line 3295:
                    `btnText: isStudent ? ... : "Review"`) — it leads to the
                    submissions view, which is what a teacher opens an
                    assignment for; edit and delete sit behind the overflow
                    menu, reusing the design's Manage▾ pattern. */}
                <div className="ac-row__actions">
                  <div className="ac-menuWrap">
                    <button
                      type="button"
                      className="ac-btn ac-btn--icon"
                      aria-label="More actions"
                      aria-haspopup="menu"
                      aria-expanded={rowMenu === a.id}
                      onClick={() => setRowMenu(rowMenu === a.id ? null : a.id)}
                    >
                      <FiMoreHorizontal size={13} aria-hidden="true" />
                    </button>
                    {rowMenu === a.id && (
                      <div className="ac-menu" role="menu">
                        <button
                          type="button"
                          role="menuitem"
                          className="ac-menu__item"
                          onClick={() => { setRowMenu(null); handleEdit(a); }}
                        >
                          <FiEdit2 size={13} aria-hidden="true" />
                          Edit assignment
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="ac-menu__item ac-menu__item--danger"
                          disabled={a.total_submissions > 0 || deletingId === a.id}
                          title={
                            a.total_submissions > 0
                              ? "Cannot delete — has submissions"
                              : "Delete assignment"
                          }
                          onClick={() => { setRowMenu(null); askDelete(a); }}
                        >
                          <FiTrash2 size={13} aria-hidden="true" />
                          {deletingId === a.id ? "Deleting…" : "Delete assignment"}
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="ac-btn"
                    onClick={() =>
                      navigate(`/teacher/classes/${a.subjectId}/assignments/${a.id}/submissions`)
                    }
                  >
                    Review
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
      <ConfirmDialog
        dialog={confirmDlg && { ...confirmDlg, busy: deletingId != null }}
        onClose={() => setConfirmDlg(null)}
      />
    </div>
  );
}
