/* shared/src/components/live/assistance/ControlRequestDialog.jsx — RC-011.
 * ─────────────────────────────────────────────────────────────────────────
 * The consent dialog, and the requester's waiting view.
 *
 * 🔴 This dialog is the ONLY thing standing between a request and a stranger
 * driving someone's computer. OD-01 resolved that in an instant collab the
 * requester may be an `InstantCollaborationGuest` whose entire identity is a
 * display name somebody typed — no account, no history, nothing to ban
 * afterwards. architecture-decisions.md: "The consent dialog carries
 * everything... T22's deny-by-default, dwell timer and plain-language
 * capability copy are the only controls left standing, so they are not
 * negotiable in this context."
 *
 * So the following are load-bearing, not styling choices, and each maps to a
 * named assertion in security-test-plan.md T22:
 *
 *   1. Allow starts DISABLED and UNFOCUSED. Deny takes initial focus.
 *   2. A dwell timer must elapse before Allow can do anything — so Enter or
 *      Space held down, or pressed reflexively under social pressure, cannot
 *      approve. The handler re-checks the timer; a disabled attribute alone
 *      is a styling fact, and this must not depend on one.
 *   3. The copy names the real capability — "use the mouse and keyboard in
 *      applications you can access, including files and terminals" — not a
 *      euphemism like "assist you".
 *   4. There is NO countdown that approves on its own, and no prechecked
 *      unattended or trust-forever option. Neither exists in this file.
 *
 * A green test here is evidence about the dialog. T22 says plainly it is
 * "never evidence that consent was freely given" — that needs the scripted
 * peer-pressure walkthrough and a safeguarding owner.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAssistance } from "./AssistanceProvider";

/* How long Allow stays inert after the dialog opens.
 *
 * Long enough that the button cannot be hit by a keypress already in flight
 * or by reflex, short enough that it does not train people to sit with a
 * finger on Enter waiting for it. T22 does not name a value; this is a
 * judgement, and it is deliberately a named constant so a safeguarding owner
 * can argue with the number rather than go hunting for it. */
export const CONSENT_DWELL_MS = 3000;

/** Plain-language names. These are shown to a person deciding, so they say
 *  what the capability DOES, not what the protocol calls it. */
const CAPABILITY_TEXT = Object.freeze({
  "pointer.move": "Move the mouse pointer",
  "pointer.button": "Click, including right-click and drag",
  "pointer.scroll": "Scroll",
  "keyboard.physical": "Press keys, including shortcuts",
  "keyboard.text": "Type text",
});

/** The single rule for whether Allow may do anything.
 *
 * One predicate, two consumers: the button's `disabled` attribute and the
 * click handler itself. They must never be able to disagree — a handler that
 * trusts `disabled` is trusting a presentational attribute, and React
 * suppresses `onClick` on a disabled button by inspecting its PROPS, so the
 * handler guard is genuinely unreachable through the UI today. It exists for
 * the refactor that swaps in a custom <Button> which forgets to forward
 * `disabled`; on that day this predicate still holds the line.
 *
 * It is exported so that rule can be tested directly, because that is the
 * only way to cover it — a DOM-level test of a disabled button passes whether
 * or not the guard exists, which makes it worse than no test at all.
 */
export function canApprove({ dwellDone, busy, capabilityCount }) {
  return Boolean(dwellDone) && !busy && capabilityCount > 0;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/* ── a focus-trapped modal shell ─────────────────────────────────────────
 * Escape denies rather than merely closing: an abandoned dialog must not sit
 * there as an unanswered request, and "closed it without deciding" is, for
 * consent, a refusal. */
function Modal({ titleId, descId, onEscape, initialFocusRef, children, labelledBy }) {
  const ref = useRef(null);
  const returnTo = useRef(null);

  useEffect(() => {
    returnTo.current = document.activeElement;
    // Default focus is Deny — never Allow. frontend-ux: "default focus Deny".
    const t = window.setTimeout(() => {
      if (initialFocusRef?.current) initialFocusRef.current.focus();
    }, 0);
    return () => {
      window.clearTimeout(t);
      // "focus returns to initiating control"
      const el = returnTo.current;
      if (el && typeof el.focus === "function" && document.contains(el)) el.focus();
    };
  }, [initialFocusRef]);

  const onKeyDown = useCallback((e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      e.preventDefault();
      onEscape?.();
      return;
    }
    if (e.key !== "Tab") return;
    const nodes = ref.current ? Array.from(ref.current.querySelectorAll(FOCUSABLE)) : [];
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, [onEscape]);

  return (
    <div className="sa-backdrop" data-testid="assistance-backdrop">
      <div
        ref={ref}
        className="sa-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy || titleId}
        aria-describedby={descId}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </div>
  );
}

/* ── the consent dialog (host / target side) ─────────────────────────── */

export function ConsentDialog({ grant, onAllow, onDeny, onMuteRequests, busy = false }) {
  const denyRef = useRef(null);
  const [dwellDone, setDwellDone] = useState(false);
  const [selected, setSelected] = useState(() => new Set(grant?.capabilities || []));

  const titleId = "sa-consent-title";
  const descId = "sa-consent-desc";

  useEffect(() => {
    setDwellDone(false);
    const t = window.setTimeout(() => setDwellDone(true), CONSENT_DWELL_MS);
    return () => window.clearTimeout(t);
  }, [grant?.id]);

  const requester = grant?.controller?.display_name || "Someone";
  const deviceName = grant?.device?.name || "your computer";
  const displayName = grant?.capture?.display_name || grant?.display_name || "a screen";

  const toggle = (cap) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(cap)) next.delete(cap); else next.add(cap);
    return next;
  });

  const approvable = canApprove({
    dwellDone, busy, capabilityCount: selected.size,
  });

  /* Re-checked here, from the same predicate that drives `disabled`. */
  const allow = useCallback(() => {
    if (!canApprove({ dwellDone, busy, capabilityCount: selected.size })) return;
    onAllow?.(Array.from(selected));
  }, [dwellDone, busy, onAllow, selected]);

  const allowDisabled = !approvable;

  return (
    <Modal titleId={titleId} descId={descId} onEscape={onDeny} initialFocusRef={denyRef}>
      <h2 id={titleId} className="sa-title">
        Allow {requester} to control your computer?
      </h2>

      <p id={descId} className="sa-body">
        <strong>{requester}</strong> is asking to control{" "}
        <strong>{deviceName} — {displayName}</strong>. They can use the mouse and
        keyboard in applications you can access, including files and terminals.
        Other participants who can view this screen may see what happens.
        Sending files needs separate approval.
      </p>

      <fieldset className="sa-caps">
        <legend className="sa-caps-legend">They will be able to:</legend>
        {(grant?.capabilities || []).map((cap) => (
          <label key={cap} className="sa-cap">
            <input
              type="checkbox"
              checked={selected.has(cap)}
              onChange={() => toggle(cap)}
            />
            <span>{CAPABILITY_TEXT[cap] || cap}</span>
          </label>
        ))}
      </fieldset>

      <p className="sa-note">
        You can stop control at any time with the <strong>Stop control</strong>{" "}
        button, or from the app on your computer. Nothing starts until you also
        confirm on your computer.
      </p>

      {grant?.expires_at ? (
        <p className="sa-note">
          This permission ends at{" "}
          {new Date(grant.expires_at).toLocaleTimeString()} unless stopped sooner.
        </p>
      ) : null}

      {/* Polite, so it does not interrupt someone reading the dialog. */}
      <p className="sa-dwell" aria-live="polite">
        {dwellDone
          ? "You can now choose."
          : "Take a moment to read this before choosing."}
      </p>

      <div className="sa-actions">
        {/* Deny first in DOM order as well as focus order. */}
        <button
          ref={denyRef}
          type="button"
          className="sa-btn sa-btn-deny"
          onClick={onDeny}
          disabled={busy}
        >
          Deny
        </button>
        <button
          type="button"
          className="sa-btn sa-btn-allow"
          onClick={allow}
          disabled={allowDisabled}
          aria-disabled={allowDisabled}
          data-dwell-done={dwellDone ? "true" : "false"}
        >
          Allow
        </button>
      </div>

      {onMuteRequests ? (
        <button type="button" className="sa-link" onClick={onMuteRequests} disabled={busy}>
          Deny and stop asking me in this meeting
        </button>
      ) : null}
    </Modal>
  );
}

/* ── the requester's waiting view ────────────────────────────────────── */

export function WaitingDialog({ grant, onCancel }) {
  const cancelRef = useRef(null);
  const titleId = "sa-waiting-title";
  const target = grant?.target?.display_name || "them";
  const approved = grant?.state === "approved";

  return (
    <Modal titleId={titleId} onEscape={onCancel} initialFocusRef={cancelRef}>
      <h2 id={titleId} className="sa-title">
        {approved ? `Waiting for local confirmation` : `Waiting for ${target}`}
      </h2>
      <p className="sa-body" aria-live="polite">
        {approved
          ? `${target} allowed the request in their browser. They still have to confirm on their own computer before control starts.`
          : `${target} has been asked. Nothing happens unless they allow it.`}
      </p>
      <div className="sa-actions">
        <button ref={cancelRef} type="button" className="sa-btn" onClick={onCancel}>
          Cancel request
        </button>
      </div>
    </Modal>
  );
}

/* ── connected surface ───────────────────────────────────────────────── */

export function ControlRequestDialog() {
  const {
    incoming, outgoing, awaitingLocal, actions, setAllowRequests,
  } = useAssistance();
  const [busy, setBusy] = useState(false);

  const grant = incoming;

  const decide = useCallback(async (allow, capabilities) => {
    if (!grant) return;
    setBusy(true);
    try {
      await actions.respond(grant.id, allow, capabilities || [], grant.version);
    } catch {
      /* The provider surfaces the error; the dialog stays open so the host is
       * never left thinking they answered when they did not. */
    } finally {
      setBusy(false);
    }
  }, [actions, grant]);

  const denyAndMute = useCallback(async () => {
    await decide(false, []);
    await setAllowRequests(false);
  }, [decide, setAllowRequests]);

  if (grant) {
    return (
      <ConsentDialog
        grant={grant}
        busy={busy}
        onAllow={(caps) => decide(true, caps)}
        onDeny={() => decide(false, [])}
        onMuteRequests={denyAndMute}
      />
    );
  }

  /* The host's own "now confirm on your computer" step. Not a decision point
   * — it exists so the browser never implies control already started. */
  if (awaitingLocal) {
    return (
      <Modal titleId="sa-local-title" onEscape={() => {}} initialFocusRef={{ current: null }}>
        <h2 id="sa-local-title" className="sa-title">Confirm on your computer</h2>
        <p className="sa-body" aria-live="polite">
          You allowed this in the browser. Control starts only after you confirm
          in the app on <strong>{awaitingLocal.device?.name || "your computer"}</strong>.
        </p>
      </Modal>
    );
  }

  const pending = outgoing;
  if (pending) {
    return (
      <WaitingDialog
        grant={pending}
        onCancel={() => actions.stop(pending.id, pending.version, "user_stop").catch(() => {})}
      />
    );
  }

  return null;
}

export default ControlRequestDialog;
