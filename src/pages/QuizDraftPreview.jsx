/**
 * QuizDraftPreview.jsx
 * 
 * Teacher-only view of an UNPUBLISHED quiz.
 * Route: /teacher/quizzes/:quizId/draft
 * 
 * Uses the existing /quizzes/:pk/ endpoint (teacher role gets full data
 * including correct answers). Shows everything the published QuizView shows,
 * plus a prominent "Publish" CTA and a draft watermark.
 */

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IoChevronBack } from "react-icons/io5";
import { IoCheckmarkCircle } from "react-icons/io5";
import { IoWarningOutline, IoHourglassOutline } from "react-icons/io5";
import api from "../api/apiClient";
import "../styles/quiz-draft-preview.css";
import { LoadingState } from "../components/StateViews";
import ConfirmDialog from "../components/ConfirmDialog";

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];

export default function QuizDraftPreview() {
  const navigate = useNavigate();
  const { quizId } = useParams();

  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState(null);
  const [confirmDlg, setConfirmDlg] = useState(null);

  useEffect(() => {
    async function fetchQuiz() {
      try {
        setFetchError(null);
        // /quizzes/:pk/draft/ — teacher-only endpoint that works for
        // both published and unpublished quizzes (no is_published filter)
        const res = await api.get(`/quizzes/${quizId}/draft/`);
        setQuiz(res.data);
      } catch (err) {
        console.error("Failed to load quiz draft", err);
        const msg = err.response?.data?.detail
          || (err.response?.status === 404 ? "Quiz not found. It may have been deleted." : null)
          || (err.response?.status === 403 ? "You are not authorised to preview this quiz." : null)
          || "Failed to load quiz. Please go back and try again.";
        setFetchError(msg);
      } finally {
        setLoading(false);
      }
    }
    fetchQuiz();
  }, [quizId]);

  const doPublish = async () => {
    setConfirmDlg(null);
    setPublishing(true);
    setPublishError(null);
    try {
      await api.patch(`/teacher/quizzes/${quizId}/publish/`);
      // Reload so the banner reflects the new review_status immediately.
      const res = await api.get(`/quizzes/${quizId}/draft/`);
      setQuiz(res.data);
    } catch (err) {
      setPublishError(err.response?.data?.detail || "Failed to submit quiz for review.");
    } finally {
      setPublishing(false);
    }
  };

  const handlePublish = () => {
    setConfirmDlg({
      title: "Submit this quiz for admin review?",
      message: "Once submitted, questions can't be edited until it's approved or sent back.",
      confirmLabel: "Submit for review",
      onConfirm: doPublish,
    });
  };

  if (loading) return <LoadingState label="Loading preview" />;
  if (fetchError) return (
    <div className="qdp-page">
      <button className="qdp-back-btn" onClick={() => navigate(-1)}>
        <IoChevronBack /> Back to Quizzes
      </button>
      <div className="qdp-fetch-error"><IoWarningOutline /> {fetchError}</div>
    </div>
  );
  if (!quiz) return null;

  const questions = quiz.questions || [];

  // Find correct answer for a question (uses choices array from backend)
  const getCorrectText = (q) => {
    const correct = (q.choices || q.options || []).find((c) => c.is_correct);
    return correct ? (correct.text || correct) : "";
  };

  const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);
  // Falls back to is_assigned, not the retiring is_published mirror — see
  // Quizzes.jsx's handleDelete. Only reached when review_status is absent.
  const reviewStatus = quiz.review_status || (quiz.is_assigned ? "approved" : "draft");
  const canSubmit = quiz.is_editable !== false && (reviewStatus === "draft" || reviewStatus === "rejected");

  const BANNER_COPY = {
    draft: { cls: "qdp-draft-badge", text: "DRAFT — Not visible to students" },
    pending: { cls: "qdp-draft-badge qdp-badge--pending", icon: IoHourglassOutline, text: "Submitted — awaiting admin verification" },
    approved: { cls: "qdp-draft-badge qdp-badge--approved", icon: IoCheckmarkCircle, text: "Approved — live for students" },
    rejected: { cls: "qdp-draft-badge qdp-badge--rejected", icon: IoWarningOutline, text: "Changes requested by admin" },
  };
  const banner = BANNER_COPY[reviewStatus] || BANNER_COPY.draft;
  const BannerIcon = banner.icon;

  return (
    <div className="qdp-page">
      {/* Banner */}
      <div className="qdp-draft-banner">
        <span className={banner.cls}>{BannerIcon && <BannerIcon />} {banner.text}</span>
        <div className="qdp-banner-actions">
          {publishError && <span className="qdp-publish-error">{publishError}</span>}
          {canSubmit && (
            <button
              className="qdp-back-btn"
              onClick={() => navigate(`/teacher/quizzes/${quizId}/edit`)}
            >
              Edit quiz
            </button>
          )}
          {canSubmit && (
            <button
              className="qdp-publish-btn"
              onClick={handlePublish}
              disabled={publishing || questions.length === 0}
              title={questions.length === 0 ? "Add questions before submitting" : ""}
            >
              {publishing ? "Submitting…" : reviewStatus === "rejected" ? "Resubmit for review" : "Submit for review"}
            </button>
          )}
        </div>
      </div>

      {reviewStatus === "rejected" && quiz.review_note && (
        <div className="qdp-rejection-banner">
          <strong>Admin feedback:</strong> {quiz.review_note}
        </div>
      )}

      <button
        className="qdp-back-btn"
        onClick={() => navigate(-1)}
      >
        <IoChevronBack /> Back to Quizzes
      </button>

      {/* Header */}
      <div className="qdp-header">
        <div>
          <h2 className="qdp-title">{quiz.subject_name || "Subject"}</h2>
          <p className="qdp-meta">
            {quiz.teacher_name} &nbsp;·&nbsp;
            Created: {quiz.created_at ? new Date(quiz.created_at).toLocaleDateString() : "—"}
          </p>
        </div>
      </div>

      <div className="qdp-content-card">

        {/* Quiz meta */}
        <div className="qdp-quiz-meta-row">
          <div className="qdp-meta-block">
            <span className="qdp-meta-label">Quiz Title</span>
            <span className="qdp-meta-value">{quiz.title}</span>
          </div>
          <div className="qdp-meta-block">
            <span className="qdp-meta-label">Time Limit</span>
            <span className="qdp-meta-value">
              {quiz.time_limit_minutes ? `${quiz.time_limit_minutes} min` : "—"}
            </span>
          </div>
          <div className="qdp-meta-block">
            <span className="qdp-meta-label">Questions</span>
            <span className="qdp-meta-value">{questions.length}</span>
          </div>
          <div className="qdp-meta-block">
            <span className="qdp-meta-label">Total Marks</span>
            <span className="qdp-meta-value">{totalMarks}</span>
          </div>
        </div>

        {quiz.description && (
          <p className="qdp-description">{quiz.description}</p>
        )}

        {/* Questions */}
        {questions.length === 0 && (
          <p className="qdp-empty">
            No questions added yet. Go back and add questions before publishing.
          </p>
        )}

        <div className="qdp-questions-list">
          {questions.map((q, qIndex) => {
            const correctText = getCorrectText(q);
            const choices = q.choices || q.options || [];

            return (
              <div className="qdp-question-block" key={q.id || qIndex}>
                <div className="qdp-question-row">
                  <div className="qdp-question-left">
                    <span className="qdp-q-num">{qIndex + 1}.</span>
                    <span className="qdp-q-text">{q.text || "Question text"}</span>
                  </div>
                  <span className="qdp-q-marks">{q.marks || 1} {(q.marks || 1) === 1 ? "mark" : "marks"}</span>
                </div>

                <div className="qdp-options-row">
                  {choices.map((opt, optIndex) => {
                    const optText = (opt.text || opt).trim();
                    const isCorrect = opt.is_correct || optText.toLowerCase() === correctText.toLowerCase();
                    return (
                      <label
                        className={`qdp-option ${isCorrect ? "qdp-option--correct" : ""}`}
                        key={optIndex}
                      >
                        <span className="qdp-opt-letter">{OPTION_LABELS[optIndex]}</span>
                        <input type="radio" disabled />
                        <span className="qdp-opt-text">{optText}</span>
                        {isCorrect && <IoCheckmarkCircle className="qdp-check-icon" />}
                      </label>
                    );
                  })}
                </div>

                <div className="qdp-answer-pill">
                  <IoCheckmarkCircle />
                  <span>Correct answer: <strong>{correctText}</strong></span>
                </div>

                {q.explanation && (
                  <div className="qdp-explanation">
                    <strong>Explanation:</strong> {q.explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom publish CTA */}
        {questions.length > 0 && canSubmit && (
          <div className="qdp-bottom-cta">
            <p className="qdp-cta-note">
              Everything looks good? Submitting sends this quiz to an admin for verification.
              <br />
              <strong>Questions can't be edited again until it's approved or sent back.</strong>
            </p>
            <button
              className="qdp-publish-btn-lg"
              onClick={handlePublish}
              disabled={publishing}
            >
              {publishing ? "Submitting…" : reviewStatus === "rejected" ? "Resubmit for review" : "Submit for review"}
            </button>
          </div>
        )}
      </div>
      <ConfirmDialog
        dialog={confirmDlg && { ...confirmDlg, busy: publishing }}
        onClose={() => setConfirmDlg(null)}
      />
    </div>
  );
}
