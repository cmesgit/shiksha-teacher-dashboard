// PLACEMENT: src/pages/counsellor/CounselorSchedule.jsx   (NEW FILE — teacher dashboard app)
//
// Upcoming sessions (with assessment-ready badges and meeting-link state). Each card
// opens the full student file at /teacher/counsellor/appointments/:id.

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAppointments } from "../../api/counselorService";
import { useCounselor } from "../../layout/CounselorContext";
import "../../styles/counsellor.css";

// "Tue, 17 Nov · 6:00 PM" — see the note on the identical helper in
// CounselorRequests.jsx. Kept local to each screen rather than extracted,
// matching how these files already duplicate their small formatters.
const fmtWhen = (iso) => {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short",
  });
  const time = d.toLocaleTimeString("en-IN", {
    hour: "numeric", minute: "2-digit", hour12: true,
  }).toUpperCase();
  return `${date} · ${time}`;
};

const STATUS_META = {
  confirmed: ["Confirmed", "co-chip--green"],
};

export default function CounselorSchedule() {
  const navigate = useNavigate();
  const { me } = useCounselor() || {};
  const [filter, setFilter] = useState("all");
  const [order, setOrder] = useState("chronological");
  const [upcoming, setUpcoming] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getAppointments({ upcoming: 1 })
      .then((d) => setUpcoming(d.results || []))
      .catch(() => setError("Couldn't load your schedule — please refresh."));
  }, []);

  const today = new Date();
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);
  // One predicate shared by the tab counts and the list, so a tab can never
  // claim a number the list then contradicts.
  const inFilter = (a, f) => {
    const when = new Date(a.scheduled_at);
    if (f === "all") return true;
    return f === "today"
      ? when.toDateString() === today.toDateString()
      : when < weekEnd;
  };
  const counts = upcoming === null ? null : {
    all: upcoming.length,
    today: upcoming.filter((a) => inFilter(a, "today")).length,
    week: upcoming.filter((a) => inFilter(a, "week")).length,
  };

  // ⚠ This screen CRASHED on every load before this line changed, and the
  // crash was invisible to a build: `upcoming` starts as null,
  // `null?.filter(...)` evaluates to UNDEFINED (not null), and the loading
  // guard below tests `list === null` — false for undefined. So render fell
  // through to `list.length` and threw into the ErrorBoundary every time, on
  // the only path that ever runs. Branch explicitly so loading stays null.
  const list = upcoming === null ? null : upcoming
    .filter((a) => inFilter(a, filter))
    .sort((a, b) => (order === "chronological" ? 1 : -1) *
      (new Date(a.scheduled_at) - new Date(b.scheduled_at)));

  return (
    <div className="co-page">
      <div className="co-head">
        <div>
          <h1 className="co-title">Upcoming sessions</h1>
          <p className="co-sub">
            {me?.display_name} · {me?.session_duration_minutes}-minute sessions
            {me?.is_listed === false ? " · currently unlisted" : ""}
          </p>
        </div>
        <button className="co-btn co-btn--outline" onClick={() => navigate("/teacher/counsellor/availability")}>
          Edit availability
        </button>
      </div>

      <div className="co-head">
        <div className="co-tabs" role="tablist" aria-label="Upcoming session dates">
          {/* Counts per tab, as the artboard shows them — "Today 2" answers
              "is there anything today" without having to switch to find out.
              Computed from the same `upcoming` array the list filters, so a
              tab's number and its contents can never disagree. */}
          {[["all", "All"], ["today", "Today"], ["week", "Next 7 days"]].map(([value, label]) =>
            <button key={value} role="tab" aria-selected={filter === value}
              className={`co-tab${filter === value ? " co-tab--on" : ""}`} onClick={() => setFilter(value)}>
              {label}
              {counts && <span className="co-count">{counts[value]}</span>}
            </button>)}
        </div>
        <label className="co-sort">Sort <select className="co-select" value={order} onChange={(e) => setOrder(e.target.value)}>
          <option value="chronological">Soonest first</option><option value="recent">Latest first</option>
        </select></label>
      </div>

      {error && <div className="co-error">{error}</div>}

      {list === null ? (
        <div className="co-skel" style={{ height: 160 }} />
      ) : list.length === 0 ? (
        <div className="co-empty">
          <div className="co-empty-title">
            No sessions in this view
          </div>
          Confirmed bookings appear here. You can change the date filter above.
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
                {a.status === "cancelled" && a.cancel_reason && (
                  <div className="co-meta" style={{ marginTop: 9, color: "#b91c1c" }}>
                    Cancelled: {a.cancel_reason}
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
