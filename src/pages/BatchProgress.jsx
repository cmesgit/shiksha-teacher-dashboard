// PLACEMENT: src/pages/BatchProgress.jsx
//
// Lists the batches this teacher can record progress for, grouped by course.
// Tapping a batch opens the per-batch chapter checklist (BatchProgressDetail).

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IoChevronBack } from "react-icons/io5";
import api from "../api/apiClient";
import "../styles/batch-progress.css";
import { LoadingState } from "../components/StateViews";

function Bar({ percent }) {
  return (
    <div className="bp-bar" aria-hidden>
      <div className="bp-bar__fill" style={{ width: `${Math.min(100, percent || 0)}%` }} />
    </div>
  );
}

export default function BatchProgress() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await api.get("/courses/teacher/my-batches/");
        if (!cancel) setGroups(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to load batches", err);
        if (!cancel) setGroups([]);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  const totalBatches = groups.reduce((n, g) => n + (g.batches?.length || 0), 0);

  return (
    <div className="bp-wrapper">
      <button className="bp-back-btn" onClick={() => navigate("/teacher/dashboard")}>
        <IoChevronBack /> Back
      </button>

      <div className="bp-container">
        <div className="bp-top">
          <h2>Batch Progress</h2>
        </div>

        {loading ? (
          <LoadingState plain label="Loading your batches" />
        ) : totalBatches === 0 ? (
          <div className="bp-empty">
            <p className="bp-empty-title">No batches to track yet.</p>
            <p className="bp-muted">
              Batches are created by an admin and tied to the courses you teach.
              Once a batch exists for one of your courses, it shows up here and
              you can tick off chapters as you cover them.
            </p>
          </div>
        ) : (
          groups.map((g) => (
            <section className="bp-course" key={g.course_id}>
              <div className="bp-course-head">
                <h3>{g.course_title}</h3>
                {g.board && <span className="bp-course-board">{g.board}</span>}
              </div>

              {(!g.batches || g.batches.length === 0) ? (
                <p className="bp-muted bp-muted--indent">No batches in this course yet.</p>
              ) : (
                <div className="bp-grid">
                  {g.batches.map((b) => (
                    <button
                      className="bp-card"
                      key={b.id}
                      onClick={() =>
                        navigate(`/teacher/batch-progress/${b.id}`, {
                          state: { batchName: b.name, batchCode: b.code, courseTitle: g.course_title },
                        })
                      }
                    >
                      <div className="bp-card-top">
                        <span className="bp-card-name">{b.name}</span>
                        <span className="bp-code">{b.code}</span>
                      </div>
                      <div className="bp-card-meta">
                        {b.year ? <span>{b.year}</span> : null}
                        <span>
                          {b.seats_taken}
                          {b.capacity != null ? ` / ${b.capacity}` : ""} students
                        </span>
                        {!b.is_active && <span className="bp-closed">Closed</span>}
                      </div>
                      <div className="bp-card-progress">
                        <Bar percent={b.percent} />
                        <span className="bp-card-pct">
                          {b.chapters_done}/{b.chapters_total} · {b.percent}%
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          ))
        )}
      </div>
    </div>
  );
}
