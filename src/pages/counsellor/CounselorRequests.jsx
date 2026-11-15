// PLACEMENT: src/pages/counsellor/CounselorRequests.jsx   (NEW FILE — teacher dashboard)
//
// Workflow §11 "Requests" — pending bookings the counsellor approves or
// declines.
//
// This queue is only ever populated when an admin turns ON
// GlobalSettings.counselling_booking_requires_approval. With the flag OFF
// (the default, and how the platform behaves today) a student's booking is
// CONFIRMED the moment they make it and nothing is ever pending — so this
// screen's normal state is empty, and its empty copy says why rather than
// implying something went wrong.

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { actOnRequest, getAppointments } from "../../api/counselorService";
import "../../styles/counsellor.css";

/** The artboard's context line: "Class 12 · Science (PCB)" /
 *  "Class 10 · Booked by a parent".
 *
 *  Every part is optional — a learner who never filled in their class gets
 *  nothing rather than a line of separators. Returns "" when there is nothing
 *  worth saying, and the caller omits the row entirely.
 */
const learnerContext = (l) => {
  if (!l) return "";
  const bits = [];
  if (l.current_class) bits.push(`Class ${l.current_class}`);
  if (l.stream) bits.push(l.stream);
  else if (l.board) bits.push(l.board);
  // Worth knowing before the call, not during it.
  if (l.booked_by_other) bits.push("Booked by a parent");
  return bits.join(" · ");
};

/** "Tue, 17 Nov · 6:00 PM" — the artboard's format.
 *
 *  `toLocaleString` with all five parts emits "Tue, 17 Nov, 11:32 pm": a
 *  comma between date and time where the design uses a separator dot, and a
 *  lowercase meridiem. Formatting the two halves separately is the only way
 *  to control the join; `en-IN` gives lowercase "pm", hence the upper-case.
 */
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

function DeclineBox({ onCancel, onConfirm, busy }) {
  const [reason, setReason] = useState("");
  return (
    <div className="co-decline">
      <label className="co-decline-label">
        Why are you declining? The student sees this.
      </label>
      <textarea
        className="co-decline-text"
        value={reason}
        placeholder="e.g. I'm on leave that week — please pick another slot."
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="co-decline-actions">
        <button className="co-btn co-btn--outline" onClick={onCancel} disabled={busy}>
          Keep request
        </button>
        <button
          className="co-btn co-btn--danger"
          disabled={busy || !reason.trim()}
          onClick={() => onConfirm(reason.trim())}
        >
          {busy ? "Declining…" : "Decline request"}
        </button>
      </div>
    </div>
  );
}

export default function CounselorRequests() {
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const [declining, setDeclining] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    getAppointments({ status: "pending" })
      // ⚠ The heading promises "oldest first" and the API returns this queue
      // unordered, so the screen was contradicting itself — newest requests
      // were appearing above ones that had been waiting longer. "Oldest" is
      // how long the STUDENT has been waiting (created_at), not when the
      // session happens; scheduled_at breaks ties so the order is stable.
      .then((d) => setList([...(d.results || [])].sort((a, b) =>
        new Date(a.created_at) - new Date(b.created_at)
        || new Date(a.scheduled_at) - new Date(b.scheduled_at))))
      .catch(() => setError("Couldn't load your requests — please refresh."));
  };
  useEffect(load, []);

  const act = async (appt, action, reason = "") => {
    setBusyId(appt.id); setError("");
    try {
      await actOnRequest(appt.id, action, reason);
      setDeclining(null);
      // Drop it from the queue rather than refetching — it is no longer
      // pending, so a reload would return the same list minus this row.
      setList((l) => (l || []).filter((a) => a.id !== appt.id));
    } catch (e) {
      setError(e?.response?.status === 409
        ? "That slot is no longer free — ask the student to pick another time."
        : "Couldn't update that request — please try again.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="co-page">
      <div className="co-head">
        <div>
          <h1 className="co-title">Booking requests</h1>
          <p className="co-sub">
            Sessions waiting on your approval, oldest first.
          </p>
        </div>
      </div>

      {error && <div className="co-error">{error}</div>}

      {list === null ? (
        <div className="co-skel" style={{ height: 140 }} />
      ) : list.length === 0 ? (
        <div className="co-empty">
          <div className="co-empty-title">No requests waiting</div>
          Bookings are confirmed instantly on this platform, so nothing
          normally queues here. If an admin turns on booking approval,
          requests will appear on this screen.
        </div>
      ) : (
        <div className="co-list">
          {list.map((a) => (
            <div key={a.id} className="co-card">
              <div className="co-card-head">
                <div className="co-avatar">
                  {(a.learner?.display_name || "?").slice(0, 1)}
                </div>
                <div className="co-card-main">
                  <div className="co-card-title">{a.learner?.display_name}</div>
                  <div className="co-card-sub">
                    {fmtWhen(a.scheduled_at)} · {a.duration_minutes} min
                  </div>
                  {learnerContext(a.learner) && (
                    <div className="co-card-sub">{learnerContext(a.learner)}</div>
                  )}
                </div>
                <span className="co-chip co-chip--amber">Pending</span>
              </div>

              {a.student_note && <div className="co-note">"{a.student_note}"</div>}

              {declining === a.id ? (
                <DeclineBox
                  busy={busyId === a.id}
                  onCancel={() => setDeclining(null)}
                  onConfirm={(reason) => act(a, "decline", reason)}
                />
              ) : (
                <div className="co-actions">
                  <button className="co-btn" disabled={busyId === a.id}
                    onClick={() => act(a, "approve")}>
                    {busyId === a.id ? "Approving…" : "Approve"}
                  </button>
                  <button className="co-btn co-btn--outline" disabled={busyId === a.id}
                    onClick={() => setDeclining(a.id)}>
                    Decline
                  </button>
                  {/* The artboard's third action. It opens the session screen,
                      which is where the student file already lives — there is
                      no separate route for it. */}
                  <button className="co-btn co-btn--outline co-btn--sm" disabled={busyId === a.id}
                    onClick={() => navigate(`/teacher/counsellor/appointments/${a.id}`)}>
                    View student file
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
