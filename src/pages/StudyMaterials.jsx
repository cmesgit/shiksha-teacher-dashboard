import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IoChevronBack } from "react-icons/io5";
import { MdDelete } from "react-icons/md";
import api from "../api/apiClient";
import "../styles/study-materials.css";
import { LoadingState } from "../components/StateViews";


export default function StudyMaterials() {
  const navigate = useNavigate();
  const { subjectId } = useParams();

  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  useEffect(() => {
    if (!subjectId) return;
    loadMaterials();
  }, [subjectId]);

  const loadMaterials = async () => {
    try {
      const res = await api.get(`/materials/subjects/${subjectId}/materials/`);
      setMaterials(res.data);
    } catch (err) {
      console.error("Failed to load materials:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await api.delete(`/materials/materials/${id}/delete/`);
      setMaterials((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };

  if (loading) return <LoadingState label="Loading study materials" />;

  return (
    <div className="study-materials-page">

      <button className="sm-back-btn" onClick={() => navigate(`/teacher/classes/${subjectId}`)}>
        <IoChevronBack /> Back
      </button>

      <div className="sm-title-container">
        <div className="sm-title-left">
          <h2 className="sm-title">Study Materials</h2>
          <span className="sm-count-badge">{materials.length}</span>
        </div>
      </div>

      <div className="sm-list-container">

        <div className="sm-actions">
          <button
            className="sm-add-btn"
            onClick={() =>
              navigate(`/teacher/classes/${subjectId}/study-materials/upload`)
            }
          >
            + Add Study Material
          </button>
        </div>

        {/* ✅ HEADER UPDATED */}
        <div className="sm-table-header">
          <span className="sm-col-chapter">Chapter</span>
          <span className="sm-col-topic">Topic</span>
          <span className="sm-col-date">Date</span>
          <span className="sm-col-files">Files</span>
          <span className="sm-col-actions"></span>
        </div>

        {materials.length === 0 ? (
          <p className="sm-empty">
            No study materials uploaded yet.
          </p>
        ) : (
          <div className="sm-list">
            {materials.map((material) => (
              <div className="sm-row" key={material.id}>

                {/* ✅ NEW: CHAPTER */}
                <span className="sm-col-chapter">
                  {material.chapter_title || material.custom_chapter || "—"}
                </span>

                {/* ✅ TOPIC */}
                <span className="sm-col-topic">
                  {material.title}
                </span>

                <span className="sm-col-date">
                  {new Date(material.created_at).toLocaleDateString()}
                </span>

                <span className="sm-col-files">
                  <span className="sm-files-badge">
                    {material.files?.length || 0} files
                  </span>
                </span>

                <div className="sm-col-actions">
                  <button
                    className="sm-view-btn"
                    onClick={() =>
                      navigate(
                        `/teacher/classes/${subjectId}/study-materials/${material.id}`
                      )
                    }
                  >
                    View
                  </button>

                  {confirmId === material.id ? (
                    <div className="sm-confirm-row">
                      <span className="sm-confirm-label">Delete?</span>
                      <button
                        className="sm-confirm-yes"
                        disabled={deletingId === material.id}
                        onClick={() => handleDelete(material.id)}
                      >
                        {deletingId === material.id ? "..." : "Yes"}
                      </button>
                      <button
                        className="sm-confirm-no"
                        onClick={() => setConfirmId(null)}
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      className="sm-delete-btn"
                      onClick={() => setConfirmId(material.id)}
                    >
                      <MdDelete />
                    </button>
                  )}
                </div>

              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}