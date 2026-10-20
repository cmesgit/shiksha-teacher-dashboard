import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAppointments } from "../../api/counselorService";
import "../../styles/counsellor.css";

const CANCELLED = new Set(["cancelled", "rejected", "no_show"]);

export default function CounselorHistory() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState(null);
  const [tab, setTab] = useState("completed");
  const [order, setOrder] = useState("recent");
  const [error, setError] = useState("");

  useEffect(() => {
    getAppointments().then((data) => setSessions(data.results || []))
      .catch(() => setError("Couldn't load session history. Please refresh."));
  }, []);

  const shown = useMemo(() => {
    if (!sessions) return null;
    const list = sessions.filter((s) => tab === "completed" ? s.status === "completed" : CANCELLED.has(s.status));
    return list.sort((a, b) => (order === "recent" ? -1 : 1) * (new Date(a.scheduled_at) - new Date(b.scheduled_at)));
  }, [sessions, tab, order]);

  return <div className="co-page">
    <div className="co-head"><div><h1 className="co-title">Session history</h1><p className="co-sub">Completed, cancelled and declined sessions.</p></div></div>
    <div className="co-head">
      <div className="co-tabs" role="tablist" aria-label="History status">
        {["completed", "cancelled"].map((value) => <button key={value} role="tab" aria-selected={tab === value}
          className={`co-tab${tab === value ? " co-tab--on" : ""}`} onClick={() => setTab(value)}>
          {value === "completed" ? "Completed" : "Cancelled & declined"}
        </button>)}
      </div>
      <label className="co-sort">Sort <select className="co-select" value={order} onChange={(e) => setOrder(e.target.value)}><option value="recent">Most recent</option><option value="oldest">Oldest first</option></select></label>
    </div>
    {error && <div className="co-error">{error}</div>}
    {shown === null ? <div className="co-skel" style={{ height: 140 }} /> : shown.length === 0 ?
      <div className="co-empty"><div className="co-empty-title">No {tab} sessions</div>Sessions will appear here as their status changes.</div> :
      <div className="co-list">{shown.map((s) => <button className="co-card co-card--row" key={s.id}
        onClick={() => navigate(`/teacher/counsellor/appointments/${s.id}`)}>
        <span className="co-avatar">{(s.learner?.display_name || "?")[0]}</span>
        <span className="co-card-main"><span className="co-card-title">{s.learner?.display_name}</span>
          <span className="co-card-sub">{new Date(s.scheduled_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {s.status.replaceAll("_", " ")}</span>
          {s.student_note && <span className="co-card-sub">{s.student_note}</span>}
          {s.cancel_reason && <span className="co-card-sub">Reason: {s.cancel_reason}</span>}
        </span><span className="co-caret">›</span>
      </button>)}</div>}
  </div>;
}
