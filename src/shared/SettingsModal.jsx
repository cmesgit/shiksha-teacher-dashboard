/**
 * SettingsModal.jsx · src/shared/SettingsModal.jsx
 * ──────────────────────────────────────────────────────────────────
 * One self-contained Settings surface used identically on the landing,
 * student and teacher apps. No cross-domain redirects — each domain opens
 * its own in-app modal.
 *
 * Tabs:
 *   Manage profiles  → switch / add / edit / remove profiles, photo,
 *                      display name, bio, PIN, per-profile notifications & privacy
 *   Global settings  → account email/username, change password, account-wide
 *                      preferences, sign out
 *
 * Server-backed:
 *   · display name + photo  → PATCH /accounts/profiles/{id}/
 *   · add profile           → POST  /accounts/profiles/
 *   · remove profile        → DELETE /accounts/profiles/{id}/
 *   · PIN set / remove      → POST  /accounts/profiles/pin/
 *   · change password       → POST  /accounts/change-password/
 * Local (sticky) prefs until a backend prefs endpoint exists: bio, notification
 * & privacy toggles. Class & board are read-only (set during onboarding).
 */
import { useEffect, useState, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import "./SettingsModal.css";

const initials = (n) =>
  (n || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const CLASS_LABEL = (c) => (c ? `Class ${c}` : "");
const classBoard = (p) => [CLASS_LABEL(p?.current_class), p?.board].filter(Boolean).join(" · ");

const prefsKey = (email) => `shiksha_prefs_${email || "anon"}`;
const loadPrefs = (email) => { try { return JSON.parse(localStorage.getItem(prefsKey(email)) || "{}"); } catch { return {}; } };
const savePrefs = (email, p) => { try { localStorage.setItem(prefsKey(email), JSON.stringify(p)); } catch {} };

function Toggle({ on, onChange }) {
  return (
    <button type="button" className={`sm-toggle ${on ? "on" : ""}`} role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <span className="sm-toggle__dot" />
    </button>
  );
}

export default function SettingsModal({ open, tab: initialTab = "profile", onClose }) {
  const { user, profiles, activeProfile, api, bootstrap, logout } = useAuth();

  const [tab, setTab] = useState(initialTab);
  const [rows, setRows] = useState([]);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ display_name: "", bio: "" });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [prefs, setPrefs] = useState({ email: true, sms: false, directory: true, announce: true });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const fileRef = useRef(null);

  // sub-flows
  const [adding, setAdding] = useState(false);
  const [newProfile, setNewProfile] = useState({ name: "", relationship: "DEPENDENT" });
  const [pinEditing, setPinEditing] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [pw, setPw] = useState({ old: "", next: "", confirm: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState("");

  const email = user?.email || "";

  useEffect(() => {
    if (!open) return;
    setTab(initialTab); setErr(""); setOkMsg(""); setAdding(false); setPinEditing(false);
    setPhotoFile(null); setPhotoPreview(null); setPw({ old: "", next: "", confirm: "" }); setPwMsg("");
    const p = loadPrefs(email);
    setPrefs({ email: p.email ?? true, sms: p.sms ?? false, directory: p.directory ?? true, announce: p.announce ?? true });
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const refresh = async () => {
    try {
      const res = await api.get("/accounts/profiles/");
      const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setRows(list);
      const start = (activeProfile && list.find((p) => p.id === activeProfile.id)) || list[0];
      if (start) selectRow(start);
    } catch {
      setRows(profiles || []);
      if (activeProfile) selectRow(activeProfile);
    }
  };

  const selectRow = (row) => {
    setEditId(row.id); setPinEditing(false); setPinValue("");
    setPhotoFile(null); setPhotoPreview(null);
    const stored = loadPrefs(email);
    setForm({ display_name: row.display_name || "", bio: (stored.bios && stored.bios[row.id]) || "" });
  };

  const currentRow = rows.find((r) => r.id === editId) || activeProfile;
  const hasPin = !!(currentRow?.requires_pin);

  const onPhoto = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f));
  };
  const setPref = (k, v) => {
    const next = { ...prefs, [k]: v }; setPrefs(next);
    savePrefs(email, { ...loadPrefs(email), ...next });
  };

  /* ── profile CRUD ── */
  const handleSaveProfile = async () => {
    if (!editId) return;
    setSaving(true); setErr(""); setOkMsg("");
    try {
      const fd = new FormData();
      fd.append("display_name", (form.display_name || "").trim());
      if (photoFile) fd.append("avatar_image", photoFile);
      await api.patch(`/accounts/profiles/${editId}/`, fd);
      const stored = loadPrefs(email);
      savePrefs(email, { ...stored, ...prefs, bios: { ...(stored.bios || {}), [editId]: form.bio || "" } });
      await bootstrap?.();
      await refresh();
      setOkMsg("Saved.");
    } catch (e) {
      const d = e?.response?.data;
      setErr(typeof d === "string" ? d : Object.values(d || {}).flat().join(" ") || "Could not save.");
    } finally { setSaving(false); }
  };

  const handleAddProfile = async () => {
    if (!newProfile.name.trim()) { setErr("Enter a profile name."); return; }
    setSaving(true); setErr("");
    try {
      const fd = new FormData();
      fd.append("display_name", newProfile.name.trim());
      fd.append("relationship", newProfile.relationship);
      const res = await api.post("/accounts/profiles/", fd);
      setAdding(false); setNewProfile({ name: "", relationship: "DEPENDENT" });
      await bootstrap?.(); await refresh();
      if (res?.data?.id) { const r = { id: res.data.id, display_name: newProfile.name.trim() }; selectRow(r); }
    } catch (e) {
      const d = e?.response?.data;
      setErr(typeof d === "string" ? d : Object.values(d || {}).flat().join(" ") || "Could not add profile.");
    } finally { setSaving(false); }
  };

  const handleRemoveProfile = async () => {
    if (!currentRow || rows.length <= 1) return;
    if (!window.confirm(`Remove "${currentRow.display_name}"? This can't be undone.`)) return;
    setSaving(true); setErr("");
    try {
      await api.delete(`/accounts/profiles/${currentRow.id}/`);
      await bootstrap?.(); await refresh();
    } catch (e) {
      const d = e?.response?.data;
      setErr(typeof d?.detail === "string" ? d.detail : "Could not remove profile.");
    } finally { setSaving(false); }
  };

  const handleSavePin = async () => {
    if (!/^\d{4,6}$/.test(pinValue)) { setErr("PIN must be 4–6 digits."); return; }
    setSaving(true); setErr("");
    try {
      await api.post("/accounts/profiles/pin/", { profile_id: editId, pin: pinValue });
      setPinEditing(false); setPinValue(""); await bootstrap?.(); await refresh(); setOkMsg("PIN updated.");
    } catch { setErr("Could not update PIN."); } finally { setSaving(false); }
  };
  const handleRemovePin = async () => {
    setSaving(true); setErr("");
    try {
      await api.post("/accounts/profiles/pin/", { profile_id: editId, pin: "" });
      await bootstrap?.(); await refresh(); setOkMsg("PIN removed.");
    } catch { setErr("Could not remove PIN."); } finally { setSaving(false); }
  };

  /* ── password ── */
  const handleChangePassword = async () => {
    setPwMsg("");
    if (!pw.old || !pw.next) { setPwMsg("Fill in both fields."); return; }
    if (pw.next.length < 8) { setPwMsg("New password must be at least 8 characters."); return; }
    if (pw.next !== pw.confirm) { setPwMsg("New passwords don't match."); return; }
    setPwBusy(true);
    try {
      await api.post("/accounts/change-password/", { old_password: pw.old, new_password: pw.next });
      setPw({ old: "", next: "", confirm: "" }); setPwMsg("Password changed.");
    } catch (e) {
      const d = e?.response?.data;
      setPwMsg(typeof d === "string" ? d : Object.values(d || {}).flat().join(" ") || "Could not change password.");
    } finally { setPwBusy(false); }
  };

  if (!open) return null;

  return (
    <div className="sm-overlay" onClick={(e) => { if (e.target.classList.contains("sm-overlay")) onClose?.(); }}>
      <div className="sm-card" role="dialog" aria-modal="true" aria-label="Settings">
        <div className="sm-head">
          <h3 className="sm-title">Settings</h3>
          <button className="sm-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="sm-email">{email}</div>

        <div className="sm-tabs">
          <button className={`sm-tab ${tab === "profile" ? "on" : ""}`} onClick={() => setTab("profile")}>Manage profiles</button>
          <button className={`sm-tab ${tab === "account" ? "on" : ""}`} onClick={() => setTab("account")}>Global settings</button>
        </div>

        <div className="sm-body">
          {tab === "profile" && (
            <>
              <div className="sm-sec">Editing profile</div>
              <div className="sm-editrow">
                <span className="sm-av sm-av--sm">{initials(currentRow?.display_name)}</span>
                <select className="sm-select" value={editId || ""}
                  onChange={(e) => { const r = rows.find((x) => x.id === e.target.value); if (r) selectRow(r); }}>
                  {rows.map((r) => (
                    <option key={r.id} value={r.id}>{[r.display_name, classBoard(r)].filter(Boolean).join(" · ")}</option>
                  ))}
                </select>
                <button className="sm-mini" onClick={() => { setAdding((v) => !v); setErr(""); }}>{adding ? "Close" : "+ Add"}</button>
              </div>

              {adding && (
                <div className="sm-addform">
                  <input className="sm-input" placeholder="New profile name" value={newProfile.name}
                    onChange={(e) => setNewProfile((n) => ({ ...n, name: e.target.value }))} />
                  <select className="sm-select" value={newProfile.relationship}
                    onChange={(e) => setNewProfile((n) => ({ ...n, relationship: e.target.value }))}>
                    <option value="DEPENDENT">Child / Dependent</option>
                    <option value="SELF">Myself</option>
                  </select>
                  <button className="sm-save sm-save--sm" onClick={handleAddProfile} disabled={saving}>Create</button>
                </div>
              )}

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

              <label className="sm-label">Class &amp; board</label>
              <input className="sm-input" value={classBoard(currentRow) || "—"} readOnly title="Set during onboarding" />

              <label className="sm-label">Bio</label>
              <textarea className="sm-input sm-textarea" rows={2} value={form.bio}
                placeholder="A short line about you"
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />

              <div className="sm-sec">Security · this profile</div>
              <div className="sm-pinrow">
                <div>
                  <div className="sm-tg-title">Profile PIN</div>
                  <div className="sm-tg-sub">{hasPin ? "This profile is PIN-protected" : "No PIN set"}</div>
                </div>
                <div className="sm-row-actions">
                  {!pinEditing && <button className="sm-mini" onClick={() => { setPinEditing(true); setPinValue(""); }}>{hasPin ? "Change" : "Set PIN"}</button>}
                  {hasPin && !pinEditing && <button className="sm-mini sm-mini--danger" onClick={handleRemovePin}>Remove</button>}
                </div>
              </div>
              {pinEditing && (
                <div className="sm-addform">
                  <input className="sm-input" inputMode="numeric" maxLength={6} placeholder="4–6 digit PIN"
                    value={pinValue} onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ""))} />
                  <button className="sm-save sm-save--sm" onClick={handleSavePin} disabled={saving}>Save PIN</button>
                </div>
              )}

              <div className="sm-sec">Notifications · this profile</div>
              <div className="sm-togglerow">
                <div><div className="sm-tg-title">Email notifications</div><div className="sm-tg-sub">{email}</div></div>
                <Toggle on={prefs.email} onChange={(v) => setPref("email", v)} />
              </div>
              <div className="sm-togglerow">
                <div><div className="sm-tg-title">SMS / WhatsApp alerts</div></div>
                <Toggle on={prefs.sms} onChange={(v) => setPref("sms", v)} />
              </div>

              <div className="sm-sec">Privacy</div>
              <div className="sm-togglerow">
                <div><div className="sm-tg-title">Show me in the expert directory</div><div className="sm-tg-sub">Let others find this profile</div></div>
                <Toggle on={prefs.directory} onChange={(v) => setPref("directory", v)} />
              </div>

              {rows.length > 1 && !currentRow?.is_default && (
                <>
                  <div className="sm-sec">Danger zone</div>
                  <button className="sm-linkbtn sm-linkbtn--danger" onClick={handleRemoveProfile} disabled={saving}>
                    Remove this profile
                  </button>
                </>
              )}
            </>
          )}

          {tab === "account" && (
            <>
              <div className="sm-sec">Account</div>
              <label className="sm-label">Email</label>
              <input className="sm-input" value={email} readOnly />
              <label className="sm-label">Username</label>
              <input className="sm-input" value={user?.username || ""} readOnly />

              <div className="sm-sec">Change password</div>
              <input className="sm-input sm-mb" type="password" placeholder="Current password"
                value={pw.old} onChange={(e) => setPw((p) => ({ ...p, old: e.target.value }))} autoComplete="current-password" />
              <input className="sm-input sm-mb" type="password" placeholder="New password"
                value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} autoComplete="new-password" />
              <input className="sm-input" type="password" placeholder="Confirm new password"
                value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} autoComplete="new-password" />
              {pwMsg && <div className={`sm-mini-msg ${/changed/i.test(pwMsg) ? "ok" : "err"}`}>{pwMsg}</div>}
              <button className="sm-linkbtn sm-mt" onClick={handleChangePassword} disabled={pwBusy}>
                {pwBusy ? "Updating…" : "Update password"}
              </button>

              <div className="sm-sec">Account preferences</div>
              <div className="sm-togglerow">
                <div><div className="sm-tg-title">Product updates &amp; announcements</div><div className="sm-tg-sub">Occasional email from ShikshaCom</div></div>
                <Toggle on={prefs.announce} onChange={(v) => setPref("announce", v)} />
              </div>

              <div className="sm-sec">Session</div>
              <button className="sm-linkbtn sm-linkbtn--danger" onClick={logout}>Log out of this account</button>
            </>
          )}

          {err && <div className="sm-err">{err}</div>}
          {okMsg && <div className="sm-ok">{okMsg}</div>}
        </div>

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
