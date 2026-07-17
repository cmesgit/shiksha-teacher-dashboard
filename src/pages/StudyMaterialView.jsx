import { useNavigate, useParams } from "react-router-dom";
import { IoChevronBack } from "react-icons/io5";
import { FaRegFolder } from "react-icons/fa";
import { useState, useEffect } from "react";
import api from "../api/apiClient";
import "../styles/study-material-view.css";
import { LoadingState } from "../components/StateViews";

const getFileExt = (name = "") => {
  const ext = name.split(".").pop().toUpperCase();
  return ext.length <= 5 ? ext : "FILE";
};

const extColor = (ext) => {
  const map = {
    PDF: "#e74c3c", DOC: "#2980b9", DOCX: "#2980b9",
    PPT: "#e67e22", PPTX: "#e67e22", XLS: "#27ae60",
    XLSX: "#27ae60", JPG: "#8e44ad", PNG: "#8e44ad",
  };
  return map[ext] || "#4ba7b5";
};

export default function StudyMaterialView() {
  const navigate = useNavigate();
  const { materialId, subjectId } = useParams();

  const [material, setMaterial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    loadMaterial();
  }, [materialId]);

  const loadMaterial = async () => {
    try {
      const res = await api.get(`/materials/materials/${materialId}/`);
      setMaterial(res.data);
    } catch (err) {
      console.error("Failed to load material", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingState label="Loading material" />;
  if (!material) return <div>Material not found</div>;

  const files = material.files || [];

  const handleCopy = (e, url) => {
    e.preventDefault();
    navigator.clipboard.writeText(url).then(() => {
      setCopied(url);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <div className="smv-page">

      <button className="smv-back-btn" onClick={() => navigate(`/teacher/classes/${subjectId}/study-materials`)}>
        <IoChevronBack /> Back
      </button>

      <div className="smv-header">
        <h2 className="smv-title">Study Material</h2>
      </div>

      <div className="smv-content-card">
        <div className="smv-details">

          <div className="smv-meta-card">

            {/* ✅ NEW: CHAPTER */}
            <p className="smv-detail-line">
              <span className="smv-label">Chapter: </span>
              <span className="smv-value-bold">
                {material.chapter_title || material.custom_chapter || "—"}
              </span>
            </p>

            {/* ✅ CHANGED: TITLE → TOPIC */}
            <p className="smv-detail-line">
              <span className="smv-label">Topic: </span>
              <span className="smv-value-bold">{material.title}</span>
            </p>

            <p className="smv-detail-line">
              <span className="smv-label">Uploaded: </span>
              <span className="smv-value-bold">
                {new Date(material.created_at).toLocaleDateString()}
              </span>
            </p>

          </div>

          <div className="smv-files-section">
            <div className="smv-files-header">
              <span className="smv-label">Attached Files</span>
              <span className="smv-files-count-badge">{files.length}</span>
            </div>

            {files.length === 0 ? (
              <p className="smv-no-files">No files attached.</p>
            ) : (
              <div className="smv-files-list">
                {files.map((file) => {
                  const url = file.file_url || `${import.meta.env.VITE_API_BASE || "https://api.shikshacom.com"}${file.file}`;
                  const ext = getFileExt(file.file_name);
                  const color = extColor(ext);
                  return (
                    <div className="smv-file-card" key={file.id}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="smv-file-link"
                      >
                        <div className="smv-file-icon-box" style={{ background: `${color}22` }}>
                          <FaRegFolder className="smv-file-icon" style={{ color }} />
                        </div>
                        <div className="smv-file-info">
                          <span className="smv-file-name">{file.file_name}</span>
                          <span className="smv-file-ext" style={{ color }}>{ext}</span>
                        </div>
                      </a>
                      <button
                        className={`smv-copy-btn ${copied === url ? "copied" : ""}`}
                        title="Copy link"
                        onClick={(e) => handleCopy(e, url)}
                      >
                        {copied === url ? "Copied!" : "Copy link"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}