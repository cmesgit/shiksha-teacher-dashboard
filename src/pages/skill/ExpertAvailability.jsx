/**
 * src/pages/skill/ExpertAvailability.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * "Availability" — editable weekly grid. Tap a slot to open/close it for
 * 1-on-1 bookings. Booked slots are locked (a learner request was accepted
 * on the Bookings page). Backed by the shared availability store. Ported from
 * the prototype's TeachAvailability.
 *
 * Route: /teacher/expert/availability
 * API TODO: store load/save → GET/PATCH /api/skill/teacher/availability/
 *           (see src/api/availabilityStore.js).
 */
import { useState } from "react";
import { Icon } from "../../components/SkillIcons";
import AV, { DAYS, SLOTS } from "../../api/availabilityStore";
import { EXPERT_ID } from "../../data/skillMockData";
import "../../styles/skillDev.css";

export default function ExpertAvailability() {
  const [avail, setAvail] = useState(() => AV.get(EXPERT_ID));
  const toggle = (k) => setAvail({ ...AV.toggleOpen(EXPERT_ID, k) });

  return (
    <div className="sk-page">
      <div className="sk-head">
        <div>
          <div className="sk-head__title">Availability</div>
          <div className="sk-head__sub">Set the hours learners can book you for 1-on-1 sessions</div>
        </div>
      </div>

      <div className="rd-card teacher" style={{ "--acc": "#13899b" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <h4 style={{ margin: 0 }}>Weekly availability</h4>
          {/* API TODO: PATCH /api/skill/teacher/availability/ { open: [...] } */}
          <button className="sk-btn" style={{ padding: "8px 16px", fontSize: 12 }}>Save</button>
        </div>
        <p style={{ fontSize: 12, color: "#6b7c83", margin: "0 0 12px", lineHeight: 1.5 }}>
          Tap slots to set the hours learners can book you for 1-on-1 sessions. This shows on your public
          profile. Accepted bookings are locked and can't be changed.
        </p>

        <div style={{ display: "flex", gap: 14, fontSize: 11, color: "#6b7c83", marginBottom: 14, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "#13899b" }} /> Open</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "#f0a23b" }} /> Booked · locked</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "#fff", border: "1px solid #e3dccf" }} /> Closed</span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: `64px repeat(${DAYS.length}, minmax(54px, 1fr))`, gap: 6, alignItems: "center", minWidth: 420 }}>
            <div />
            {DAYS.map((d) => (
              <div key={d} style={{ fontSize: 10.5, fontWeight: 700, color: "#6b7c83", textAlign: "center" }}>{d}</div>
            ))}
            {SLOTS.map((sl, si) => (
              <Row key={sl} sl={sl} si={si} avail={avail} toggle={toggle} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ sl, si, avail, toggle }) {
  return (
    <>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9aa9af", textAlign: "right", paddingRight: 4 }}>{sl}</div>
      {DAYS.map((d, di) => {
        const k = `${di}-${si}`;
        const st = avail.booked.includes(k) ? "booked" : avail.open.includes(k) ? "open" : "closed";
        if (st === "booked") {
          return <button key={di} disabled className="slot booked" title="Booked — locked"><Icon.check size={12} /></button>;
        }
        return (
          <button key={di} onClick={() => toggle(k)} className={`slot ${st === "open" ? "on" : ""}`}>
            {st === "open" ? "" : "+"}
          </button>
        );
      })}
    </>
  );
}
