// src/pages/QuizSubmissionView.jsx
// ──────────────────────────────────────────────────────────────────────────
// Academy "Quiz Results" (teacher) — reached from the Quizzes list card's
// "View results" action. Matches the design handoff's Quiz Results screen
// (Academy Dashboard.dc.html, data-screen-label="Quiz Results", lines
// 947-989 / screenshots/teacher-09-quiz-results.png): a 4-tile stat row, a
// status legend, then one row per student with an avatar, a status chip and
// a score.
//
// One real difference from the design's flattened mock data: a student here
// can attempt a quiz more than once (best/average score + an attempts count
// come back per student), so the design's single "Overdue" tile — which
// needs a due date this endpoint doesn't return — is swapped for a real
// "Total attempts" tile instead of inventing data. The design's row-level
// "View answers" button becomes "View attempts", landing on
// QuizStudentAttemptsView so the teacher can pick which attempt to review.
// ──────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IoChevronBack } from "react-icons/io5";
import api from "../api/apiClient";
import { LoadingState, ErrorState, EmptyState } from "../components/StateViews";
import "../styles/academyScreens.css";
import "../styles/quiz-submission-view.css";

// Design's fixed 5-tone avatar rotation (dc.html's `AV` array) — reuses the
// shared subject-chip colour slots from tokens.css instead of inventing new
// hex pairs; the order below reproduces the design's own rotation exactly
// (blue, green, amber, maroon, teal).
const AVATAR_TONES = [
  { bg: "var(--subj-2-bg)", ink: "var(--subj-2-ink)" },
  { bg: "var(--subj-4-bg)", ink: "var(--subj-4-ink)" },
  { bg: "var(--subj-3-bg)", ink: "var(--subj-3-ink)" },
  { bg: "var(--subj-5-bg)", ink: "var(--subj-5-ink)" },
  { bg: "var(--subj-1-bg)", ink: "var(--subj-1-ink)" },
];

const initialsOf = (name) =>
  (name || "?")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function QuizSubmissionView() {
  const navigate = useNavigate();
  const { quizId, subjectId } = useParams();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchSubmissions() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/teacher/quizzes/${quizId}/attempts/`);
        if (!cancelled) setStudents(res.data || []);
      } catch (err) {
        console.error("Failed to load submissions", err);
        if (!cancelled) setError("Failed to load quiz results.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchSubmissions();
    return () => { cancelled = true; };
  }, [quizId]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) {
    return <div className="ac-screen"><LoadingState label="Loading quiz results" /></div>;
  }

  if (error) {
    return (
      <div className="ac-screen">
        <button
          type="button"
          className="qsv-back-btn"
          onClick={() => navigate(-1)}
        >
          <IoChevronBack size={14} /> Back to Quizzes
        </button>
        <ErrorState message={error} />
      </div>
    );
  }

  // Every stat here is a real aggregate off the roster already fetched —
  // no field is fabricated.
  const submitted = students.filter((s) => (s.attempts_count ?? 0) > 0);
  const totalAttempts = students.reduce((sum, s) => sum + (s.attempts_count ?? 0), 0);
  const scoredPcts = submitted
    .filter((s) => s.total_marks)
    .map((s) => (s.average_score / s.total_marks) * 100);
  const avgPct = scoredPcts.length
    ? Math.round(scoredPcts.reduce((a, b) => a + b, 0) / scoredPcts.length)
    : null;

  const stats = [
    { label: "Students", value: String(students.length) },
    { label: "Submitted", value: String(submitted.length) },
    { label: "Total attempts", value: String(totalAttempts) },
    { label: "Avg score", value: avgPct != null ? `${avgPct}%` : "—" },
  ];

  return (
    <div className="ac-screen">
      <button
        type="button"
        className="qsv-back-btn"
        onClick={() => navigate(-1)}
      >
        <IoChevronBack size={14} /> Back to Quizzes
      </button>

      <div className="qsv-head">
        <h1 className="qsv-title">Quiz Results</h1>
        <p className="qsv-sub">
          {plural(students.length, "student")} · {plural(submitted.length, "submission")}
        </p>
      </div>

      <div className="qsv-statGrid">
        {stats.map((s) => (
          <div className="qsv-statTile" key={s.label}>
            <div className="qsv-statValue">{s.value}</div>
            <div className="qsv-statLabel">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="qsv-legend">
        <span className="qsv-legendItem"><span className="qsv-dot qsv-dot--submitted" />Submitted</span>
        <span className="qsv-legendItem"><span className="qsv-dot qsv-dot--pending" />Not submitted</span>
      </div>

      <div className="ac-listCard">
        {students.length === 0 ? (
          <EmptyState
            plain
            icon="quiz"
            title="No submissions yet"
            message="Results will appear here once a student attempts this quiz."
          />
        ) : (
          <div className="ac-list">
            {students.map((student, index) => {
              const hasAttempts = (student.attempts_count ?? 0) > 0;
              const tone = AVATAR_TONES[index % AVATAR_TONES.length];
              const rowPct = student.total_marks
                ? `${((student.average_score / student.total_marks) * 100).toFixed(0)}%`
                : null;

              return (
                <div className="ac-row qsv-row" key={student.id || student.student_id || index}>
                  <span className={`qsv-dot ${hasAttempts ? "qsv-dot--submitted" : "qsv-dot--pending"}`} />
                  <div className="qsv-avatar" style={{ background: tone.bg, color: tone.ink }}>
                    {initialsOf(student.student_name)}
                  </div>
                  <div className="ac-row__body">
                    <div className="ac-row__topic">{student.student_name}</div>
                    <div className="ac-row__sub">
                      {hasAttempts
                        ? `${plural(student.attempts_count, "attempt")}${rowPct ? ` · avg ${rowPct}` : ""} · last ${formatDate(student.latest_submitted_at)}`
                        : "No attempts yet"}
                    </div>
                  </div>
                  <span className={`ac-tag ac-tag--${hasAttempts ? "success" : "neutral"}`}>
                    {hasAttempts ? "Submitted" : "Not submitted"}
                  </span>
                  <span className="qsv-score">
                    {hasAttempts ? `${student.best_score} / ${student.total_marks}` : "—"}
                  </span>
                  {hasAttempts ? (
                    <button
                      type="button"
                      className="ac-btn"
                      onClick={() =>
                        navigate(
                          `/teacher/classes/${subjectId}/quizzes/${quizId}/student/${student.student_id}`
                        )
                      }
                    >
                      View attempts
                    </button>
                  ) : (
                    <span className="qsv-actionSpacer" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
