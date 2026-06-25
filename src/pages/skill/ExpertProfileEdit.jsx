/**
 * src/pages/skill/ExpertProfileEdit.jsx  (NEW)
 *
 * Wired to GET/PATCH /skill/teacher/profile/.
 * Lets a guest expert edit:
 *   • rate, bio, what they teach (subject_description), languages,
 *   • offline-class mode + location (so nearby learners can find them),
 *   • their OWN UPI payee details (learners pay them directly — P2P).
 */
import { useEffect, useState } from "react";
import { Icon } from "../../components/SkillIcons";
import api from "../../shared/apiClient";
import "../../styles/skillDev.css";

const MODES = [
  { v: "online", label: "Online only" },
  { v: "home",   label: "At my place" },
  { v: "travel", label: "I travel" },
];

export default function ExpertProfileEdit() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [err, setErr]         = useState("");
  const [f, setF] = useState({
    hourly_rate: 0, bio: "", subject_description: "", availability: "",
    languages: "", class_mode: "online", class_location: "",
    pincode: "", state: "", district: "", city: "",
    payment_upi: "", payment_name: "", payment_note: "",
  });

  useEffect(() => {
    api.get("/skill/teacher/profile/")
      .then(r => {
        const d = r.data || {};
        setF((prev) => ({
          ...prev, ...d,
          languages: Array.isArray(d.languages) ? d.languages.join(", ") : (d.languages || ""),
        }));
      })
      .catch(() => setErr("Couldn't load your profile."))
      .finally(() => setLoading(false));
  }, []);

  const set = (k) => (e) => { setSaved(false); setF({ ...f, [k]: e.target.value }); };
  const offline = f.class_mode === "home" || f.class_mode === "travel";

  const save = () => {
    setErr(""); setSaved(false);
    if (offline && !f.class_location.trim()) {
      setErr("Add your class location — it's required for offline teaching.");
      return;
    }
    setSaving(true);
    const payload = {
      ...f,
      hourly_rate: Number(f.hourly_rate) || 0,
      languages: f.languages.split(",").map(s => s.trim()).filter(Boolean),
    };
    api.patch("/skill/teacher/profile/", payload)
      .then(() => { setSaved(true); })
      .catch((e) => setErr(e?.response?.data?.class_location
        || e?.response?.data?.detail || "Couldn't save. Please try again."))
      .finally(() => setSaving(false));
  };

  if (loading) return <div className="sk-page"><div className="sk-empty">Loading your profile…</div></div>;

  return (
    <div className="sk-page">
      <div className="sk-head">
        <div>
          <div className="sk-head__title">My profile</div>
          <div className="sk-head__sub">How learners see you — and how they pay you.</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="sk-dash-grid">

        {/* What you teach */}
        <div className="rd-card teacher">
          <h4>What you teach</h4>
          <div className="sk-field">
            <label>Rate (₹ / hour)</label>
            <input className="sk-input" type="number" min="0" value={f.hourly_rate} onChange={set("hourly_rate")} />
          </div>
          <div className="sk-field">
            <label>Subject / what you offer</label>
            <textarea className="sk-input" rows={3} value={f.subject_description}
                      onChange={set("subject_description")} placeholder="e.g. Hindustani vocal for beginners to intermediate" />
          </div>
          <div className="sk-field">
            <label>About you</label>
            <textarea className="sk-input" rows={3} value={f.bio} onChange={set("bio")} />
          </div>
          <div className="sk-field">
            <label>Languages (comma-separated)</label>
            <input className="sk-input" value={f.languages} onChange={set("languages")} placeholder="English, Hindi, Manipuri" />
          </div>
          <div className="sk-field">
            <label>Availability note</label>
            <input className="sk-input" value={f.availability} onChange={set("availability")} placeholder="e.g. Evenings & weekends" />
          </div>
        </div>

        {/* Location + payment */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="rd-card teacher" style={{ marginBottom: 0 }}>
            <h4>Where you teach</h4>
            <div className="sk-field">
              <label>Class mode</label>
              <div className="sk-seg">
                {MODES.map(m => (
                  <button key={m.v} className={f.class_mode === m.v ? "on" : ""}
                          onClick={() => { setSaved(false); setF({ ...f, class_mode: m.v }); }}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            {offline && (
              <>
                <div className="sk-field">
                  <label>Class location {offline && <span style={{ color: "#c0492f" }}>*</span>}</label>
                  <input className="sk-input" value={f.class_location} onChange={set("class_location")}
                         placeholder="Area / landmark where the class is held" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div className="sk-field"><label>Pincode</label>
                    <input className="sk-input" value={f.pincode} onChange={set("pincode")} /></div>
                  <div className="sk-field"><label>City</label>
                    <input className="sk-input" value={f.city} onChange={set("city")} /></div>
                  <div className="sk-field"><label>District</label>
                    <input className="sk-input" value={f.district} onChange={set("district")} /></div>
                  <div className="sk-field"><label>State</label>
                    <input className="sk-input" value={f.state} onChange={set("state")} /></div>
                </div>
                <div style={{ fontSize: 11.5, color: "#9aa9af", lineHeight: 1.5 }}>
                  Nearby learners searching for offline lessons will find you by pincode / district / state.
                </div>
              </>
            )}
          </div>

          <div className="rd-card teacher" style={{ marginBottom: 0 }}>
            <h4>How learners pay you</h4>
            <div style={{ fontSize: 12, color: "#6b7c83", lineHeight: 1.5, marginBottom: 10 }}>
              Payments are settled directly between you and the learner — ShikshaCom doesn't take a cut.
              These details are shown to a learner after they book.
            </div>
            <div className="sk-field">
              <label>Your UPI ID</label>
              <input className="sk-input" value={f.payment_upi} onChange={set("payment_upi")} placeholder="yourname@okaxis" />
            </div>
            <div className="sk-field">
              <label>Payee name</label>
              <input className="sk-input" value={f.payment_name} onChange={set("payment_name")} />
            </div>
            <div className="sk-field">
              <label>Note for learners (optional)</label>
              <input className="sk-input" value={f.payment_note} onChange={set("payment_note")} placeholder="e.g. Add a reference with your name" />
            </div>
          </div>
        </div>
      </div>

      {err && <div style={{ color: "#c0492f", fontSize: 12.5, fontWeight: 600, marginTop: 12 }}>{err}</div>}

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
        <button className="sk-btn" onClick={save} disabled={saving}>
          <Icon.check size={14} /> {saving ? "Saving…" : "Save profile"}
        </button>
        {saved && <span style={{ color: "#2f9d42", fontSize: 12.5, fontWeight: 700 }}>Saved ✓</span>}
      </div>
    </div>
  );
}
