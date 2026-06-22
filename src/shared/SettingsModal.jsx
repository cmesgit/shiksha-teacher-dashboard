/**
 * SettingsModal.jsx · src/shared/SettingsModal.jsx
 * ──────────────────────────────────────────────────────────────────
 * In-dashboard Settings modal, matched to the uploaded Claude design:
 *   Header (Settings + email + close)
 *   Tabs:  Profile · Account
 *   Profile → EDITING ACCOUNT (switch which profile) · PROFILE (photo,
 *             display name, class & board, bio) · NOTIFICATIONS · PRIVACY
 *   Account → email, username, change password, log out
 *   Footer:  Cancel · Save changes
 *
 * Persistence:
 *   · display name + photo  → PATCH /accounts/profiles/{id}/  (server)
 *   · notification + privacy toggles, bio → per-account local prefs
 *     (kept sticky in localStorage until a backend prefs endpoint exists)
 * Class & board are shown read-only (academic data is edited in onboarding).
 */
import { useEffect, useState, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { HOME_URL } from "../config/urls";
import "./SettingsModal.css";

const initials = (n) =>
  (n || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

const CLASS_LABEL = (c) => (c ? `Class ${c}` : "");
const classBoard = (p) =>
  [CLASS_LABEL(p?.current_class), p?.board].filter(Boolean).join(" · ");

/* sticky local prefs (until a server prefs endpoint exists) */
const prefsKey = (email) => `shiksha_prefs_${email || "anon"}`;
const loadPrefs = (email) => {
  try { return JSON.parse(localStorage.getItem(prefsKey(email)) || "{}"); }
  catch { return {}; }
};
const savePrefs = (email, prefs) => {
  try { localStorage.setItem(prefsKey(email), JSON.stringify(prefs)); } catch {}
};

function Toggle({ on, onChange }) {
  return (
    <button type="button" className={`sm-toggle ${on ? "on" : ""}`}
      role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <span className="sm-toggle__dot" />
    </button>
  );
}

export default function SettingsModal({ open, onClose }) {
  const { user, profiles, activeProfile, api, bootstrap, logout } = useAuth();

  const [tab, setTab] = useState("profile");
  const [rows, setRows] = useState([]);          // full profile rows
  const [editId, setEditId] = useState(null);    // which profile is being edited
  const [form, setForm] = useState({ display_name: "", bio: "" });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [prefs, setPrefs] = useState({ email: true, sms: false, directory: true });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef(null);

  const email = user?.email || "";

  // Load full profiles + local prefs when opened.
  useEffect(() => {
    if (!open) return;
    setErr(""); setTab("profile"); setPhotoFile(null); setPhotoPreview(null);
    const seed = (list) => {
      setRows(list);
      const start = (activeProfile && list.find((p) => p.id === activeProfile.id)) || list[0];
      if (start) selectRow(start, list);
    };
    api.get("/accounts/profiles/")
      .then((res) => seed(Array.isArray(res.data) ? res.data : res.data?.results || []))
      .catch(() => seed(profiles || []));
    const p = loadPrefs(email);
    setPrefs({ email: p.email ?? true, sms: p.sms ?? false, directory: p.directory ?? true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selectRow = (row, list = rows) => {
    setEditId(row.id);
    const stored = loadPrefs(email);
    setForm({
      display_name: row.display_name || "",
      bio: (stored.bios && stored.bios[row.id]) || "",
    });
    setPhotoFile(null); setPhotoPreview(null);
  };

  const currentRow = rows.find((r) => r.id === editId) || activeProfile;

  const onPhoto = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const setPref = (k, v) => {
    const next = { ...prefs, [k]: v };
    setPrefs(next);
    const stored = loadPrefs(email);
    savePrefs(email, { ...stored, ...next });
  };

  const handleSave = async () => {
    if (!editId) return;
    setSaving(true); setErr("");
    try {
      const fd = new FormData();
      fd.append("display_name", (form.display_name || "").trim());
      if (photoFile) fd.append("avatar_image", photoFile);
      await api.patch(`/accounts/profiles/${editId}/`, fd);
      // sticky local bits
      const stored = loadPrefs(email);
      const bios = { ...(stored.bios || {}), [editId]: form.bio || "" };
      savePrefs(email, { ...stored, ...prefs, bios });
      await bootstrap?.();
      onClose?.();
    } catch (e) {
      const d = e?.response?.data;
      setErr(typeof d === "string" ? d : Object.values(d || {}).flat().join(" ") || "Could not save.");
    } finally {
      setSaving(false);
    }
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
          <button className={`sm-tab ${tab === "profile" ? "on" : ""}`} onClick={() => setTab("profile")}>Profile</button>
          <button className={`sm-tab ${tab === "account" ? "on" : ""}`} onClick={() => setTab("account")}>Account</button>
        </div>

        <div className="sm-body">
          {tab === "profile" && (
            <>
              <div className="sm-sec">Editing account</div>
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
              </div>

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
              <input className="sm-input" value={classBoard(currentRow) || "—"} readOnly
                title="Academic details are set during onboarding" />

              <label className="sm-label">Bio</label>
              <textarea className="sm-input sm-textarea" rows={2} value={form.bio}
                placeholder="A short line about you"
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />

              <div className="sm-sec">Notifications · this account</div>
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

              <div className="sm-sec">Privacy</div>
              <div className="sm-togglerow">
                <div>
                  <div className="sm-tg-title">Show me in the expert directory</div>
                  <div className="sm-tg-sub">Let others find this profile</div>
                </div>
                <Toggle on={prefs.directory} onChange={(v) => setPref("directory", v)} />
              </div>
            </>
          )}

          {tab === "account" && (
            <>
              <div className="sm-sec">Account</div>
              <label className="sm-label">Email</label>
              <input className="sm-input" value={email} readOnly />
              <label className="sm-label">Username</label>
              <input className="sm-input" value={user?.username || ""} readOnly />

              <div className="sm-sec">Security</div>
              <a className="sm-linkbtn" href={`${HOME_URL}/forgot-password`}>Change password</a>

              <div className="sm-sec">Session</div>
              <button className="sm-linkbtn sm-linkbtn--danger" onClick={logout}>Log out of this account</button>
            </>
          )}
          {err && <div className="sm-err">{err}</div>}
        </div>

        <div className="sm-footer">
          <button className="sm-cancel" onClick={onClose}>Cancel</button>
          <button className="sm-save" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
