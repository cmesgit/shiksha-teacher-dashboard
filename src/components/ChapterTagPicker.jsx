/**
 * src/components/ChapterTagPicker.jsx
 *
 * THE shared chapter picker (design_handoff_quiz_system/README.md §"The
 * shared chapter picker"). One component for every content-creation surface:
 * quiz builder, create assignment, upload study material, schedule live
 * session, upload recording. Wired into Create Assignment first (T5, full
 * variant, Phase 4) — the other surfaces still use their old single-select.
 *
 * Replaces the old required single-select `<select>` of fixed course
 * chapters. Chapters are now OPTIONAL and MULTIPLE, a teacher can type their
 * own, and a custom one can be promoted into the course syllabus for reuse.
 *
 * Contract:
 *   value = { chapterIds: number[], customLabels: string[],
 *             noSpecific: boolean, note: string }
 * The parent owns `value`; this component is controlled. State-transition and
 * payload-shaping logic lives in ../utils/chapterTagPicker.js (pure, no
 * React) so it can be unit-tested once this repo has test infra.
 *
 * Endpoints:
 *   GET  /courses/subjects/:subjectId/chapters/     syllabus + this teacher's custom
 *   POST /courses/subjects/:subjectId/chapters/     { title, is_custom: true }
 * The chapter field is `title` on both sides — `courses.ChapterSerializer`
 * exposes no `name` at all. Keep every read and write on that one spelling.
 * The POST only happens on SAVE, via the imperative `resolveForSubmit()`
 * handle below — never while typing, so a half-filled form doesn't litter the
 * syllabus with chapters the teacher never finished creating.
 */

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { IoBookmarkOutline, IoClose, IoAdd, IoCheckmark, IoSearch, IoPencil } from "react-icons/io5";
import toast from "react-hot-toast";
import api from "../api/apiClient";
import {
  EMPTY_CHAPTER_VALUE,
  toggleChapterSelection,
  toggleNoSpecific as toggleNoSpecificValue,
  removeCustomLabel,
  resolveCustomInput,
} from "../utils/chapterTagPicker";
import "../styles/chapter-tag-picker.css";

/** Create a courses.Chapter for each custom label. Returns the new ids, in
 *  the same order as `labels`. */
async function promoteCustomLabels(subjectId, labels) {
  const created = await Promise.all(
    // `title`, not `name`: SubjectChaptersView.post() reads request.data["title"]
    // and 400s "Chapter name is required." on anything else — so this call had
    // never once succeeded, and every attempt to promote a teacher-typed
    // chapter fell into the catch below and silently downgraded to free text.
    labels.map((title) =>
      api.post(`/courses/subjects/${subjectId}/chapters/`, { title, is_custom: true }).then((r) => r.data)
    )
  );
  return created.map((c) => c.id);
}

const ChapterTagPicker = forwardRef(function ChapterTagPicker(
  {
    subjectId,
    value,
    onChange,
    variant = "compact",
    allowPromote = true,
    noteLabel = "Your note",
    noteHint = "optional, shown with this to students",
    notePlaceholder = "What this covers, what to revise first…",
    // Called with the fetched chapter list. `value` carries ids only, so a
    // parent that needs to *display* the selection (T5's preview rail renders
    // real chapter chips) has no way to turn an id into a name on its own.
    // Handing the list up costs nothing and avoids a second identical request.
    onChaptersLoaded,
  },
  ref
) {
  const current = value || EMPTY_CHAPTER_VALUE;
  const { chapterIds = [], customLabels = [], noSpecific = false, note = "" } = current;

  const [chapters, setChapters] = useState([]);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [promote, setPromote] = useState(allowPromote);
  const [error, setError] = useState("");
  const draftRef = useRef(null);

  // Held in a ref so an inline arrow from the parent can't retrigger the
  // fetch — this effect keys on subjectId alone and must stay that way.
  const onChaptersLoadedRef = useRef(onChaptersLoaded);
  useEffect(() => {
    onChaptersLoadedRef.current = onChaptersLoaded;
  });

  useEffect(() => {
    if (!subjectId) return;
    let cancelled = false;
    api
      .get(`/courses/subjects/${subjectId}/chapters/`)
      .then((res) => {
        if (cancelled) return;
        const list = res.data?.chapters || res.data || [];
        setChapters(list);
        onChaptersLoadedRef.current?.(list);
      })
      .catch(() => {
        // A failed chapter list must not block the form — the teacher can
        // still type their own label and save.
        if (cancelled) return;
        setChapters([]);
        onChaptersLoadedRef.current?.([]);
      });
    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  // Promoting is an on-save decision, not part of the controlled `value` —
  // expose it as an imperative step the parent's submit handler awaits before
  // building its payload. Zero custom labels (or promote off) is a no-op.
  useImperativeHandle(
    ref,
    () => ({
      async resolveForSubmit() {
        if (!allowPromote || !promote || customLabels.length === 0) return current;
        try {
          const newIds = await promoteCustomLabels(subjectId, customLabels);
          const next = { chapterIds: [...chapterIds, ...newIds], customLabels: [], noSpecific, note };
          onChange(next);
          return next;
        } catch {
          toast.error("Couldn't save the new chapters to the course — sending them as text instead.");
          return current;
        }
      },
    }),
    [allowPromote, promote, customLabels, chapterIds, noSpecific, note, subjectId, current, onChange]
  );

  const set = (patch) => onChange({ chapterIds, customLabels, noSpecific, note, ...patch });

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chapters;
    return chapters.filter((c) => (c.title || "").toLowerCase().includes(q));
  }, [chapters, query]);

  const toggleChapter = (id) => set(toggleChapterSelection(current, id));
  const toggleNoSpecific = () => set(toggleNoSpecificValue(current));
  const removeLabel = (label) => set(removeCustomLabel(current, label));

  const addDraft = () => {
    const result = resolveCustomInput(chapters, current, draft);
    if (result.status === "empty") return;
    if (result.status === "duplicate-label" || result.status === "already-selected") {
      setError(result.message);
      return;
    }
    onChange(result.value);
    setDraft("");
    setError("");
  };

  const onDraftKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addDraft();
    }
  };

  /* ── Compact variant: chip row + note (builder, material, live session) ── */
  if (variant === "compact") {
    return (
      <div className="ctp ctp--compact">
        <div className="ctp__head">
          <IoBookmarkOutline className="ctp__headIcon" />
          <span className="ctp__headTitle">What is this about?</span>
          <span className="ctp__headHint">optional — helps students find it later</span>
        </div>

        <div className="ctp__chips">
          {chapters.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`ctp__chip${chapterIds.includes(c.id) ? " ctp__chip--on" : ""}${
                c.is_custom ? " ctp__chip--custom" : ""
              }`}
              onClick={() => toggleChapter(c.id)}
              aria-pressed={chapterIds.includes(c.id)}
            >
              {chapterIds.includes(c.id) && <IoCheckmark />}
              {c.is_custom && <IoPencil />}
              {c.title}
            </button>
          ))}

          {customLabels.map((l) => (
            <span key={l} className="ctp__chip ctp__chip--on ctp__chip--custom">
              <IoPencil /> {l}
              <button type="button" className="ctp__chipX" onClick={() => removeLabel(l)} aria-label={`Remove ${l}`}>
                <IoClose />
              </button>
            </span>
          ))}

          <button type="button" className="ctp__chip ctp__chip--add" onClick={() => draftRef.current?.focus()}>
            <IoAdd /> Add your own
          </button>

          <button
            type="button"
            className={`ctp__chip${noSpecific ? " ctp__chip--on" : ""}`}
            onClick={toggleNoSpecific}
            aria-pressed={noSpecific}
          >
            No specific chapter
          </button>
        </div>

        <div className="ctp__addRow">
          <input
            ref={draftRef}
            className="ctp__input"
            placeholder="e.g. Rotational motion (extra)"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onDraftKeyDown}
            aria-label="Add your own chapter or topic"
          />
          <button type="button" className="ctp__addBtn" onClick={addDraft} disabled={!draft.trim()}>
            Add
          </button>
        </div>
        {error && <div className="ctp__error">{error}</div>}

        {allowPromote && customLabels.length > 0 && (
          <label className="ctp__check">
            <input type="checkbox" checked={promote} onChange={(e) => setPromote(e.target.checked)} />
            Save these to the course so I can pick them next time
          </label>
        )}

        <label className="ctp__noteField">
          <span className="ctp__noteLabel">
            {noteLabel} <em>— {noteHint}</em>
          </span>
          <textarea
            className="ctp__note"
            placeholder={notePlaceholder}
            value={note}
            onChange={(e) => set({ note: e.target.value })}
          />
        </label>
      </div>
    );
  }

  /* ── Full variant: searchable list + custom block + note (assignment) ── */
  return (
    <div className="ctp ctp--full">
      <div className="ctp__fullHead">
        <span className="ctp__fullIcon">
          <IoBookmarkOutline />
        </span>
        <div>
          <div className="ctp__fullTitle">What is this about?</div>
          <div className="ctp__fullSub">
            Pick any chapters from the course, add your own, or skip it entirely. Nothing here is required.
          </div>
        </div>
      </div>

      <div className="ctp__search">
        <IoSearch />
        <input
          placeholder="Find a chapter…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search chapters"
        />
      </div>

      <div className="ctp__list" role="group" aria-label="Chapters in this course">
        <div className="ctp__listHead">From the course syllabus</div>
        {visible.length === 0 ? (
          <div className="ctp__listEmpty">No chapters match. You can still add your own below.</div>
        ) : (
          visible.map((c) => {
            const on = chapterIds.includes(c.id);
            return (
              <label key={c.id} className={`ctp__row${on ? " ctp__row--on" : ""}`}>
                <input type="checkbox" checked={on} onChange={() => toggleChapter(c.id)} />
                <span className="ctp__rowBox" aria-hidden="true">
                  {on && <IoCheckmark />}
                </span>
                <span className="ctp__rowName">{c.title}</span>
                {c.material_count != null && <span className="ctp__rowMeta">{c.material_count} materials</span>}
              </label>
            );
          })
        )}
      </div>

      <div className="ctp__custom">
        <div className="ctp__customHead">
          <IoPencil /> Your own chapter or topic
        </div>
        {customLabels.length > 0 && (
          <div className="ctp__chips">
            {customLabels.map((l) => (
              <span key={l} className="ctp__chip ctp__chip--on ctp__chip--custom">
                {l}
                <button type="button" className="ctp__chipX" onClick={() => removeLabel(l)} aria-label={`Remove ${l}`}>
                  <IoClose />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="ctp__addRow">
          <input
            ref={draftRef}
            className="ctp__input"
            placeholder="e.g. Board-pattern numericals"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onDraftKeyDown}
            aria-label="Add your own chapter or topic"
          />
          <button type="button" className="ctp__addBtn" onClick={addDraft} disabled={!draft.trim()}>
            Add
          </button>
        </div>
        {error && <div className="ctp__error">{error}</div>}
        {allowPromote && customLabels.length > 0 && (
          <label className="ctp__check">
            <input type="checkbox" checked={promote} onChange={(e) => setPromote(e.target.checked)} />
            Save these to the course so I can pick them next time
          </label>
        )}
      </div>

      <label className={`ctp__noSpecific${noSpecific ? " ctp__noSpecific--on" : ""}`}>
        <input type="checkbox" checked={noSpecific} onChange={toggleNoSpecific} />
        <span>
          <strong>No specific chapter</strong>
          <em>Use this for revision, general practice or anything that spans the syllabus.</em>
        </span>
      </label>

      <label className="ctp__noteField">
        <span className="ctp__noteLabel">
          {noteLabel} <em>— {noteHint}</em>
        </span>
        <textarea
          className="ctp__note"
          placeholder={notePlaceholder}
          value={note}
          onChange={(e) => set({ note: e.target.value })}
        />
      </label>
    </div>
  );
});

export default ChapterTagPicker;
