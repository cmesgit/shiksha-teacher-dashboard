import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import api from "../api/apiClient";
import { IoChevronBack } from "react-icons/io5";
import { IoCheckmarkCircle } from "react-icons/io5";
import "../styles/quiz-view.css";
import { LoadingState } from "../components/StateViews";

const optionLabels = ["a", "b", "c", "d"];

export default function QuizView() {
  const navigate = useNavigate();
  const { quizId, subjectId } = useParams();

  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);

  useEffect(() => {
    async function fetchQuiz() {
      try {
        const res = await api.get(`/quizzes/${quizId}/`);
        setQuiz(res.data);
        setQuestions(res.data.questions || []);
      } catch (err) {
        console.error("Failed to load quiz", err);
      }
    }
    fetchQuiz();
  }, [quizId]);

  const getAnswerText = (q) => {
    const answer = q.answer?.toLowerCase().trim();

    const answerIndex = optionLabels.indexOf(answer);
    if (answerIndex >= 0 && q.options?.[answerIndex]) {
      const opt = q.options[answerIndex];
      return (opt.text || opt).trim();
    }

    if (q.options) {
      const match = q.options.find((opt) => {
        const optText = (opt.text || opt).toLowerCase().trim();
        return optText === answer;
      });
      if (match) return (match.text || match).trim();
    }

    return q.answer?.trim() || "";
  };

  if (!quiz) {
    return <LoadingState label="Loading quiz" />;
  }

  return (
    <div className="quiz-view-page">
      <button
        className="qv-back-btn"
        onClick={() => navigate(-1)}
      >
        <IoChevronBack /> Back
      </button>

      <div className="qv-header">
        <h2 className="qv-title">{quiz.subject_name || "Subject"}</h2>
      </div>

      <div className="qv-content-card">
        <div className="qv-edit-row">
          <button
            className="qv-view-submission-btn"
            onClick={() =>
              navigate(`/teacher/classes/${subjectId}/quizzes/${quizId}/submissions`)
            }
          >
            View Submission
          </button>
          <button
            className="qv-edit-btn"
            onClick={() => navigate("/teacher/classes/quizzes/create", { state: quiz })}
          >
            Edit
          </button>
        </div>

        <div className="qv-details">
          <h3 className="qv-quiz-title">Quiz ({quiz.title || "ID"})</h3>

          <p className="qv-teacher-info">
            {quiz.teacher_name || quiz.created_by_email} -{" "}
            {quiz.created_at
              ? new Date(quiz.created_at).toLocaleDateString()
              : "-"}
          </p>

          <div className="qv-dates-row">
            <span className="qv-question-count">
              {questions.length} question{questions.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="qv-questions-list">
            {questions.length === 0 && (
              <p className="qv-no-results">No questions found.</p>
            )}

            {questions.map((q, qIndex) => {
              const answerText = getAnswerText(q);

              return (
                <div className="qv-question-block" key={qIndex}>
                  <div className="qv-question-row">
                    <span className="qv-question-text">
                      <span className="qv-q-num">{qIndex + 1}.</span>
                      {q.text || "Question"}
                    </span>
                  </div>

                  <div className="qv-options-row">
                    {(q.options || q.choices || []).map((opt, optIndex) => {
                      const optText = (opt.text || opt).trim();
                      const isAnswer =
                        optText.toLowerCase() === answerText.toLowerCase();
                      return (
                        <label
                          className={`qv-option ${isAnswer ? "qv-option-answer" : ""}`}
                          key={optIndex}
                        >
                          <input type="radio" disabled />
                          <span>{optText}</span>
                          {isAnswer && (
                            <IoCheckmarkCircle className="qv-check-icon" />
                          )}
                        </label>
                      );
                    })}
                  </div>

                  {answerText && (
                    <div className="qv-answer-pill">
                      <IoCheckmarkCircle />
                      <span>
                        Correct answer: <strong>{answerText}</strong>
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}