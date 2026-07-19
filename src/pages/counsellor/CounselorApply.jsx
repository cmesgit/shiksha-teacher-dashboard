// PLACEMENT: src/pages/counsellor/CounselorApply.jsx   (NEW FILE — teacher dashboard app)
//
// The application form shown inside CounselorLayout when the teacher has
// no counsellor profile yet. POST /counseling/counselor/apply/ creates a
// PENDING profile; admins review it in the admin console (mirror of the
// teacher-approvals flow). Approval grants the COUNSELOR role.

import React, { useEffect, useState } from "react";
import { applyCounselor, getSpecializations } from "../../api/counselorService";
import "../../styles/counsellor.css";
import { LoadingState } from "../../components/StateViews";

const EXPERIENCE = [
  ["lt1", "Less than 1 year"], ["1_3", "1–3 years"], ["3_5", "3–5 years"],
  ["5_10", "5–10 years"], ["10plus", "10+ years"],
];

export default function CounselorApply({ onApplied }) {
  const [specs, setSpecs] = useState([]);
  const [form, setForm] = useState({
    display_name: "", bio: "", qualifications: "", certifications: "",
    approach: "", years_experience: "1_3", languages: "",
  });
  const [picked, setPicked] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { getSpecializations().then(setSpecs).catch(() => {}); }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggle = (id) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const submit = async () => {
    if (!form.display_name.trim()) return setError("Add the name students will see.");
    if (picked.length === 0) return setError("Pick at least one specialization — matching runs on these.");
    setBusy(true);
    setError("");
    try {
      await applyCounselor({ ...form, specialization_ids: picked });
      onApplied?.();
    } catch (e) {
      setError(e?.response?.data?.detail || "Couldn't submit — please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="co-gate" style={{ maxWidth: 700 }}>
      <div className="co-card">
        <h2 className="co-title">Become a career counsellor</h2>
        <p className="co-sub" style={{ marginBottom: 18 }}>
          Guide students one-on-one — stream selection, entrance exams,
          career direction. Fill this in once; our team reviews every
          application before you appear in the directory.
        </p>
        {error && <div className="co-error">{error}</div>}

        <div className="co-field">
          <label className="co-label">Display name (as students will see it)</label>
          <input className="co-input" placeholder="e.g. Dr. Rina Sharma" value={form.display_name} onChange={set("display_name")} />
        </div>
        <div className="co-field">
          <label className="co-label">Specializations — what can you guide students on?</label>
          <div className="co-chips">
            {specs.map((s) => (
              <button key={s.id} className={`co-choice${picked.includes(s.id) ? " co-choice--on" : ""}`} onClick={() => toggle(s.id)}>
                {s.name}
              </button>
            ))}
            {specs.length === 0 && <LoadingState plain label="Loading specializations" />}
          </div>
        </div>
        <div className="co-field">
          <label className="co-label">About you</label>
          <textarea className="co-textarea" placeholder="Your background and how you help students…" value={form.bio} onChange={set("bio")} />
        </div>
        <div className="co-field">
          <label className="co-label">Qualifications</label>
          <input className="co-input" placeholder="e.g. PhD Psychology, IIT Delhi" value={form.qualifications} onChange={set("qualifications")} />
        </div>
        <div className="co-field">
          <label className="co-label">Certifications (optional)</label>
          <input className="co-input" placeholder="e.g. Certified Career Analyst" value={form.certifications} onChange={set("certifications")} />
        </div>
        <div className="co-field">
          <label className="co-label">Counselling approach (optional)</label>
          <textarea className="co-textarea" style={{ minHeight: 60 }} placeholder="How you run a session…" value={form.approach} onChange={set("approach")} />
        </div>
        <div className="co-field">
          <label className="co-label">Experience</label>
          <select className="co-select" value={form.years_experience} onChange={set("years_experience")}>
            {EXPERIENCE.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
        <div className="co-field">
          <label className="co-label">Languages (comma-separated)</label>
          <input className="co-input" placeholder="e.g. English, Hindi, Manipuri" value={form.languages} onChange={set("languages")} />
        </div>

        <button className="co-btn" disabled={busy} onClick={submit} style={{ marginTop: 4 }}>
          {busy ? "Submitting…" : "Submit application"}
        </button>
      </div>
    </div>
  );
}
