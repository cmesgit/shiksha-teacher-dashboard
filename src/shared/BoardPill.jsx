// ──────────────────────────────────────────────────────────────────────────
// BoardPill — the board (MBSE / CBSE) shown next to a course, subject, batch
// or session name. See boardLabel.js for WHY the board has to appear
// everywhere, and for the string-building helpers this shares its reader with.
//
// Component only. `boardNameOf`/`courseLabel` deliberately live in
// boardLabel.js — react-refresh forbids non-component exports from a component
// file, and most call sites need the string helpers, not this element.
// ──────────────────────────────────────────────────────────────────────────

import { boardNameOf } from "./boardLabel";
import "./BoardPill.css";

/**
 * Renders NOTHING when there is no board — most non-academic courses
 * (coaching/competitive) legitimately have none, and an "—" placeholder on
 * every one of those rows would be noise.
 *
 * @param board  anything boardNameOf understands
 * @param tone   "soft" (default) filled pill | "text" bare inline text, for
 *               dense rows and sidebars where a filled pill is too loud
 * @param className  extra classes, so a caller can slot this into an existing
 *               pill row without fighting the layout
 */
export default function BoardPill({ board, tone = "soft", className = "", ...rest }) {
  const name = boardNameOf(board);
  if (!name) return null;
  return (
    <span
      className={`board-pill board-pill--${tone}${className ? ` ${className}` : ""}`}
      /* "MBSE" on its own is opaque to a screen-reader user (and to a parent).
         The visible text stays short; the accessible name says what it is. */
      title={`Board: ${name}`}
      aria-label={`Board: ${name}`}
      {...rest}
    >
      {name}
    </span>
  );
}
