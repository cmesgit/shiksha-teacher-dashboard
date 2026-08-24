/**
 * T5's right rail — "What your students see".
 *
 * design_handoff_quiz_system/README.md §"T5 · Create assignment (teacher)":
 * a 320px rail holding a real preview of the student assignment card
 * (chapter chips + the teacher's note as a quote block) and an info note
 * explaining what tagging chapters actually buys the student.
 *
 * The point of the rail is that chapter tagging is otherwise invisible work:
 * the teacher ticks some chapters and nothing on their own screen changes.
 * This shows the payoff, so the field reads as useful rather than as
 * bureaucracy — which is why the copy in the info note is exact.
 *
 * The card mirrors the student app's real assignment row
 * (`shiksha-student-dashboard/src/pages/SubjectsAssignments.jsx`: a meta row
 * of chips above the title, then the due line). It is a static rendering, not
 * a shared component — the two apps have separate stylesheets and no shared
 * component layer, so importing across them is not an option.
 */
import { useMemo } from "react";
import "../styles/assignment-preview-rail.css";

/** "12 Mar" — matches the student card's short due format. */
function formatDue(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function AssignmentPreviewRail({
  title,
  dueDate,
  maxMarks,
  chapterValue,
  chapters = [],
}) {
  const {
    chapterIds = [],
    customLabels = [],
    noSpecific = false,
    note = "",
  } = chapterValue || {};

  // ids → names. A tagged chapter that isn't in the fetched list (a custom one
  // promoted moments ago, or a list that failed to load) is skipped rather
  // than shown as a raw uuid.
  const chipLabels = useMemo(() => {
    // `title` only — see ChapterTagPicker's header. A `?? c.name` fallback here
    // would have masked the very mismatch that made every chapter render blank.
    const byId = new Map(chapters.map((c) => [String(c.id), c.title]));
    const named = chapterIds
      .map((id) => byId.get(String(id)))
      .filter(Boolean);
    return [...named, ...customLabels.filter(Boolean)];
  }, [chapterIds, customLabels, chapters]);

  const due = formatDue(dueDate);

  return (
    <aside className="apr-rail" aria-label="Student preview">
      <h2 className="apr-rail__title">What your students see</h2>

      <div className="apr-card">
        <div className="apr-card__meta">
          {noSpecific ? (
            <span className="apr-chip apr-chip--muted">No specific chapter</span>
          ) : (
            chipLabels.map((label) => (
              <span className="apr-chip" key={label}>
                {label}
              </span>
            ))
          )}
        </div>

        <p className="apr-card__topic">
          {title.trim() || "Your assignment title"}
        </p>

        <p className="apr-card__due">
          {due ? `Due ${due}` : "No due date yet"}
          {maxMarks ? ` · out of ${maxMarks}` : ""}
        </p>

        {note.trim() && <blockquote className="apr-note">{note.trim()}</blockquote>}
      </div>

      <p className="apr-info">
        Chapters you tag also drive the student&rsquo;s weak-area report and
        their chapter-wise practice.
      </p>
    </aside>
  );
}
