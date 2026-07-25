// Deterministic subject -> colour-slot mapping so the same subject always
// gets the same chip colour everywhere it appears, without needing a
// per-subject config table. Ported from the student dashboard's
// utils/subjectChips.js (same hash + palette) so subject chips read
// consistently across both apps.

function hashString(name) {
  const str = name || "";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// Canonical {bg, ink} palette — the single source of truth for "same subject,
// same colour everywhere it appears" in this app.
const SUBJECT_PALETTE = [
  { bg: "#e6f4f6", ink: "#13899b" }, // teal
  { bg: "#e8edfb", ink: "#1d4ed8" }, // info / blue
  { bg: "#fef3ec", ink: "#c2701c" }, // warning / amber
  { bg: "#ecf8ee", ink: "#2f9d42" }, // success / green
  { bg: "#f4e6e6", ink: "#7a1c1c" }, // maroon
  { bg: "#f1e9fb", ink: "#7c3aed" }, // violet
];

export function subjectChipPalette(name) {
  return SUBJECT_PALETTE[hashString(name) % SUBJECT_PALETTE.length];
}
