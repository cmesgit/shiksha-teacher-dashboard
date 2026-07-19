/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  GENERATED FILE — DO NOT EDIT HERE.                                         │
 * │  Canonical source: <workspace>/shared/src/shared/ProfileSwitcher.jsx        │
 * │  Edit the canonical copy, then run `npm run sync:shared` (any app) to        │
 * │  propagate. `npm run check:shared` fails if an app's copy has drifted.       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ProfileSwitcher — the account avatar dropdown shared by shiksha-frontend,
 * shiksha-teacher-dashboard and shiksha-student-dashboard.
 *
 * Structure: a pill trigger (avatar + name + context chip) that opens a card
 * with the Account header, Learn/Faculty/Expert context pills, a "Switch
 * profile · same email" list (tick on the active Profile), a "Teaching
 * tracks" list with one entry PER approved/pending Track (Academy Teacher /
 * Skill-Dev Teacher) or an empty-state "Become a teacher" invite, an optional
 * per-app Quick actions grid, and a footer (Manage profiles / Global settings
 * / Log out).
 *
 * Terminology (keep consistent — no "mode" / "context" in labels):
 *   Account · Profile · Track · Faculty (Academy) · Expert (Skill-Dev).
 *
 * Track data comes from useAuth().teacherInfo.tracks = { academy, skill }, each
 * "locked" | "pending" | "approved" (backend contract). Entering a Track from a
 * non-teaching context re-confirms the account password via enterTeacherMode(
 * password, track); flipping between two already-held Tracks while teaching uses
 * switchTrack(track) with no password. Locked tracks are never surfaced here —
 * they're invisible until applied for (Settings → Teacher identity), matching
 * the app-wide rule that a rejected/locked track isn't a switch target.
 *
 * `quickActions` (optional prop, array of { icon, label, onClick }) lets each
 * app supply its own real destinations — the three apps have different route
 * trees (student: "/my-courses", teacher: "/teacher/classes", frontend: cross-
 * app links), so this component doesn't hardcode any of them. Omit the prop
 * (or pass []) to hide the Quick actions section entirely.
 */
import { useState, useRef, useEffect } from "react";
import {
  RiGroupLine, RiLogoutBoxRLine, RiCheckLine, RiLockLine, RiSettings3Line,
  RiArrowDownSLine, RiAddLine,
} from "react-icons/ri";
import { useAuth } from "../contexts/AuthContext";
import "./ProfileSwitcher.css";
import SettingsModal from "./SettingsModal";

const DEFAULT_EMOJI = "📚";
const initials = (name) =>
  (name || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

/* ── Teaching-track catalogue ──
 * The two teaching identities an account can hold, surfaced as distinct entries.
 * `role` is the user-facing identity name (Faculty / Expert); `dest` is the
 * landing path within the teacher app after the switch. `accent`/`tint` give
 * each track its own identity color in pills, badges and icon tiles. */
const TRACKS = [
  { key: "academy", label: "Academy Teacher",   role: "Faculty", emoji: "🎓", dest: "/teacher/dashboard",       accent: "#425f7f", tint: "rgba(66,95,127,.14)" },
  { key: "skill",   label: "Skill-Dev Teacher", role: "Expert",  emoji: "⚡", dest: "/teacher/expert/profile", accent: "#b45309", tint: "rgba(180,83,9,.12)" },
];
const trackByKey = (key) => TRACKS.find((t) => t.key === key);
const trackLabel = (key) => trackByKey(key)?.label || "Teaching";

const LEARN_ACCENT = "#015865";
const LEARN_TINT   = "rgba(19,137,155,.13)";

/* ── Avatar (image / emoji / initials) ── */
function Avatar({ profile, size = 36, fallback }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };
  if (profile?.avatar_type === "image" && profile.avatar) {
    return <img src={profile.avatar} alt="" className="ps-av ps-av--img" style={style} />;
  }
  if (profile?.avatar_type === "emoji" && profile.avatar) {
    return <span className="ps-av ps-av--emoji" style={style}>{profile.avatar}</span>;
  }
  return <span className="ps-av ps-av--initials" style={style}>{fallback || initials(profile?.display_name) || DEFAULT_EMOJI}</span>;
}

/* ── PIN modal (with account-password "forgot PIN" escape hatch) ── */
function PinModal({ profile, onConfirm, onCancel, onForgot, loading, error }) {
  const [pin, setPin] = useState("");
  const inputs = useRef([]);
  useEffect(() => { inputs.current[0]?.focus(); }, []);
  const handleKey = (i, e) => {
    if (e.key === "Backspace") {
      if (pin[i]) setPin(pin.slice(0, i) + pin.slice(i + 1));
      else if (i > 0) { inputs.current[i - 1]?.focus(); setPin(pin.slice(0, i - 1) + pin.slice(i)); }
    }
  };
  const handleChange = (i, e) => {
    const ch = e.target.value.replace(/\D/g, "").slice(-1);
    const next = pin.slice(0, i) + ch + pin.slice(i + 1);
    setPin(next);
    if (ch && i < 3) inputs.current[i + 1]?.focus();
    if (next.length === 4) onConfirm(next);
  };
  return (
    <div className="ps-modal-overlay" onClick={onCancel}>
      <div className="ps-modal" onClick={(e) => e.stopPropagation()}>
        <Avatar profile={profile} size={56} />
        <h3 className="ps-modal__title">{profile.display_name}</h3>
        <p className="ps-modal__sub">Enter PIN</p>
        <div className={`ps-pin ${error ? "ps-pin--error" : ""}`}>
          {[0,1,2,3].map((i) => (
            <input key={i} ref={(el) => (inputs.current[i] = el)}
              type="password" inputMode="numeric" maxLength={1}
              value={pin[i] || ""} onChange={(e) => handleChange(i, e)}
              onKeyDown={(e) => handleKey(i, e)} className="ps-pin__cell" />
          ))}
        </div>
        {error && <p className="ps-modal__error">{error}</p>}
        {loading && <p className="ps-modal__sub">Checking…</p>}
        {onForgot && (
          <button type="button" className="ps-modal__link" onClick={onForgot}>
            Forgot PIN?
          </button>
        )}
        <button className="ps-modal__cancel" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/* ── Reset PIN via account password (forgot-PIN path — no old PIN needed) ── */
function ResetPinModal({ profile, onConfirm, onCancel, loading, error }) {
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const submit = () => {
    if (!/^\d{4,6}$/.test(pin)) return;
    if (!password) return;
    onConfirm(pin, password);
  };
  return (
    <div className="ps-modal-overlay" onClick={onCancel}>
      <div className="ps-modal" onClick={(e) => e.stopPropagation()}>
        <Avatar profile={profile} size={56} />
        <h3 className="ps-modal__title">{profile.display_name}</h3>
        <p className="ps-modal__sub">Reset PIN with your account password</p>
        <div className="ps-pw-wrap">
          <input ref={ref} className="ps-pw-input" inputMode="numeric" maxLength={6}
            placeholder="New 4–6 digit PIN" value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
        </div>
        <div className="ps-pw-wrap">
          <input className="ps-pw-input" type="password" autoComplete="current-password"
            placeholder="Account password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
        </div>
        {error && <p className="ps-modal__error">{error}</p>}
        {loading && <p className="ps-modal__sub">Saving…</p>}
        <button className="ps-modal__confirm" onClick={submit}
          disabled={loading || !/^\d{4,6}$/.test(pin) || !password}>
          Reset &amp; continue
        </button>
        <button className="ps-modal__cancel" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/* ── Account-password confirm (enter a teaching track) ── */
function PasswordModal({ title, onConfirm, onCancel, loading, error }) {
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="ps-modal-overlay" onClick={onCancel}>
      <div className="ps-modal" onClick={(e) => e.stopPropagation()}>
        <span className="ps-av ps-av--emoji" style={{ width: 56, height: 56, fontSize: 28 }}>🎓</span>
        <h3 className="ps-modal__title">{title || "Enter teaching track"}</h3>
        <p style={{ fontSize: 12, color: "#8a8a8a", margin: "4px 0 10px", lineHeight: 1.5 }}>
          For security, enter your <b>account login password</b> (the one you use to sign in to ShikshaCom).
        </p>
        <p className="ps-modal__sub">Confirm your account password</p>
        <div className="ps-pw-wrap">
          <input ref={ref} type={show ? "text" : "password"} value={pw}
            onChange={(e) => setPw(e.target.value)} className="ps-pw-input" placeholder="Password"
            onKeyDown={(e) => e.key === "Enter" && pw && onConfirm(pw)} />
          <button type="button" className="ps-pw-eye" onClick={() => setShow((v) => !v)}>
            {show ? "🙈" : "👁️"}
          </button>
        </div>
        {error && <p className="ps-modal__error">{error}</p>}
        <button className="ps-modal__confirm" onClick={() => onConfirm(pw)} disabled={loading || !pw}>
          {loading ? "Entering…" : "Continue"}
        </button>
        <button className="ps-modal__cancel" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/* ── Main ── */
export default function ProfileSwitcher({ teacherSignupUrl, learnUrl, teachUrl, quickActions = [] }) {
  const {
    user, profiles, activeProfile, teacherInfo,
    isTeacherContext, selectProfile, setProfilePin, enterTeacherMode, switchTrack, logout,
  } = useAuth();

  const [open, setOpen] = useState(false);
  const [pinTarget, setPinTarget] = useState(null);
  const [forgotTarget, setForgotTarget] = useState(null);  // reset-PIN-via-password
  const [showPwModal, setShowPwModal] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("profile");
  const openSettings = (t) => { setOpen(false); setSettingsTab(t); setSettingsOpen(true); };
  const [modalError, setModalError] = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const ref = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Esc closes the panel and returns focus to the trigger (outside-click
  // already lands focus naturally on whatever was clicked).
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const closeAll = () => { setOpen(false); setPinTarget(null); setForgotTarget(null); setShowPwModal(false); setModalError(""); };

  // Forgot PIN → reset with the account password (no old PIN), then switch in.
  const doResetPin = async (newPin, password) => {
    setModalLoading(true); setModalError("");
    try {
      await setProfilePin(forgotTarget.id, newPin, password);
      const id = forgotTarget.id;
      setForgotTarget(null);
      await doSelect(id, newPin);
    } catch (err) {
      setModalError(err.message || "Could not reset PIN.");
    } finally { setModalLoading(false); }
  };

  const handleSelectProfile = (p) => {
    setOpen(false);
    if (p.requires_pin) { setModalError(""); setPinTarget(p); }
    else doSelect(p.id, "");
  };
  const doSelect = async (id, pin) => {
    setModalLoading(true); setModalError("");
    try {
      await selectProfile(id, pin || undefined);
      closeAll();
      if (learnUrl && isTeacherContext) window.location.href = learnUrl;
    } catch (err) { setModalError(err.message || "Wrong PIN."); }
    finally { setModalLoading(false); }
  };

  // Destination after a successful track switch: resolve `dest` against the
  // teacher app origin (teachUrl), falling back to teachUrl itself.
  const destUrl = (dest) => {
    const base = teachUrl || "";
    if (!dest) return base;
    const origin = base ? new URL(base, window.location.href).origin : "";
    return origin + dest;
  };

  const [pendingTrack, setPendingTrack] = useState(null);
  const [pendingDest,  setPendingDest]  = useState("");

  // Entry point for a track button. From a non-teaching context we re-confirm
  // the account password; while already teaching we flip tracks password-free.
  const goToTrack = (track, dest) => {
    setOpen(false); setModalError("");
    if (isTeacherContext) { doSwitchTrack(track, dest); return; }
    setPendingTrack(track); setPendingDest(dest);
    setShowPwModal(true);
  };

  const doSwitchTrack = async (track, dest) => {
    try {
      const res = await switchTrack(track);
      if (res.ok) { closeAll(); window.location.href = destUrl(dest); }
    } catch { /* already-teaching flip failed (rare race) — leave view as-is */ }
  };

  const doEnterTeacher = async (password) => {
    setModalLoading(true); setModalError("");
    try {
      const result = await enterTeacherMode(password, pendingTrack || undefined);
      if (result.ok) { closeAll(); window.location.href = destUrl(pendingDest); return; }
      if (result.needsSignup) { closeAll(); if (teacherSignupUrl) window.location.href = teacherSignupUrl; return; }
      if (result.notApproved)  { setModalError("Your teacher account is awaiting admin approval."); return; }
      if (result.trackPending) { setModalError("This track is awaiting approval — you'll get access once it's reviewed."); return; }
      if (result.trackLocked)  { setModalError("This track isn't enabled on your account yet. Apply from Settings → Teacher identity."); return; }
    } catch (err) { setModalError(err.message || "Incorrect password."); }
    finally { setModalLoading(false); }
  };

  const accountName  = activeProfile?.display_name || user?.username || "Account";
  const accountEmail = user?.email || "";
  const activeTrackKey = teacherInfo?.active_track || null;
  const activeTrackDef = isTeacherContext ? trackByKey(activeTrackKey) : null;
  const teacherEmoji = activeTrackDef?.emoji || "🎓";
  const headerName   = isTeacherContext ? trackLabel(activeTrackKey) : accountName;
  const subFor = (p) => (p.relationship === "DEPENDENT" ? "Child profile" : "Primary");

  // Context accent (drives trigger + header chip + active pill color).
  const ctxAccent = activeTrackDef?.accent || LEARN_ACCENT;
  const ctxTint   = activeTrackDef?.tint   || LEARN_TINT;
  const ctxChip   = activeTrackDef?.role   || "Learner";

  // Tracks worth showing: the ones the account actually holds (approved or in
  // review). Locked tracks are hidden — the account can apply from Settings.
  const tracks = teacherInfo?.tracks || {};
  const heldTracks = teacherInfo
    ? TRACKS.filter((t) => tracks[t.key] === "approved" || tracks[t.key] === "pending")
    : [];
  const noTracks = heldTracks.length === 0;

  // "Learn" pill: jump back to the active (or default) learner profile. A no-op
  // while already learning — just closes the panel like any other pill tap.
  const clickLearnPill = () => {
    if (!isTeacherContext) { setOpen(false); return; }
    const fallback = profiles.find((p) => p.is_default) || profiles[0];
    const target = activeProfile || fallback;
    if (target) handleSelectProfile(target);
    else setOpen(false);
  };

  // Track pill: switches straight in when approved and not already active.
  // Pending tracks have nothing to do yet (badge in the list below explains
  // why) — same "wait for approval" rule the track-list rows already use.
  const clickTrackPill = (t) => {
    const status = tracks[t.key];
    const active = isTeacherContext && activeTrackKey === t.key;
    if (active) { setOpen(false); return; }
    if (status === "approved") goToTrack(t.key, t.dest);
    else setOpen(false);
  };

  return (
    <>
      <div className="ps-root" ref={ref}>
        <button
          ref={triggerRef}
          className={`ps-trigger ${open ? "ps-trigger--open" : ""}`}
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu" aria-expanded={open} title="Account & profiles"
        >
          <span className="ps-av ps-av--initials ps-trigger__av" style={{ background: ctxTint, color: ctxAccent }}>
            {isTeacherContext ? teacherEmoji : initials(accountName)}
          </span>
          <span className="ps-trigger__txt">
            <span className="ps-trigger__nm">{headerName}</span>
            <span className="ps-trigger__chip" style={{ color: ctxAccent }}>{ctxChip}</span>
          </span>
          <RiArrowDownSLine className="ps-trigger__chevron" />
        </button>

        {open && (
          <div className="ps-prof ps-scroll" role="menu">
            <div className="ps-prof-head">
              <span className="ps-prof-head__av" style={{ background: ctxAccent }}>
                {isTeacherContext ? teacherEmoji : initials(accountName)}
              </span>
              <div className="ps-prof-head__txt">
                <div className="ps-prof-head__nm">{headerName}</div>
                {accountEmail && <div className="ps-prof-head__em">{accountEmail}</div>}
              </div>
              <span className="ps-prof-head__chip" style={{ background: ctxTint, color: ctxAccent }}>{ctxChip}</span>
            </div>

            {!noTracks && (
              <div className="ps-pills">
                <button
                  className={`ps-pill ${!isTeacherContext ? "ps-pill--active" : ""}`}
                  style={!isTeacherContext ? { borderColor: LEARN_ACCENT, background: LEARN_TINT, color: LEARN_ACCENT } : undefined}
                  onClick={clickLearnPill}
                >
                  <span className="ps-pill__emoji">📚</span>
                  <span className="ps-pill__lbl">Learn</span>
                </button>
                {heldTracks.map((t) => {
                  const active = isTeacherContext && activeTrackKey === t.key;
                  return (
                    <button
                      key={t.key}
                      className={`ps-pill ${active ? "ps-pill--active" : ""}`}
                      style={active ? { borderColor: t.accent, background: t.tint, color: t.accent } : undefined}
                      onClick={() => clickTrackPill(t)}
                    >
                      <span className="ps-pill__emoji">{t.emoji}</span>
                      <span className="ps-pill__lbl">{t.role}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="ps-prof-sec">Switch profile · same email</div>
            {profiles.map((p) => {
              const active = !isTeacherContext && activeProfile?.id === p.id;
              return (
                <button key={p.id} className={`ps-prof-item ${active ? "active" : ""}`}
                  onClick={() => handleSelectProfile(p)} role="menuitem">
                  <Avatar profile={p} size={30} />
                  <div className="ps-prof-item__txt">
                    <div className="ps-prof-item__nm">{p.display_name}</div>
                    <div className="ps-prof-item__sub">{subFor(p)}</div>
                  </div>
                  {p.requires_pin && <RiLockLine className="ps-prof-item__lock" />}
                  {active && <span className="ps-prof-item__tick"><RiCheckLine /></span>}
                </button>
              );
            })}

            {!noTracks && (
              <>
                <div className="ps-prof-sec ps-prof-sec--divider">Teaching tracks</div>
                {heldTracks.map((t) => {
                  const status  = tracks[t.key];            // "approved" | "pending"
                  const active  = isTeacherContext && activeTrackKey === t.key;
                  const pending = status === "pending";
                  const disabled = active || pending;        // not a switch target
                  const badgeLabel = active ? "Active" : pending ? "Under review" : "Approved";
                  const badgeClass = active ? "ps-badge--active" : pending ? "ps-badge--pending" : "ps-badge--approved";
                  return (
                    <button
                      key={t.key}
                      className={`ps-prof-item ${active ? "active" : ""}`}
                      onClick={disabled ? undefined : () => goToTrack(t.key, t.dest)}
                      disabled={disabled}
                      role="menuitem"
                    >
                      <span className="ps-prof-item__av ps-prof-item__av--tile" style={{ background: t.tint, color: t.accent }}>
                        {t.emoji}
                      </span>
                      <div className="ps-prof-item__txt">
                        <div className="ps-prof-item__nm">{t.label}</div>
                        <div className="ps-prof-item__sub">
                          {active ? "Current track"
                            : pending ? `${t.role} · awaiting approval`
                            : t.role}
                        </div>
                      </div>
                      <span className={`ps-badge ${badgeClass}`}>{badgeLabel}</span>
                    </button>
                  );
                })}
              </>
            )}
            {noTracks && (
              <div className="ps-empty-tracks">
                <div className="ps-empty-tracks__emoji">🎓</div>
                <div className="ps-empty-tracks__title">No teaching tracks yet</div>
                <p className="ps-empty-tracks__body">
                  Teach academic classes as <b>Faculty</b> or run skill sessions as an <b>Expert</b> — all under this account.
                </p>
                <button className="ps-empty-tracks__cta" onClick={() => openSettings("account")}>
                  <RiAddLine /> Become a teacher
                </button>
              </div>
            )}

            {quickActions.length > 0 && (
              <>
                <div className="ps-prof-sec ps-prof-sec--divider">Quick actions</div>
                <div className="ps-qa-grid">
                  {quickActions.map((qa, i) => (
                    <button key={i} className="ps-qa" onClick={() => { setOpen(false); qa.onClick(); }}>
                      <span className="ps-qa__icon">{qa.icon}</span>
                      <span className="ps-qa__lbl">{qa.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="ps-prof-menu">
              <button className="ps-mi" onClick={() => openSettings("profile")} role="menuitem">
                <RiGroupLine /> Manage profiles
              </button>
              <button className="ps-mi" onClick={() => openSettings("account")} role="menuitem">
                <RiSettings3Line /> Global settings
              </button>
              <button className="ps-mi ps-mi--logout" onClick={() => logout()} role="menuitem">
                <RiLogoutBoxRLine /> Log out
              </button>
            </div>
          </div>
        )}
      </div>

      {pinTarget && (
        <PinModal profile={pinTarget}
          onConfirm={(pin) => doSelect(pinTarget.id, pin)}
          onForgot={() => { const t = pinTarget; setPinTarget(null); setModalError(""); setForgotTarget(t); }}
          onCancel={() => { setPinTarget(null); setModalError(""); }}
          loading={modalLoading} error={modalError} />
      )}
      {forgotTarget && (
        <ResetPinModal profile={forgotTarget}
          onConfirm={doResetPin}
          onCancel={() => { setForgotTarget(null); setModalError(""); }}
          loading={modalLoading} error={modalError} />
      )}
      {showPwModal && (
        <PasswordModal
          title={`Switch to ${trackLabel(pendingTrack)}`}
          onConfirm={doEnterTeacher}
          onCancel={() => { setShowPwModal(false); setModalError(""); }}
          loading={modalLoading} error={modalError} />
      )}

      <SettingsModal open={settingsOpen} tab={settingsTab} onClose={() => setSettingsOpen(false)}
        teacherSignupUrl={teacherSignupUrl} teachUrl={teachUrl}
        onManageTrack={(track, dest) => { setSettingsOpen(false); goToTrack(track, dest); }} />
    </>
  );
}
