// ──────────────────────────────────────────────────────────────────────────
// Board label helpers — reading and formatting a course's board (MBSE / CBSE).
//
// Why this exists
// ---------------
// Course titles were normalised to plain "Class 9" / "Class 11 Science" with
// the board deliberately stripped out. Two published courses now share a title
// and differ only by board — MBSE and CBSE run their own Class 9 with a
// genuinely different syllabus, so they are NOT duplicates. Every screen that
// names a course without its board is therefore ambiguous, and a picker that
// does so is worse than ambiguous: scheduling a session or uploading material
// against the wrong "Class 9" is a real, silent mistake.
//
// Separate from BoardPill.jsx because `react-refresh/only-export-components`
// forbids exporting non-components from a component file — the same rule that
// moved the course-cover logic out of CourseShopCard.jsx into courseCover.js.
// It also means these are directly testable without pulling in React.
// ──────────────────────────────────────────────────────────────────────────

/* Read a board name off almost anything, or "" if there isn't one.
   The backend is genuinely inconsistent here and all of these ship today:
     "MBSE"                              a flat string
     { name: "MBSE" }                    a nested Board
     { board_name: "MBSE" }              the convention for NEW payloads
     { board: "MBSE" }                   /teacher/my-batches/, /courses/:id/public/
     { board: { name: "MBSE" } }         CourseSerializer, SubjectSerializer
     { course: { board: {...} } }        anything holding a nested course
   Rather than make ~50 call sites each remember which shape their endpoint
   returns, this normalises all of them. `board` is nullable on Course, so ""
   is a legitimate and common answer — never render a placeholder for it. */
export function boardNameOf(src) {
  if (!src) return "";
  if (typeof src === "string") return src.trim();

  // A bare Board object. Guarded against objects that merely HAVE a name —
  // a subject row's `name` is the subject, and a course row's is the course,
  // so anything carrying its own board/board_name must fall through to below.
  if (typeof src.name === "string" && !src.title && !src.board && !src.board_name) {
    return src.name.trim();
  }
  if (typeof src.board_name === "string") return src.board_name.trim();

  const b = src.board;
  if (typeof b === "string") return b.trim();
  if (b && typeof b.name === "string") return b.name.trim();

  // Last resort: an object that merely CONTAINS a course (a session, an
  // assignment row, a conversation). Only one hop — deeper than that and the
  // caller should pass the course itself.
  if (src.course) return boardNameOf(src.course);
  return "";
}

/* "Class 9" + "MBSE" -> "Class 9 · MBSE", for the many places that build a
   label string rather than render elements — `[course_name, batch_name].join(" · ")`
   meta rows, <option> labels, search haystacks, confirm-dialog copy.
   Returns the title untouched when there is no board, so it is always safe to
   wrap an existing expression in this. Numeric titles are coerced and kept —
   a bare class number is a legitimate label. */
export function courseLabel(title, boardSource) {
  const t = (title == null ? "" : String(title)).trim();
  const b = boardNameOf(boardSource === undefined ? null : boardSource);
  if (!t) return b;
  if (!b || t.includes(b)) return t;   // don't double up if it's already there
  return `${t} · ${b}`;
}
