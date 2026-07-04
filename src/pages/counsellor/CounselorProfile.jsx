// PLACEMENT: src/pages/counsellor/CounselorProfile.jsx   (NEW FILE — teacher dashboard app)
//
// Edit the public counsellor profile (what students see in the
// directory and on the booking page). Status / listing are
// admin-controlled and shown read-only.

import React, { useEffect, useState } from "react";
import { getSpecializations, updateMe } from "../../api/counselorService";
import { useCounselor } from "../../layout/CounselorLayout";
import "../../styles/counsellor.css";

const EXPERIENCE = [
  ["lt1", "Less than 1 year"], ["1_3", "1–3 years"], ["3_5", "3–5 years"],
  ["5_10", "5–10 years"], ["10plus", "10+ years"],
];

export default function CounselorProfile() {
  const { me, refreshMe } = useCounselor() || {};
  const [specs, setSpecs] = useState([]);
  const [form, setForm] = useState(null);
  const [picked, setPicked] = useState([]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { getSpecializations().then(setSpecs).catch(() => {}); }, []);
  useEffect(() => {
    if (!me) return;
    setForm({
      display_name: me.display_name || "",
      bio: me.bio || "",
      qualifications: me.qualifications || "",
      certifications: me.certifications || "",
      approach: me.approach || "",
      years_experience: me.years_experience || "1_3",
      languages: me.languages || "",
    });
    setPicked((me.specializations || []).map((s) => s.id));
  }, [me]);

  if (!form) return <div className="co-skel" style={{ height: 260 }} />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggle = (id) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const save = async () => {
    if (picked.length === 0) {
      setMsg({ error: true, text: "Keep at least one specialization — matching runs on these." });
      return;
    }
    setBusy(true);
    try {
      await updateMe({ ...form, specialization_ids: picked });
      refreshMe?.();
      setMsg({ ok: true, text: "Profile saved — live in the directory." });
    } catch {
      setMsg({ error: true, text: "Couldn't save — please try again." });
    }
    setBusy(false);
    setTimeout(() => setMsg(null), 3500);
  };

  return (
    <div className="co-page">
      <div className="co-head">
        <div>
          <h1 className="co-title">My counsellor profile</h1>
          <p className="co-sub">
            Status: <b style={{ color: "#047857" }}>{me.status}</b>
            {me.is_listed ? " · listed in the directory" : " · currently unlisted"}
            {Number(me.avg_rating) > 0 ? ` · ★ ${me.avg_rating} (${me.rating_count})` : ""}
          </p>
        </div>
        <button className="co-btn" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save profile"}</button>
      </div>

      {msg && <div className={msg.ok ? "co-ok" : "co-error"}>{msg.text}</div>}

      <div className="co-card" style={{ maxWidth: 720 }}>
        <div className="co-field">
          <label className="co-label">Display name</label>
          <input className="co-input" value={form.display_name} onChange={set("display_name")} />
        </div>
        <div className="co-field">
          <label className="co-label">Specializations</label>
          <div className="co-chips">
            {specs.map((s) => (
              <button key={s.id} className={`co-choice${picked.includes(s.id) ? " co-choice--on" : ""}`} onClick={() => toggle(s.id)}>
                {s.name}
              </button>
            ))}
          </div>
        </div>
        <div className="co-field">
          <label className="co-label">About you</label>
          <textarea className="co-textarea" value={form.bio} onChange={set("bio")} />
        </div>
        <div className="co-field">
          <label className="co-label">Qualifications</label>
          <input className="co-input" value={form.qualifications} onChange={set("qualifications")} />
        </div>
        <div className="co-field">
          <label className="co-label">Certifications</label>
          <input className="co-input" value={form.certifications} onChange={set("certifications")} />
        </div>
        <div className="co-field">
          <label className="co-label">Counselling approach</label>
          <textarea className="co-textarea" style={{ minHeight: 60 }} value={form.approach} onChange={set("approach")} />
        </div>
        <div className="co-field">
          <label className="co-label">Experience</label>
          <select className="co-select" value={form.years_experience} onChange={set("years_experience")}>
            {EXPERIENCE.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
        <div className="co-field">
          <label className="co-label">Languages (comma-separated)</label>
          <input className="co-input" value={form.languages} onChange={set("languages")} />
        </div>
      </div>
    </div>
  );
}
