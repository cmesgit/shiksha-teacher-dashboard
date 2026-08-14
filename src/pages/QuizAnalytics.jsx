import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { IoChevronBack } from "react-icons/io5";
import api from "../api/apiClient";
import { useToast } from "../contexts/ToastContext";
import "../styles/quiz-analytics.css";

// New teacher-facing analytics screen — item analysis, score distribution,
// flagged questions, and non-attempters, per quiz. Route: teacher/quizzes/:quizId/analytics
// GET /teacher/quizzes/:id/analytics/ -> { title, attempted_count, total_students,
// class_average, median, avg_time_seconds, time_limit_minutes,
// items: [{ id, order, text, pct_correct }],       // pct_correct < 40 flags
// score_distribution: [{ range, count }],
// not_attempted: [{ id, name }] }

export default function QuizAnalytics() {
  const navigate = useNavigate();
  const { quizId } = useParams();
  const { showToast } = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reminding, setReminding] = useState(false);
  const [reminded, setReminded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get(`/teacher/quizzes/${quizId}/analytics/`);
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.detail || "Unable to load analytics.");
      } finally {
        setLoading(false);
      }
    })();
  }, [quizId]);

  async function sendReminder() {
    setReminding(true);
    try {
      const res = await api.post(`/teacher/quizzes/${quizId}/remind/`);
      setReminded(true);
      if (res.data?.detail) {
        // Surface the exact count/skip reason from the backend (e.g.
        // "Everyone has already attempted this quiz.").
        setData((prev) => (prev ? { ...prev, _reminderDetail: res.data.detail } : prev));
      }
    } catch (err) {
      showToast({ type: "error", message: err.response?.data?.detail || "Failed to send reminder." });
    } finally {
      setReminding(false);
    }
  }

  if (loading) return <div className="qa-loading">Loading analytics…</div>;
  if (error) return <div className="qa-loading qa-error">{error}</div>;
  if (!data) return null;

  const items = data.items || [];
  const flagged = items.filter((it) => it.pct_correct < 40);
  const worst = [...flagged].sort((a, b) => a.pct_correct - b.pct_correct)[0];
  const dist = data.score_distribution || [];
  const distMax = Math.max(1, ...dist.map((d) => d.count));
  const fmtSecs = (s) => {
    if (s == null) return "—";
    const m = Math.floor(s / 60), sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="qa-page">
      <button className="qa-back" onClick={() => navigate("/teacher/quizzes")}>
        <IoChevronBack /> Back to quizzes
      </button>
      <h1 className="qa-title">{data.title} · Analytics</h1>

      <div className="qa-stat-strip">
        <div className="qa-stat-card">
          <div className="qa-stat-label">Attempted</div>
          <div className="qa-stat-value">{data.attempted_count} / {data.total_students}</div>
          <div className="qa-stat-sub">{Math.round((data.attempted_count / Math.max(1, data.total_students)) * 100)}% of the batch</div>
        </div>
        <div className="qa-stat-card">
          <div className="qa-stat-label">Class average</div>
          <div className="qa-stat-value">{data.class_average}%</div>
          <div className="qa-stat-sub">median {data.median}%</div>
        </div>
        <div className="qa-stat-card">
          <div className="qa-stat-label">Avg time taken</div>
          <div className="qa-stat-value">{fmtSecs(data.avg_time_seconds)}</div>
          <div className="qa-stat-sub">of {data.time_limit_minutes ?? "—"}:00 limit</div>
        </div>
        <div className="qa-stat-card">
          <div className="qa-stat-label">Flagged questions</div>
          <div className="qa-stat-value">{flagged.length}</div>
          <div className="qa-stat-sub">below 40% correct</div>
        </div>
      </div>

      <div className="qa-main-grid">
        <div className="qa-card">
          <div className="qa-card-title">Item analysis</div>
          <div className="qa-card-sub">% of students answering each question correctly. Flags need review.</div>
          <div className="qa-item-list">
            {items.map((it) => {
              const bad = it.pct_correct < 40;
              const mid = it.pct_correct < 65;
              return (
                <div key={it.id} className="qa-item-row">
                  <span className="qa-item-num">Q{it.order}</span>
                  <span className="qa-item-text">{it.text}</span>
                  <div className="qa-item-track"><div className={`qa-item-fill ${bad ? "qa-item-fill--bad" : mid ? "qa-item-fill--mid" : ""}`} style={{ width: `${it.pct_correct}%` }} /></div>
                  <span className={`qa-item-pct ${bad ? "qa-item-pct--bad" : mid ? "qa-item-pct--mid" : ""}`}>{it.pct_correct}%</span>
                  {bad && <span className="qa-item-flag">Review</span>}
                </div>
              );
            })}
            {items.length === 0 && <div className="qa-item-empty">No questions on this quiz.</div>}
          </div>
        </div>

        <div className="qa-side">
          {worst && (
            <div className="qa-attention-card">
              <div className="qa-attention-title">⚠ Needs attention</div>
              <div className="qa-attention-body">
                Only {worst.pct_correct}% got Q{worst.order} right. Consider re-teaching this topic or checking the question wording.
              </div>
            </div>
          )}

          {dist.length > 0 && (
            <div className="qa-card">
              <div className="qa-card-title">Score distribution</div>
              <div className="qa-dist-chart">
                {dist.map((d) => (
                  <div key={d.range} className="qa-dist-col">
                    <div className="qa-dist-bar" style={{ height: `${(d.count / distMax) * 72}px` }} />
                    <div className="qa-dist-range">{d.range}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(data.not_attempted) && (
            <div className="qa-card">
              <div className="qa-card-title">Not yet attempted · {data.not_attempted.length}</div>
              <div className="qa-not-attempted-body">
                {data.not_attempted.slice(0, 3).map((s) => s.name).join(", ")}
                {data.not_attempted.length > 3 && ` +${data.not_attempted.length - 3} more`}
              </div>
              <button className="qa-remind-btn" onClick={sendReminder} disabled={reminding || reminded || !data.not_attempted.length}>
                {reminded ? "Reminder sent ✓" : reminding ? "Sending…" : "Send reminder"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
