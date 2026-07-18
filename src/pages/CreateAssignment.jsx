import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { IoChevronBack } from "react-icons/io5";
import { FaRegFile, FaTrash } from "react-icons/fa";
import toast from "react-hot-toast";
// No external dep — crypto.randomUUID() is built into all modern browsers
import api from "../api/apiClient";
import "../styles/create-assignment.css";

export default function CreateAssignment() {
  const navigate = useNavigate();
  const { subjectId } = useParams();
  const { state: editData } = useLocation();

  const isEditing = Boolean(editData);

  // One UUID per form session — survives re-renders, changes only on mount
  // so double-clicking Submit sends the same key and the backend deduplicates.
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  const [chapters, setChapters]     = useState([]);
  const [chapterId, setChapterId]   = useState(editData?.chapter_id || editData?.chapter?.id || "");
  // Batch picker (create only): the backend requires a batch on new
  // assignments so due dates stay cohort-relative. Editing does not change
  // the batch, so the picker is hidden in edit mode.
  const [batches, setBatches]       = useState([]);
  const [batchId, setBatchId]       = useState(editData?.batch_id || editData?.batch?.id || "");
  const [title, setTitle]           = useState(editData?.title || "");
  const [description, setDescription] = useState(editData?.description || "");
  const [dueDate, setDueDate]       = useState(editData?.due_date?.slice(0, 10) || "");

  // New files to upload
  const [newFiles, setNewFiles]     = useState([]);
  // Existing files from server (edit mode)
  const [existingFiles, setExistingFiles] = useState(editData?.files || []);
  // IDs of existing files the teacher wants deleted
  const [deleteFileIds, setDeleteFileIds] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors]         = useState({});
  const fileInputRef = useRef(null);

  useEffect(() => {
    async function fetchChapters() {
      try {
        const res = await api.get(`/courses/subject/${subjectId}/`);
        setChapters(res.data?.chapters || []);
      } catch {
        toast.error("Failed to load chapters.");
      }
    }
    if (subjectId) fetchChapters();
  }, [subjectId]);

  useEffect(() => {
    if (isEditing) return; // batch is fixed for an existing assignment
    let cancelled = false;
    api
      .get(`/courses/subjects/${subjectId}/batches/`)
      .then((res) => {
        if (cancelled) return;
        const list = res.data || [];
        setBatches(list);
        if (list.length && !batchId) setBatchId(String(list[0].id));
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
    if (!chapterId)           e.chapter     = "Chapter required";
    if (!isEditing && !batchId) e.batch     = "Batch required";
    if (!title.trim())        e.title       = "Title required";
    if (!description.trim())  e.description = "Description required";
    if (!dueDate)             e.dueDate     = "Due date required";
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
      const formData = new FormData();
      formData.append("chapter_id",   chapterId);
      if (!isEditing) formData.append("batch_id", batchId);
      formData.append("title",        title);
      formData.append("description",  description);
      formData.append("due_date",     `${dueDate}T23:59:00`);

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
          toast.success(res?.data?.message || "Assignment created successfully");
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

      <div className="ca-title-container">
        <h2>{isEditing ? "Edit Assignment" : "Create Assignment"}</h2>
      </div>

      <div className="ca-form-container">
        <div className="ca-form">

          {/* Batch (create only) */}
          {!isEditing && (
            <div className="ca-field">
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

          {/* Chapter */}
          <div className="ca-field">
            <label>Chapter</label>
            <select
              value={chapterId}
              onChange={(e) => setChapterId(e.target.value)}
              className={`ca-input ${errors.chapter ? "ca-input-error" : ""}`}
            >
              <option value="">Select Chapter</option>
              {chapters.map((ch) => (
                <option key={ch.id} value={ch.id}>{ch.title}</option>
              ))}
            </select>
            {errors.chapter && <span className="ca-error">{errors.chapter}</span>}
          </div>

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
          <div className="ca-field">
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
                    <FaRegFile style={{ fontSize: 13, color: "#D85A30" }} />
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
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#A32D2D" }}
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
                    <FaRegFile style={{ fontSize: 13, color: "#1D9E75" }} />
                    <span style={{ fontSize: 13, flex: 1 }}>{f.name}</span>
                    <button
                      type="button"
                      onClick={() => removeNewFile(i)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#A32D2D" }}
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
            >
              {submitting ? "Saving…" : isEditing ? "Update" : "Create"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
