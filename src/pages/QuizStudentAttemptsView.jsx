// src/pages/QuizStudentAttemptsView.jsx
// ──────────────────────────────────────────────────────────────────────────
// Academy "Student Attempts" (teacher) — one student's attempt history for a
// quiz, reached from QuizSubmissionView's "View attempts" action.
//
// The design handoff has no equivalent screen: its Quiz Results mock data
// gives every student exactly one attempt, so its row goes straight to an
// answer-detail modal. This app's quiz attempts endpoint is a real, separate
// per-student, per-attempt fan-out (attempt_number / submitted_at / score
// per row, plus a best/average/attempts-count summary one level up in
// QuizSubmissionView) — a student really can retake a quiz here, so picking
// WHICH attempt to review is real functionality the design was silent on,
// not a redundant screen. It's restyled to the shared Academy list vocabulary
// below rather than removed.
// ──────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IoChevronBack } from "react-icons/io5";
import api from "../api/apiClient";
import { LoadingState, ErrorState, EmptyState } from "../components/StateViews";
import "../styles/academyScreens.css";
import "../styles/quiz-student-attempts-view.css";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Same score-tier thresholds the legacy table used, just remapped onto the
// shared semantic tokens instead of one-off hexes.
const scoreTier = (score, total) => {
  if (!total) return "neutral";
  const pct = (score / total) * 100;
  if (pct >= 70) return "high";
  if (pct >= 40) return "mid";
  return "low";
};

export default function QuizStudentAttemptsView() {
  const { quizId, subjectId, studentId } = useParams();
  const navigate = useNavigate();

  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchAttempts() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(
          `/teacher/quizzes/${quizId}/attempts/${studentId}/`
        );
        if (!cancelled) setAttempts(res.data || []);
      } catch (err) {
        console.error("Failed to load attempts", err);
        if (!cancelled) setError("Failed to load this student's attempts.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchAttempts();
    return () => { cancelled = true; };
  }, [quizId, studentId]);

  const goBack = () => navigate(-1);

  if (loading) {
    return <div className="ac-screen"><LoadingState label="Loading attempts" /></div>;
  }

  if (error) {
    return (
      <div className="ac-screen">
        <button type="button" className="qsav-back-btn" onClick={goBack}>
          <IoChevronBack size={14} /> Back to Results
        </button>
        <ErrorState message={error} />
      </div>
    );
  }

  const studentName = attempts[0]?.student_name || "Student";

  return (
    <div className="ac-screen">
      <button type="button" className="qsav-back-btn" onClick={goBack}>
        <IoChevronBack size={14} /> Back to Results
      </button>

      <div className="qsav-head">
        <h1 className="qsav-title">{studentName}’s Attempts</h1>
        <p className="qsav-sub">{plural(attempts.length, "attempt")}</p>
      </div>

      <div className="ac-listCard">
        {attempts.length === 0 ? (
          <EmptyState
            plain
            icon="quiz"
            title="No attempts found"
            message="This student hasn't attempted the quiz yet."
          />
        ) : (
          <div className="ac-list">
            {attempts.map((a) => {
              const tier = scoreTier(a.score, a.total_marks);
              return (
                <div className="ac-row" key={a.id}>
                  <div className="qsav-attemptBadge">#{a.attempt_number}</div>
                  <div className="ac-row__body">
                    <div className="ac-row__topic">Attempt {a.attempt_number}</div>
                    <div className="ac-row__sub">
                      {a.submitted_at
                        ? new Date(a.submitted_at).toLocaleString()
                        : "Not submitted"}
                    </div>
                  </div>
                  <span className={`qsav-score-pill qsav-score-pill--${tier}`}>
                    {a.score} / {a.total_marks}
                  </span>
                  <button
                    type="button"
                    className="ac-btn"
                    onClick={() =>
                      navigate(
                        `/teacher/classes/${subjectId}/quizzes/${quizId}/review/${a.id}`
                      )
                    }
                  >
                    Review
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
