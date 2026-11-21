/* shared/src/components/live/assistance/ControlStatusBar.jsx — RC-011.
 * ─────────────────────────────────────────────────────────────────────────
 * The persistent banner during control, and the notice when it ends.
 *
 * 🔴 **Stop is always present and always first.** frontend-ux calls the
 * banner "persistent" for both sides, and the native prompt promises "Stop
 * anytime". A Stop that is behind a menu, or that disappears when the window
 * is small, breaks a promise the consent dialog already made — which is why
 * it is the first control in DOM order and never conditional.
 *
 * 🔴 **Resume is an intent, not a resume.** The host's browser can only
 * record that they want control back; `resume-intent` then requires a fresh
 * native physical reapproval on the companion before anything is injected
 * again. api-contracts.md: "no browser-only resume". A button labelled
 * "Resume" that silently restarted input would be exactly the unattended
 * path this design exists to prevent, so the label says what really happens.
 *
 * 🔴 Status is never carried by colour alone — each state has a text label
 * and a non-colour marker, per the accessibility rules in frontend-ux.
 */
import React, { useCallback, useState } from "react";

import { useAssistance } from "./AssistanceProvider";

export function StatusBar({
  grant, role, onStop, onPause, onResumeIntent, busy = false,
}) {
  const paused = grant?.state === "paused";
  const isHost = role === "host";
  const other = isHost
    ? (grant?.controller?.display_name || "Someone")
    : (grant?.target?.display_name || "them");

  const label = isHost
    ? (paused
      ? "Control paused — input stopped"
      : `${other} is controlling your computer`)
    : (paused
      ? `Paused by ${other} — view only, your keys are not sent`
      : `You are controlling ${other}'s computer`);

  return (
    <div
      className={`sa-status ${paused ? "is-paused" : "is-active"}`}
      role="region"
      aria-label="Remote control status"
      data-state={grant?.state || "unknown"}
    >
      {/* Non-colour marker, so the state survives greyscale and colour
        * blindness. */}
      <span className="sa-status-mark" aria-hidden="true">{paused ? "⏸" : "●"}</span>
      <span className="sa-status-text">{label}</span>

      <div className="sa-status-actions">
        <button type="button" className="sa-btn sa-btn-stop" onClick={onStop} disabled={busy}>
          Stop control
        </button>

        {isHost && !paused ? (
          <button type="button" className="sa-btn" onClick={onPause} disabled={busy}>
            Pause
          </button>
        ) : null}

        {isHost && paused ? (
          <button type="button" className="sa-btn" onClick={onResumeIntent} disabled={busy}>
            Resume — needs confirming on your computer
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function EndedNotice({ ended, onDismiss }) {
  if (!ended) return null;
  return (
    /* Assertive: this interrupts, because "control stopped" is exactly the
     * thing a screen-reader user must not learn late. It does NOT take
     * focus — frontend-ux: "immediate announcement without focus theft". */
    <div className="sa-ended" role="alert" data-state={ended.state}>
      <span className="sa-status-mark" aria-hidden="true">■</span>
      <span className="sa-status-text">
        Control stopped. {ended.text}
      </span>
      <button type="button" className="sa-btn" onClick={onDismiss}>Dismiss</button>
    </div>
  );
}

export function ControlStatusBar() {
  const { active, currentUserId, actions, ended, dismissEnded } = useAssistance();
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (fn) => {
    setBusy(true);
    try { await fn(); } catch { /* provider surfaces it */ } finally { setBusy(false); }
  }, []);

  if (!active) return <EndedNotice ended={ended} onDismiss={dismissEnded} />;

  const role = active.target?.user_id === currentUserId ? "host" : "controller";

  return (
    <>
      <StatusBar
        grant={active}
        role={role}
        busy={busy}
        onStop={() => run(() => actions.stop(active.id, active.version, "user_stop"))}
        onPause={() => run(() => actions.pause(active.id, active.version))}
        onResumeIntent={() => run(() => actions.resumeIntent(active.id, active.version))}
      />
      <EndedNotice ended={ended} onDismiss={dismissEnded} />
    </>
  );
}

export default ControlStatusBar;
