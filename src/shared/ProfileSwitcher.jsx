/**
 * ProfileSwitcher.jsx  ·  src/shared/ProfileSwitcher.jsx
 * ──────────────────────────────────────────────────────────────────
 * Dashboard avatar dropdown — styled to match the Auth Flow prototype's
 * `rd-prof` menu: a round avatar trigger that opens a card with the
 * account header, a "Switch profile · same email" list (tick on the
 * active one), an optional Teaching entry, and a menu footer
 * (Manage profiles / Global settings / Log out).
 *
 * Data wiring is unchanged — profiles, active profile, teacher identity,
 * PIN + account-password confirms all come from useAuth().
 */
import { useState, useRef, useEffect } from "react";
import {
  RiGroupLine, RiLogoutBoxRLine, RiCheckLine, RiLockLine, RiSettings3Line,
} from "react-icons/ri";
import { useAuth } from "../contexts/AuthContext";
import "./ProfileSwitcher.css";
import SettingsModal from "./SettingsModal";

const DEFAULT_EMOJI = "📚";
const initials = (name) =>
  (name || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

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

/* ── PIN modal (unchanged behaviour) ── */
function PinModal({ profile, onConfirm, onCancel, loading, error }) {
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
        <button className="ps-modal__cancel" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/* ── Account-password confirm (enter teacher mode) ── */
function PasswordModal({ onConfirm, onCancel, loading, error }) {
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="ps-modal-overlay" onClick={onCancel}>
      <div className="ps-modal" onClick={(e) => e.stopPropagation()}>
        <span className="ps-av ps-av--emoji" style={{ width: 56, height: 56, fontSize: 28 }}>🎓</span>
        <h3 className="ps-modal__title">Enter teacher mode</h3>
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
export default function ProfileSwitcher({ teacherSignupUrl, learnUrl, teachUrl }) {
  const {
    user, profiles, activeProfile, teacherInfo,
    isTeacherContext, selectProfile, enterTeacherMode, logout,
  } = useAuth();

  const [open, setOpen] = useState(false);
  const [pinTarget, setPinTarget] = useState(null);
  const [showPwModal, setShowPwModal] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("profile");
  const openSettings = (t) => { setOpen(false); setSettingsTab(t); setSettingsOpen(true); };
  const [modalError, setModalError] = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const closeAll = () => { setOpen(false); setPinTarget(null); setShowPwModal(false); setModalError(""); };

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

  const handleTeacherClick = () => { setOpen(false); setModalError(""); setShowPwModal(true); };
  const doEnterTeacher = async (password) => {
    setModalLoading(true); setModalError("");
    try {
      const result = await enterTeacherMode(password);
      if (result.ok) { closeAll(); if (teachUrl) window.location.href = teachUrl; return; }
      if (result.needsSignup) { closeAll(); if (teacherSignupUrl) window.location.href = teacherSignupUrl; return; }
      if (result.notApproved) { setModalError("Your teacher account is awaiting admin approval."); return; }
    } catch (err) { setModalError(err.message || "Incorrect password."); }
    finally { setModalLoading(false); }
  };

  const accountName = activeProfile?.display_name || user?.username || "Account";
  const accountEmail = user?.email || "";
  const teacherLabel = teacherInfo?.type === "GUEST" ? "Expert teacher" : "Faculty";
  const subFor = (p) => (p.relationship === "DEPENDENT" ? "Child profile" : "Primary");

  return (
    <>
      <div className="ps-root" ref={ref}>
        <button
          className={`ps-avatar-btn ${isTeacherContext ? "ps-avatar-btn--teacher" : ""}`}
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu" aria-expanded={open} title="Account & profiles"
        >
          {isTeacherContext ? "🎓" : initials(accountName)}
        </button>

        {open && (
          <div className="ps-prof" role="menu">
            <div className="ps-prof-head">
              <div className="ps-prof-head__av">{isTeacherContext ? "🎓" : initials(accountName)}</div>
              <div className="ps-prof-head__txt">
                <div className="ps-prof-head__nm">{isTeacherContext ? "Teacher mode" : accountName}</div>
                {accountEmail && <div className="ps-prof-head__em">{accountEmail}</div>}
              </div>
            </div>

            <div className="ps-prof-sec">Switch profile · same email</div>
            {profiles.map((p) => {
              const active = !isTeacherContext && activeProfile?.id === p.id;
              return (
                <button key={p.id} className={`ps-prof-item ${active ? "active" : ""}`}
                  onClick={() => handleSelectProfile(p)} role="menuitem">
                  <Avatar profile={p} size={26} />
                  <div className="ps-prof-item__txt">
                    <div className="ps-prof-item__nm">{p.display_name}</div>
                    <div className="ps-prof-item__sub">{subFor(p)}</div>
                  </div>
                  {p.requires_pin && <RiLockLine className="ps-prof-item__lock" />}
                  {active && <span className="ps-prof-item__tick"><RiCheckLine /></span>}
                </button>
              );
            })}

            {teacherInfo && (
              <>
                <div className="ps-prof-sec">Teaching</div>
                <button
                  className={`ps-prof-item ${isTeacherContext ? "active" : ""}`}
                  onClick={isTeacherContext ? undefined : handleTeacherClick}
                  disabled={isTeacherContext} role="menuitem"
                >
                  <span className="ps-prof-item__av ps-prof-item__av--teacher">🎓</span>
                  <div className="ps-prof-item__txt">
                    <div className="ps-prof-item__nm">{teacherLabel}</div>
                    <div className="ps-prof-item__sub">
                      {isTeacherContext ? "Current mode" : "Switch to teaching"}
                    </div>
                  </div>
                  {isTeacherContext && <span className="ps-prof-item__tick"><RiCheckLine /></span>}
                </button>
              </>
            )}

            <div className="ps-prof-menu">
              <button className="ps-mi" onClick={() => openSettings("profile")} role="menuitem">
                <RiGroupLine /> Manage profiles
              </button>
              <button className="ps-mi" onClick={() => openSettings("account")} role="menuitem">
                <RiSettings3Line /> Global settings
              </button>
              <button className="ps-mi ps-mi--logout" onClick={logout} role="menuitem">
                <RiLogoutBoxRLine /> Log out
              </button>
            </div>
          </div>
        )}
      </div>

      {pinTarget && (
        <PinModal profile={pinTarget}
          onConfirm={(pin) => doSelect(pinTarget.id, pin)}
          onCancel={() => { setPinTarget(null); setModalError(""); }}
          loading={modalLoading} error={modalError} />
      )}
      {showPwModal && (
        <PasswordModal onConfirm={doEnterTeacher}
          onCancel={() => { setShowPwModal(false); setModalError(""); }}
          loading={modalLoading} error={modalError} />
      )}

      <SettingsModal open={settingsOpen} tab={settingsTab} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
