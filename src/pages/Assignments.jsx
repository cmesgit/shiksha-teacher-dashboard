import { useNavigate, useParams } from "react-router-dom";
import { IoChevronBack } from "react-icons/io5";
import { FiEdit2, FiTrash2 } from "react-icons/fi";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../api/apiClient";
import "../styles/assignments.css";
import { LoadingState } from "../components/StateViews";

const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function Assignments() {
  const navigate = useNavigate();
  const { subjectId } = useParams();

  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);   // which row is mid-delete
  const [confirmId, setConfirmId] = useState(null);     // which row has confirm open

  const backPath = `/teacher/classes/${subjectId}`;

  useEffect(() => {
    async function fetchAssignments() {
      try {
        const res = await api.get(`/assignments/teacher/subject/${subjectId}/`);
        setAssignments(res.data);
      } catch (err) {
        console.error("Failed to load assignments", err);
      } finally {
        setLoading(false);
      }
    }
    if (subjectId) fetchAssignments();
  }, [subjectId]);

  // ── Delete ────────────────────────────────────────────────────────────
  const handleDeleteConfirm = async (assignmentId) => {
    setDeletingId(assignmentId);
    try {
      await api.delete(`/assignments/teacher/${assignmentId}/delete/`);
      setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
      toast.success("Assignment deleted.");
    } catch (err) {
      const msg = err?.response?.data?.detail || "Delete failed.";
      toast.error(msg);
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };

  // ── Edit — navigate to create page with assignment pre-filled ─────────
  const handleEdit = (assignment) => {
    navigate(
      `/teacher/classes/${subjectId}/assignments/create`,
      { state: assignment }
    );
  };

  if (loading) return <LoadingState label="Loading assignments" />;

  return (
    <div className="assignments-page">

      <button className="assignments-back-btn" onClick={() => navigate(backPath)}>
        <IoChevronBack /> Back
      </button>

      <div className="assignments-title-container">
        <div className="assignments-title-left">
          <h2 className="assignments-title">Assignments</h2>
          <span className="assignments-count-badge">{assignments.length}</span>
        </div>
      </div>

      <div className="assignments-list-container">

        <div className="assignments-actions">
          <button
            className="assignments-create-btn"
            onClick={() => navigate(`/teacher/classes/${subjectId}/assignments/create`)}
          >
            + Create New Assignment
          </button>
        </div>

        <div className="assignments-list">
          {assignments.length === 0 && (
            <div className="assignments-empty">
              No assignments created yet.
            </div>
          )}

          {assignments.map((assignment) => (
            <div className="assignment-row" key={assignment.id}>

              <div className="assignment-info">
                <span className="assignment-id">{assignment.id?.slice(0, 8)}</span>
                <span className="assignment-name">{assignment.title}</span>
              </div>

              <div className="assignment-detail">
                <span className="assignment-label">Chapter:</span>
                <span className="assignment-value">{assignment.chapter_name}</span>
              </div>

              <div className="assignment-detail">
                <span className="assignment-label">Due on:</span>
                <span className="assignment-value">{formatDate(assignment.due_date)}</span>
              </div>

              <div className="assignment-detail">
                <span className="assignment-label">Submissions:</span>
                <span className={`assignment-value bold ${assignment.total_submissions > 0 ? "has-submissions" : "no-submissions"}`}>
                  {assignment.total_submissions}
                </span>
              </div>

              {/* ── Action buttons ─────────────────────────────────── */}
              <div className="assignment-row-actions">

                <button
                  className="assignment-view-btn"
                  onClick={() =>
                    navigate(`/teacher/classes/${subjectId}/assignments/${assignment.id}/submissions`)
                  }
                >
                  View
                </button>

                <button
                  className="assignment-edit-btn"
                  title="Edit assignment"
                  onClick={() => handleEdit(assignment)}
                >
                  <FiEdit2 size={14} />
                </button>

                {/* Delete — shows inline confirm to prevent accidents */}
                {confirmId === assignment.id ? (
                  <div className="assignment-delete-confirm">
                    <span className="assignment-delete-confirm-text">Delete?</span>
                    <button
                      className="assignment-delete-confirm-yes"
                      disabled={deletingId === assignment.id}
                      onClick={() => handleDeleteConfirm(assignment.id)}
                    >
                      {deletingId === assignment.id ? "…" : "Yes"}
                    </button>
                    <button
                      className="assignment-delete-confirm-no"
                      onClick={() => setConfirmId(null)}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    className="assignment-delete-btn"
                    title={
                      assignment.total_submissions > 0
                        ? "Cannot delete — has submissions"
                        : "Delete assignment"
                    }
                    disabled={assignment.total_submissions > 0}
                    onClick={() => setConfirmId(assignment.id)}
                  >
                    <FiTrash2 size={14} />
                  </button>
                )}

              </div>

            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
