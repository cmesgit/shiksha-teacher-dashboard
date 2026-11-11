import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAppointments } from "../../api/counselorService";
import { useCounselor } from "../../layout/CounselorContext";
import "../../styles/counsellor.css";

const time = (value) => new Date(value).toLocaleTimeString("en-IN", {
  hour: "numeric", minute: "2-digit", hour12: true,
});
const EXPERIENCE = { lt1: "Less than 1 year", "1_3": "1–3 years", "3_5": "3–5 years", "5_10": "5–10 years", "10plus": "10+ years" };

export default function CounselorToday() {
  const navigate = useNavigate();
  const { me } = useCounselor() || {};
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getAppointments()
      .then((data) => setSessions(data.results || []))
      .catch(() => setError("Couldn't load your sessions. Please refresh."));
  }, []);

  const summary = useMemo(() => {
    if (!sessions) return null;
    const now = new Date();
    const today = sessions.filter((s) =>
      s.status === "confirmed" && new Date(s.scheduled_at).toDateString() === now.toDateString()
    ).sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
    return {
      today,
      upcoming: sessions.filter((s) => s.status === "confirmed" && new Date(s.scheduled_at) >= now).length,
      pending: sessions.filter((s) => s.status === "pending"),
      completed: sessions.filter((s) => s.status === "completed").length,
      activity: [...sessions].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 4),
    };
  }, [sessions]);

  return (
    <div className="co-page">
      <div className="co-head">
        <div>
          <h1 className="co-title">Today</h1>
          <p className="co-sub">{me?.display_name} · Your counselling day at a glance</p>
        </div>
        <button className="co-btn co-btn--outline" onClick={() => navigate("/teacher/counsellor/availability")}>Edit availability</button>
      </div>
      {error && <div className="co-error">{error}</div>}
      <div className="co-card co-profile-hero">
        <span className="co-avatar">{(me?.display_name || "?")[0]}</span>
        <div className="co-card-main">
          <div className="co-card-title">{me?.display_name} <span className="co-chip co-chip--slate">Counsellor</span></div>
          <div className="co-card-sub">★ {Number(me?.avg_rating || 0).toFixed(1)} · {me?.rating_count || 0} reviews
            {me?.years_experience ? ` · ${EXPERIENCE[me.years_experience] || me.years_experience} experience` : ""}
          </div>
          {me?.specializations?.length > 0 && <div className="co-chips">
            {me.specializations.map((spec) => <span className="co-chip co-chip--grey" key={spec.id}>{spec.name}</span>)}
          </div>}
        </div>
        <button className="co-btn co-btn--outline co-btn--sm" onClick={() => navigate("/teacher/counsellor/profile")}>Edit profile</button>
      </div>
      {!summary ? <div className="co-skel" style={{ height: 180 }} /> : <>
        <div className="co-stats">
          {[
            ["Sessions today", summary.today.length], ["Upcoming", summary.upcoming],
            ["Pending requests", summary.pending.length], ["Completed total", summary.completed],
          ].map(([label, value]) => <div className="co-card co-stat" key={label}><strong>{value}</strong><span>{label}</span></div>)}
        </div>
        <div className="co-today-grid">
          <section>
            <h2 className="co-sec-title">Today's sessions</h2>
            {summary.today.length === 0 ? <div className="co-empty"><div className="co-empty-title">No sessions today</div>Your next confirmed sessions are under Upcoming.</div> :
              <div className="co-list">{summary.today.map((session) =>
                <button className="co-card co-card--row" key={session.id}
                  onClick={() => navigate(`/teacher/counsellor/appointments/${session.id}`)}>
                  <span className="co-avatar">{(session.learner?.display_name || "?")[0]}</span>
                  <span className="co-card-main"><span className="co-card-title">{session.learner?.display_name}</span>
                    <span className="co-card-sub">{time(session.scheduled_at)} · {session.duration_minutes} min</span>
                    {session.student_note && <span className="co-card-sub">{session.student_note}</span>}
                  </span><span className="co-caret">›</span>
                </button>)}</div>}
            <button className="co-btn co-btn--outline co-today-link" onClick={() => navigate("/teacher/counsellor/upcoming")}>View all upcoming sessions →</button>
          </section>
          <aside>
            <div className="co-card co-today-aside">
              <h2 className="co-sec-title">Booking requests</h2>
              <p className="co-sub">{summary.pending.length ? `${summary.pending.length} waiting for a decision` : "No requests waiting"}</p>
              {summary.pending.slice(0, 3).map((s) => <p className="co-card-sub" key={s.id}>{s.learner?.display_name} · {new Date(s.scheduled_at).toLocaleDateString("en-IN")}</p>)}
              <button className="co-btn co-btn--outline co-btn--sm" onClick={() => navigate("/teacher/counsellor/requests")}>Open requests →</button>
            </div>
            <div className="co-card co-today-aside">
              <h2 className="co-sec-title">Recent bookings</h2>
              {summary.activity.length === 0 ? <p className="co-sub">No activity yet.</p> : summary.activity.map((s) =>
                <button className="co-activity" key={s.id} onClick={() => navigate(`/teacher/counsellor/appointments/${s.id}`)}>
                  <span>{s.learner?.display_name} · {s.status.replaceAll("_", " ")}</span>
                  <small>{new Date(s.created_at).toLocaleDateString("en-IN")}</small>
                </button>)}
            </div>
          </aside>
        </div>
      </>}
    </div>
  );
}
