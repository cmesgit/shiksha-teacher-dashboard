// PLACEMENT: src/pages/counsellor/CounselorAvailability.jsx   (NEW FILE — teacher dashboard app)
//
// Weekly availability windows. The backend materializes these into
// concrete bookable slots (session-duration steps, minus booked/past)
// for the landing-site picker — so a change here is live immediately.

import React, { useEffect, useState } from "react";
import { addAvailability, deleteAvailability, getAvailability } from "../../api/counselorService";
import { useCounselor } from "../../layout/CounselorLayout";
import "../../styles/counsellor.css";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function CounselorAvailability() {
  const { me } = useCounselor() || {};
  const [slots, setSlots] = useState(null);
  const [draft, setDraft] = useState({ weekday: 0, start_time: "16:00", end_time: "18:00" });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { getAvailability().then(setSlots).catch(() => setSlots([])); }, []);
  const flash = (ok, text) => { setMsg({ ok, text }); setTimeout(() => setMsg(null), 3500); };

  const add = async () => {
    setBusy(true);
    try {
      const s = await addAvailability(draft);
      setSlots((xs) => [...(xs || []), s].sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time)));
      flash(true, "Window added — it's bookable right away.");
    } catch (e) {
      const detail = e?.response?.data;
      flash(false, (detail?.non_field_errors?.[0]) || detail?.detail || "Start must be before end.");
    }
    setBusy(false);
  };

  const remove = async (id) => {
    try {
      await deleteAvailability(id);
      setSlots((xs) => xs.filter((x) => x.id !== id));
      flash(true, "Window removed. Existing bookings in it are unaffected.");
    } catch { flash(false, "Couldn't remove that window."); }
  };

  return (
    <div className="co-page">
      <div className="co-head">
        <div>
          <h1 className="co-title">Weekly availability</h1>
          <p className="co-sub">
            Students book {me?.session_duration_minutes || 45}-minute slots inside
            these windows. Repeats every week.
          </p>
        </div>
      </div>

      {msg && <div className={msg.ok ? "co-ok" : "co-error"}>{msg.text}</div>}

      <div className="co-card" style={{ marginBottom: 14 }}>
        <h3 className="co-sec-title">Add a window</h3>
        <div className="co-avail-add">
          <div className="co-field">
            <label className="co-label">Day</label>
            <select className="co-select" value={draft.weekday}
              onChange={(e) => setDraft((d) => ({ ...d, weekday: Number(e.target.value) }))}>
              {WEEKDAYS.map((w, i) => <option key={w} value={i}>{w}</option>)}
            </select>
          </div>
          <div className="co-field">
            <label className="co-label">From</label>
            <input type="time" className="co-input" value={draft.start_time}
              onChange={(e) => setDraft((d) => ({ ...d, start_time: e.target.value }))} />
          </div>
          <div className="co-field">
            <label className="co-label">To</label>
            <input type="time" className="co-input" value={draft.end_time}
              onChange={(e) => setDraft((d) => ({ ...d, end_time: e.target.value }))} />
          </div>
          <button className="co-btn" disabled={busy} onClick={add}>Add</button>
        </div>
      </div>

      {slots === null ? (
        <div className="co-skel" style={{ height: 100 }} />
      ) : slots.length === 0 ? (
        <div className="co-empty">
          <div className="co-empty-title">No availability set</div>
          Until you add at least one window, students can't book you.
        </div>
      ) : (
        <div>
          {slots.map((s) => (
            <div key={s.id} className="co-avail-row">
              <b>{s.weekday_label || WEEKDAYS[s.weekday]}</b>
              <span>{s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}</span>
              <button className="co-btn co-btn--danger co-btn--sm" onClick={() => remove(s.id)}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
