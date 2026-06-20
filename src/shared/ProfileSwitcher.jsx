/* shared/ProfileSwitcher.jsx
 * ─────────────────────────────────────────────────────────────────────────
 * Drop-in header widget for all three apps. Shows the active identity and a
 * dropdown to switch between learner profiles and teacher mode.
 *
 * Behaviour (per product rules):
 *   - Learner profiles: tap to switch. PIN prompt inline if the profile has one.
 *   - "Switch to teaching":
 *       · teacher identity exists  → prompt for the TEACHER password, then switch
 *       · no teacher identity yet  → route to teacher signup
 *   - "Switch to learning" (from teacher mode) → opens the learner picker.
 *   - Cross-subdomain: switching writes the shared cookie; other tabs reflect it
 *     on their next load (Option A — one active context everywhere).
 *
 * Props:
 *   teacherSignupUrl  — where to send users with no teacher identity
 *   learnUrl / teachUrl — where to land after switching (defaults to current host)
 */
import { useState } from "react";
import { useAuth } from "./AuthContext";

const initial = (name) => (name || "?").trim().charAt(0).toUpperCase();

function Avatar({ profile, size = 34 }) {
  const s = { width: size, height: size };
  if (profile?.avatar_type === "image" && profile?.avatar)
    return <img className="ps-avatar" style={s} src={profile.avatar} alt="" />;
  return (
    <div className="ps-avatar ps-avatar-fallback" style={s}>
      {profile?.avatar_type === "emoji" && profile?.avatar ? profile.avatar : initial(profile?.display_name)}
    </div>
  );
}

export default function ProfileSwitcher({
  teacherSignupUrl,
  learnUrl,
  teachUrl,
}) {
  const {
    profiles, teacherInfo, context, activeProfile, isTeacherContext,
    selectProfile, enterTeacherMode, logout, user,
  } = useAuth();

  const [open, setOpen] = useState(false);
  const [pinFor, setPinFor] = useState(null);
  const [pin, setPin] = useState("");
  const [askTeacherPw, setAskTeacherPw] = useState(false);
  const [teacherPw, setTeacherPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const go = (url) => { window.location.href = url || window.location.origin; };

  const chooseLearner = async (p) => {
    setError("");
    if (p.requires_pin && pinFor !== p.id) { setPinFor(p.id); setPin(""); return; }
    setBusy(true);
    try {
      await selectProfile(p.id, p.requires_pin ? pin : undefined);
      go(learnUrl);
    } catch (e) { setError(e?.message || "Could not open that profile."); setBusy(false); }
  };

  const clickTeach = async () => {
    setError("");
    // No teacher identity → route to signup.
    if (!teacherInfo) { go(teacherSignupUrl); return; }
    setAskTeacherPw(true);
  };

  const confirmTeach = async () => {
    setBusy(true); setError("");
    try {
      const res = await enterTeacherMode(teacherPw);
      if (res?.needsSignup) { go(teacherSignupUrl); return; }
      if (res?.notApproved) { setError("Your teacher account is awaiting approval."); setBusy(false); return; }
      go(teachUrl);
    } catch (e) { setError(e?.message || "Could not enter teacher mode."); setBusy(false); }
  };

  const current = isTeacherContext
    ? { display_name: (user?.username || "Teacher"), label: "Teaching" }
    : { ...(activeProfile || {}), label: activeProfile?.display_name || "Select profile" };

  return (
    <div className="ps-root">
      <button className="ps-trigger" onClick={() => setOpen((o) => !o)}>
        <Avatar profile={isTeacherContext ? null : activeProfile} />
        <span className="ps-trigger-text">
          <span className="ps-name">{current.label}</span>
          <span className="ps-sub">{isTeacherContext ? "Teacher mode" : "Learner"}</span>
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
      </button>

      {open && (
        <div className="ps-menu" role="menu">
          <div className="ps-section-label">Learner profiles</div>
          {profiles.map((p) => (
            <div key={p.id} className="ps-item-wrap">
              <button
                className={"ps-item" + (!isTeacherContext && activeProfile?.id === p.id ? " ps-item-active" : "")}
                onClick={() => chooseLearner(p)}
                disabled={busy}
              >
                <Avatar profile={p} size={28} />
                <span>{p.display_name}</span>
                {p.relationship === "DEPENDENT" && <span className="ps-tag">child</span>}
                {p.requires_pin && <span className="ps-lock">🔒</span>}
              </button>
              {pinFor === p.id && (
                <div className="ps-pin">
                  <input
                    type="password" inputMode="numeric" placeholder="PIN"
                    value={pin} onChange={(e) => setPin(e.target.value)} autoFocus
                  />
                  <button onClick={() => chooseLearner(p)} disabled={busy}>Enter</button>
                </div>
              )}
            </div>
          ))}

          <div className="ps-divider" />

          {isTeacherContext ? (
            <button className="ps-item" onClick={() => setOpen(true)} disabled={busy}>
              ↩ Switch to learning
            </button>
          ) : (
            <button className="ps-item ps-teach" onClick={clickTeach} disabled={busy}>
              🎓 {teacherInfo ? "Switch to teaching" : "Become a teacher"}
            </button>
          )}

          {askTeacherPw && (
            <div className="ps-pin">
              <input
                type="password" placeholder="Teacher password"
                value={teacherPw} onChange={(e) => setTeacherPw(e.target.value)} autoFocus
              />
              <button onClick={confirmTeach} disabled={busy}>Teach</button>
            </div>
          )}

          <div className="ps-divider" />
          <button className="ps-item ps-logout" onClick={logout}>Log out</button>

          {error && <div className="ps-error">{error}</div>}
        </div>
      )}
    </div>
  );
}
