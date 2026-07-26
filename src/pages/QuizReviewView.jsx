// src/pages/QuizReviewView.jsx
// ──────────────────────────────────────────────────────────────────────────
// Academy "Quiz Review" (teacher) — one attempt's answer breakdown, reached
// from QuizStudentAttemptsView's "Review" action.
//
// The design handoff (Academy Dashboard.dc.html, quizResShowDetail, lines
// 318-346 / screenshots/teacher-10-quiz-answer-detail.png) shows this as a
// compact 560px MODAL over the Results list — a WRONG/CORRECT pill per
// question plus "Answered:"/"Correct:" text lines, no per-option radio rows
// and no score-circle. This app reaches the same content via its own routed
// page (deep-linkable by attemptId, used from a screen the design doesn't
// have — see QuizStudentAttemptsView), so collapsing it into a true inline
// modal would mean restructuring that screen's state/navigation for a purely
// visual win. Instead this stays a page but is restyled to the modal's exact
// visual language: same panel shape, same WRONG/CORRECT pill, same
// Answered/Correct lines — the score-circle and radio-style option rows are
// gone because the design has no equivalent for them.
// ──────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IoChevronBack } from "react-icons/io5";
import api from "../api/apiClient";
import "../styles/academyScreens.css";
import "../styles/quiz-review-view.css";
import { LoadingState, ErrorState, EmptyState } from "../components/StateViews";

export default function QuizReviewView() {
  const navigate = useNavigate();
  const { attemptId } = useParams();

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchReview() {
      setError(null);
      try {
        const res = await api.get(`/teacher/attempts/${attemptId}/`);
        if (!cancelled) setData(res.data);
      } catch (err) {
        console.error("Failed to load review", err);
        if (!cancelled) setError("Failed to load this attempt's review.");
      }
    }
    fetchReview();
    return () => { cancelled = true; };
  }, [attemptId]);

  // The only place this route is reached from today is QuizStudentAttemptsView's
  // "Review" button, so browser-back always lands back where the teacher came
  // from without needing studentId threaded through this URL.
  const goBack = () => navigate(-1);

  if (error) {
    return (
      <div className="ac-screen">
        <button type="button" className="qrv-back-btn" onClick={goBack}>
          <IoChevronBack size={14} /> Back
        </button>
        <ErrorState message={error} />
      </div>
    );
  }

  if (!data) {
    return <LoadingState label="Loading review" />;
  }

  const questions = data.questions || [];

  return (
    <div className="ac-screen">
      <button type="button" className="qrv-back-btn" onClick={goBack}>
        <IoChevronBack size={14} /> Back
      </button>

      <div className="qrv-panel">
        <div className="qrv-panelHead">
          <div className="qrv-name">{data.student_name}</div>
          <div className="qrv-scoreLine">
            Scored {data.score} / {data.total}
            {data.submitted_at && <> · Submitted {new Date(data.submitted_at).toLocaleString()}</>}
          </div>
        </div>

        <div className="qrv-answers">
          {questions.map((q, qIndex) => {
            const isCorrect = q.selected === q.correct;
            return (
              <div className="qrv-answerCard" key={qIndex}>
                <div className="qrv-answerTop">
                  <div className="qrv-qText">{qIndex + 1}. {q.question}</div>
                  <span className={`qrv-markPill ${isCorrect ? "is-correct" : "is-wrong"}`}>
                    {isCorrect ? "Correct" : "Wrong"}
                  </span>
                </div>
                <div className="qrv-answerLine">
                  <span className="qrv-answerLabel">Answered:</span> {q.selected ?? "—"}
                </div>
                {!isCorrect && (
                  <div className="qrv-answerLine qrv-answerLine--correct">
                    <span className="qrv-answerLabel">Correct:</span> {q.correct}
                  </div>
                )}
              </div>
            );
          })}

          {questions.length === 0 && (
            <EmptyState plain icon="quiz" title="No questions to review" />
          )}
        </div>
      </div>
    </div>
  );
}
