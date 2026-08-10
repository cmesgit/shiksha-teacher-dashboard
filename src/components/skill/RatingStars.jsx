/**
 * RatingStars.jsx — the one rating primitive for the whole Skill feature.
 *
 * Mirrors shiksha-frontend/src/components/skill/RatingStars.jsx (only the two
 * colour tokens differ — this app's palette, not the public site's). Stars
 * fill to the EXACT average: rounding draws 4.6 and 4.9 identically, which
 * erases the difference the directory ranking is built on. Keep the two copies
 * in step — the sample-size rules below are a product decision, not styling.
 *
 * Usage:
 *   <RatingStars value={4.9} size={13} />
 *   <RatingSummary value={4.9} count={63} size={13} />
 */
const FIVE = "★★★★★";

export function RatingStars({ value = 0, size = 13 }) {
  const pct = (Math.max(0, Math.min(5, Number(value) || 0)) / 5) * 100;
  return (
    <span
      aria-label={`${(Number(value) || 0).toFixed(1)} out of 5`}
      style={{
        position: "relative", display: "inline-block", lineHeight: 1,
        fontSize: size, letterSpacing: size * 0.115, color: "#dfe6e2",
      }}
    >
      <span aria-hidden="true">{FIVE}</span>
      <span
        aria-hidden="true"
        style={{
          position: "absolute", left: 0, top: 0, overflow: "hidden",
          whiteSpace: "nowrap", color: "#ff9900", width: `${pct.toFixed(1)}%`,
        }}
      >
        {FIVE}
      </span>
    </span>
  );
}

/**
 * Sample-size rules — the display half of the rating system.
 *
 *   >= MIN_REVIEWS  → show the average and the count, sortable
 *   1 .. MIN-1      → show "New" + the count; the average is withheld and the
 *                     expert is held OUT of the "highest rated" sort
 *   0               → "No reviews yet"; never an empty star row
 *
 * Filtering low-sample experts out entirely would hide new teachers forever
 * (nobody can get a first review); ranking them top makes one review beat 63.
 * Listing them without a sortable average is the only honest option.
 */
export const MIN_REVIEWS = 5;

export function RatingSummary({ value, count = 0, size = 13 }) {
  const base = {
    display: "inline-flex", alignItems: "center", gap: 6,
    fontSize: 12.5, color: "var(--muted, #6b7c83)",
  };

  if (!count) return <span style={base}>No reviews yet</span>;

  if (count < MIN_REVIEWS) {
    return (
      <span style={base}>
        <RatingStars value={value || 0} size={size} />
        <b style={{ color: "var(--ink, #1a2c33)" }}>New</b>
        {count} {count === 1 ? "review" : "reviews"}
      </span>
    );
  }

  return (
    <span style={base}>
      <RatingStars value={value} size={size} />
      <b style={{ color: "var(--ink, #1a2c33)" }}>{Number(value).toFixed(1)}</b> ({count})
    </span>
  );
}

/** True when this expert's average is trustworthy enough to sort on. */
export const isRankable = (count) => (count || 0) >= MIN_REVIEWS;

export default RatingStars;
