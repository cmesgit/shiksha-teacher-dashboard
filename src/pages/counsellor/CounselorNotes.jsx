import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getNotesIndex } from "../../api/counselorService";
import "../../styles/counsellor.css";

export default function CounselorNotes() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState(null);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => {
    getNotesIndex().then((data) => setSessions(data.results || []))
      .catch(() => setError("Couldn't load session notes. Please refresh."));
  }, []);

  const shown = useMemo(() => {
    if (!sessions) return null;
    return sessions.filter((s) => filter === "all" || (filter === "pending" ? !s.note_count : s.note_count));
  }, [sessions, filter]);

  return <div className="co-page">
    <div className="co-head"><div><h1 className="co-title">Session notes</h1>
      <p className="co-sub">Private observations from completed sessions. Only you can read these notes.</p></div></div>
    <div className="co-tabs" role="tablist" aria-label="Note status">
      {[["all", "All"], ["pending", "Note pending"], ["added", "Note added"]].map(([value, label]) =>
        <button key={value} role="tab" aria-selected={filter === value} className={`co-tab${filter === value ? " co-tab--on" : ""}`}
          onClick={() => setFilter(value)}>{label}</button>)}
    </div>
    {error && <div className="co-error">{error}</div>}
    {shown === null ? <div className="co-skel" style={{ height: 140 }} /> : shown.length === 0 ?
      <div className="co-empty"><div className="co-empty-title">No sessions here</div>Completed sessions and their private notes will appear here.</div> :
      <div className="co-list">{shown.map((s) => <button className="co-card co-card--row" key={s.appointment_id}
        onClick={() => navigate(`/teacher/counsellor/appointments/${s.appointment_id}`)}>
        <span className="co-avatar">{(s.learner_name || "?")[0]}</span>
        <span className="co-card-main"><span className="co-card-title">{s.learner_name}</span>
          <span className="co-card-sub">{new Date(s.scheduled_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
          {s.student_note && <span className="co-card-sub">Session topic: {s.student_note}</span>}
          {s.latest_note && <span className="co-note-preview">{s.latest_note.content}</span>}
        </span>
        <span className={`co-chip ${s.note_count ? "co-chip--green" : "co-chip--amber"}`}>
          {s.note_count ? `Note added${s.note_count > 1 ? ` (${s.note_count})` : ""}` : "Note pending"}
        </span><span className="co-caret">›</span>
      </button>)}</div>}
  </div>;
}
