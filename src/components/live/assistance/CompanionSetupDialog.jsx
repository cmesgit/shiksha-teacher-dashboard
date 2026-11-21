/* shared/src/components/live/assistance/CompanionSetupDialog.jsx — RC-011.
 * ─────────────────────────────────────────────────────────────────────────
 * Getting a companion paired, launched and bound to a display.
 *
 * 🔴 **Device state comes from the server, never from the browser guessing.**
 * frontend-ux: "status from server, no speculative localhost detection." A
 * probe of localhost to see whether the app is running would be a scanning
 * behaviour that security software flags, and it would lie confidently when
 * the app is up but not signed in.
 *
 * 🔴 **The browser cannot finish pairing.** `confirm` only records that the
 * right person typed the right code; `finalize` is device-only and demands a
 * physical confirmation on the machine. api-contracts.md: "no browser
 * finalize". So this dialog always ends by sending the user to their own
 * computer, and never says "Connected" on its own authority.
 *
 * 🔴 **Pairing confirmation names the ACCOUNT.** frontend-ux says so
 * explicitly: "Pairing confirmation names the account, not merely 'Device
 * connected'." Someone who pairs a companion to the wrong account has handed
 * their desktop to the wrong identity, and "Device connected" would not tell
 * them.
 *
 * 🔴 **Nothing here starts capture.** Binding a device only creates the
 * host binding in `awaiting_local_share`. The display is chosen natively, on
 * the host's own machine. "No browser API can cause unattended capture."
 */
import React, { useCallback, useEffect, useRef, useState } from "react";

import collaboration from "../../../api/collaborationService";
import { useAssistance } from "./AssistanceProvider";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

function Shell({ titleId, onClose, initialFocusRef, children }) {
  const ref = useRef(null);
  const returnTo = useRef(null);

  useEffect(() => {
    returnTo.current = document.activeElement;
    const t = window.setTimeout(() => initialFocusRef?.current?.focus(), 0);
    return () => {
      window.clearTimeout(t);
      const el = returnTo.current;
      if (el && typeof el.focus === "function" && document.contains(el)) el.focus();
    };
  }, [initialFocusRef]);

  const onKeyDown = useCallback((e) => {
    if (e.key === "Escape") { e.preventDefault(); onClose?.(); return; }
    if (e.key !== "Tab") return;
    const nodes = ref.current ? Array.from(ref.current.querySelectorAll(FOCUSABLE)) : [];
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }, [onClose]);

  return (
    <div className="sa-backdrop">
      <div
        ref={ref}
        className="sa-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </div>
  );
}

export function CompanionSetupDialog({ onClose, bindingId }) {
  const closeRef = useRef(null);
  const { actions } = useAssistance();

  const [devices, setDevices] = useState(null);     // null = not loaded yet
  const [loadError, setLoadError] = useState(null);
  const [code, setCode] = useState("");
  const [paired, setPaired] = useState(null);       // confirm response
  const [busy, setBusy] = useState(false);
  const [bindError, setBindError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await collaboration.listDevices();
      setDevices(res?.devices || []);
      setLoadError(null);
    } catch (err) {
      // 404 means the feature is off, which is not an error worth showing a
      // learner mid-lesson; the provider already treats it as absence.
      setDevices([]);
      if (!err?.unavailable) setLoadError(err);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submitCode = useCallback(async (e) => {
    e.preventDefault();
    const value = code.trim();
    if (!value) return;
    setBusy(true);
    try {
      const res = await collaboration.confirmPairing(value);
      setPaired(res);
      setCode("");
      load();
    } catch (err) {
      setLoadError(err);
    } finally {
      setBusy(false);
    }
  }, [code, load]);

  const bind = useCallback(async (deviceId) => {
    if (!bindingId) return;
    setBusy(true);
    setBindError(null);
    try {
      await collaboration.createHostBinding(bindingId, deviceId);
      await actions.refresh();
      onClose?.();
    } catch (err) {
      setBindError(err);
    } finally {
      setBusy(false);
    }
  }, [bindingId, actions, onClose]);

  const titleId = "sa-setup-title";
  const online = (devices || []).filter((d) => d.online);
  const offline = (devices || []).filter((d) => !d.online);

  return (
    <Shell titleId={titleId} onClose={onClose} initialFocusRef={closeRef}>
      <h2 id={titleId} className="sa-title">Remote assistance setup</h2>

      {paired ? (
        /* Names the account, the device and the verification phrase — all
         * three, because the phrase is what the user matches against what
         * their own machine is showing, and the account is what tells them
         * they paired to the right identity. */
        <div className="sa-paired" role="status">
          <p className="sa-body">
            Code accepted for <strong>{paired.device_name}</strong>
            {paired.platform ? ` (${paired.platform})` : ""}.
          </p>
          <p className="sa-body">
            This will be linked to the account{" "}
            <strong>{paired.account_display_name || "you are signed in as"}</strong>.
          </p>
          {paired.verification_phrase ? (
            <p className="sa-phrase">
              Check your computer shows: <strong>{paired.verification_phrase}</strong>
            </p>
          ) : null}
          <p className="sa-note">
            Pairing is not finished yet. Confirm on your computer to complete it.
          </p>
        </div>
      ) : null}

      {devices === null ? (
        <p className="sa-body" aria-live="polite">Checking for your devices…</p>
      ) : null}

      {devices !== null && devices.length === 0 && !paired ? (
        <div>
          <p className="sa-body">
            No companion app is linked to your account yet. Remote assistance
            needs it installed on the computer you want to share — ordinary
            screen sharing, audio, video and chat keep working without it.
          </p>
          <ol className="sa-steps">
            <li>Install the official Shiksha companion app on that computer.</li>
            <li>Open it and sign in.</li>
            <li>Type the code it shows below.</li>
          </ol>
        </div>
      ) : null}

      {online.length > 0 ? (
        <section>
          <h3 className="sa-subtitle">Your devices</h3>
          <ul className="sa-devices">
            {online.map((d) => (
              <li key={d.id} className="sa-device">
                <span className="sa-device-name">{d.name}</span>
                <span className="sa-device-state" data-online="true">Online</span>
                <button
                  type="button"
                  className="sa-btn"
                  disabled={busy || !d.compatible || !bindingId}
                  onClick={() => bind(d.id)}
                >
                  Allow remote assistance
                </button>
                {!d.compatible ? (
                  <span className="sa-note">Needs updating before it can be used.</span>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="sa-note">
            This does not start sharing. You pick which screen to share in the
            app on your own computer, and confirm it there.
          </p>
        </section>
      ) : null}

      {offline.length > 0 ? (
        <section>
          <h3 className="sa-subtitle">Not running</h3>
          <ul className="sa-devices">
            {offline.map((d) => (
              <li key={d.id} className="sa-device">
                <span className="sa-device-name">{d.name}</span>
                {/* Non-colour state label, and the honest one: the server has
                  * not heard from it. We do not probe for it. */}
                <span className="sa-device-state" data-online="false">Offline</span>
                <span className="sa-note">Open the companion app on that computer.</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <form className="sa-pair" onSubmit={submitCode}>
        <label className="sa-label" htmlFor="sa-pair-code">
          Pairing code from the companion app
        </label>
        <input
          id="sa-pair-code"
          className="sa-input"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="one-time-code"
          inputMode="text"
          spellCheck="false"
        />
        <button type="submit" className="sa-btn" disabled={busy || !code.trim()}>
          Link this device
        </button>
      </form>

      {loadError ? (
        <p className="sa-error" role="alert">
          {loadError.detail || "That did not work. Check the code and try again."}
        </p>
      ) : null}
      {bindError ? (
        <p className="sa-error" role="alert">
          {bindError.detail || "Could not enable assistance for that device."}
        </p>
      ) : null}

      <div className="sa-actions">
        <button ref={closeRef} type="button" className="sa-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </Shell>
  );
}

export default CompanionSetupDialog;
