/* shared/src/components/live/assistance/AssistanceMenu.jsx — RC-011.
 * ─────────────────────────────────────────────────────────────────────────
 * The entry point, placed next to the existing screen controls.
 *
 * 🔴 **Identical for every role.** frontend-ux: "Request button never
 * implies role eligibility. Show a teacher and a student identically when
 * authorized." Nothing here branches on teacher/student. Whether a request
 * is permitted at all is OD-01's per-context predicate, decided on the
 * server; a UI that hid the button for students would quietly re-implement
 * an authorization rule in the one place it cannot be enforced.
 *
 * 🔴 **Absent means absent.** When the feature is off every route answers
 * 404, `available` stays false, and this renders nothing at all — no greyed
 * control, no "unavailable" badge. A disabled-looking button invites support
 * tickets about a feature nobody has been told about yet.
 *
 * 🔴 **No full-room announcement.** Requests privately target the people
 * involved. Nothing in this menu broadcasts to the room.
 */
import React, { useCallback, useState } from "react";

import { useAssistance } from "./AssistanceProvider";
import CompanionSetupDialog from "./CompanionSetupDialog";

export function AssistanceMenu({ canUseAssistance = true }) {
  const {
    available, bindingId, myHostBinding, hosts, active, outgoing,
    allowRequests, setAllowRequests, capabilities, actions,
  } = useAssistance();

  const [setupOpen, setSetupOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const request = useCallback(async (hostBindingId) => {
    setBusy(true);
    try {
      await actions.requestControl(hostBindingId, capabilities);
    } catch {
      /* surfaced by the provider */
    } finally {
      setBusy(false);
    }
  }, [actions, capabilities]);

  // Spectators, public broadcast viewers and disabled session kinds: nothing.
  if (!available || !canUseAssistance) return null;

  // While control is running the status bar owns the screen; a second set of
  // controls here would give two places to stop, one of which is wrong.
  if (active) return null;

  const sharing = myHostBinding?.state === "ready";

  return (
    <div className="sa-menu">
      {!myHostBinding ? (
        <button
          type="button"
          className="sa-btn"
          onClick={() => setSetupOpen(true)}
        >
          Set up remote assistance
        </button>
      ) : null}

      {myHostBinding && !sharing ? (
        <span className="sa-note" role="status">
          Waiting for you to choose a screen in the app on your computer.
        </span>
      ) : null}

      {sharing ? (
        <span className="sa-shared" role="status">
          {/* The honest two-part state: the display is shared, and that is
            * not the same as control being allowed. Collapsing these is how
            * someone ends up believing they consented to one thing when they
            * consented to the other. */}
          Display shared; control not allowed yet
        </span>
      ) : null}

      {myHostBinding ? (
        <label className="sa-mute">
          <input
            type="checkbox"
            checked={!allowRequests}
            disabled={busy}
            onChange={(e) => setAllowRequests(!e.target.checked)}
          />
          <span>Stop people asking to control my computer in this meeting</span>
        </label>
      ) : null}

      {hosts.length > 0 && !outgoing ? (
        <ul className="sa-hosts">
          {hosts.map((h) => (
            <li key={h.id} className="sa-host">
              <span className="sa-host-name">
                {h.owner?.name || "Participant"}
                {h.device?.name ? ` — ${h.device.name}` : ""}
              </span>
              <button
                type="button"
                className="sa-btn"
                disabled={busy}
                onClick={() => request(h.id)}
              >
                Request control
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {setupOpen ? (
        <CompanionSetupDialog bindingId={bindingId} onClose={() => setSetupOpen(false)} />
      ) : null}
    </div>
  );
}

export default AssistanceMenu;
