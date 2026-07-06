// PLACEMENT: src/pages/counsellor/CounselorSchedule.jsx   (NEW FILE — teacher dashboard app)
//
// The counsellor's home: upcoming sessions (with assessment-ready
// badges and quick meeting-link state), plus history tabs. Each card
// opens the full student file at /teacher/counsellor/appointments/:id.

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAppointments } from "../../api/counselorService";
import { useCounselor } from "../../layout/CounselorLayout";
import "../../styles/counsellor.css";

const fmtWhen = (iso) =>
  new Date(iso).toLocaleString("en-IN", {
    weekday: "short", day: "numeric", month: "short",
    hour: "numeric", minute: "2-digit", hour12: true,
  });

const STATUS_META = {
  confirmed: ["Confirmed", "co-chip--green"],
  completed: ["Completed", "co-chip--grey"],
  cancelled: ["Cancelled", "co-chip--red"],
  no_show:   ["No-show", "co-chip--red"],
};

export default function CounselorSchedule() {
  const navigate = useNavigate();
  const { me } = useCounselor() || {};
  const [tab, setTab] = useState("upcoming");
  const [upcoming, setUpcoming] = useState(null);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getAppointments({ upcoming: 1 })
      .then((d) => setUpcoming(d.results || []))
      .catch(() => setError("Couldn't load your schedule — please refresh."));
    getAppointments()
      .then((d) => setHistory((d.results || []).filter(
        (a) => a.status !== "confirmed" || new Date(a.scheduled_at) < new Date()
      )))
      .catch(() => {});
  }, []);

  const list = tab === "upcoming" ? upcoming : history;

  return (
    <div className="co-page">
      <div className="co-head">
        <div>
          <h1 className="co-title">Counselling schedule</h1>
          <p className="co-sub">
            {me?.display_name} · {me?.session_duration_minutes}-minute sessions
            {me?.is_listed === false ? " · currently unlisted" : ""}
          </p>
        </div>
        <button className="co-btn co-btn--outline" onClick={() => navigate("/teacher/counsellor/availability")}>
          Edit availability
        </button>
      </div>

      <div className="co-tabs">
        <button className={`co-tab${tab === "upcoming" ? " co-tab--on" : ""}`} onClick={() => setTab("upcoming")}>
          Upcoming {upcoming?.length > 0 && <span className="co-count">{upcoming.length}</span>}
        </button>
        <button className={`co-tab${tab === "history" ? " co-tab--on" : ""}`} onClick={() => setTab("history")}>
          History
        </button>
      </div>

      {error && <div className="co-error">{error}</div>}

      {list === null ? (
        <div className="co-skel" style={{ height: 160 }} />
      ) : list.length === 0 ? (
        <div className="co-empty">
          <div className="co-empty-title">
            {tab === "upcoming" ? "No upcoming sessions" : "No past sessions yet"}
          </div>
          {tab === "upcoming"
            ? "Bookings land here the moment a student confirms a slot. Make sure your weekly availability is set."
            : "Completed and cancelled sessions will appear here."}
        </div>
      ) : (
        <div className="co-list">
          {list.map((a) => {
            const [label, cls] = STATUS_META[a.status] || [a.status, "co-chip--grey"];
            return (
              <div key={a.id} className="co-card">
                <div className="co-row">
                  <div className="co-avatar">{(a.learner?.display_name || "?").slice(0, 1)}</div>
                  <div className="co-main">
                    <div className="co-name">{a.learner?.display_name}</div>
                    <div className="co-meta">{fmtWhen(a.scheduled_at)} · {a.duration_minutes} min</div>
                  </div>
                  <span className={`co-chip ${cls}`}>{label}</span>
                  {a.status === "confirmed" && (
                    a.assessment_submitted
                      ? <span className="co-chip co-chip--slate">Assessment ready</span>
                      : a.has_assessment
                        ? <span className="co-chip co-chip--amber">Assessment pending</span>
                        : null
                  )}
                  {a.status === "confirmed" && !a.meeting_link && (
                    <span className="co-chip co-chip--amber">No meeting link</span>
                  )}
                  {a.has_report && <span className="co-chip co-chip--green">Report published</span>}
                  <button className="co-btn co-btn--sm" onClick={() => navigate(`/teacher/counsellor/appointments/${a.id}`)}>
                    Open →
                  </button>
                </div>
                {a.student_note && (
                  <div className="co-meta" style={{ marginTop: 9, fontStyle: "italic" }}>
                    "{a.student_note}"
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
