import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IoChevronBack } from "react-icons/io5";
import "../styles/quizzes.css";
import api from "../api/apiClient";

const STATUS_META = {
  draft:    { label: "Draft",           cls: "quiz-status--draft" },
  pending:  { label: "Pending review",  cls: "quiz-status--pending" },
  approved: { label: "✓ Published",     cls: "quiz-status--approved" },
  rejected: { label: "Changes requested", cls: "quiz-status--rejected" },
};

export default function Quizzes() {
  const navigate = useNavigate();
  const { subjectId } = useParams();

  const [quizzes, setQuizzes] = useState([]);
  const [subjectName, setSubjectName] = useState("");
  const [publishingId, setPublishingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    async function fetchQuizzes() {
      try {
        const res = await api.get(`/teacher/subjects/${subjectId}/quizzes/`);
        const data = res.data.results || res.data;
        setQuizzes(data);
        if (data.length > 0 && data[0].subject_name) {
          setSubjectName(data[0].subject_name);
        }
      } catch (err) {
        console.error("Failed to load quizzes", err);
      }
    }
    fetchQuizzes();
  }, [subjectId]);

  const handlePublish = async (quizId) => {
    setPublishingId(quizId);
    try {
      await api.patch(`/teacher/quizzes/${quizId}/publish/`);
      const res = await api.get(`/teacher/subjects/${subjectId}/quizzes/`);
      setQuizzes(res.data.results || res.data);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to publish quiz.");
    } finally {
      setPublishingId(null);
    }
  };

  const handleDelete = async (quiz) => {
    if (quiz.is_published) {
      // First call without force to get attempt count
      setDeletingId(quiz.id);
      try {
        await api.delete(`/teacher/quizzes/${quiz.id}/delete/`);
        setQuizzes((prev) => prev.filter((q) => q.id !== quiz.id));
        return;
      } catch (err) {
        if (err.response?.status === 409 && err.response?.data?.requires_force) {
          const count = err.response.data.attempt_count;
          const confirmed = window.confirm(
            `⚠️ This quiz has ${count} student attempt(s).

` +
            `Deleting it will permanently remove ALL student scores and attempt history.

` +
            `Are you sure you want to delete it?`
          );
          if (!confirmed) { setDeletingId(null); return; }
          // Second call with force=true
          try {
            await api.delete(`/teacher/quizzes/${quiz.id}/delete/?force=true`);
            setQuizzes((prev) => prev.filter((q) => q.id !== quiz.id));
          } catch (err2) {
            alert(err2.response?.data?.detail || "Failed to delete quiz.");
          }
        } else {
          alert(err.response?.data?.detail || "Failed to delete quiz.");
        }
      } finally {
        setDeletingId(null);
      }
    } else {
      // Unpublished — simple confirm
      if (!window.confirm("Delete this quiz?")) return;
      setDeletingId(quiz.id);
      try {
        await api.delete(`/teacher/quizzes/${quiz.id}/delete/`);
        setQuizzes((prev) => prev.filter((q) => q.id !== quiz.id));
      } catch (err) {
        alert(err.response?.data?.detail || "Failed to delete quiz.");
      } finally {
        setDeletingId(null);
      }
    }
  };

  const handleView = (quiz) => {
    if (quiz.is_published) {
      navigate(`/teacher/classes/${subjectId}/quizzes/${quiz.id}`);
    } else {
      navigate(`/teacher/classes/${subjectId}/quizzes/${quiz.id}/draft`);
    }
  };

  return (
    <div className="quizzes-page">
      <button
        className="quizzes-back-btn"
        onClick={() => navigate(`/teacher/classes/${subjectId}`)}
      >
        <IoChevronBack /> Back
      </button>

      <div className="quizzes-title-container">
        <h2 className="quizzes-title">{subjectName || "Quizzes"}</h2>
      </div>

      <div className="quizzes-list-container">
        <div className="quizzes-actions">
          <button
            className="quizzes-create-btn"
            onClick={() => navigate(`/teacher/classes/${subjectId}/quizzes/create`)}
          >
            + Create New Quiz
          </button>
        </div>

        <div className="quizzes-list">
          {quizzes.length === 0 && (
            <p className="quizzes-empty">
              No quizzes created yet. Click "Create New Quiz" to get started.
            </p>
          )}

          {quizzes.map((quiz, index) => (
            <div className="quiz-row" key={quiz.id || index}>

              <div className="quiz-info">
                <span className="quiz-id">{quiz.title}</span>
                <span className="quiz-name">ID: {quiz.id.toString().slice(0, 8)}</span>
                <span className="quiz-creator">{quiz.teacher_name || quiz.created_by_email}</span>
              </div>

              <div className="quiz-detail">
                <span className="quiz-label">Created:</span>
                <span className="quiz-value">
                  {quiz.created_at ? new Date(quiz.created_at).toLocaleString() : "-"}
                </span>
              </div>

              <div className="quiz-detail">
                <span className="quiz-label">Questions:</span>
                <span className="quiz-value bold">{quiz.questions_count ?? 0}</span>
              </div>

              <div className="quiz-detail">
                <span className="quiz-label">Due:</span>
                <span className="quiz-value">
                  {quiz.due_date ? new Date(quiz.due_date).toLocaleDateString() : "-"}
                </span>
              </div>

              <div className="quiz-actions">
                <button
                  className="quiz-view-btn"
                  onClick={() => handleView(quiz)}
                >
                  {quiz.is_published ? "View" : "Preview"}
                </button>

                {(() => {
                  const meta = STATUS_META[quiz.review_status] || STATUS_META.draft;
                  return (
                    <span className={`quiz-status-badge ${meta.cls}`} title={quiz.review_note || ""}>
                      {meta.label}
                    </span>
                  );
                })()}

                {quiz.review_status === "rejected" && quiz.review_note && (
                  <span className="quiz-rejection-note">“{quiz.review_note}”</span>
                )}

                {(quiz.review_status === "draft" || quiz.review_status === "rejected") && (
                  <button
                    className={`quiz-publish-btn ${publishingId === quiz.id ? "loading" : ""}`}
                    onClick={() => handlePublish(quiz.id)}
                    disabled={publishingId === quiz.id || (quiz.questions_count ?? 0) === 0}
                    title={
                      (quiz.questions_count ?? 0) === 0
                        ? "Add at least one question before submitting"
                        : "Send to admin for verification"
                    }
                  >
                    {publishingId === quiz.id
                      ? "Submitting…"
                      : quiz.review_status === "rejected"
                        ? "Resubmit for review"
                        : "Submit for review"}
                  </button>
                )}

                <button
                  className="quiz-delete-btn"
                  onClick={() => handleDelete(quiz)}
                  disabled={deletingId === quiz.id}
                  title="Delete this quiz (will warn if students have attempted it)"
                >
                  {deletingId === quiz.id ? "Deleting…" : "Delete"}
                </button>
              </div>

            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
