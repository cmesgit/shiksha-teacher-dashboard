// Deterministic subject -> colour-slot mapping so the same subject always gets
// the same chip colour everywhere it appears (Assignments list, Assignment
// detail, Recordings, Dashboard, Live Sessions, …). The design handoff calls
// for exactly this: "Keep one palette entry per subject and reuse it
// everywhere that subject appears."
//
// ONE palette, ONE modulus. Both accessors below index the same array, so the
// CSS-class route (subjectChipSlot -> .subj-chip--N) and the inline-style route
// (subjectChipPalette -> {bg, ink}) always agree.
//
// Kept in step with the student dashboard's copy (same hash, same palette, same
// modulus) so a subject reads the same colour in both apps. This file is not
// in shared/sync.mjs — if you change one, change both.

// Mirrors --subj-1..6-{bg,ink} in shared/tokens.css. Kept here as literals only
// because inline styles can't read a CSS custom property; prefer the
// .subj-chip--N classes (which do use the tokens) wherever a class will do.
const SUBJECT_PALETTE = [
  { bg: "#e6f4f6", ink: "#13899b" }, // 0 teal
  { bg: "#e8edfb", ink: "#1d4ed8" }, // 1 info / blue
  { bg: "#fef3ec", ink: "#c2701c" }, // 2 warning / amber
  { bg: "#ecf8ee", ink: "#2f9d42" }, // 3 success / green
  { bg: "#f4e6e6", ink: "#7a1c1c" }, // 4 maroon
  { bg: "#f1e9fb", ink: "#7c3aed" }, // 5 violet
];

export const SUBJECT_SLOT_COUNT = SUBJECT_PALETTE.length;

function hashString(name) {
  const str = name || "";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Slot index 0..5 — pair with the `.subj-chip--N` classes in academyCommon.css. */
export function subjectChipSlot(name) {
  if (!name) return 0;
  return hashString(name) % SUBJECT_SLOT_COUNT;
}

/** The same slot as an inline-style `{bg, ink}` pair. */
export function subjectChipPalette(name) {
  return SUBJECT_PALETTE[subjectChipSlot(name)];
}

export function subjectInitials(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return "S";
  return trimmed.slice(0, 1).toUpperCase() + (trimmed.slice(1, 2).toLowerCase() || "");
}
