/**
 * src/components/EditRecordingModal.jsx
 *
 * Edit a session recording in place — title, description, date, batch,
 * published state, chapter tags and the trim window.
 *
 * There was no edit path at all before this. `RecordingDetailView` was
 * GET-only, so fixing a typo in a recording's title meant opening Django
 * admin; a recording uploaded against the wrong batch was invisible to the
 * class that sat through it until someone with server access moved it. This
 * modal is the client half of `PATCH /courses/recordings/:id/`.
 *
 * PARTIAL, ALWAYS. The endpoint is PATCH and only implements PATCH (PUT 405s,
 * deliberately — see the view's docstring). This form therefore submits ONLY
 * the keys whose values actually changed. That is not an optimisation: a full
 * replace would send every writable field on every save, which is precisely
 * how a client blanks a `description` it never rendered.
 *
 * The shell (overlay → panel → stopPropagation) is lifted from
 * live/ScheduleSessionModal.jsx. The STYLES are not: that stylesheet predates
 * tokens.css and is 40-odd literal hex values. edit-recording-modal.css
 * resolves everything through tokens.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { FiEdit2 } from "react-icons/fi";
import api from "../api/apiClient";
import ChapterTagPicker from "./ChapterTagPicker";
import TrimRecordingPanel from "./TrimRecordingPanel";
import { fromChapterPayload, toChapterPayload } from "../utils/chapterTagPicker";
import { isValidWindow } from "../utils/recordingTrim";
import "../styles/edit-recording-modal.css";

/**
 * Flatten a DRF error body into {field: message}.
 *
 * DRF returns `{"batch_id": ["Pick a batch from this recording's own course."]}`
 * — a dict of LISTS, keyed by the field that failed. Rendering that as one
 * blob under the save button is how a teacher ends up re-reading a form
 * looking for which of eight fields the server meant, so each message is put
 * back beside its own input instead.
 */
function normalizeErrors(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const out = {};
  Object.entries(data).forEach(([key, val]) => {
    if (Array.isArray(val)) out[key] = String(val[0]);
    else if (typeof val === "string") out[key] = val;
  });
  return out;
}

export default function EditRecordingModal({
  recording,
  playerAvailable = false,
  getPlayerSeconds,
  onClose,
  onSaved,
}) {
  const [title, setTitle] = useState(recording.title || "");
  const [description, setDescription] = useState(recording.description || "");
  const [sessionDate, setSessionDate] = useState(recording.session_date || "");
  const [batchId, setBatchId] = useState(
    recording.batch == null ? "" : String(recording.batch)
  );
  const [isPublished, setIsPublished] = useState(Boolean(recording.is_published));
  const [trim, setTrim] = useState({
    start: recording.trim_start_seconds ?? null,
    end: recording.trim_end_seconds ?? null,
  });

  const [batches, setBatches] = useState([]);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");

  // The picker is seeded from the recording's own serialized tags. `recording`
  // is the SessionRecordingSerializer payload, which is exactly the shape
  // fromChapterPayload expects (chapter_tags / no_specific_chapter /
  // chapter_note) — no adapter needed.
  const initialChapterValue = useMemo(
    () => fromChapterPayload(recording),
    [recording]
  );
  const [chapterValue, setChapterValue] = useState(initialChapterValue);
  const chapterPickerRef = useRef(null);

  const subjectId = recording.subject;

  useEffect(() => {
    if (!subjectId) return undefined;
    let cancelled = false;
    api
      .get(`/courses/subjects/${subjectId}/batches/`)
      .then((res) => {
        if (!cancelled) setBatches(res.data || []);
      })
      .catch(() => {
        // A failed batch list must not lock the teacher out of fixing a
        // title. The select degrades to whatever the recording already has.
        if (!cancelled) setBatches([]);
      });
    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const originalChapterPayload = useMemo(
    () => JSON.stringify(toChapterPayload(initialChapterValue)),
    [initialChapterValue]
  );

  const chaptersDirty =
    JSON.stringify(toChapterPayload(chapterValue)) !== originalChapterPayload;

  /** Only what CHANGED. See the PARTIAL note in the file header. */
  const buildPayload = (chapters) => {
    const body = {};

    const nextTitle = title.trim();
    if (nextTitle !== (recording.title || "")) body.title = nextTitle;

    if (description !== (recording.description || "")) {
      body.description = description;
    }

    if (sessionDate !== (recording.session_date || "")) {
      // "" means the teacher emptied the date box; the column is nullable and
      // null is how you clear it. Sending "" would be a 400.
      body.session_date = sessionDate || null;
    }

    const originalBatch = recording.batch == null ? "" : String(recording.batch);
    if (batchId !== originalBatch) {
      // "All batches" is a real, expressible state — a course-wide recording
      // — and it is spelled null, not omitted.
      body.batch_id = batchId === "" ? null : batchId;
    }

    if (isPublished !== Boolean(recording.is_published)) {
      body.is_published = isPublished;
    }

    const nextChapters = toChapterPayload(chapters);
    if (JSON.stringify(nextChapters) !== originalChapterPayload) {
      Object.assign(body, nextChapters);
    }

    if ((trim.start ?? null) !== (recording.trim_start_seconds ?? null)) {
      body.trim_start_seconds = trim.start;
    }
    if ((trim.end ?? null) !== (recording.trim_end_seconds ?? null)) {
      body.trim_end_seconds = trim.end;
    }

    return body;
  };

  // buildPayload already folds the chapter diff in, so this is the whole
  // dirty check — the Save button stays disabled until something would
  // actually be sent.
  const dirty = Object.keys(buildPayload(chapterValue)).length > 0;

  const submit = async () => {
    setFieldErrors({});
    setFormError("");

    if (!title.trim()) {
      setFieldErrors({ title: "Give the recording a title." });
      return;
    }
    if (
      !isValidWindow({
        start: trim.start,
        end: trim.end,
        duration: recording.duration_seconds,
      })
    ) {
      setFieldErrors({
        trim_end_seconds: "The end of the clip must come after its start.",
      });
      return;
    }

    setSaving(true);
    try {
      // Promotion creates real courses.Chapter rows, so it only runs when the
      // chapter selection actually changed. Without that guard, opening this
      // modal to fix a typo and pressing Save would quietly promote every
      // free-text label the recording already carried into the syllabus.
      const resolved = chaptersDirty
        ? (await chapterPickerRef.current?.resolveForSubmit()) || chapterValue
        : chapterValue;

      const body = buildPayload(resolved);
      if (Object.keys(body).length === 0) {
        onClose();
        return;
      }

      const { data } = await api.patch(
        `/courses/recordings/${recording.id}/`,
        body
      );
      toast.success("Recording updated.");
      onSaved?.(data);
      onClose();
    } catch (err) {
      const data = err?.response?.data;
      const errors = normalizeErrors(data);
      const { detail, non_field_errors: nonField, ...perField } = errors;
      setFieldErrors(perField);
      const banner = detail || nonField;
      if (banner) setFormError(banner);
      else if (Object.keys(perField).length === 0) {
        setFormError("Couldn't save those changes. Please try again.");
      }
      toast.error(banner || "Couldn't save those changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="erm-overlay" onClick={onClose}>
      <div
        className="erm-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Edit recording"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="erm-header">
          <span className="erm-iconTile" aria-hidden="true">
            <FiEdit2 />
          </span>
          <div>
            <h2 className="erm-title">Edit recording</h2>
            <p className="erm-sub">
              Changes apply for every student who can see this recording.
            </p>
          </div>
        </div>

        <div className="erm-body">
          {formError && <p className="erm-formError">{formError}</p>}

          <div className="erm-field">
            <label className="erm-field__label" htmlFor="erm-title">
              Title
            </label>
            <input
              id="erm-title"
              type="text"
              className={`erm-input${fieldErrors.title ? " erm-input--invalid" : ""}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Light — Reflection & Refraction"
            />
            {fieldErrors.title && (
              <p className="erm-field__error">{fieldErrors.title}</p>
            )}
          </div>

          <div className="erm-field">
            <label className="erm-field__label" htmlFor="erm-description">
              Description <span className="erm-field__optional">(optional)</span>
            </label>
            <textarea
              id="erm-description"
              className={`erm-input erm-textarea${
                fieldErrors.description ? " erm-input--invalid" : ""
              }`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was covered in this session?"
            />
            {fieldErrors.description && (
              <p className="erm-field__error">{fieldErrors.description}</p>
            )}
          </div>

          <div className="erm-row">
            <div className="erm-field">
              <label className="erm-field__label" htmlFor="erm-date">
                Session date
              </label>
              <input
                id="erm-date"
                type="date"
                className={`erm-input${
                  fieldErrors.session_date ? " erm-input--invalid" : ""
                }`}
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
              />
              {fieldErrors.session_date && (
                <p className="erm-field__error">{fieldErrors.session_date}</p>
              )}
            </div>

            <div className="erm-field">
              <label className="erm-field__label" htmlFor="erm-batch">
                Batch
              </label>
              <select
                id="erm-batch"
                className={`erm-input${
                  fieldErrors.batch_id ? " erm-input--invalid" : ""
                }`}
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
              >
                <option value="">All batches</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              {fieldErrors.batch_id && (
                <p className="erm-field__error">{fieldErrors.batch_id}</p>
              )}
            </div>
          </div>

          <div className="erm-field">
            <label className="erm-toggle">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
              />
              <span className="erm-toggle__track" aria-hidden="true">
                <span className="erm-toggle__knob" />
              </span>
              <span className="erm-toggle__text">
                <strong>Published</strong>
                <em>
                  {isPublished
                    ? "Students in this batch can watch it now."
                    : "Hidden from students. Nobody can open it until you publish."}
                </em>
              </span>
            </label>
          </div>

          <div className="erm-field">
            <ChapterTagPicker
              ref={chapterPickerRef}
              subjectId={subjectId}
              value={chapterValue}
              onChange={setChapterValue}
              variant="compact"
              noteLabel="Note for students"
              notePlaceholder="What this session covers, what to revise first…"
            />
            {fieldErrors.chapter_tags && (
              <p className="erm-field__error">{fieldErrors.chapter_tags}</p>
            )}
            {fieldErrors.chapter_id && (
              <p className="erm-field__error">{fieldErrors.chapter_id}</p>
            )}
          </div>

          <TrimRecordingPanel
            recording={recording}
            value={trim}
            onChange={setTrim}
            errors={fieldErrors}
            playerAvailable={playerAvailable}
            getPlayerSeconds={getPlayerSeconds}
          />
        </div>

        <div className="erm-footer">
          <button
            type="button"
            className="erm-btn erm-btn--outline"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="erm-btn erm-btn--primary"
            onClick={submit}
            disabled={saving || !dirty}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
