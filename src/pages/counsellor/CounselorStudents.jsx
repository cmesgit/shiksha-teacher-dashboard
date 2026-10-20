// PLACEMENT: src/pages/counsellor/CounselorStudents.jsx   (NEW FILE — teacher dashboard)
//
// Workflow §11 "Students" — only students who have actually booked with
// this counsellor, never the whole platform roster.
//
// NO NEW ENDPOINT. GET /counselor/appointments/ already returns every
// appointment scoped to the acting counsellor, and a student IS their set of
// appointments here — so the roster is folded out of that one response.
// Adding a /counselor/students/ endpoint would be a second way to ask the
// same question, and a second place for the visibility rule to drift.

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAppointments } from "../../api/counselorService";
import "../../styles/counsellor.css";

const fmtDay = (iso) =>
  new Date(iso).toLocaleDateString("en-IN",
    { day: "numeric", month: "short", year: "numeric" });

// Only a student who actually met (or is due to meet) this counsellor
// belongs here — a cancelled-before-it-happened booking is not a
// relationship. Mirrors the spec's "≥1 confirmed or completed session".
const COUNTS = new Set(["confirmed", "completed"]);

export default function CounselorStudents() {
  const navigate = useNavigate();
  const [appts, setAppts] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    getAppointments()
      .then((d) => setAppts(d.results || []))
      .catch(() => setError("Couldn't load your students — please refresh."));
  }, []);

  const students = useMemo(() => {
    if (!appts) return null;
    const byId = new Map();
    appts
      .filter((a) => COUNTS.has(a.status) && a.learner?.id)
      .forEach((a) => {
        const key = a.learner.id;
        const row = byId.get(key) || {
          id: key, name: a.learner.display_name,
          sessions: 0, completed: 0, last: null, lastNote: "",
        };
        row.sessions += 1;
        if (a.status === "completed") row.completed += 1;
        // "Last session" = most recent that has actually happened, so an
        // upcoming booking doesn't masquerade as a past conversation.
        const when = new Date(a.scheduled_at);
        if (when <= new Date() && (!row.last || when > new Date(row.last))) {
          row.last = a.scheduled_at;
          row.lastNote = a.student_note || "";
          row.lastId = a.id;
        }
        byId.set(key, row);
      });
    const list = [...byId.values()];
    list.sort((a, b) => {
      if (a.last && b.last) return new Date(b.last) - new Date(a.last);
      return a.last ? -1 : b.last ? 1 : a.name.localeCompare(b.name);
    });
    return list;
  }, [appts]);

  const shown = useMemo(() => {
    if (!students) return null;
    const needle = q.trim().toLowerCase();
    if (!needle) return students;
    return students.filter((s) => s.name.toLowerCase().includes(needle));
  }, [students, q]);

  return (
    <div className="co-page">
      <div className="co-head">
        <div>
          <h1 className="co-title">My students</h1>
          <p className="co-sub">
            Everyone who has booked a session with you
            {students ? ` · ${students.length} total` : ""}.
          </p>
        </div>
      </div>

      {error && <div className="co-error">{error}</div>}

      {students && students.length > 0 && (
        <input
          className="co-search"
          value={q}
          placeholder="Search by name…"
          onChange={(e) => setQ(e.target.value)}
        />
      )}

      {shown === null ? (
        <div className="co-skel" style={{ height: 140 }} />
      ) : shown.length === 0 ? (
        <div className="co-empty">
          <div className="co-empty-title">
            {q ? "No students match that search" : "No students yet"}
          </div>
          {q ? "Try a different name." : "Students appear here once they book a session with you."}
        </div>
      ) : (
        <div className="co-list">
          {shown.map((s) => (
            <button
              key={s.id}
              className="co-card co-card--row"
              onClick={() => s.lastId && navigate(`/teacher/counsellor/appointments/${s.lastId}`)}
            >
              <div className="co-avatar">{s.name.slice(0, 1)}</div>
              <div className="co-card-main">
                <div className="co-card-title">{s.name}</div>
                <div className="co-card-sub">
                  {s.sessions} session{s.sessions === 1 ? "" : "s"}
                  {s.completed ? ` · ${s.completed} completed` : ""}
                  {s.last ? ` · last met ${fmtDay(s.last)}` : " · not met yet"}
                </div>
                {s.lastNote && <div className="co-note co-note--inline">"{s.lastNote}"</div>}
              </div>
              <span className="co-caret">›</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
