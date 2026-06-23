/**
 * src/pages/skill/ExpertBookings.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * "Bookings" — live 1-on-1: pending requests + scheduled sessions + an
 * edit-rates modal. Accepting a request books that slot in the shared
 * availability store (so it locks on the Availability page too). Ported
 * from the prototype's TeachBookings.
 *
 * Route: /teacher/expert/bookings
 * API TODO:
 *   · BOOK_REQUESTS / T_BOOKINGS → src/data/skillMockData.js
 *   · accept  → POST /api/skill/teacher/sessions/<id>/confirm/
 *   · decline → POST /api/skill/teacher/sessions/<id>/decline/
 *   · "Start class" → navigate to your live route (see onStart below)
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/SkillIcons";
import AV, { label as slotLabel } from "../../api/availabilityStore";
import {
  BOOK_REQUESTS, T_BOOKINGS, HOURLY_RATE, EXPERT_ID, packs,
} from "../../data/skillMockData";
import "../../styles/skillDev.css";

/* ── Edit-rates modal ── */
function EditRates({ onClose }) {
  const [hourly, setHourly] = useState(HOURLY_RATE);
  const [rows, setRows] = useState([
    { label: "5 sessions",  hrs: 5,  discount: 0 },
    { label: "10 sessions", hrs: 10, discount: 5 },
    { label: "20 sessions", hrs: 20, discount: 10 },
  ]);
  const setRow = (i, k, v) => setRows((ps) => ps.map((p, idx) => (idx === i ? { ...p, [k]: v } : p)));
  const total = (p) => Math.round(hourly * p.hrs * (1 - p.discount / 100));

  return (
    <div className="sk-modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sk-modal sk-modal--sm">
        <div className="sk-modal__head">
          <div>
            <h3>Edit rates</h3>
            <p>Set your hourly rate and session packages</p>
          </div>
          <button className="sk-modal__x" onClick={onClose}><Icon.x size={16} /></button>
        </div>

        <div className="sk-modal__body">
          <div className="sk-modal__panel">
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#6b7c83", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 8 }}>Base hourly rate</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 28, color: "#1a2c33" }}>₹</span>
              <input
                type="number" value={hourly} onChange={(e) => setHourly(+e.target.value)}
                style={{ border: "1px solid #d7e3e5", borderRadius: 9, padding: "10px 14px", fontSize: 22, fontWeight: 800, color: "#0a808a", width: 120, fontFamily: "Montserrat, sans-serif", outline: "none" }}
              />
              <span style={{ fontSize: 13, color: "#6b7c83" }}>/session</span>
            </div>
            <div style={{ fontSize: 12, color: "#6b7c83", marginTop: 8 }}>This is the base rate learners see on your profile. Package prices are calculated from this.</div>
          </div>

          <div className="sk-modal__panel">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "#6b7c83", textTransform: "uppercase", letterSpacing: ".4px" }}>Session packages</div>
              <button
                className="sk-btn" style={{ padding: "6px 11px", fontSize: 11.5 }}
                onClick={() => setRows((ps) => [...ps, { label: `${(ps.length + 1) * 5} sessions`, hrs: (ps.length + 1) * 5, discount: 0 }])}
              >
                <Icon.plus size={12} /> Add package
              </button>
            </div>
            {rows.map((p, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: i ? "1px solid #eef3f4" : "none" }}>
                <input value={p.label} onChange={(e) => setRow(i, "label", e.target.value)} style={{ border: "1px solid #d7e3e5", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", flex: "0 0 140px", outline: "none" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                  <input type="number" value={p.hrs} onChange={(e) => setRow(i, "hrs", +e.target.value)} style={{ border: "1px solid #d7e3e5", borderRadius: 8, padding: "8px 10px", fontSize: 13, width: 60, fontFamily: "inherit", textAlign: "center", outline: "none" }} />
                  <span style={{ fontSize: 12, color: "#6b7c83" }}>sessions</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="number" value={p.discount} onChange={(e) => setRow(i, "discount", +e.target.value)} style={{ border: "1px solid #d7e3e5", borderRadius: 8, padding: "8px 10px", fontSize: 13, width: 56, fontFamily: "inherit", textAlign: "center", outline: "none" }} />
                  <span style={{ fontSize: 12, color: "#6b7c83" }}>% off</span>
                </div>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 14, color: "#0a808a", minWidth: 72, textAlign: "right" }}>₹{total(p).toLocaleString("en-IN")}</div>
                {rows.length > 1 && (
                  <button onClick={() => setRows((ps) => ps.filter((_, idx) => idx !== i))} style={{ background: "#fff", border: "1px solid #f0d6d2", color: "#c0492f", width: 30, height: 30, borderRadius: 7, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <Icon.x size={13} />
                  </button>
                )}
              </div>
            ))}
            <div style={{ marginTop: 12, padding: "10px 14px", background: "#eef6f7", borderRadius: 9, fontSize: 12, color: "#6b7c83" }}>
              Total shown to learner = <strong style={{ color: "#0a808a" }}>₹{hourly}</strong>/session × sessions × (1 − discount)
            </div>
          </div>
        </div>

        <div className="sk-modal__foot">
          <button className="sk-btn sk-btn--ghost" onClick={onClose}>Cancel</button>
          {/* API TODO: PATCH /api/skill/teacher/profile/ { hourly_rate, packages } */}
          <button className="sk-btn" onClick={onClose}>Save rates</button>
        </div>
      </div>
    </div>
  );
}

export default function ExpertBookings() {
  const navigate = useNavigate();
  const [reqs, setReqs] = useState(BOOK_REQUESTS);
  const [editRates, setEditRates] = useState(false);
  const tpacks = packs(HOURLY_RATE);

  const accept = (i) => {
    // Book the slot in the shared store → it locks on the Availability grid.
    // API TODO: POST /api/skill/teacher/sessions/<id>/confirm/
    AV.book(EXPERT_ID, reqs[i].slot);
    setReqs((r) => r.filter((_, idx) => idx !== i));
  };
  const decline = (i) => {
    // API TODO: POST /api/skill/teacher/sessions/<id>/decline/
    setReqs((r) => r.filter((_, idx) => idx !== i));
  };

  // API TODO: route to your live session room, e.g.
  // navigate(`/teacher/private-session/live/${sessionId}`)
  const onStart = () => navigate("/teacher/private-sessions");
  const onMessage = () => navigate("/teacher/chat");

  const scheduledCount = T_BOOKINGS.reduce((a, g) => a + g.items.length, 0);

  return (
    <div className="sk-page">
      <div className="sk-head">
        <div>
          <div className="sk-head__title">Bookings</div>
          <div className="sk-head__sub">1-on-1 live tutoring — requests and your schedule</div>
        </div>
      </div>

      {/* Offering summary */}
      <div className="rd-card teacher">
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: "Montserrat, sans-serif", fontSize: 16.5, fontWeight: 800, color: "#1a2c33" }}>1-on-1 live tutoring</div>
            <div style={{ fontSize: 12, color: "#6b7c83", marginTop: 2 }}>Learners book your time by the hour or as a package · ₹{HOURLY_RATE}/hr</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {tpacks.map((p) => (
              <div key={p.label} style={{ background: "#eef6f7", borderRadius: 11, padding: "10px 14px", textAlign: "center" }}>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 16, color: "#0a808a" }}>₹{p.total.toLocaleString("en-IN")}</div>
                <div style={{ fontSize: 10.5, color: "#6b7c83", fontWeight: 600 }}>{p.label}</div>
              </div>
            ))}
            <button className="sk-btn sk-btn--ghost" onClick={() => setEditRates(true)}>Edit rates</button>
          </div>
        </div>
      </div>

      {/* Pending requests */}
      <div className="rd-card teacher">
        <h4 style={{ margin: "0 0 4px" }}>Pending requests{reqs.length ? ` (${reqs.length})` : ""}</h4>
        <p style={{ fontSize: 11.5, color: "#6b7c83", margin: "0 0 10px" }}>
          Accepting a request books that slot — it locks on your Availability and is no longer offered to others.
        </p>
        {reqs.length === 0 ? (
          <div className="sk-empty">No pending requests right now.</div>
        ) : reqs.map((r, i) => (
          <div key={r.name + i} className="rd-book">
            <img src={r.img} alt="" style={{ width: 46, height: 46, borderRadius: 11, objectFit: "cover", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1a2c33" }}>{r.name}</div>
              <div style={{ fontSize: 12, color: "#6b7c83" }}>{r.topic}</div>
              <div style={{ fontSize: 11.5, color: "#0a808a", fontWeight: 700, marginTop: 3 }}>{slotLabel(r.slot)} · ₹{r.rate}/hr</div>
            </div>
            <button className="rd-book__icon-btn" title="Message" onClick={onMessage}><Icon.msg size={15} /></button>
            <button className="rd-book__ghost" onClick={() => decline(i)}>Decline</button>
            <button className="rd-book__accept" onClick={() => accept(i)}><Icon.check size={13} /> Accept</button>
          </div>
        ))}
      </div>

      {/* Scheduled */}
      <div className="rd-card teacher">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h4 style={{ margin: 0 }}>Scheduled sessions</h4>
          <span style={{ fontSize: 11.5, color: "#6b7c83" }}>{scheduledCount} upcoming</span>
        </div>
        {T_BOOKINGS.map((g) => (
          <div key={g.day}>
            <div className="rd-daygroup">{g.day}</div>
            {g.items.map((b) => (
              <div key={b.name + b.time} className="rd-book">
                <span className="bt" style={{ background: "#13899b" }}>
                  {b.time.split(":")[0]}
                  <span style={{ fontSize: 9, opacity: .8 }}>{b.time.includes("PM") ? "PM" : "AM"}</span>
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1a2c33" }}>{b.name}</div>
                  <div style={{ fontSize: 12, color: "#6b7c83" }}>{b.topic}</div>
                  <div style={{ fontSize: 11.5, color: "#0a808a", fontWeight: 700, marginTop: 3 }}>{b.time} · {b.dur}</div>
                </div>
                {b.live ? (
                  <button className="start" onClick={onStart}><Icon.vid size={14} /> Start class</button>
                ) : (
                  <span className="soon">{b.soon ? `Starts ${b.soon}` : "Scheduled"}</span>
                )}
                <button className="rd-book__icon-btn" title="Message" onClick={onMessage}><Icon.msg size={15} /></button>
              </div>
            ))}
          </div>
        ))}
      </div>

      {editRates && <EditRates onClose={() => setEditRates(false)} />}
    </div>
  );
}
