/**
 * src/utils/chapterTagPicker.js
 *
 * Pure state-transition + payload-shaping helpers for `ChapterTagPicker`
 * (src/components/ChapterTagPicker.jsx). Pulled out of the component on
 * purpose: this repo has no test runner configured yet (no vitest/jest, no
 * `test` script — see the Phase 4 handoff notes), so the one thing we CAN do
 * today is keep the logic BUILD_GUIDE.md calls out for unit tests — dedupe
 * and mutual exclusion — as plain functions with no React/DOM dependency,
 * ready to import into a test file the moment test infra exists.
 *
 * Contract (design_handoff_quiz_system/README.md § The shared chapter picker):
 *   value = { chapterIds: number[], customLabels: string[],
 *             noSpecific: boolean, note: string }
 */

export const EMPTY_CHAPTER_VALUE = Object.freeze({
  chapterIds: [],
  customLabels: [],
  noSpecific: false,
  note: "",
});

/** Case/whitespace-insensitive compare key. */
export function normalizeLabel(s) {
  return (s || "").trim().toLowerCase();
}

/** Find a syllabus chapter whose name matches `label` case-insensitively. */
export function findMatchingChapter(chapters, label) {
  const key = normalizeLabel(label);
  if (!key) return undefined;
  return (chapters || []).find((c) => normalizeLabel(c.name) === key);
}

/** Does `customLabels` already contain `label`, case-insensitively? */
export function hasCustomLabel(customLabels, label) {
  const key = normalizeLabel(label);
  return (customLabels || []).some((l) => normalizeLabel(l) === key);
}

/**
 * Toggle a syllabus chapter on/off. Selecting any chapter clears
 * `noSpecific` — the two are mutually exclusive.
 */
export function toggleChapterSelection(value, chapterId) {
  const chapterIds = value.chapterIds.includes(chapterId)
    ? value.chapterIds.filter((id) => id !== chapterId)
    : [...value.chapterIds, chapterId];
  return { ...value, chapterIds, noSpecific: false };
}

/**
 * Toggle "no specific chapter". Turning it ON clears every chapter AND every
 * custom label — it is an explicit alternative to tagging, not one more tag.
 */
export function toggleNoSpecific(value) {
  if (value.noSpecific) return { ...value, noSpecific: false };
  return { ...value, noSpecific: true, chapterIds: [], customLabels: [] };
}

export function removeCustomLabel(value, label) {
  return { ...value, customLabels: value.customLabels.filter((l) => l !== label) };
}

/**
 * Resolve a typed custom-chapter entry against BOTH the syllabus list and the
 * labels already added, per the house rule:
 *   - matches a syllabus chapter (case-insensitive)  -> select that chapter,
 *     don't create a near-duplicate label
 *   - matches an already-added label (case-insensitive) -> no-op, surface a
 *     message; never add a second copy
 *   - otherwise -> add the trimmed label
 *
 * Returns { status, value, message } — `value` is the unchanged input on any
 * non-mutating outcome so callers can always do `setValue(result.value)`.
 */
export function resolveCustomInput(chapters, value, rawLabel) {
  const label = (rawLabel || "").trim();
  if (!label) return { status: "empty", value, message: "" };

  const hit = findMatchingChapter(chapters, label);
  if (hit) {
    if (value.chapterIds.includes(hit.id)) {
      return { status: "already-selected", value, message: "That chapter is already picked." };
    }
    return {
      status: "selected-existing-chapter",
      value: { ...value, chapterIds: [...value.chapterIds, hit.id], noSpecific: false },
      message: "",
    };
  }

  if (hasCustomLabel(value.customLabels, label)) {
    return { status: "duplicate-label", value, message: "You've already added that one." };
  }

  return {
    status: "added-label",
    value: { ...value, customLabels: [...value.customLabels, label], noSpecific: false },
    message: "",
  };
}

/** Shape the API expects, from this component's value. */
export function toChapterPayload(value) {
  const { chapterIds = [], customLabels = [], noSpecific = false, note = "" } = value || {};
  return {
    chapter_tags: [
      ...chapterIds.map((id, i) => ({ chapter: id, order: i })),
      ...customLabels.map((label, i) => ({
        chapter: null,
        custom_label: label,
        order: chapterIds.length + i,
      })),
    ],
    no_specific_chapter: noSpecific,
    chapter_note: note,
  };
}

/** Inverse of `toChapterPayload`, for populating the picker in edit mode. */
export function fromChapterPayload(data) {
  const tags = data?.chapter_tags || [];
  return {
    chapterIds: tags.filter((t) => t.chapter_id ?? t.chapter).map((t) => t.chapter_id ?? t.chapter),
    customLabels: tags.filter((t) => !(t.chapter_id ?? t.chapter)).map((t) => t.custom_label),
    noSpecific: !!data?.no_specific_chapter,
    note: data?.chapter_note || "",
  };
}
