// PLACEMENT: teacher_ui/src/pages/skill/ExpertAvailability.jsx  (replace whole file)
//
// Wired purely to the backend (no localStorage, no EXPERT_ID mock persona):
//   GET   /skill/teacher/availability/   → { open: [...], booked: [...] }
//   PATCH /skill/teacher/availability/   body: { open: [...] }
// The learner-side Book-a-Tutor grid reads the same record, so saving here is
// what makes a slot bookable there. Accepted bookings come back in `booked`
// and are locked.
import { useState, useEffect } from "react";
import { Icon } from "../../components/SkillIcons";
import { DAYS, SLOTS } from "../../api/availabilityStore";
import api from "../../shared/apiClient";
import "../../styles/skillDev.css";

export default function ExpertAvailability() {
  const [avail,   setAvail]   = useState({ open: [], booked: [] });
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  // Load the expert's saved availability from the backend.
  useEffect(() => {
    api.get("/skill/teacher/availability/")
      .then(r => setAvail({ open: r.data.open || [], booked: r.data.booked || [] }))
      .catch(() => setError("Couldn't load your availability. Please refresh."))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (k) => {
    if (avail.booked.includes(k)) return; // locked — an accepted booking
    setAvail(prev => ({
      ...prev,
      open: prev.open.includes(k)
        ? prev.open.filter(x => x !== k)
        : [...prev.open, k],
    }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const r = await api.patch("/skill/teacher/availability/", { open: avail.open });
      // Trust the server's echo (it preserves booked slots).
      setAvail({ open: r.data.open || avail.open, booked: r.data.booked || avail.booked });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Couldn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

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
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {saved && (
              <span style={{ fontSize: 12, color: "#2f9d42", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                <Icon.check size={13} /> Saved
              </span>
            )}
            <button className="sk-btn" style={{ padding: "8px 16px", fontSize: 12 }} onClick={save} disabled={saving || loading}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
        <p style={{ fontSize: 12, color: "#6b7c83", margin: "0 0 12px", lineHeight: 1.5 }}>
          Tap slots to set the hours learners can book you for 1-on-1 sessions. This shows on your public
          profile. Accepted bookings are locked and can't be changed.
        </p>

        {error && (
          <div style={{ background: "rgba(192,73,47,.1)", color: "#c0492f", padding: "9px 13px", borderRadius: 9, fontSize: 12.5, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 14, fontSize: 11, color: "#6b7c83", marginBottom: 14, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "#13899b" }} /> Open
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "#f0a23b" }} /> Booked · locked
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "#fff", border: "1px solid #e3dccf" }} /> Closed
          </span>
        </div>

        {loading ? (
          <div className="sk-empty">Loading availability…</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: `64px repeat(${DAYS.length}, minmax(54px, 1fr))`,
              gap: 6, alignItems: "center", minWidth: 420,
            }}>
              <div />
              {DAYS.map((d) => (
                <div key={d} style={{ fontSize: 10.5, fontWeight: 700, color: "#6b7c83", textAlign: "center" }}>{d}</div>
              ))}
              {SLOTS.map((sl, si) => (
                <Row key={sl} sl={sl} si={si} avail={avail} toggle={toggle} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ sl, si, avail, toggle }) {
  return (
    <>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9aa9af", textAlign: "right", paddingRight: 4 }}>{sl}</div>
      {DAYS.map((d, di) => {
        const k  = `${di}-${si}`;
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
