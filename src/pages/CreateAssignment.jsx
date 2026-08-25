import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { IoChevronBack } from "react-icons/io5";
import { FaRegFile, FaTrash } from "react-icons/fa";
import toast from "react-hot-toast";
// No external dep — crypto.randomUUID() is built into all modern browsers
import api from "../api/apiClient";
import TourHeaderButton from "../tour/TourHeaderButton";
import ChapterTagPicker from "../components/ChapterTagPicker";
import AssignmentPreviewRail from "../components/AssignmentPreviewRail";
import { EMPTY_CHAPTER_VALUE, toChapterPayload, fromChapterPayload } from "../utils/chapterTagPicker";
import "../styles/create-assignment.css";

export default function CreateAssignment() {
  const navigate = useNavigate();
  const { subjectId } = useParams();
  const { state: editData, pathname } = useLocation();

  const isEditing = Boolean(editData);

  // One UUID per form session — survives re-renders, changes only on mount
  // so double-clicking Submit sends the same key and the backend deduplicates.
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  // Shared chapter picker (design_handoff_quiz_system/README.md §"The shared
  // chapter picker"). Replaces the old required single-select chapter
  // dropdown + free-text custom-chapter field: chapters are now optional and
  // multiple, and a teacher can type their own without it being a dead end.
  // Prefers the Phase-3 `chapter_tags` shape when the backend already sent
  // one (edit mode against an up-to-date serializer); falls back to the
  // legacy single `chapter_id` for an assignment fetched before that landed.
  const [chapterValue, setChapterValue] = useState(() => {
    if (!editData) return EMPTY_CHAPTER_VALUE;
    if (editData.chapter_tags || editData.no_specific_chapter || editData.chapter_note) {
      return fromChapterPayload(editData);
    }
    const legacyId = editData.chapter_id || editData.chapter?.id;
    return legacyId ? { ...EMPTY_CHAPTER_VALUE, chapterIds: [legacyId] } : EMPTY_CHAPTER_VALUE;
  });
  const chapterPickerRef = useRef(null);
  // The picker owns the fetch; it hands the list up so the preview rail can
  // turn the tagged ids in `chapterValue` into real chapter names.
  const [chapterList, setChapterList] = useState([]);
  // Batch picker (create only): the backend requires a batch on new
  // assignments so due dates stay cohort-relative. Editing does not change
  // the batch, so the picker is hidden in edit mode.
  const [batches, setBatches]       = useState([]);
  const [batchId, setBatchId]       = useState(editData?.batch_id || editData?.batch?.id || "");
  const [title, setTitle]           = useState(editData?.title || "");
  const [description, setDescription] = useState(editData?.description || "");
  const [dueDate, setDueDate]       = useState(editData?.due_date?.slice(0, 10) || "");
  // What the work is marked out of. This was never collected and never sent,
  // on create OR edit, so every assignment ever made used the model default
  // of 100: a teacher marking a 20-mark worksheet typed 18 meaning 18/20 and
  // the student was shown 18%. There was no correction path short of the
  // Django admin.
  const [maxMarks, setMaxMarks]     = useState(
    editData?.max_marks != null ? String(editData.max_marks) : "100");
  // Draft gate. The backend has had `is_published` (and the False→True
  // notification edge) all along with no control anywhere in the UI, so a
  // teacher staging tomorrow's worksheet notified the whole class the moment
  // they hit Save. Defaults to published — that is the model default and the
  // behaviour every existing teacher expects.
  const [isPublished, setIsPublished] = useState(
    editData?.is_published != null ? Boolean(editData.is_published) : true);

  // New files to upload
  const [newFiles, setNewFiles]     = useState([]);
  // Existing files from server (edit mode)
  const [existingFiles, setExistingFiles] = useState(editData?.files || []);
  // IDs of existing files the teacher wants deleted
  const [deleteFileIds, setDeleteFileIds] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors]         = useState({});
  const fileInputRef = useRef(null);

  // Batches this teacher may ACTUALLY post to, not every active batch of the
  // course. The old source (/courses/subjects/:id/batches/) filters on
  // course_id + is_active only, and this form then auto-selected list[0] — so
  // a teacher who only takes 9-B got 9-A preselected, filled the whole form,
  // and hit a 400 rendered as "You are not assigned to this subject", which
  // was both false and unactionable. Falls back to the old endpoint on a 404
  // so the form still works against a backend that predates the new one.
  useEffect(() => {
    if (isEditing) return; // batch is fixed for an existing assignment
    let cancelled = false;
    api
      .get(`/assignments/teacher/subject/${subjectId}/batches/`)
      .catch((err) => {
        if (err?.response?.status !== 404) throw err;
        return api.get(`/courses/subjects/${subjectId}/batches/`);
      })
      .then((res) => {
        if (cancelled) return;
        const list = res.data || [];
        setBatches(list);
        // Only auto-select when there is no choice to get wrong. With two or
        // more, the teacher picks — a silent default is what produced the
        // false 400 above.
        if (list.length === 1) setBatchId(String(list[0].id));
      })
      .catch(() => {
        if (!cancelled) setBatches([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, isEditing]);

  // ── Validation ──────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    // Chapter tagging is optional and multiple now (ChapterTagPicker) — zero
    // chapters is a valid, submittable state. Do not gate submit on it.
    if (!isEditing && !batchId) e.batch     = "Batch required";
    if (!title.trim())        e.title       = "Title required";
    if (!description.trim())  e.description = "Description required";
    if (!dueDate)             e.dueDate     = "Due date required";
    const marks = Number(maxMarks);
    if (!maxMarks || !Number.isInteger(marks) || marks < 1)
      e.maxMarks = "Enter a whole number of marks (1 or more)";
    if (!isEditing && newFiles.length === 0 && existingFiles.length === 0)
      e.files = "At least one file is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── File selection ───────────────────────────────────────────────────
  const addFiles = (fileList) => {
    const allowed = [".pdf", ".doc", ".docx"];
    const valid = Array.from(fileList).filter((f) => {
      const name = f.name.toLowerCase();
      if (!allowed.some((ext) => name.endsWith(ext))) {
        toast.error(`${f.name}: only PDF, DOC, DOCX allowed`);
        return false;
      }
      return true;
    });
    setNewFiles((prev) => [...prev, ...valid]);
  };

  const removeNewFile = (idx) =>
    setNewFiles((prev) => prev.filter((_, i) => i !== idx));

  const markDeleteExisting = (id) => {
    setDeleteFileIds((prev) => [...prev, id]);
    setExistingFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // ── Submit ───────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate() || submitting) return;
    setSubmitting(true);

    try {
      // Custom labels the teacher ticked "save to the course" for get
      // promoted to real courses.Chapter rows here (POST once per label);
      // resolveForSubmit folds their new ids back into chapterIds so they go
      // out as chapters, not throwaway text.
      const resolvedChapterValue = (await chapterPickerRef.current?.resolveForSubmit()) || chapterValue;
      const chapterPayload = toChapterPayload(resolvedChapterValue);

      const formData = new FormData();
      // This request is multipart (file uploads), so `chapter_tags` cannot
      // travel as a real JSON array — multipart repeats of the same field
      // name collapse to a list of scalars, so appending once per tag would
      // silently drop all but the last one. The backend decodes this exact
      // shape: a single field holding the JSON-encoded string.
      formData.append("chapter_tags", JSON.stringify(chapterPayload.chapter_tags));
      formData.append("no_specific_chapter", chapterPayload.no_specific_chapter ? "true" : "false");
      formData.append("chapter_note", chapterPayload.chapter_note || "");

      if (!isEditing) {
        formData.append("batch_id", batchId);
        // Subject is the backend's NOT NULL column and its authorization
        // anchor. It used to be inferred from the required single-select
        // `chapter_id` this screen sent; the ChapterTagPicker replaced that
        // with `chapter_tags`, which resolve only AFTER the row is written and
        // so cannot imply a subject at validate() time. Send it explicitly
        // from the route param, the same contract UploadMaterial.jsx honours.
        formData.append("subject_id", subjectId);
      }
      formData.append("title",        title);
      formData.append("description",  description);
      formData.append("due_date",     `${dueDate}T23:59:00`);
      formData.append("max_marks",    String(Number(maxMarks)));
      formData.append("is_published", isPublished ? "true" : "false");

      if (!isEditing) {
        // Send idempotency key so backend deduplicates double-submits
        formData.append("idempotency_key", idempotencyKey);

        // Primary attachment (legacy field) = first file
        if (newFiles.length > 0) formData.append("attachment", newFiles[0]);
        // Extra files go to the new `files` list field
        newFiles.slice(1).forEach((f) => formData.append("files", f));

        const res = await api.post("/assignments/teacher/create/", formData);

        if (res.data?.duplicate) {
          toast("Assignment already submitted — no duplicate created.", { icon: "ℹ️" });
        } else {
          toast.success(
            isPublished
              ? "Assignment published — the class has been notified."
              : "Draft saved. Students won't see it until you publish."
          );
        }
      } else {
        // Edit — send new files + file IDs to delete
        newFiles.forEach((f) => formData.append("new_files", f));
        deleteFileIds.forEach((id) => formData.append("delete_file_ids", id));

        const res = await api.patch(
          `/assignments/teacher/${editData.id}/edit/`,
          formData
        );
        toast.success(res?.data?.message || "Assignment updated successfully");
      }

      setTimeout(() => navigate(`/teacher/classes/${subjectId}/assignments`), 600);
    } catch (err) {
      toast.error(
        err?.response?.data?.detail ||
        Object.values(err?.response?.data || {})?.[0]?.[0] ||
        err?.message ||
        "Operation failed."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="create-assignment-page">

      <button className="ca-back-btn" onClick={() => navigate(`/teacher/classes/${subjectId}/assignments`)}>
        <IoChevronBack /> Back
      </button>

      <div className="ca-title-container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h2>{isEditing ? "Edit Assignment" : "Create Assignment"}</h2>
        <TourHeaderButton pathname={pathname} />
      </div>

      <div className={`ca-form-container${isEditing ? "" : " ca-form-container--with-rail"}`}>
        <div className="ca-form">

          {/* Batch (create only) */}
          {!isEditing && (
            <div className="ca-field" data-tour="assignment-create.batch">
              <label>Batch</label>
              {batches.length === 0 ? (
                <span className="ca-error">
                  No active batch found for this subject. Create a batch first.
                </span>
              ) : (
                <select
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  className={`ca-input ${errors.batch ? "ca-input-error" : ""}`}
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code}){b.year ? ` — ${b.year}` : ""}
                    </option>
                  ))}
                </select>
              )}
              {errors.batch && <span className="ca-error">{errors.batch}</span>}
            </div>
          )}

          {/* Chapter tagging — the shared picker (full variant). Optional and
              multiple: zero, several, syllabus and/or custom chapters, or an
              explicit "no specific chapter" are all valid here. */}
          <ChapterTagPicker
            ref={chapterPickerRef}
            subjectId={subjectId}
            value={chapterValue}
            onChange={setChapterValue}
            variant="full"
            noteLabel="Note for students"
            notePlaceholder="What this assignment covers, what to revise first…"
            onChaptersLoaded={setChapterList}
          />

          {/* Title */}
          <div className="ca-field">
            <label>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`ca-input ${errors.title ? "ca-input-error" : ""}`}
            />
            {errors.title && <span className="ca-error">{errors.title}</span>}
          </div>

          {/* Description */}
          <div className="ca-field">
            <label>Description</label>
            <textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`ca-textarea ${errors.description ? "ca-input-error" : ""}`}
            />
            {errors.description && <span className="ca-error">{errors.description}</span>}
          </div>

          {/* Due Date */}
          <div className="ca-field" data-tour="assignment-create.due-date">
            <label>Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={`ca-input ${errors.dueDate ? "ca-input-error" : ""}`}
            />
            {errors.dueDate && <span className="ca-error">{errors.dueDate}</span>}
          </div>

          {/* File Upload */}
          <div className="ca-field">
            <label>Attach Files</label>

            {/* Existing files (edit mode) */}
            {existingFiles.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 6 }}>
                  Current files:
                </p>
                {existingFiles.map((f) => (
                  <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <FaRegFile style={{ fontSize: 13, color: "var(--warning)" }} />
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 13, flex: 1 }}
                    >
                      {f.original_filename}
                    </a>
                    <button
                      type="button"
                      onClick={() => markDeleteExisting(f.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger-hover)" }}
                      title="Remove this file"
                    >
                      <FaTrash style={{ fontSize: 12 }} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* New files pending upload */}
            {newFiles.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 6 }}>
                  Files to upload:
                </p>
                {newFiles.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <FaRegFile style={{ fontSize: 13, color: "var(--success)" }} />
                    <span style={{ fontSize: 13, flex: 1 }}>{f.name}</span>
                    <button
                      type="button"
                      onClick={() => removeNewFile(i)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger-hover)" }}
                    >
                      <FaTrash style={{ fontSize: 12 }} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              type="file"
              ref={fileInputRef}
              hidden
              multiple
              accept=".pdf,.doc,.docx"
              onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="ca-add-file-btn"
            >
              + Add File{newFiles.length > 0 ? "s" : ""}
            </button>

            {errors.files && <span className="ca-error">{errors.files}</span>}
          </div>

          {/* Submit */}
          <div className="ca-actions">
            <button
              className="ca-create-btn"
              onClick={handleSubmit}
              disabled={submitting}
              data-tour="assignment-create.submit"
            >
              {submitting ? "Saving…" : isEditing ? "Update" : "Create"}
            </button>
          </div>

        </div>

        {/* T5's rail. Create only: in edit mode the students already have the
            assignment, so "what your students see" is a claim about the past
            rather than a preview. */}
        {!isEditing && (
          <AssignmentPreviewRail
            title={title}
            dueDate={dueDate}
            maxMarks={maxMarks}
            chapterValue={chapterValue}
            chapters={chapterList}
          />
        )}
      </div>
    </div>
  );
}
