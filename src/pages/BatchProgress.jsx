// PLACEMENT: src/pages/BatchProgress.jsx
//
// Lists every batch this teacher can record progress for as one flat list
// (no per-course grouping), plus a stat-cards summary row.
// Tapping a batch opens the per-batch chapter checklist (BatchProgressDetail) —
// that screen is the only place chapters get marked as covered, which is how
// every percentage shown here gets produced in the first place.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/apiClient";
import NavIcon from "../components/NavIcon";
import "../styles/batch-progress.css";
import { LoadingState } from "../components/StateViews";

export default function BatchProgress() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await api.get("/courses/teacher/my-batches/");
        const payload = res.data || {};
        if (!cancel) {
          setGroups(Array.isArray(payload.groups) ? payload.groups : []);
          setStats(payload.stats || null);
        }
      } catch (err) {
        console.error("Failed to load batches", err);
        if (!cancel) {
          setGroups([]);
          setStats(null);
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  const flatBatches = groups.flatMap((g) =>
    (g.batches || []).map((b) => ({ ...b, courseTitle: g.course_title }))
  );

  const safeStats = stats || {};
  const avgSyllabus = safeStats.avg_syllabus_completion;
  const avgQuiz = safeStats.avg_quiz_score;

  const statCards = [
    {
      icon: "layers", iconBg: "#e6edee", iconColor: "#425f7f",
      value: safeStats.active_batches ?? 0, label: "Active batches",
    },
    {
      icon: "chart", iconBg: "#e6f4f6", iconColor: "#13899b",
      value: avgSyllabus == null ? "—" : `${avgSyllabus}%`, label: "Avg syllabus completion",
    },
    {
      icon: "users", iconBg: "#e8edfb", iconColor: "#1d4ed8",
      value: safeStats.students ?? 0, label: "Students",
    },
    {
      icon: "trend", iconBg: "#ecf8ee", iconColor: "#2f9d42",
      value: avgQuiz == null ? "—" : `${avgQuiz}%`, label: "Avg quiz score",
    },
  ];

  return (
    <div className="bp-page">
      <div className="bp-page-head">
        <h1>Batch Progress</h1>
        <p>Syllabus completion across your batches.</p>
      </div>

      <div className="bp-stats">
        {statCards.map((st) => (
          <div className="bp-stat" key={st.label}>
            <div className="bp-stat__icon" style={{ background: st.iconBg, color: st.iconColor }}>
              <NavIcon name={st.icon} size={18} color={st.iconColor} />
            </div>
            <div>
              <div className="bp-stat__value">{st.value}</div>
              <div className="bp-stat__label">{st.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bp-panel">
        <h3>Batch Completion</h3>

        {loading ? (
          <LoadingState plain label="Loading your batches" />
        ) : flatBatches.length === 0 ? (
          <div className="bp-empty">
            <p className="bp-empty-title">No batches to track yet.</p>
            <p className="bp-muted">
              Batches are created by an admin and tied to the courses you teach.
              Once a batch exists for one of your courses, it shows up here and
              you can tick off chapters as you cover them.
            </p>
          </div>
        ) : (
          <div className="bp-list">
            {flatBatches.map((b) => (
              <button
                type="button"
                className="bp-row"
                key={b.id}
                onClick={() =>
                  navigate(`/teacher/batch-progress/${b.id}`, {
                    state: { batchName: b.name, batchCode: b.code, courseTitle: b.courseTitle },
                  })
                }
              >
                <div className="bp-row-top">
                  <span className="bp-row-name">{b.name} · {b.seats_taken} students</span>
                  <span className="bp-row-pct">{b.percent ?? 0}%</span>
                </div>
                <div className="bp-row-bar" aria-hidden>
                  <div className="bp-row-bar__fill" style={{ width: `${Math.min(100, b.percent || 0)}%` }} />
                </div>
                <div className="bp-row-meta">
                  {[
                    b.courseTitle,
                    b.year,
                    `Ch ${b.chapters_done ?? 0} of ${b.chapters_total ?? 0} covered`,
                  ].filter(Boolean).join(" · ")}
                  {!b.is_active && <span className="bp-row-closed"> · Closed</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
