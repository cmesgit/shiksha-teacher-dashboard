/**
 * Contract + logic tests for the shared chapter picker.
 *
 * These exist because this component shipped TWO silent-no-op bugs that every
 * suite on both sides stayed green through, and that only browser-driving the
 * screen found. Both were key-spelling mismatches against the Django API:
 *
 *   1. toChapterPayload() emitted {chapter, custom_label}; resolve_tags()
 *      reads {chapter_id, label}. `chapter_tags` is validated as a bare list
 *      of dicts, so DRF accepted the wrong keys and skipped every entry as a
 *      blank row — a 201 that saved zero chapters.
 *   2. The picker read and wrote chapter `name`; ChapterSerializer exposes
 *      only `title`. Every syllabus row rendered blank, search matched
 *      nothing, dedupe never fired, and the create call 400'd every time.
 *
 * Neither is catchable by testing this module against itself, so the
 * WIRE FORMAT tests below assert literal key names rather than round-tripping
 * through our own helpers. If someone renames a key to match a refactor on
 * this side only, these fail — which is the entire point.
 */
import { describe, it, expect } from "vitest";
import {
  EMPTY_CHAPTER_VALUE,
  findMatchingChapter,
  hasCustomLabel,
  normalizeLabel,
  removeCustomLabel,
  resolveCustomInput,
  toggleChapterSelection,
  toggleNoSpecific,
  toChapterPayload,
  fromChapterPayload,
} from "./chapterTagPicker";

/** Shaped exactly like courses.ChapterSerializer output. */
const CHAPTERS = [
  { id: "c-algebra", title: "Algebra", is_custom: false },
  { id: "c-trig", title: "Trigonometry", is_custom: false },
  { id: "c-stats", title: "Statistics", is_custom: true },
];

describe("wire format — chapter_tags payload", () => {
  it("emits chapter_id and label, never chapter/custom_label", () => {
    const payload = toChapterPayload({
      chapterIds: ["c-algebra"],
      customLabels: ["Mixed revision"],
      noSpecific: false,
      note: "ch 3-4",
    });

    const keys = new Set(payload.chapter_tags.flatMap(Object.keys));
    // The whole vocabulary courses.chapter_tags._TAG_KEYS accepts. Anything
    // outside it is now a 400 from resolve_tags(), so an extra key here is a
    // broken create, not a cosmetic difference.
    expect([...keys].sort()).toEqual(["chapter_id", "label", "order"]);
    expect(keys.has("chapter")).toBe(false);
    expect(keys.has("custom_label")).toBe(false);
  });

  it("sends a free-text label as chapter_id:null plus label", () => {
    const { chapter_tags } = toChapterPayload({
      chapterIds: [],
      customLabels: ["Board-pattern numericals"],
      noSpecific: false,
      note: "",
    });

    // chapter_id present-but-null takes the `elif raw_label` branch in
    // resolve_tags(), NOT the blank-row branch an absent key would hit.
    expect(chapter_tags).toEqual([
      { chapter_id: null, label: "Board-pattern numericals", order: 0 },
    ]);
  });

  it("names the sibling fields no_specific_chapter and chapter_note", () => {
    const payload = toChapterPayload({ ...EMPTY_CHAPTER_VALUE, noSpecific: true, note: "hi" });
    expect(payload.no_specific_chapter).toBe(true);
    expect(payload.chapter_note).toBe("hi");
  });

  it("orders chapters first, then labels, with a contiguous order", () => {
    const { chapter_tags } = toChapterPayload({
      chapterIds: ["c-algebra", "c-trig"],
      customLabels: ["Revision"],
      noSpecific: false,
      note: "",
    });
    expect(chapter_tags.map((t) => t.order)).toEqual([0, 1, 2]);
  });
});

describe("wire format — chapter objects", () => {
  it("matches on `title`, the only field the serializer exposes", () => {
    expect(findMatchingChapter(CHAPTERS, "Algebra")?.id).toBe("c-algebra");
  });

  it("does NOT fall back to a `name` field", () => {
    // A tolerant `?? c.name` here is exactly what let the mismatch hide: the
    // picker looked like it worked against a fixture nobody checked against
    // the real serializer.
    const wrongShape = [{ id: "x", name: "Algebra" }];
    expect(findMatchingChapter(wrongShape, "Algebra")).toBeUndefined();
  });
});

describe("fromChapterPayload — the read side", () => {
  it("round-trips what serialize_tags actually emits", () => {
    const value = fromChapterPayload({
      chapter_tags: [
        { chapter_id: "c-algebra", label: "", is_custom: false, order: 0 },
        { chapter_id: null, label: "Mixed revision", is_custom: true, order: 1 },
      ],
      no_specific_chapter: false,
      chapter_note: "revise identities",
    });

    expect(value).toEqual({
      chapterIds: ["c-algebra"],
      customLabels: ["Mixed revision"],
      noSpecific: false,
      note: "revise identities",
    });
  });

  it("survives a payload with no chapter fields at all", () => {
    expect(fromChapterPayload({})).toEqual({
      chapterIds: [], customLabels: [], noSpecific: false, note: "",
    });
    expect(fromChapterPayload(undefined)).toEqual({
      chapterIds: [], customLabels: [], noSpecific: false, note: "",
    });
  });

  it("drops a labelless free-text tag instead of yielding undefined", () => {
    const value = fromChapterPayload({
      chapter_tags: [{ chapter_id: null, label: "", order: 0 }],
    });
    expect(value.customLabels).toEqual([]);
  });

  it("survives a full toChapterPayload round trip", () => {
    const original = {
      chapterIds: ["c-algebra", "c-trig"],
      customLabels: ["Revision"],
      noSpecific: false,
      note: "note",
    };
    expect(fromChapterPayload(toChapterPayload(original))).toEqual(original);
  });
});

describe("mutual exclusion — BUILD_GUIDE Phase 4 item 1", () => {
  it("selecting a chapter clears noSpecific", () => {
    const next = toggleChapterSelection({ ...EMPTY_CHAPTER_VALUE, noSpecific: true }, "c-algebra");
    expect(next.noSpecific).toBe(false);
    expect(next.chapterIds).toEqual(["c-algebra"]);
  });

  it("turning noSpecific ON wipes chapters AND labels", () => {
    const next = toggleNoSpecific({
      chapterIds: ["c-algebra"], customLabels: ["Revision"], noSpecific: false, note: "keep me",
    });
    expect(next).toEqual({
      chapterIds: [], customLabels: [], noSpecific: true, note: "keep me",
    });
  });

  it("turning noSpecific OFF does not resurrect what it cleared", () => {
    const on = toggleNoSpecific({
      chapterIds: ["c-algebra"], customLabels: [], noSpecific: false, note: "",
    });
    expect(toggleNoSpecific(on).chapterIds).toEqual([]);
  });

  it("toggling a selected chapter deselects it", () => {
    const on = toggleChapterSelection(EMPTY_CHAPTER_VALUE, "c-algebra");
    expect(toggleChapterSelection(on, "c-algebra").chapterIds).toEqual([]);
  });
});

describe("dedupe — BUILD_GUIDE Phase 4 item 1", () => {
  it("typing an existing chapter selects it instead of forking a label", () => {
    // The exact case the `name`/`title` bug broke: this silently became
    // "add a duplicate free-text label" for every chapter in the syllabus.
    const r = resolveCustomInput(CHAPTERS, EMPTY_CHAPTER_VALUE, "trigonometry");
    expect(r.status).toBe("selected-existing-chapter");
    expect(r.value.chapterIds).toEqual(["c-trig"]);
    expect(r.value.customLabels).toEqual([]);
  });

  it("ignores case and surrounding whitespace when matching", () => {
    const r = resolveCustomInput(CHAPTERS, EMPTY_CHAPTER_VALUE, "  ALGEBRA  ");
    expect(r.value.chapterIds).toEqual(["c-algebra"]);
  });

  it("reports an already-selected chapter without duplicating it", () => {
    const r = resolveCustomInput(
      CHAPTERS, { ...EMPTY_CHAPTER_VALUE, chapterIds: ["c-trig"] }, "Trigonometry"
    );
    expect(r.status).toBe("already-selected");
    expect(r.value.chapterIds).toEqual(["c-trig"]);
    expect(r.message).toBeTruthy();
  });

  it("refuses a duplicate custom label case-insensitively", () => {
    const r = resolveCustomInput(
      CHAPTERS, { ...EMPTY_CHAPTER_VALUE, customLabels: ["Revision"] }, "revision"
    );
    expect(r.status).toBe("duplicate-label");
    expect(r.value.customLabels).toEqual(["Revision"]);
  });

  it("adds a genuinely new label, trimmed, and clears noSpecific", () => {
    const r = resolveCustomInput(
      CHAPTERS, { ...EMPTY_CHAPTER_VALUE, noSpecific: true }, "  Board-pattern numericals "
    );
    expect(r.status).toBe("added-label");
    expect(r.value.customLabels).toEqual(["Board-pattern numericals"]);
    expect(r.value.noSpecific).toBe(false);
  });

  it("treats a blank entry as a no-op, so a stray Enter changes nothing", () => {
    const value = { ...EMPTY_CHAPTER_VALUE, chapterIds: ["c-algebra"] };
    const r = resolveCustomInput(CHAPTERS, value, "   ");
    expect(r.status).toBe("empty");
    expect(r.value).toBe(value);
  });

  it("matches a custom chapter the teacher already promoted", () => {
    // is_custom chapters are real rows and must dedupe like any other.
    const r = resolveCustomInput(CHAPTERS, EMPTY_CHAPTER_VALUE, "statistics");
    expect(r.value.chapterIds).toEqual(["c-stats"]);
  });
});

describe("small helpers", () => {
  it("normalizeLabel is null-safe", () => {
    expect(normalizeLabel(undefined)).toBe("");
    expect(normalizeLabel("  Mixed  ")).toBe("mixed");
  });

  it("hasCustomLabel ignores case", () => {
    expect(hasCustomLabel(["Revision"], "revision")).toBe(true);
    expect(hasCustomLabel([], "revision")).toBe(false);
  });

  it("removeCustomLabel removes only the exact label", () => {
    const v = { ...EMPTY_CHAPTER_VALUE, customLabels: ["A", "B"] };
    expect(removeCustomLabel(v, "A").customLabels).toEqual(["B"]);
  });

  it("EMPTY_CHAPTER_VALUE is frozen, so no caller can mutate the shared default", () => {
    expect(Object.isFrozen(EMPTY_CHAPTER_VALUE)).toBe(true);
  });
});
