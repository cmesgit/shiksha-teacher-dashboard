/**
 * src/utils/recordingTrim.js
 *
 * Pure timecode + trim-window helpers for TrimRecordingPanel. Kept out of the
 * component for the same reason chapterTagPicker.js is: the arithmetic is the
 * part that can be wrong silently, and it has no business needing a DOM to be
 * checked.
 *
 * WHY THE PANEL NEEDS THESE AT ALL
 * The Bunny player is a cross-origin iframe. We cannot scrub it, and we cannot
 * read its clock synchronously — so the trim UI cannot be "drag the scrubber
 * and read the position back". It is built instead from `duration_seconds`,
 * which the SERVER already knows, and every position the teacher picks is a
 * number this module parses, formats and range-checks on its own.
 *
 * `isValidWindow` deliberately mirrors
 * courses/serializers_recordings.py::SessionRecordingUpdateSerializer._validate_trim
 * rule for rule (end > start; neither past `duration_seconds`). It is a
 * courtesy check that lets the panel say so before the request, NOT a
 * substitute for it — the server re-validates, and a DB constraint sits behind
 * that. Keep the two in step; if the backend rule changes, this one is wrong.
 *
 * Covered by ./recordingTrim.test.js (`npm test`).
 */

/**
 * Parse a teacher-typed timecode into whole seconds, or null when it isn't one.
 *
 * Accepts `ss`, `mm:ss` and `h:mm:ss` — a bare "5" is five seconds, not five
 * minutes, because that is what every video tool does. Returns null (not 0,
 * and not NaN) for anything unparseable, so a caller can tell "the teacher
 * cleared this field" from "the teacher wants position zero". Those two mean
 * genuinely different things to the API: null CLEARS the trim, 0 sets it.
 *
 * Rejected on purpose:
 *   · negatives — there is no such position, and a stray "-" should not
 *     silently become its absolute value
 *   · a non-leading part over 59 ("1:75") — ambiguous between 75 seconds and a
 *     typo for 1:15, and guessing wrong trims the wrong minute of a lesson
 *   · decimals — the API field is an integer count of seconds
 */
export function parseTimecode(input) {
  // A number goes through unchanged (bar the same range rules) so callers can
  // hand this either a raw field value or an already-parsed position.
  if (typeof input === "number") {
    return Number.isFinite(input) && input >= 0 ? Math.floor(input) : null;
  }

  const raw = String(input ?? "").trim();
  if (!raw) return null;

  const parts = raw.split(":");
  if (parts.length > 3) return null;

  const nums = [];
  for (const part of parts) {
    const p = part.trim();
    // Digits only. This is what rejects "", "-5", "1.5", "abc" and "1e3" —
    // Number() would happily coerce three of those four.
    if (!/^\d+$/.test(p)) return null;
    nums.push(Number(p));
  }

  // Only the LEADING unit may exceed 59: "90" is a legal 90 seconds, "1:90"
  // is not a legal 1 minute 90 seconds.
  for (let i = 1; i < nums.length; i += 1) {
    if (nums[i] > 59) return null;
  }

  return nums.reduce((acc, n) => acc * 60 + n, 0);
}

/**
 * Render whole seconds as `m:ss`, or `h:mm:ss` once past an hour.
 *
 * Returns "" for null/undefined/NaN rather than "0:00", because these values
 * drive text INPUTS: an unset trim must show an empty box, not a zero the
 * teacher then has to clear before typing.
 */
export function formatTimecode(seconds) {
  if (!Number.isFinite(seconds)) return "";

  const total = Math.max(0, Math.floor(seconds));
  const ss = String(total % 60).padStart(2, "0");
  const mm = Math.floor(total / 60) % 60;
  const hh = Math.floor(total / 3600);

  if (hh > 0) return `${hh}:${String(mm).padStart(2, "0")}:${ss}`;
  return `${mm}:${ss}`;
}

/**
 * Fit a {start, end} pair into a real video, preserving "unset" as null.
 *
 * This is what the sliders and the text fields both commit through, so a
 * window that is inverted or past the end of the video cannot be held in
 * component state in the first place — the panel never has to render an
 * impossible track.
 *
 * `duration` under one second is treated as unknown: `duration_seconds` is
 * NULL until Bunny finishes transcoding and something polls the status, and a
 * zero would otherwise clamp every position to 0 and read as "the teacher
 * trimmed the whole lesson away".
 */
export function clampTrim({ start, end, duration } = {}) {
  const max =
    Number.isFinite(duration) && duration >= 1 ? Math.floor(duration) : null;

  const norm = (v) => {
    if (!Number.isFinite(v)) return null;
    let n = Math.floor(v);
    if (n < 0) n = 0;
    if (max !== null && n > max) n = max;
    return n;
  };

  let s = norm(start);
  let e = norm(end);

  // Non-empty window. The end moves rather than the start, because the handle
  // being dragged past its partner is nearly always the end one; only when the
  // start is already pinned at the very end of the video does the start give
  // way instead.
  if (s !== null && e !== null && e <= s) {
    if (max === null) {
      e = s + 1;
    } else if (s >= max) {
      s = max - 1;
      e = max;
    } else {
      e = Math.min(s + 1, max);
    }
  }

  return { start: s, end: e };
}

/**
 * Would the API accept this window? Mirrors the serializer's `_validate_trim`.
 *
 * Either side may be null — that is a one-sided trim ("skip the first two
 * minutes", "stop before the noise at the end"), which is legal.
 */
export function isValidWindow({ start, end, duration } = {}) {
  const unset = (v) => v === null || v === undefined;
  const ok = (v) => unset(v) || (Number.isFinite(v) && v >= 0);
  if (!ok(start) || !ok(end)) return false;

  const s = unset(start) ? null : start;
  const e = unset(end) ? null : end;

  if (s !== null && e !== null && e <= s) return false;

  if (Number.isFinite(duration) && duration > 0) {
    if (s !== null && s > duration) return false;
    if (e !== null && e > duration) return false;
  }

  return true;
}
