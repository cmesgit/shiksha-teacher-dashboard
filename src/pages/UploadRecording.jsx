// src/pages/UploadRecording.jsx
// ──────────────────────────────────────────────────────────────────────────
// Matches Academy Dashboard.dc.html's Upload Recording screen: a single-page
// 2-column form (Title / Subject / Batch / Description / video dropzone +
// Cancel/Upload) with a Preview + Publishing info rail on the right — not
// the 3-step wizard this page used to be.
//
// Real backend flow is unchanged: create a Bunny video slot, get a signed
// upload URL, PUT the file directly to Bunny with progress, then save the
// recording's metadata. Two reconciliations with the design, both mirroring
// the same pattern already used in UploadMaterial.jsx / CreateAssignment.jsx:
//   · No Subject field — already implicit via the :subjectId route.
//   · Session Date dropped as a user input (the design has none) — the
//     model allows a null session_date, so this now just sends today's date
//     automatically rather than making the teacher pick one.
// Batch is newly real: POST .../recordings/save/ now accepts an optional
// batch_id (courses/views_recordings.py) — previously the field existed on
// the model (inherited from a LiveSession) but a manual upload had no way
// to set it.
// ──────────────────────────────────────────────────────────────────────────
import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { IoChevronBack } from "react-icons/io5";
import { FiUploadCloud, FiCheckCircle, FiPlay, FiUsers, FiClock, FiCheckSquare } from "react-icons/fi";
import api from "../api/apiClient";
import { uploadToBunny } from "../shared/bunnyUpload";
import "../styles/upload-recording.css";

const ALLOWED_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function UploadRecording() {
  const navigate = useNavigate();
  const { subjectId } = useParams();
  const location = useLocation();
  const prefill = location.state || {};

  const [title, setTitle] = useState(prefill.title || "");
  const [description, setDescription] = useState("");
  const [batches, setBatches] = useState([]);
  const [batchId, setBatchId] = useState("");
  const [liveSessionId] = useState(prefill.live_session_id || null);

  const [videoFile, setVideoFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const fileInputRef = useRef(null);
  const uploadRef = useRef(null);

  useEffect(() => {
    if (!subjectId) return;
    api.get(`/courses/subjects/${subjectId}/batches/`)
      .then((res) => setBatches(res.data || []))
      .catch(() => setBatches([]));
  }, [subjectId]);

  const handleBack = () => {
    if (uploadRef.current) uploadRef.current.abort();
    navigate(`/teacher/classes/${subjectId}/session-recordings`);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Only MP4, WebM, or MOV files are allowed.");
      return;
    }
    if (file.size > 4 * 1024 * 1024 * 1024) {
      setError("File is too large (max 4 GB).");
      return;
    }
    setError("");
    setVideoFile(file);
  };

  const handleUpload = async () => {
    if (!title.trim()) return setError("Enter a title.");
    if (!videoFile) return setError("Attach a video file.");
    if (!subjectId) return setError("Invalid subject.");

    try {
      setUploading(true);
      setUploadProgress(0);
      setError("");

      const res = await api.post("/courses/recordings/create-video/", { title });
      const videoId = res.data.video_id;

      const signedRes = await api.post("/courses/recordings/signed-upload-url/", { video_id: videoId });

      await uploadToBunny(videoFile, signedRes.data, {
        onProgress: setUploadProgress,
        onUploadStart: (u) => { uploadRef.current = u; },
      });

      await api.post(`/courses/subjects/${subjectId}/recordings/save/`, {
        title,
        description,
        // The design has no date picker, but a recording made from a real
        // past live session should still carry that session's actual date,
        // not the upload date — only default to "today" for a standalone
        // manual upload with nothing to inherit from.
        session_date: prefill.date || new Date().toISOString().slice(0, 10),
        video_id: videoId,
        ...(batchId ? { batch_id: batchId } : {}),
        ...(liveSessionId ? { live_session_id: liveSessionId } : {}),
      });

      navigate(`/teacher/classes/${subjectId}/session-recordings`);
    } catch (err) {
      console.error(err);
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const batchName = batches.find((b) => String(b.id) === batchId)?.name;

  return (
    <div className="ur-page">
      <button type="button" className="ur-back" onClick={handleBack}>
        <IoChevronBack size={14} /> Back to Recordings
      </button>

      <h1 className="ur-pageTitle">Upload a recording</h1>
      <p className="ur-pageSub">Fill in the details and attach the video file. The recording will be processed and made available to students.</p>

      <div className="ur-layout">
        <div className="ur-card">
          <div className="ur-field">
            <label className="ur-label">Title <span className="ur-required">*</span></label>
            <input
              type="text"
              className="ur-input"
              placeholder="e.g. Light — Reflection & Refraction"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(""); }}
            />
          </div>

          <div className="ur-field">
            <label className="ur-label">Batch</label>
            <select className="ur-input" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
              <option value="">All batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="ur-field">
            <label className="ur-label">Description <span className="ur-optional">(optional)</span></label>
            <textarea
              className="ur-input ur-textarea"
              placeholder="What was covered in this session? Add chapter references, key topics, homework links…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="ur-field">
            <label className="ur-label">Video file <span className="ur-required">*</span></label>
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: "none" }}
              accept="video/mp4,video/webm,video/quicktime"
              onChange={handleFileChange}
            />
            <div className="ur-dropzone" onClick={() => fileInputRef.current?.click()}>
              {videoFile ? (
                <>
                  <FiCheckCircle size={26} className="ur-dropzone__doneIcon" />
                  <div className="ur-dropzone__text ur-dropzone__text--done">{videoFile.name}</div>
                  <div className="ur-dropzone__sub">{formatBytes(videoFile.size)} · Click to change</div>
                </>
              ) : (
                <>
                  <FiUploadCloud size={26} />
                  <div className="ur-dropzone__text">Click to upload video</div>
                  <div className="ur-dropzone__sub">MP4, MOV, WEBM — max 4GB</div>
                </>
              )}
            </div>

            {uploading && (
              <div className="ur-progressWrap">
                <div className="ur-progressBar">
                  <div className="ur-progressFill" style={{ width: `${uploadProgress}%` }} />
                </div>
                <span className="ur-progressLabel">{uploadProgress}% · don't close this tab</span>
              </div>
            )}

            {error && <p className="ur-error">{error}</p>}
          </div>

          <div className="ur-actions">
            <button type="button" className="ur-btn ur-btn--outline" onClick={handleBack} disabled={uploading}>
              Cancel
            </button>
            <button type="button" className="ur-btn ur-btn--primary" onClick={handleUpload} disabled={uploading}>
              {uploading ? `Uploading ${uploadProgress}%…` : "Upload recording"}
            </button>
          </div>
        </div>

        <div className="ur-rail">
          <div className="ur-panel">
            <div className="ur-panel__label">Preview</div>
            <div className="ur-preview">
              <span className="ur-preview__play"><FiPlay size={15} /></span>
              {videoFile && <span className="ur-preview__badge">{formatBytes(videoFile.size)}</span>}
            </div>
            <div className="ur-preview__title">{title || "Untitled recording"}</div>
            <div className="ur-preview__meta">{batchName || "All batches"}</div>
          </div>

          <div className="ur-panel">
            <div className="ur-panel__label">Publishing</div>
            <div className="ur-pubList">
              <div className="ur-pubItem">
                <span className="ur-pubItem__icon ur-pubItem__icon--info"><FiUsers size={15} /></span>
                <div>
                  <div className="ur-pubItem__title">Visible to batch</div>
                  <div className="ur-pubItem__sub">{batchName || "All batches"}</div>
                </div>
              </div>
              <div className="ur-pubItem">
                <span className="ur-pubItem__icon ur-pubItem__icon--warning"><FiClock size={15} /></span>
                <div>
                  <div className="ur-pubItem__title">Processing time</div>
                  <div className="ur-pubItem__sub">~5–10 min after upload</div>
                </div>
              </div>
              <div className="ur-pubItem">
                <span className="ur-pubItem__icon ur-pubItem__icon--success"><FiCheckSquare size={15} /></span>
                <div>
                  <div className="ur-pubItem__title">Students notified</div>
                  <div className="ur-pubItem__sub">Auto-alert once live</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
