// src/pages/UploadMaterial.jsx
// ──────────────────────────────────────────────────────────────────────────
// Matches the design handoff's Upload Material screen (Academy Dashboard.dc.html,
// data-screen-label="Upload Material") — Title / Batch / File, Cancel + maroon
// "Upload material" submit, on the same card shell as Create Assignment.
//
// Two reconciliations with the real backend, both mirroring the identical
// tension already resolved in CreateAssignment.jsx (that screen's design is
// equally silent on both):
//   · No Subject field — this route is already subject-scoped (:subjectId),
//     same as Create Assignment omits Subject for the same reason.
//   · Chapter (existing-or-custom) stays — POST /materials/materials/upload/
//     requires chapter_id or custom_chapter+subject_id; the design has no
//     concept of chapters at all, but there's no materials model without one.
//   · Multi-file stays — the upload endpoint already accepts multiple
//     file_ids and Create Assignment's own file field is multi too; the
//     design's dropzone shows one file only because its prototype data never
//     modeled more.
// Batch is newly real: POST .../upload/ now accepts an optional batch_id
// (materials/views.py) — previously the field existed on the model but had
// no way to set it from this form.
// ──────────────────────────────────────────────────────────────────────────
import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IoChevronBack } from "react-icons/io5";
import { FiUploadCloud, FiCheckCircle, FiFile, FiX } from "react-icons/fi";
import toast from "react-hot-toast";
import api from "../api/apiClient";
import "../styles/upload-material.css";

export default function UploadMaterial() {
  const navigate = useNavigate();
  const { subjectId } = useParams();

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");

  const [fileItems, setFileItems] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [chapterId, setChapterId] = useState("");
  const [useCustomChapter, setUseCustomChapter] = useState(false);
  const [customChapter, setCustomChapter] = useState("");

  // "" = course-wide (the model's own default — shared across every batch).
  const [batches, setBatches] = useState([]);
  const [batchId, setBatchId] = useState("");

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const formatSize = (bytes) => {
    if (!bytes || bytes <= 0) return "0 KB";
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
  };

  useEffect(() => {
    if (!subjectId) return;
    api.get(`/courses/subjects/${subjectId}/chapters/`)
      .then((res) => setChapters(res.data || []))
      .catch(() => toast.error("Failed to load chapters."));
    api.get(`/courses/subjects/${subjectId}/batches/`)
      .then((res) => setBatches(res.data || []))
      .catch(() => setBatches([]));
  }, [subjectId]);

  const handleAddAttachment = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const selected = Array.from(e.target.files || []);
    e.target.value = "";

    for (const file of selected) {
      const item = { file, name: file.name, progress: 0, size: file.size, status: "uploading", id: null };
      setFileItems((prev) => [...prev, item]);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await api.post(`/materials/files/upload/`, formData, {
          onUploadProgress: (evt) => {
            const percent = Math.round((evt.loaded * 100) / evt.total);
            setFileItems((prev) => prev.map((f) => (f.name === file.name ? { ...f, progress: percent } : f)));
          },
        });
        setFileItems((prev) =>
          prev.map((f) => (f.name === file.name ? { ...f, progress: 100, status: "done", id: res.data.id } : f))
        );
      } catch {
        toast.error(`Couldn't upload ${file.name}.`);
        setFileItems((prev) => prev.filter((f) => f.name !== file.name));
      }
    }
  };

  const handleRemoveFile = (name) => setFileItems((prev) => prev.filter((f) => f.name !== name));

  const handleUpload = async () => {
    if (!title.trim()) return toast.error("Enter a title.");
    if (!useCustomChapter && !chapterId) return toast.error("Select a chapter.");
    if (useCustomChapter && !customChapter.trim()) return toast.error("Enter the new chapter's name.");
    if (fileItems.length === 0) return toast.error("Add at least one file.");
    if (fileItems.some((item) => !item.id)) return toast.error("Wait for all files to finish uploading.");

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", note);
      if (batchId) formData.append("batch_id", batchId);

      if (useCustomChapter) {
        formData.append("custom_chapter", customChapter);
        formData.append("subject_id", subjectId);
      } else {
        formData.append("chapter_id", chapterId);
      }
      fileItems.forEach((item) => formData.append("file_ids", item.id));

      await api.post(`/materials/materials/upload/`, formData);
      toast.success("Material uploaded.");
      navigate(`/teacher/classes/${subjectId}/study-materials`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="um-page">
      <button type="button" className="um-back" onClick={() => navigate(`/teacher/classes/${subjectId}/study-materials`)}>
        <IoChevronBack size={14} /> Back to Study Materials
      </button>

      <h1 className="um-pageTitle">Upload study material</h1>
      <p className="um-pageSub">Give it a title and attach the file. It'll be shared with the selected batch right away.</p>

      <div className="um-card">
        <div className="um-field">
          <label className="um-label">Title <span className="um-required">*</span></label>
          <input
            type="text"
            className="um-input"
            placeholder="e.g. Electricity — solved numericals set"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="um-row">
          <div className="um-field">
            <label className="um-label">Chapter <span className="um-required">*</span></label>
            {!useCustomChapter ? (
              <div className="um-inline">
                <select className="um-input" value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
                  <option value="">Select chapter</option>
                  {chapters.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
                <button type="button" className="um-linkBtn" onClick={() => setUseCustomChapter(true)}>Custom</button>
              </div>
            ) : (
              <div className="um-inline">
                <input
                  className="um-input"
                  placeholder="Enter new chapter"
                  value={customChapter}
                  onChange={(e) => setCustomChapter(e.target.value)}
                />
                <button type="button" className="um-linkBtn" onClick={() => setUseCustomChapter(false)}>Use existing</button>
              </div>
            )}
          </div>

          <div className="um-field">
            <label className="um-label">Batch</label>
            <select className="um-input" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
              <option value="">All batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="um-field">
          <label className="um-label">Note</label>
          <textarea
            className="um-input um-textarea"
            placeholder='Optional: add helpful context (e.g. "Focus on examples 5-8")'
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="um-field">
          <label className="um-label">File <span className="um-required">*</span></label>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            multiple
            accept=".pdf,.doc,.docx"
            onChange={handleFileChange}
          />
          <div className="um-dropzone" onClick={handleAddAttachment}>
            <FiUploadCloud size={26} />
            <div className="um-dropzone__text">Click to upload a file</div>
            <div className="um-dropzone__sub">PDF, DOC, DOCX — max 50MB/file</div>
          </div>

          {fileItems.length > 0 && (
            <div className="um-fileList">
              {fileItems.map((item) => (
                <div key={item.name} className="um-fileRow">
                  <FiFile size={15} className="um-fileRow__icon" />
                  <div className="um-fileRow__meta">
                    <span className="um-fileRow__name">{item.name}</span>
                    <span className="um-fileRow__size">
                      {formatSize(Math.round((item.progress / 100) * item.size))} / {formatSize(item.size)}
                      {item.status === "done" ? (
                        <span className="um-fileRow__done"><FiCheckCircle size={11} /> Uploaded</span>
                      ) : (
                        <span className="um-fileRow__uploading"> · Uploading…</span>
                      )}
                    </span>
                    {item.status !== "done" && (
                      <div className="um-progressBar">
                        <div className="um-progressFill" style={{ width: `${item.progress}%` }} />
                      </div>
                    )}
                  </div>
                  <button type="button" className="um-fileRow__remove" onClick={() => handleRemoveFile(item.name)} aria-label={`Remove ${item.name}`}>
                    <FiX size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="um-actions">
          <button
            type="button"
            className="um-btn um-btn--outline"
            onClick={() => navigate(`/teacher/classes/${subjectId}/study-materials`)}
          >
            Cancel
          </button>
          <button type="button" className="um-btn um-btn--primary" onClick={handleUpload} disabled={uploading}>
            {uploading ? "Uploading…" : "Upload material"}
          </button>
        </div>
      </div>
    </div>
  );
}
