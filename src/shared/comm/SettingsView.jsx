// PLACEMENT: put this file in BOTH apps (identical):
//   student_dashboard/src/shared/comm/SettingsView.jsx
//   teacher_ui/src/shared/comm/SettingsView.jsx
//
// CC-020 Communication Settings / CC-021 Privacy & Notification Prefs.
// Three sections: online-status/read-receipt privacy toggles (new — Stage
// E), channel + category notification preferences (existing
// notifications.NotificationPreference, given a UI for the first time),
// and blocked-users management (existing block API, previously only a
// per-thread button with no standalone management screen).
import { useEffect, useState } from "react";
import { FiEye, FiEyeOff, FiBell, FiUserX, FiCheck } from "react-icons/fi";
import { ChatAPI } from "../chatClient";
import api from "../apiClient";
import { Avatar, Spinner, EmptyState } from "./common";

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="cc-toggle-row">
      <span>
        <span className="cc-toggle-label">{label}</span>
        {hint && <span className="cc-toggle-hint">{hint}</span>}
      </span>
      <span className={"cc-toggle" + (checked ? " cc-toggle-on" : "")} onClick={() => onChange(!checked)}>
        <span className="cc-toggle-knob" />
      </span>
    </label>
  );
}

const CATEGORY_LABEL = {
  bookings: "Bookings & sessions", reminders: "Reminders", classes: "Live classes",
  learning: "Assignments & quizzes", social: "Chat & forum", payments: "Payments",
  account: "Account & security", announcements: "Course announcements", support: "Support tickets",
};

export default function SettingsView() {
  const [commPrefs, setCommPrefs] = useState(null);
  const [notifPrefs, setNotifPrefs] = useState(null);
  const [blocked, setBlocked] = useState(null);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    ChatAPI.getPreferences().then(setCommPrefs).catch(() => setCommPrefs({ show_online_status: true, show_read_receipts: true }));
    api.get("/notifications/preferences/").then((r) => setNotifPrefs(r.data)).catch(() => setNotifPrefs(null));
    ChatAPI.blocks().then(setBlocked).catch(() => setBlocked([]));
  }, []);

  const flashSaved = () => { setSaved("Saved"); setTimeout(() => setSaved(""), 1500); };

  const updateComm = async (patch) => {
    const next = { ...commPrefs, ...patch };
    setCommPrefs(next);
    try { await ChatAPI.updatePreferences(patch); flashSaved(); } catch { /* keep optimistic value */ }
  };

  const updateNotif = async (patch) => {
    const next = { ...notifPrefs, ...patch };
    setNotifPrefs(next);
    try { const { data } = await api.put("/notifications/preferences/", patch); setNotifPrefs(data); flashSaved(); } catch { /* */ }
  };

  const toggleCategory = (cat) => {
    const muted = notifPrefs.muted_categories.includes(cat)
      ? notifPrefs.muted_categories.filter((c) => c !== cat)
      : [...notifPrefs.muted_categories, cat];
    updateNotif({ muted_categories: muted });
  };

  const unblock = async (target_kind, target_id) => {
    await ChatAPI.unblock(target_kind, target_id);
    setBlocked((prev) => prev.filter((b) => b.target_id !== target_id));
  };

  return (
    <div className="cc-settings-view">
      <header className="cc-view-head">
        <span className="cc-view-title">Communication Settings</span>
        {saved && <span className="cc-saved-pill"><FiCheck size={12} /> {saved}</span>}
      </header>

      <div className="cc-settings-scroll">
        <section className="cc-settings-section">
          <h4>{commPrefs?.show_online_status ? <FiEye size={14} /> : <FiEyeOff size={14} />} Privacy</h4>
          {!commPrefs ? <Spinner /> : (
            <>
              <Toggle
                checked={commPrefs.show_online_status}
                onChange={(v) => updateComm({ show_online_status: v })}
                label="Show when you're online"
                hint="Others in your direct messages can see your online status and last-seen time."
              />
              <Toggle
                checked={commPrefs.show_read_receipts}
                onChange={(v) => updateComm({ show_read_receipts: v })}
                label="Send read receipts"
                hint="People you message can see when you've read their messages."
              />
            </>
          )}
        </section>

        <section className="cc-settings-section">
          <h4><FiBell size={14} /> Notifications</h4>
          {!notifPrefs ? <Spinner /> : (
            <>
              <Toggle checked={notifPrefs.email_enabled} onChange={(v) => updateNotif({ email_enabled: v })} label="Email" />
              <Toggle checked={notifPrefs.sms_enabled} onChange={(v) => updateNotif({ sms_enabled: v })} label="SMS" />
              <Toggle checked={notifPrefs.push_enabled} onChange={(v) => updateNotif({ push_enabled: v })} label="Push" />
              <div className="cc-field-label" style={{ marginTop: 10 }}>Mute specific categories</div>
              <div className="cc-cat-chips">
                {(notifPrefs.categories || []).map((cat) => (
                  <button
                    key={cat}
                    className={"cc-chip" + (notifPrefs.muted_categories.includes(cat) ? "" : " cc-chip-active")}
                    onClick={() => toggleCategory(cat)}
                  >
                    {CATEGORY_LABEL[cat] || cat}
                  </button>
                ))}
              </div>
              <div className="cc-empty-hint" style={{ marginTop: 6 }}>Highlighted = notifying. Tap to mute a category.</div>
            </>
          )}
        </section>

        <section className="cc-settings-section">
          <h4><FiUserX size={14} /> Blocked users</h4>
          {blocked === null ? (
            <Spinner />
          ) : blocked.length === 0 ? (
            <EmptyState title="No one is blocked" />
          ) : (
            blocked.map((b) => (
              <div className="cc-blocked-row" key={b.target_id}>
                <Avatar name={b.name} identity={b.target_id} size={30} />
                <span className="cc-blocked-name">{b.name}</span>
                <button className="cc-btn-secondary" onClick={() => unblock(b.target_kind, b.target_id)}>Unblock</button>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
