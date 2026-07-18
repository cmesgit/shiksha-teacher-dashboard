/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  GENERATED FILE — DO NOT EDIT HERE.                                         │
 * │  Canonical source: <workspace>/shared/src/shared/SettingsModal.jsx          │
 * │  Edit the canonical copy, then run `npm run sync:shared` (any app) to        │
 * │  propagate. `npm run check:shared` fails if an app's copy has drifted.       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * SettingsModal.jsx · src/shared/SettingsModal.jsx
 * ──────────────────────────────────────────────────────────────────
 * One Settings surface, byte-identical across landing / student / teacher.
 * No cross-domain redirects — each domain manages everything in-app.
 *
 * Terminology (keep consistent — no "mode" / "context" in labels):
 *   Account · Profile · Track · Faculty (Academy) · Expert (Skill-Dev).
 *
 * Tabs
 * ────
 * Manage profiles
 *   · Learner profiles  — add / edit / remove, photo, display name, bio,
 *                         PIN set/change/remove, per-profile notifications
 *                         & privacy.
 *   · Teacher identity  — shown whenever teacherInfo is present.
 *                         Track cards (Academy/Faculty + Skill Dev/Expert)
 *                         with their status (approved / pending review /
 *                         locked) and an "Apply" button for locked tracks.
 *
 * Global settings
 *   · Email, username (read-only), change password, account prefs, log out.
 *
 * Server endpoints
 * ────────────────
 *   PATCH  /accounts/profiles/{id}/     display name + photo
 *   POST   /accounts/profiles/          add profile
 *   DELETE /accounts/profiles/{id}/     remove profile
 *   POST   /accounts/profiles/pin/      set / clear PIN
 *   POST   /accounts/change-password/
 *
 * Sticky local prefs (bio, notification & privacy toggles) kept in
 * localStorage until a backend prefs endpoint exists.
 * Class & board shown read-only to protect coded fields.
 */
import { useEffect, useState, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import "./SettingsModal.css";

/* ── helpers ── */
const initials = (n) =>
  (n || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const classBoard = (p) =>
  [p?.current_class ? `Class ${p.current_class}` : "", p?.board].filter(Boolean).join(" · ");

const prefsKey = (email) => `shiksha_prefs_${email || "anon"}`;
const loadPrefs = (email) => {
  try { return JSON.parse(localStorage.getItem(prefsKey(email)) || "{}"); } catch { return {}; }
};
const savePrefs = (email, p) => {
  try { localStorage.setItem(prefsKey(email), JSON.stringify(p)); } catch { /* ignore */ }
};

/* Cross-domain destinations (faculty form, expert editor, add-track) are
   derived from the teacherSignupUrl / teachUrl props the host app passes in —
   see the main component — so they're correct on every domain. */

/* ── Toggle ── */
function Toggle({ on, onChange }) {
  return (
    <button type="button" className={`sm-toggle ${on ? "on" : ""}`}
      role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <span className="sm-toggle__dot" />
    </button>
  );
}

/* ── Track status badge ── */
function TrackBadge({ status }) {
  const map = {
    approved: { label: "Approved",     cls: "sm-badge--green"  },
    pending:  { label: "Under review",  cls: "sm-badge--yellow" },
    locked:   { label: "Not applied",   cls: "sm-badge--gray"   },
  };
  const { label, cls } = map[status] || map.locked;
  return <span className={`sm-badge ${cls}`}>{label}</span>;
}


/* ── Notifications & language (design parity) ──────────────────────────────
   The Claude design lists these toggles under Skill Dev / Global settings.
   The backend has no preference columns yet, so they're stored per-device
   (localStorage) and labelled honestly as such. */
const PREFS_KEY = "shk_prefs_v1";
const PREF_DEFS = [
  { k: "session_reminders",     label: "Session reminders" },
  { k: "booking_confirmations", label: "Booking confirmations" },
  { k: "new_messages",          label: "New messages" },
  { k: "review_prompts",        label: "Review prompts" },
  { k: "promo_emails",          label: "Promotional emails" },
];
const LANGS = ["English", "Hindi", "Telugu", "Tamil", "Kannada", "Bengali", "Marathi"];

/* LearnerProfile academic/choice options — mirror accounts.models.LearnerProfile. */
const CLASS_OPTS   = [["", "—"], ["8", "Class 8"], ["9", "Class 9"], ["10", "Class 10"], ["11", "Class 11"], ["12", "Class 12"]];
const STREAM_OPTS  = [["", "—"], ["science", "Science"], ["commerce", "Commerce"], ["arts", "Arts"]];
const BOARD_OPTS   = [["", "—"], ["cbse", "CBSE"], ["icse", "ICSE"], ["mbse", "Mizoram Board (MBSE)"], ["nios", "NIOS"], ["other", "Other State Board"]];
const STUDYING_OPTS = [["", "—"], ["yes", "Yes"], ["no", "No"]];
const HIGHED_OPTS  = [["", "—"], ["below_8", "Below Class 8"], ["8", "Class 8"], ["9", "Class 9"], ["10", "Class 10"], ["11", "Class 11"], ["12", "Class 12"]];

function loadShkPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch { return {}; }
}

function PrefsSection() {
  const [prefs, setPrefs] = useState(loadShkPrefs);
  const save = (next) => { setPrefs(next); try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* ignore */ } };
  const flip = (k) => save({ ...prefs, [k]: !(prefs[k] ?? true) });

  return (
    <>
      <div className="sm-sec">Notifications</div>
      <div className="sm-teacher-note">Saved on this device.</div>
      {PREF_DEFS.map(({ k, label }) => (
        <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 2px", borderBottom: "1px solid #f2f0ea" }}>
          <span style={{ fontSize: 13.5 }}>{label}</span>
          <Toggle on={prefs[k] ?? true} onChange={() => flip(k)} />
        </div>
      ))}

      <div className="sm-sec" style={{ marginTop: 18 }}>Language preference</div>
      <select className="sm-input" style={{ maxWidth: 260 }}
        value={prefs.language || "English"}
        onChange={(e) => save({ ...prefs, language: e.target.value })}>
        {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
      </select>
    </>
  );
}

/* ── Teacher identity section ── */
function TeacherSection({ teacherInfo, mkAddTrack, facultyFormUrl, expertProfileUrl, onManageTrack }) {
  if (!teacherInfo) return null;
  const tracks = teacherInfo.tracks || {};

  const TRACK_DEFS = [
    { key: "academy", label: "Faculty",          sub: "Academic teaching (Academy)", icon: "🎓",
      manageUrl: facultyFormUrl,   manageLabel: "Application form" },
    { key: "skill",   label: "Expert (Skill-Dev)", sub: "Skill-development sessions",  icon: "⚡",
      manageUrl: expertProfileUrl, manageLabel: "Edit profile" },
  ];

  return (
    <>
      <div className="sm-sec sm-sec--teacher">Teacher identity</div>
      <div className="sm-teacher-note">
        Your teaching tracks. Skill-Dev lists once your expert profile is complete;
        Academy requires admin approval. Use the links to fill in or edit each
        track's details — the advertised expert profile and the faculty
        application both live behind these.
      </div>
      <div className="sm-track-list">
        {TRACK_DEFS.map(({ key, label, sub, icon, manageUrl, manageLabel }) => {
          const st = tracks[key] || "locked";
          // Asymmetric Faculty/Guest rule: you may add Faculty (academy) any
          // time it's not held, but you may add Skill ONLY if you've never
          // held Faculty. So a faculty account never gets a Skill "Apply".
          const academyHeld  = ["pending", "approved"].includes(tracks.academy);
          const canApply     = st === "locked" && (key === "academy" || !academyHeld);
          const skillBlocked = key === "skill" && st === "locked" && academyHeld;
          const held         = st === "pending" || st === "approved";
          return (
            <div key={key} className={`sm-track-card sm-track-card--${st}`}>
              <span className="sm-track-icon">{icon}</span>
              <div className="sm-track-info">
                <div className="sm-track-name">{label}</div>
                <div className="sm-track-sub">
                  {skillBlocked ? "Not available on faculty accounts" : sub}
                </div>
              </div>
              <div className="sm-track-right">
                <TrackBadge status={st} />
                {canApply && (
                  <a className="sm-mini sm-track-apply" href={mkAddTrack(key)}>
                    Apply
                  </a>
                )}
                {held && (
                  onManageTrack ? (
                    /* From learner context the teacher app needs a password
                       unlock first — route through the switcher's flow instead
                       of a raw link that bounces to login. */
                    <button type="button" className="sm-mini"
                      onClick={() => onManageTrack(key, key === "skill" ? "/teacher/expert/profile" : "/teacher/dashboard")}>
                      {manageLabel} 🔒
                    </button>
                  ) : (manageUrl && <a className="sm-mini" href={manageUrl}>{manageLabel}</a>)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ══════════════════════════════════ main ══════════════════════════════════ */
export default function SettingsModal({
  open, tab: initialTab = "profile", onClose,
  teacherSignupUrl = "/signup?role=teacher", teachUrl = "", onManageTrack,}) {
  const { user, profiles, activeProfile, teacherInfo, api, bootstrap, logout } = useAuth();

  /* Cross-domain destinations, derived from the host app's props so they're
     right on every domain. homeBase is "" on the marketing app (same origin). */
  const homeBase = (teacherSignupUrl || "").split("/signup")[0];
  const mkAddTrack = (track) =>
    `${homeBase}/signup?role=teacher&add_track=${encodeURIComponent(track)}`;
  const facultyFormUrl   = `${homeBase}/form-fillup`;
  const expertProfileUrl = teachUrl
    ? `${teachUrl.replace(/\/teacher\/dashboard\/?$/, "")}/teacher/expert/profile`
    : "";

  const [tab, setTab]             = useState(initialTab);
  const [rows, setRows]           = useState([]);
  const [editId, setEditId]       = useState(null);
  const [form, setForm]           = useState({
    display_name: "", bio: "",
    first_name: "", last_name: "", phone: "", gender: "", date_of_birth: "",
    state: "", district: "", city_town: "", pin_code: "",
    // Academic
    currently_studying: "", current_class: "", stream: "", board: "",
    board_other: "", school_name: "", academic_year: "",
    highest_education: "", reason_not_studying: "",
    // Parent / guardian
    father_name: "", father_phone: "", mother_name: "", mother_phone: "",
    guardian_name: "", guardian_phone: "", parent_guardian_email: "",
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [realPhotoFile, setRealPhotoFile]       = useState(null); // personal photo (profile_photo)
  const [realPhotoPreview, setRealPhotoPreview] = useState(null);
  const realFileRef = useRef(null);
  const [prefs, setPrefs]         = useState({ email: true, sms: false, directory: true, announce: true });
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState("");
  const [okMsg, setOkMsg]         = useState("");
  const fileRef = useRef(null);

  /* sub-flows */
  const [adding, setAdding]         = useState(false);
  const [newProfile, setNewProfile] = useState({ name: "", relationship: "DEPENDENT" });
  const [pinMode, setPinMode]       = useState(null);   // 'set' | 'remove' | null
  const [pinValue, setPinValue]     = useState("");
  const [pinPassword, setPinPassword] = useState("");   // account password re-auth
  const [removeMode, setRemoveMode] = useState(false);  // delete-profile confirm
  const [removePassword, setRemovePassword] = useState("");
  const [pw, setPw]                 = useState({ old: "", next: "", confirm: "" });
  const [pwBusy, setPwBusy]         = useState(false);
  const [pwMsg, setPwMsg]           = useState("");

  const email = user?.email || "";

  /* ── mount / re-open ── */
  useEffect(() => {
    if (!open) return;
    setTab(initialTab); setErr(""); setOkMsg(""); setPwMsg("");
    setAdding(false);
    setPinMode(null); setPinValue(""); setPinPassword("");
    setRemoveMode(false); setRemovePassword("");
    setPhotoFile(null); setPhotoPreview(null);
    setRealPhotoFile(null); setRealPhotoPreview(null);
    setPw({ old: "", next: "", confirm: "" });
    const stored = loadPrefs(email);
    setPrefs({
      email:    stored.email    ?? true,
      sms:      stored.sms      ?? false,
      directory:stored.directory?? true,
      announce: stored.announce ?? true,
    });
    refreshProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const refreshProfiles = async () => {
    try {
      const res = await api.get("/accounts/profiles/");
      const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setRows(list);
      const start = (activeProfile && list.find((p) => p.id === activeProfile.id)) || list[0];
      if (start) selectRow(start);
    } catch {
      const list = profiles || [];
      setRows(list);
      if (activeProfile) selectRow(activeProfile);
    }
  };

  const fillForm = (row) => {
    const stored = loadPrefs(email);
    setForm({
      display_name: row.display_name || "",
      bio: stored.bios?.[row.id] || "",
      first_name:   row.first_name || "",
      last_name:    row.last_name || "",
      phone:        row.phone || "",
      gender:       row.gender || "",
      date_of_birth: row.date_of_birth || "",
      state:        row.state || "",
      district:     row.district || "",
      city_town:    row.city_town || "",
      pin_code:     row.pin_code || "",
      currently_studying:  row.currently_studying || "",
      current_class:       row.current_class || "",
      stream:              row.stream || "",
      board:               row.board || "",
      board_other:         row.board_other || "",
      school_name:         row.school_name || "",
      academic_year:       row.academic_year || "",
      highest_education:   row.highest_education || "",
      reason_not_studying: row.reason_not_studying || "",
      father_name:         row.father_name || "",
      father_phone:        row.father_phone || "",
      mother_name:         row.mother_name || "",
      mother_phone:        row.mother_phone || "",
      guardian_name:       row.guardian_name || "",
      guardian_phone:      row.guardian_phone || "",
      parent_guardian_email: row.parent_guardian_email || "",
    });
  };

  const selectRow = async (row) => {
    setEditId(row.id);
    setPinMode(null); setPinValue(""); setPinPassword("");
    setRemoveMode(false); setRemovePassword("");
    setPhotoFile(null); setPhotoPreview(null);
    setRealPhotoFile(null); setRealPhotoPreview(null);
    // The /profiles/ list is lean (no academic/guardian fields); fetch the full
    // detail so a parent can view+edit any child's complete profile.
    fillForm(row);
    try {
      const res = await api.get(`/accounts/profiles/${row.id}/`);
      if (res?.data) fillForm({ ...row, ...res.data });
    } catch { /* keep the lean fields already shown */ }
  };

  const currentRow = rows.find((r) => r.id === editId) || activeProfile;
  const hasPin     = !!currentRow?.requires_pin;

  const onPhoto = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f));
  };

  const onRealPhoto = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setRealPhotoFile(f); setRealPhotoPreview(URL.createObjectURL(f));
  };

  const setPref = (k, v) => {
    const next = { ...prefs, [k]: v }; setPrefs(next);
    savePrefs(email, { ...loadPrefs(email), ...next });
  };

  /* ── save profile ── */
  const handleSaveProfile = async () => {
    if (!editId) return;
    setSaving(true); setErr(""); setOkMsg("");
    try {
      const fd = new FormData();
      fd.append("display_name", (form.display_name || "").trim());
      // Personal data (all optional — empty values clear the field server-side).
      fd.append("first_name",    form.first_name || "");
      fd.append("last_name",     form.last_name || "");
      fd.append("phone",         form.phone || "");
      fd.append("gender",        form.gender || "");
      fd.append("date_of_birth", form.date_of_birth || "");
      fd.append("state",         form.state || "");
      fd.append("district",      form.district || "");
      fd.append("city_town",     form.city_town || "");
      fd.append("pin_code",      form.pin_code || "");
      // Academic + parent/guardian (all optional — empty clears the field).
      [
        "currently_studying", "current_class", "stream", "board", "board_other",
        "school_name", "academic_year", "highest_education", "reason_not_studying",
        "father_name", "father_phone", "mother_name", "mother_phone",
        "guardian_name", "guardian_phone", "parent_guardian_email",
      ].forEach((k) => fd.append(k, form[k] || ""));
      if (photoFile)     fd.append("avatar_image", photoFile);
      if (realPhotoFile) fd.append("profile_photo", realPhotoFile);
      await api.patch(`/accounts/profiles/${editId}/`, fd);
      const stored = loadPrefs(email);
      savePrefs(email, { ...stored, ...prefs,
        bios: { ...(stored.bios || {}), [editId]: form.bio || "" } });
      await bootstrap?.();
      await refreshProfiles();
      setOkMsg("Saved.");
    } catch (e) {
      const d = e?.response?.data;
      setErr(typeof d === "string" ? d : Object.values(d || {}).flat().join(" ") || "Could not save.");
    } finally { setSaving(false); }
  };

  /* ── add profile ── */
  const handleAddProfile = async () => {
    if (!newProfile.name.trim()) { setErr("Enter a profile name."); return; }
    setSaving(true); setErr("");
    try {
      const fd = new FormData();
      fd.append("display_name", newProfile.name.trim());
      fd.append("relationship", newProfile.relationship);
      const res = await api.post("/accounts/profiles/", fd);
      setAdding(false); setNewProfile({ name: "", relationship: "DEPENDENT" });
      await bootstrap?.(); await refreshProfiles();
      if (res?.data?.id) selectRow({ id: res.data.id, display_name: newProfile.name.trim() });
    } catch (e) {
      const d = e?.response?.data;
      setErr(typeof d === "string" ? d : Object.values(d || {}).flat().join(" ") || "Could not add profile.");
    } finally { setSaving(false); }
  };

  /* ── remove profile (requires account password) ── */
  const handleRemoveProfile = async () => {
    if (!currentRow || rows.length <= 1) return;
    if (!removePassword) { setErr("Enter your account password to remove this profile."); return; }
    setSaving(true); setErr("");
    try {
      await api.delete(`/accounts/profiles/${currentRow.id}/`, { data: { password: removePassword } });
      setRemoveMode(false); setRemovePassword("");
      await bootstrap?.(); await refreshProfiles();
    } catch (e) {
      const d = e?.response?.data;
      setErr(d?.password || d?.detail ||
        (typeof d === "string" ? d : "Could not remove profile."));
    } finally { setSaving(false); }
  };

  /* ── PIN (all changes require the ACCOUNT password — also the forgot-PIN path) ── */
  const handleSavePin = async () => {
    if (!/^\d{4,6}$/.test(pinValue)) { setErr("PIN must be 4–6 digits."); return; }
    if (!pinPassword) { setErr("Enter your account password to change the PIN."); return; }
    setSaving(true); setErr("");
    try {
      await api.post("/accounts/profiles/pin/", { profile_id: editId, pin: pinValue, password: pinPassword });
      setPinMode(null); setPinValue(""); setPinPassword("");
      await bootstrap?.(); await refreshProfiles(); setOkMsg("PIN updated.");
    } catch (e) {
      const d = e?.response?.data;
      setErr(d?.password || d?.pin ||
        (typeof d === "string" ? d : "Could not update PIN."));
    } finally { setSaving(false); }
  };

  const handleRemovePin = async () => {
    if (!pinPassword) { setErr("Enter your account password to remove the PIN."); return; }
    setSaving(true); setErr("");
    try {
      await api.post("/accounts/profiles/pin/", { profile_id: editId, pin: "", password: pinPassword });
      setPinMode(null); setPinPassword("");
      await bootstrap?.(); await refreshProfiles(); setOkMsg("PIN removed.");
    } catch (e) {
      const d = e?.response?.data;
      setErr(d?.password || (typeof d === "string" ? d : "Could not remove PIN."));
    } finally { setSaving(false); }
  };

  /* ── change password ── */
  const handleChangePassword = async () => {
    setPwMsg("");
    if (!pw.old || !pw.next) { setPwMsg("Fill in both fields."); return; }
    if (pw.next.length < 8)  { setPwMsg("New password must be at least 8 characters."); return; }
    if (pw.next !== pw.confirm) { setPwMsg("New passwords don't match."); return; }
    setPwBusy(true);
    try {
      await api.post("/accounts/change-password/", { old_password: pw.old, new_password: pw.next });
      setPw({ old: "", next: "", confirm: "" }); setPwMsg("✓ Password changed.");
    } catch (e) {
      const d = e?.response?.data;
      setPwMsg(typeof d === "string" ? d : Object.values(d || {}).flat().join(" ") || "Could not change password.");
    } finally { setPwBusy(false); }
  };

  if (!open) return null;

  /* ─────────────────────────── render ─────────────────────────── */
  return (
    <div className="sm-overlay"
      onClick={(e) => { if (e.target.classList.contains("sm-overlay")) onClose?.(); }}>
      <div className="sm-card" role="dialog" aria-modal="true" aria-label="Settings">

        {/* head */}
        <div className="sm-head">
          <h3 className="sm-title">Settings</h3>
          <button className="sm-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="sm-email">{email}</div>

        {/* tabs */}
        <div className="sm-tabs">
          <button className={`sm-tab ${tab === "profile" ? "on" : ""}`} onClick={() => setTab("profile")}>
            Manage profiles
          </button>
          <button className={`sm-tab ${tab === "account" ? "on" : ""}`} onClick={() => setTab("account")}>
            Global settings
          </button>
        </div>

        {/* body */}
        <div className="sm-body">

          {/* ══ MANAGE PROFILES ══════════════════════════════════════ */}
          {tab === "profile" && (
            <>
              {/* ── learner profiles ── */}
              <div className="sm-sec">Learner profiles</div>
              <div className="sm-editrow">
                <span className="sm-av sm-av--sm">{initials(currentRow?.display_name)}</span>
                <select className="sm-select" value={editId || ""}
                  onChange={(e) => { const r = rows.find((x) => x.id === e.target.value); if (r) selectRow(r); }}>
                  {rows.map((r) => (
                    <option key={r.id} value={r.id}>
                      {[r.display_name, classBoard(r)].filter(Boolean).join(" · ")}
                    </option>
                  ))}
                </select>
                <button className="sm-mini" onClick={() => { setAdding((v) => !v); setErr(""); }}>
                  {adding ? "Close" : "+ Add"}
                </button>
              </div>

              {adding && (
                <div className="sm-addform">
                  <input className="sm-input" placeholder="Profile name" value={newProfile.name}
                    onChange={(e) => setNewProfile((n) => ({ ...n, name: e.target.value }))} />
                  <select className="sm-select" value={newProfile.relationship}
                    onChange={(e) => setNewProfile((n) => ({ ...n, relationship: e.target.value }))}>
                    <option value="DEPENDENT">Child / Dependent</option>
                    <option value="SELF">Myself</option>
                  </select>
                  <button className="sm-save sm-save--sm" onClick={handleAddProfile} disabled={saving}>Create</button>
                </div>
              )}

              {/* ── profile detail ── */}
              <div className="sm-sec">Profile</div>
              <div className="sm-photorow">
                {photoPreview
                  ? <img className="sm-av sm-av--lg" src={photoPreview} alt="" />
                  : (currentRow?.avatar_type === "image" && currentRow?.avatar)
                    ? <img className="sm-av sm-av--lg" src={currentRow.avatar} alt="" />
                    : <span className="sm-av sm-av--lg">{initials(currentRow?.display_name)}</span>}
                <button className="sm-photobtn" onClick={() => fileRef.current?.click()}>Change photo</button>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto} />
              </div>

              <label className="sm-label">Display name</label>
              <input className="sm-input" value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))} />

              <label className="sm-label">Bio</label>
              <textarea className="sm-input sm-textarea" rows={2} value={form.bio}
                placeholder="A short line about you"
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />

              {/* ── personal details (optional; feeds the faculty application) ── */}
              <div className="sm-sec">Personal details</div>
              <div className="sm-tg-sub" style={{ marginBottom: 10 }}>
                Optional — fill in what you like. These details are reused by the
                faculty application form so you don't have to type them twice.
              </div>

              <div className="sm-photorow">
                {realPhotoPreview
                  ? <img className="sm-av sm-av--lg" src={realPhotoPreview} alt="" />
                  : (currentRow?.profile_photo)
                    ? <img className="sm-av sm-av--lg" src={currentRow.profile_photo} alt="" />
                    : <span className="sm-av sm-av--lg">{initials(currentRow?.display_name)}</span>}
                <button className="sm-photobtn" onClick={() => realFileRef.current?.click()}>
                  {currentRow?.profile_photo || realPhotoPreview ? "Change photo" : "Add photo"}
                </button>
                <input ref={realFileRef} type="file" accept="image/*" hidden onChange={onRealPhoto} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="sm-label">First name</label>
                  <input className="sm-input" value={form.first_name}
                    onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} />
                </div>
                <div>
                  <label className="sm-label">Last name</label>
                  <input className="sm-input" value={form.last_name}
                    onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} />
                </div>
                <div>
                  <label className="sm-label">Phone</label>
                  <input className="sm-input" value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                </div>
                <div>
                  <label className="sm-label">Date of birth</label>
                  <input className="sm-input" type="date" value={form.date_of_birth}
                    onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))} />
                </div>
              </div>

              <label className="sm-label">Gender</label>
              <select className="sm-select" value={form.gender}
                onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}>
                <option value="">Prefer not to specify</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>

              <label className="sm-label">Address</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <input className="sm-input" placeholder="State" value={form.state}
                  onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
                <input className="sm-input" placeholder="District" value={form.district}
                  onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))} />
                <input className="sm-input" placeholder="City / town" value={form.city_town}
                  onChange={(e) => setForm((f) => ({ ...f, city_town: e.target.value }))} />
                <input className="sm-input" placeholder="Pincode" value={form.pin_code}
                  onChange={(e) => setForm((f) => ({ ...f, pin_code: e.target.value }))} />
              </div>

              {/* ── academic details ── */}
              <div className="sm-sec">Academic details</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="sm-label">Currently studying?</label>
                  <select className="sm-select" value={form.currently_studying}
                    onChange={(e) => setForm((f) => ({ ...f, currently_studying: e.target.value }))}>
                    {STUDYING_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="sm-label">Class</label>
                  <select className="sm-select" value={form.current_class}
                    onChange={(e) => setForm((f) => ({ ...f, current_class: e.target.value }))}>
                    {CLASS_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="sm-label">Stream</label>
                  <select className="sm-select" value={form.stream}
                    onChange={(e) => setForm((f) => ({ ...f, stream: e.target.value }))}>
                    {STREAM_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="sm-label">Board</label>
                  <select className="sm-select" value={form.board}
                    onChange={(e) => setForm((f) => ({ ...f, board: e.target.value }))}>
                    {BOARD_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              {form.board === "other" && (
                <>
                  <label className="sm-label">Board name (other)</label>
                  <input className="sm-input" value={form.board_other}
                    onChange={(e) => setForm((f) => ({ ...f, board_other: e.target.value }))} />
                </>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="sm-label">School / institution</label>
                  <input className="sm-input" value={form.school_name}
                    onChange={(e) => setForm((f) => ({ ...f, school_name: e.target.value }))} />
                </div>
                <div>
                  <label className="sm-label">Academic year</label>
                  <input className="sm-input" placeholder="e.g. 2025–26" value={form.academic_year}
                    onChange={(e) => setForm((f) => ({ ...f, academic_year: e.target.value }))} />
                </div>
              </div>
              {form.currently_studying === "no" && (
                <>
                  <label className="sm-label">Highest education</label>
                  <select className="sm-select" value={form.highest_education}
                    onChange={(e) => setForm((f) => ({ ...f, highest_education: e.target.value }))}>
                    {HIGHED_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <label className="sm-label">Reason for not studying</label>
                  <input className="sm-input" value={form.reason_not_studying}
                    onChange={(e) => setForm((f) => ({ ...f, reason_not_studying: e.target.value }))} />
                </>
              )}

              {/* ── parent / guardian ── */}
              <div className="sm-sec">Parent / guardian</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="sm-label">Father's name</label>
                  <input className="sm-input" value={form.father_name}
                    onChange={(e) => setForm((f) => ({ ...f, father_name: e.target.value }))} />
                </div>
                <div>
                  <label className="sm-label">Father's phone</label>
                  <input className="sm-input" value={form.father_phone}
                    onChange={(e) => setForm((f) => ({ ...f, father_phone: e.target.value }))} />
                </div>
                <div>
                  <label className="sm-label">Mother's name</label>
                  <input className="sm-input" value={form.mother_name}
                    onChange={(e) => setForm((f) => ({ ...f, mother_name: e.target.value }))} />
                </div>
                <div>
                  <label className="sm-label">Mother's phone</label>
                  <input className="sm-input" value={form.mother_phone}
                    onChange={(e) => setForm((f) => ({ ...f, mother_phone: e.target.value }))} />
                </div>
                <div>
                  <label className="sm-label">Guardian's name</label>
                  <input className="sm-input" value={form.guardian_name}
                    onChange={(e) => setForm((f) => ({ ...f, guardian_name: e.target.value }))} />
                </div>
                <div>
                  <label className="sm-label">Guardian's phone</label>
                  <input className="sm-input" value={form.guardian_phone}
                    onChange={(e) => setForm((f) => ({ ...f, guardian_phone: e.target.value }))} />
                </div>
              </div>
              <label className="sm-label">Parent / guardian email</label>
              <input className="sm-input" type="email" value={form.parent_guardian_email}
                onChange={(e) => setForm((f) => ({ ...f, parent_guardian_email: e.target.value }))} />

              {/* ── PIN ── */}
              <div className="sm-sec">Security · this profile</div>
              <div className="sm-pinrow">
                <div>
                  <div className="sm-tg-title">Profile PIN</div>
                  <div className="sm-tg-sub">{hasPin ? "This profile is PIN-protected" : "No PIN set"}</div>
                </div>
                <div className="sm-row-actions">
                  {!pinMode && (
                    <button className="sm-mini"
                      onClick={() => { setPinMode("set"); setPinValue(""); setPinPassword(""); setErr(""); }}>
                      {hasPin ? "Change / reset" : "Set PIN"}
                    </button>
                  )}
                  {hasPin && !pinMode && (
                    <button className="sm-mini sm-mini--danger"
                      onClick={() => { setPinMode("remove"); setPinPassword(""); setErr(""); }}>Remove</button>
                  )}
                </div>
              </div>
              {pinMode === "set" && (
                <div className="sm-addform" style={{ flexWrap: "wrap", gap: 8 }}>
                  <input className="sm-input" inputMode="numeric" maxLength={6}
                    placeholder="New 4–6 digit PIN" value={pinValue}
                    onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ""))} />
                  <input className="sm-input" type="password" autoComplete="current-password"
                    placeholder="Account password" value={pinPassword}
                    onChange={(e) => setPinPassword(e.target.value)} />
                  <div className="sm-tg-sub" style={{ flexBasis: "100%" }}>
                    Forgot the current PIN? You don't need it — your account password resets it.
                  </div>
                  <button className="sm-save sm-save--sm" onClick={handleSavePin} disabled={saving}>
                    Save PIN
                  </button>
                  <button className="sm-mini" onClick={() => { setPinMode(null); setPinValue(""); setPinPassword(""); }}>
                    Cancel
                  </button>
                </div>
              )}
              {pinMode === "remove" && (
                <div className="sm-addform" style={{ flexWrap: "wrap", gap: 8 }}>
                  <input className="sm-input" type="password" autoComplete="current-password"
                    placeholder="Account password to remove PIN" value={pinPassword}
                    onChange={(e) => setPinPassword(e.target.value)} />
                  <button className="sm-save sm-save--sm sm-save--danger" onClick={handleRemovePin} disabled={saving}>
                    Remove PIN
                  </button>
                  <button className="sm-mini" onClick={() => { setPinMode(null); setPinPassword(""); }}>
                    Cancel
                  </button>
                </div>
              )}

              {/* ── notifications ── */}
              <div className="sm-sec">Notifications · this profile</div>
              <div className="sm-togglerow">
                <div>
                  <div className="sm-tg-title">Email notifications</div>
                  <div className="sm-tg-sub">{email}</div>
                </div>
                <Toggle on={prefs.email} onChange={(v) => setPref("email", v)} />
              </div>
              <div className="sm-togglerow">
                <div><div className="sm-tg-title">SMS / WhatsApp alerts</div></div>
                <Toggle on={prefs.sms} onChange={(v) => setPref("sms", v)} />
              </div>

              {/* ── privacy ── */}
              <div className="sm-sec">Privacy</div>
              <div className="sm-togglerow">
                <div>
                  <div className="sm-tg-title">Show me in the expert directory</div>
                  <div className="sm-tg-sub">Let others find this profile</div>
                </div>
                <Toggle on={prefs.directory} onChange={(v) => setPref("directory", v)} />
              </div>

              {/* ── danger zone (learner) — removal needs account password ── */}
              {rows.length > 1 && !currentRow?.is_default && (
                <>
                  <div className="sm-sec">Danger zone</div>
                  {!removeMode ? (
                    <button className="sm-linkbtn sm-linkbtn--danger"
                      onClick={() => { setRemoveMode(true); setRemovePassword(""); setErr(""); }} disabled={saving}>
                      Remove this profile
                    </button>
                  ) : (
                    <div className="sm-addform" style={{ flexWrap: "wrap", gap: 8 }}>
                      <div className="sm-tg-sub" style={{ flexBasis: "100%" }}>
                        Removing “{currentRow?.display_name}” can’t be undone. Enter your account password to confirm.
                      </div>
                      <input className="sm-input" type="password" autoComplete="current-password"
                        placeholder="Account password" value={removePassword}
                        onChange={(e) => setRemovePassword(e.target.value)} />
                      <button className="sm-save sm-save--sm sm-save--danger"
                        onClick={handleRemoveProfile} disabled={saving}>
                        Remove profile
                      </button>
                      <button className="sm-mini" onClick={() => { setRemoveMode(false); setRemovePassword(""); }}>
                        Cancel
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* ── teacher identity section ── */}
              <PrefsSection />
              <TeacherSection teacherInfo={teacherInfo}
                mkAddTrack={mkAddTrack}
                facultyFormUrl={facultyFormUrl}
                expertProfileUrl={expertProfileUrl}
            onManageTrack={onManageTrack} />
            </>
          )}

          {/* ══ GLOBAL SETTINGS ══════════════════════════════════════ */}
          {tab === "account" && (
            <>
              <div className="sm-sec">Account</div>
              <label className="sm-label">Email</label>
              <input className="sm-input" value={email} readOnly />
              <div className="sm-tg-sub" style={{ marginTop: 4 }}>
                This is the email you log in with. Changing your password below
                updates your sign-in credentials.
              </div>
              <label className="sm-label">Username</label>
              <input className="sm-input" value={user?.username || ""} readOnly />

              <div className="sm-sec">Change password</div>
              <input className="sm-input sm-mb" type="password" placeholder="Current password"
                value={pw.old} onChange={(e) => setPw((p) => ({ ...p, old: e.target.value }))}
                autoComplete="current-password" />
              <input className="sm-input sm-mb" type="password" placeholder="New password"
                value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
                autoComplete="new-password" />
              <input className="sm-input" type="password" placeholder="Confirm new password"
                value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
                autoComplete="new-password" />
              {pwMsg && (
                <div className={`sm-mini-msg ${/✓/.test(pwMsg) ? "ok" : "err"}`}>{pwMsg}</div>
              )}
              <button className="sm-linkbtn sm-mt" onClick={handleChangePassword} disabled={pwBusy}>
                {pwBusy ? "Updating…" : "Update password"}
              </button>

              <div className="sm-sec">Preferences</div>
              <div className="sm-togglerow">
                <div>
                  <div className="sm-tg-title">Product updates &amp; announcements</div>
                  <div className="sm-tg-sub">Occasional email from ShikshaCom</div>
                </div>
                <Toggle on={prefs.announce} onChange={(v) => setPref("announce", v)} />
              </div>

              <div className="sm-sec">Session</div>
              <button className="sm-linkbtn sm-linkbtn--danger" onClick={logout}>
                Log out of this account
              </button>
            </>
          )}

          {err  && <div className="sm-err">{err}</div>}
          {okMsg && <div className="sm-ok">{okMsg}</div>}
        </div>

        {/* footer */}
        <div className="sm-footer">
          <button className="sm-cancel" onClick={onClose}>Close</button>
          {tab === "profile" && (
            <button className="sm-save" onClick={handleSaveProfile} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
