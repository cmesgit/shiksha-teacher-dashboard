import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/apiClient";
import "../styles/batch-progress.css";

// Not a real pacing model — there's no per-batch schedule/plan backend, so
// this compares % chapters covered against % of the batch's start/end date
// range elapsed. Batches missing either date show only the raw chapter count.
function paceLabel(percent, startDate, endDate) {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;

  const elapsedPct = Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100));
  const diff = percent - elapsedPct;

  if (diff > 10) return { text: "ahead of plan", color: "#2f9d42" };
  if (diff < -25) return { text: "well behind", color: "#dc2626" };
  if (diff < -10) return { text: "slightly behind", color: "#d97706" };
  return { text: "on track", color: "#6b7c83" };
}

export default function BatchProgressSummary() {
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await api.get("/courses/teacher/my-batches/");
        const groups = Array.isArray(res.data?.groups) ? res.data.groups : [];
        const flat = groups.flatMap((g) => g.batches || []);
        if (!cancel) setBatches(flat);
      } catch (err) {
        console.error("Failed to load batch progress", err);
        if (!cancel) setBatches([]);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <h4>Batch Progress</h4>
        <button type="button" className="dash-remaining" style={{ background: "none", border: "none", cursor: "pointer" }}
          onClick={() => navigate("/teacher/batch-progress")}>
          View all &rarr;
        </button>
      </div>
      <div className="dash-card-body">
        {loading && <p>Loading...</p>}
        {!loading && batches.length === 0 && <p>No batches yet</p>}
        {!loading && batches.map((b) => {
          const pace = paceLabel(b.percent, b.start_date, b.end_date);
          return (
            <div key={b.id} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 600, color: "#1a2c33" }}>
                <span>{b.name}</span>
                <span style={{ fontWeight: 500, color: "#6b7c83" }}>{b.seats_taken} students</span>
              </div>
              <div className="bp-card-progress" style={{ marginTop: 6 }}>
                <div className="bp-bar" aria-hidden>
                  <div className="bp-bar__fill" style={{ width: `${Math.min(100, b.percent || 0)}%` }} />
                </div>
              </div>
              <div style={{ fontSize: 10.5, color: "#6b7c83", marginTop: 4 }}>
                Ch {b.chapters_done} of {b.chapters_total} covered
                {pace && <span style={{ color: pace.color, fontWeight: 600 }}> · {pace.text}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
