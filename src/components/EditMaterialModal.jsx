/**
 * src/components/EditMaterialModal.jsx
 *
 * Edit a study material's details in place — title, description, chapter, batch.
 *
 * There was no edit path at all before this. StudyMaterial was the one content
 * model of the four with create/read/delete only, so fixing a typo in a title,
 * or moving a handout filed against the wrong batch, meant deleting the row and
 * re-uploading every attached file. This is the client half of
 * `PATCH /materials/materials/:id/`.
 *
 * FILES ARE NOT EDITED HERE, deliberately. Attachments have exactly one
 * validated write path (the upload flow); a second one on this endpoint is how
 * an unscanned file reaches students. Swapping a file is still
 * delete-and-reupload — unchanged behaviour, not a regression this introduces.
 *
 * PARTIAL, ALWAYS — same rule as EditRecordingModal: only the keys that
 * actually changed are sent. A full replace is precisely how a client blanks a
 * `description` it never rendered.
 *
 * STYLES: this reuses edit-recording-modal.css and its `erm-*` classes rather
 * than cloning ~200 lines of it under a second prefix. Those classes are
 * generic modal furniture (overlay / panel / field / footer) and both modals
 * are the same shape by design — a copy would drift the moment one is touched.
 * The stylesheet resolves everything through tokens.css; keep it that way.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { FiEdit2 } from "react-icons/fi";
import api from "../api/apiClient";
import "../styles/edit-recording-modal.css";

/** Flatten a DRF error body into {field: message}. See EditRecordingModal. */
function normalizeErrors(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const out = {};
  Object.entries(data).forEach(([key, val]) => {
    if (Array.isArray(val)) out[key] = String(val[0]);
    else if (typeof val === "string") out[key] = val;
  });
  return out;
}

export default function EditMaterialModal({ material, onClose, onSaved }) {
  const original = {
    title: material.title || "",
    description: material.description || "",
    chapterId: material.chapter_id == null ? "" : String(material.chapter_id),
    batchId: material.batch_id == null ? "" : String(material.batch_id),
  };

  const [title, setTitle] = useState(original.title);
  const [description, setDescription] = useState(original.description);
  const [chapterId, setChapterId] = useState(original.chapterId);
  const [batchId, setBatchId] = useState(original.batchId);

  const [chapters, setChapters] = useState([]);
  const [batches, setBatches] = useState([]);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");

  const subjectId = material.subject_id;

  useEffect(() => {
    if (!subjectId) return undefined;
    let cancelled = false;

    // Both lists degrade to empty rather than blocking the form: a failed
    // lookup must not stop a teacher fixing a title. The selects then offer
    // only what the material already has, which is a narrower form, not a
    // broken one.
    api
      .get(`/courses/subjects/${subjectId}/chapters/`)
      .then((res) => !cancelled && setChapters(res.data || []))
      .catch(() => !cancelled && setChapters([]));

    api
      .get(`/courses/subjects/${subjectId}/batches/`)
      .then((res) => !cancelled && setBatches(res.data || []))
      .catch(() => !cancelled && setBatches([]));

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

  /** Only what CHANGED. See the PARTIAL note in the file header. */
  const buildPayload = () => {
    const body = {};
    const nextTitle = title.trim();
    if (nextTitle !== original.title) body.title = nextTitle;
    if (description !== original.description) body.description = description;
    // "" is the teacher choosing "no chapter" / "all batches" — both are real,
    // expressible states, and both are spelled null. Sending "" is a 400.
    if (chapterId !== original.chapterId) {
      body.chapter_id = chapterId === "" ? null : chapterId;
    }
    if (batchId !== original.batchId) {
      body.batch_id = batchId === "" ? null : batchId;
    }
    return body;
  };

  const dirty = Object.keys(buildPayload()).length > 0;

  // The batch endpoint returns only ACTIVE batches, so a material scoped to a
  // batch that has since been archived opened with a <select> whose value
  // matched no <option>: the field rendered BLANK, giving no hint what the
  // material was actually scoped to, and `dirty` stayed false so there was
  // nothing to confirm. Touching the control for any reason then snapped it to
  // the first option — "All batches" — and saving silently widened delivery
  // from one archived batch to every student on the course.
  //
  // Re-inserting the current batch keeps the control honest about the state it
  // is editing. It is marked so the teacher can see why it isn't in the normal
  // list, and it is only added when genuinely missing.
  const batchOptions =
    batchId && !batches.some((b) => String(b.id) === batchId)
      ? [
          ...batches,
          {
            id: batchId,
            name: material.batch_name || "Current batch",
            archived: true,
          },
        ]
      : batches;

  const submit = async () => {
    setFieldErrors({});
    setFormError("");

    if (!title.trim()) {
      setFieldErrors({ title: "Give this material a title." });
      return;
    }

    const body = buildPayload();
    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      const { data } = await api.patch(
        `/materials/materials/${material.id}/`,
        body
      );
      toast.success("Material updated.");
      onSaved?.(data);
      onClose();
    } catch (err) {
      const errors = normalizeErrors(err?.response?.data);
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

  // PORTALLED TO <body> — not decorative, and not optional.
  //
  // `.ac-screen` (every Academy list screen's root) carries
  // `animation: fadeUp ... both`. The fill mode leaves an identity `transform`
  // on the element forever, and ANY transform makes that element the
  // containing block for its `position: fixed` descendants. Rendered in place,
  // this overlay resolved `inset: 0` against the screen div instead of the
  // viewport: measured 656×387 at (252,106) rather than 928×402 at (0,0). The
  // scrim then left the sidebar and header undimmed, and — because the panel
  // was centred in the wrong box — its footer fell below the fold, so on a
  // short window the Save button could not be reached at all.
  //
  // createPortal is already this app's convention for overlays (see
  // tour/TourOverlay.jsx, shared/ProfileSwitcher.jsx).
  //
  // NOTE: ConfirmDialog and EditRecordingModal render in place and still have
  // this bug. Not fixed here — flagged, not silently changed.
  return createPortal(
    <div className="erm-overlay" onClick={onClose}>
      <div
        className="erm-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Edit study material"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="erm-header">
          <span className="erm-iconTile" aria-hidden="true">
            <FiEdit2 />
          </span>
          <div>
            <h2 className="erm-title">Edit material</h2>
            <p className="erm-sub">
              Changes apply for every student who can see this material.
            </p>
          </div>
        </div>

        <div className="erm-body">
          {formError && <p className="erm-formError">{formError}</p>}

          <div className="erm-field">
            <label className="erm-field__label" htmlFor="emm-title">
              Title
            </label>
            <input
              id="emm-title"
              type="text"
              className={`erm-input${fieldErrors.title ? " erm-input--invalid" : ""}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Kinematics — formula sheet"
            />
            {fieldErrors.title && (
              <p className="erm-field__error">{fieldErrors.title}</p>
            )}
          </div>

          <div className="erm-field">
            <label className="erm-field__label" htmlFor="emm-description">
              Description <span className="erm-field__optional">(optional)</span>
            </label>
            <textarea
              id="emm-description"
              className={`erm-input erm-textarea${
                fieldErrors.description ? " erm-input--invalid" : ""
              }`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this material cover?"
            />
            {fieldErrors.description && (
              <p className="erm-field__error">{fieldErrors.description}</p>
            )}
          </div>

          <div className="erm-row">
            <div className="erm-field">
              <label className="erm-field__label" htmlFor="emm-chapter">
                Chapter
              </label>
              <select
                id="emm-chapter"
                className={`erm-input${
                  fieldErrors.chapter_id ? " erm-input--invalid" : ""
                }`}
                value={chapterId}
                onChange={(e) => setChapterId(e.target.value)}
              >
                <option value="">No specific chapter</option>
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
              {fieldErrors.chapter_id && (
                <p className="erm-field__error">{fieldErrors.chapter_id}</p>
              )}
            </div>

            <div className="erm-field">
              <label className="erm-field__label" htmlFor="emm-batch">
                Batch
              </label>
              <select
                id="emm-batch"
                className={`erm-input${
                  fieldErrors.batch_id ? " erm-input--invalid" : ""
                }`}
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
              >
                <option value="">All batches</option>
                {batchOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.archived ? " (archived)" : ""}
                  </option>
                ))}
              </select>
              {fieldErrors.batch_id && (
                <p className="erm-field__error">{fieldErrors.batch_id}</p>
              )}
            </div>
          </div>
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
    </div>,
    document.body
  );
}
