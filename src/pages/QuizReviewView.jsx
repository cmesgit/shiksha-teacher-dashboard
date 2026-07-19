import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IoChevronBack } from "react-icons/io5";
import { IoCheckmarkCircle, IoCloseCircle } from "react-icons/io5";
import api from "../api/apiClient";
import "../styles/quiz-review-view.css";
import { LoadingState } from "../components/StateViews";

export default function QuizReviewView() {
  const navigate = useNavigate();
const { attemptId, quizId, subjectId, studentId } = useParams();

  const [data, setData] = useState(null);

  useEffect(() => {
    async function fetchReview() {
      try {
        const res = await api.get(`/teacher/attempts/${attemptId}/`);
        setData(res.data);
      } catch (err) {
        console.error("Failed to load review", err);
      }
    }
    fetchReview();
  }, [attemptId]);

  if (!data) {
    return <LoadingState label="Loading review" />;
  }

  const correct = data.questions.filter((q) => q.selected === q.correct).length;
  const total = data.questions.length;
  const pct = Math.round((correct / total) * 100);

  return (
    <div className="qrv-page">
      <button className="qrv-back-btn" onClick={() => navigate(`/teacher/classes/${subjectId}/quizzes/${quizId}/student/${studentId}`)}>
  <IoChevronBack /> Back
</button>

      <div className="qrv-card">
        <div className="qrv-header">
          <h2 className="qrv-title">Quiz Review</h2>
        </div>

        <div className="qrv-content">
          <div className="qrv-meta-row">
            <h3 className="qrv-student-name">{data.student_name}</h3>
            <span className="qrv-date-text">
              Submitted:{" "}
              {data.submitted_at
                ? new Date(data.submitted_at).toLocaleString()
                : "-"}
            </span>
          </div>

          <div className="qrv-score-banner">
            <div className="qrv-score-circle">
              <span className="qrv-score-pct">{pct}%</span>
            </div>
            <div className="qrv-score-details">
              <span className="qrv-score-label">Final Score</span>
              <span className="qrv-score-fraction">
                {data.score} / {data.total} correct
              </span>
            </div>
            <div className="qrv-score-bar-wrap">
              <div
                className="qrv-score-bar-fill"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="qrv-questions-list">
            {data.questions.map((q, qIndex) => {
              const isCorrect = q.selected === q.correct;

              return (
                <div
                  className={`qrv-question-block ${isCorrect ? "qrv-correct" : "qrv-wrong"}`}
                  key={qIndex}
                >
                  <div className="qrv-question-header">
                    <div className="qrv-question-text">
                      <span className="qrv-q-num">{qIndex + 1}.</span>
                      {q.question}
                    </div>
                    <span className={`qrv-status-badge ${isCorrect ? "badge-correct" : "badge-wrong"}`}>
                      {isCorrect ? (
                        <><IoCheckmarkCircle /> Correct</>
                      ) : (
                        <><IoCloseCircle /> Wrong</>
                      )}
                    </span>
                  </div>

                  <div className="qrv-options-row">
                    {q.options.map((opt, optIndex) => {
                      const isSelected = opt === q.selected;
                      const isAnswer = opt === q.correct;
                      let optClass = "qrv-option";
                      if (isSelected && isCorrect) optClass += " opt-selected-correct";
                      else if (isSelected && !isCorrect) optClass += " opt-selected-wrong";
                      else if (isAnswer && !isCorrect) optClass += " opt-correct-hint";

                      return (
                        <label className={optClass} key={optIndex}>
                          <input
                            type="radio"
                            checked={isSelected}
                            disabled
                            readOnly
                          />
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="qrv-answer-row">
                    <div className={`qrv-answer-pill ${isCorrect ? "pill-correct" : "pill-wrong"}`}>
                      <IoCheckmarkCircle />
                      <span>Correct answer: <strong>{q.correct}</strong></span>
                    </div>
                  </div>
                </div>
              );
            })}

            {data.questions.length === 0 && (
              <p className="qrv-no-results">No questions to review.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}