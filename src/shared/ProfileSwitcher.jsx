/**
 * ProfileSwitcher.jsx  ·  goes in src/shared/ProfileSwitcher.jsx
 * ──────────────────────────────────────────────────────────────────
 * Drop-in replacement for student and teacher dashboard headers.
 * Already imported by the existing Header.jsx files as:
 *   import ProfileSwitcher from "../shared/ProfileSwitcher"
 *   import "../shared/ProfileSwitcher.css"
 *
 * REFACTORED: teacher mode is confirmed with the account password
 * (same password used to log in). No separate teacher password.
 *
 * Props (all optional — the component reads from useAuth):
 *   teacherSignupUrl  URL to send users who have no teacher identity
 *   learnUrl          URL of the student dashboard (for learn switch)
 *   teachUrl          URL of the teacher dashboard (for teach switch)
 */
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import "./ProfileSwitcher.css";
import { HOME_URL } from "../config/urls";

const DEFAULT_EMOJI = "📚";

/* ── Avatar ── */
function Avatar({ profile, size = 36 }) {
  const style = { width: size, height: size };
  if (!profile) {
    return (
      <span className="ps-avatar ps-avatar--emoji" style={style}>
        {DEFAULT_EMOJI}
      </span>
    );
  }
  if (profile.avatar_type === "image" && profile.avatar) {
    return <img src={profile.avatar} alt={profile.display_name} className="ps-avatar ps-avatar--img" style={style} />;
  }
  return (
    <span className="ps-avatar ps-avatar--emoji" style={style}>
      {(profile.avatar_type === "emoji" && profile.avatar) || DEFAULT_EMOJI}
    </span>
  );
}

/* ── PIN modal (4 digits) ── */
function PinModal({ profile, onConfirm, onCancel, loading, error }) {
  const [pin, setPin] = useState("");
  const inputs = useRef([]);

  useEffect(() => { inputs.current[0]?.focus(); }, []);

  const handleKey = (i, e) => {
    if (e.key === "Backspace") {
      if (pin[i]) {
        setPin(pin.slice(0, i) + pin.slice(i + 1));
      } else if (i > 0) {
        inputs.current[i - 1]?.focus();
        setPin(pin.slice(0, i - 1) + pin.slice(i));
      }
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
              value={pin[i] || ""}
              onChange={(e) => handleChange(i, e)}
              onKeyDown={(e) => handleKey(i, e)}
              className="ps-pin__cell" />
          ))}
        </div>
        {error && <p className="ps-modal__error">{error}</p>}
        {loading && <p className="ps-modal__sub">Checking…</p>}
        <button className="ps-modal__cancel" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/* ── Account password confirm modal (for teacher context) ── */
function PasswordModal({ onConfirm, onCancel, loading, error }) {
  const [pw, setPw]   = useState("");
  const [show, setShow] = useState(false);
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);

  return (
    <div className="ps-modal-overlay" onClick={onCancel}>
      <div className="ps-modal" onClick={(e) => e.stopPropagation()}>
        <span className="ps-avatar ps-avatar--emoji" style={{ width: 56, height: 56, fontSize: 28 }}>🎓</span>
        <h3 className="ps-modal__title">Enter teacher mode</h3>
        <p className="ps-modal__sub">Confirm your account password</p>
        <div className="ps-pw-wrap">
          <input ref={ref} type={show ? "text" : "password"} value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="ps-pw-input" placeholder="Password"
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

/* ── Main component ── */
export default function ProfileSwitcher({
  teacherSignupUrl,
  learnUrl,
  teachUrl,
}) {
  const {
    profiles, activeProfile, teacherInfo,
    context, isTeacherContext,
    selectProfile, enterTeacherMode, logout,
  } = useAuth();

  const [open,         setOpen]         = useState(false);
  const [pinTarget,    setPinTarget]    = useState(null);
  const [showPwModal,  setShowPwModal]  = useState(false);
  const [modalError,   setModalError]   = useState("");
  const [modalLoading, setModalLoading] = useState(false);

  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const closeAll = () => {
    setOpen(false); setPinTarget(null); setShowPwModal(false); setModalError("");
  };

  /* pick a learner profile */
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
    } catch (err) {
      setModalError(err.message || "Wrong PIN.");
    } finally {
      setModalLoading(false);
    }
  };

  /* enter teacher mode */
  const handleTeacherClick = () => { setOpen(false); setModalError(""); setShowPwModal(true); };

  const doEnterTeacher = async (password) => {
    setModalLoading(true); setModalError("");
    try {
      const result = await enterTeacherMode(password);
      if (result.ok) {
        closeAll();
        if (teachUrl) window.location.href = teachUrl;
        return;
      }
      if (result.needsSignup) {
        closeAll();
        if (teacherSignupUrl) window.location.href = teacherSignupUrl;
        return;
      }
      if (result.notApproved) {
        setModalError("Your teacher account is awaiting admin approval.");
        return;
      }
    } catch (err) {
      setModalError(err.message || "Incorrect password.");
    } finally {
      setModalLoading(false);
    }
  };

  /* display */
  const displayName = isTeacherContext
    ? "Teacher mode"
    : (activeProfile?.display_name || "Select profile");

  return (
    <>
      <div className="ps-root" ref={ref}>
        <button
          className={`ps-trigger ${isTeacherContext ? "ps-trigger--teacher" : ""}`}
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          {isTeacherContext
            ? <span className="ps-avatar ps-avatar--emoji" style={{ width: 32, height: 32, fontSize: 16 }}>🎓</span>
            : <Avatar profile={activeProfile} size={32} />
          }
          <span className="ps-trigger__name">{displayName}</span>
          <span className="ps-trigger__caret">{open ? "▲" : "▼"}</span>
        </button>

        {open && (
          <div className="ps-dropdown" role="listbox">
            <p className="ps-dropdown__section-label">Learner profiles</p>
            {profiles.map((p) => (
              <button key={p.id}
                className={`ps-dropdown__item ${!isTeacherContext && activeProfile?.id === p.id ? "ps-dropdown__item--active" : ""}`}
                onClick={() => handleSelectProfile(p)}
                role="option"
                aria-selected={!isTeacherContext && activeProfile?.id === p.id}
              >
                <Avatar profile={p} size={28} />
                <span className="ps-dropdown__item-name">{p.display_name}</span>
                {p.requires_pin && <span className="ps-dropdown__lock">🔒</span>}
                {!isTeacherContext && activeProfile?.id === p.id && <span className="ps-dropdown__check">✓</span>}
              </button>
            ))}

            {teacherInfo && (
              <>
                <div className="ps-dropdown__divider" />
                <p className="ps-dropdown__section-label">Teacher</p>
                <button
                  className={`ps-dropdown__item ps-dropdown__item--teacher ${isTeacherContext ? "ps-dropdown__item--active" : ""}`}
                  onClick={isTeacherContext ? undefined : handleTeacherClick}
                  disabled={isTeacherContext}
                  role="option"
                >
                  <span className="ps-avatar ps-avatar--emoji" style={{ width: 28, height: 28, fontSize: 14 }}>🎓</span>
                  <span className="ps-dropdown__item-name">
                    {teacherInfo.type === "GUEST" ? "Expert teacher" : "Faculty"}
                  </span>
                  {isTeacherContext && <span className="ps-dropdown__check">✓</span>}
                </button>
              </>
            )}

            <div className="ps-dropdown__divider" />
            <a
              className="ps-dropdown__item ps-dropdown__item--manage"
              href={`${HOME_URL}/manage-profiles`}
            >
              <span className="ps-dropdown__item-icon">⚙</span>
              <span className="ps-dropdown__item-name">Manage profiles</span>
            </a>
            <button className="ps-dropdown__item ps-dropdown__item--logout" onClick={logout}>
              <span className="ps-dropdown__item-icon">↩</span> Sign out
            </button>
          </div>
        )}
      </div>

      {pinTarget && (
        <PinModal
          profile={pinTarget}
          onConfirm={(pin) => doSelect(pinTarget.id, pin)}
          onCancel={() => { setPinTarget(null); setModalError(""); }}
          loading={modalLoading}
          error={modalError}
        />
      )}

      {showPwModal && (
        <PasswordModal
          onConfirm={doEnterTeacher}
          onCancel={() => { setShowPwModal(false); setModalError(""); }}
          loading={modalLoading}
          error={modalError}
        />
      )}
    </>
  );
}
