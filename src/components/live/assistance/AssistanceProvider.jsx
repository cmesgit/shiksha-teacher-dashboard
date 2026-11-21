/* shared/src/components/live/assistance/AssistanceProvider.jsx — RC-011.
 * ─────────────────────────────────────────────────────────────────────────
 * RC-010 shipped `useCollaboration`: binding lifecycle, notification socket,
 * refetch loop, renders nothing. This is the layer that turns its snapshot
 * into the states frontend-ux-specification.md's table names, and nothing
 * more. It still renders no chrome of its own.
 *
 * 🔴 **This provider decides what to SHOW, never what is ALLOWED.** Every
 * authorization check lives on the server; a grant only becomes active when
 * the companion sets a native physical latch. "No write to frontend state
 * can open native gate." If a future edit here appears to grant something,
 * that is the bug, not a feature.
 *
 * 🔴 **`enabled` defaults false and the feature ships inert.** Both backend
 * flags default off, every route answers 404, and `available` only becomes
 * true after a successful snapshot. A disabled feature is absent, not
 * broken, so nothing here surfaces an error for it.
 *
 * 🔴 **Requests are private.** frontend-ux: "Offers/requests privately
 * target involved users, no full-room toast." The snapshot already excludes
 * strangers' requests; this must not widen that by announcing anything to
 * the room.
 */
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";

import useCollaboration from "../../../hooks/useCollaboration";
import collaboration, { CAPABILITIES } from "../../../api/collaborationService";

/** Grant states in which the grant still matters to the UI. */
const LIVE_STATES = Object.freeze(["requested", "approved", "active", "paused"]);

/** Terminal states, each of which the host/controller is told about by name. */
const ENDED_STATES = Object.freeze([
  "declined", "revoked", "expired", "completed", "failed",
]);

/* Human wording for why control ended. The UI must say which of these it is:
 * "Control stopped" with no reason invites the reading that it broke, and a
 * host who thinks the system is flaky is a host who stops using the Stop
 * button. */
const ENDED_REASON_TEXT = Object.freeze({
  declined: "You declined the request.",
  revoked: "Control was stopped.",
  expired: "The permission expired.",
  completed: "The session finished.",
  failed: "Control stopped because of a problem.",
});

const AssistanceContext = createContext(null);

export function useAssistance() {
  const ctx = useContext(AssistanceContext);
  if (!ctx) throw new Error("useAssistance must be used inside <AssistanceProvider>");
  return ctx;
}

/** Exported for tests and for the wrappers' own gating. */
export function deriveAssistance(snapshot, currentUserId) {
  const grants = Array.isArray(snapshot?.grants) ? snapshot.grants : [];
  const hostBindings = Array.isArray(snapshot?.host_bindings) ? snapshot.host_bindings : [];

  const mine = (g, side) => g?.[side]?.user_id && g[side].user_id === currentUserId;
  const live = (g) => LIVE_STATES.includes(g?.state);

  return {
    /* The host binding this user owns — present only once their own companion
     * has bound a display. Everyone else's appears in `hosts`. */
    myHostBinding: hostBindings.find((h) => h?.owner?.id === currentUserId) || null,

    /* Other people's shared displays that are actually ready to be asked
     * about. A binding in any other state is not offerable: showing a
     * "Request control" button against it would promise something the server
     * will refuse. */
    hosts: hostBindings.filter((h) => h?.owner?.id !== currentUserId && h?.state === "ready"),

    /* Someone is asking to control THIS user's machine. The consent dialog. */
    incoming: grants.find((g) => mine(g, "target") && g.state === "requested") || null,

    /* This user said Allow in the browser; the companion has not yet latched.
     * A distinct state on purpose — "Confirm on your computer" is the whole
     * point of the two-step consent, and collapsing it into "approved" would
     * hide the step that actually authorizes injection. */
    awaitingLocal: grants.find((g) => mine(g, "target") && g.state === "approved") || null,

    /* This user's own outstanding request to control someone else. */
    outgoing: grants.find(
      (g) => mine(g, "controller") && (g.state === "requested" || g.state === "approved"),
    ) || null,

    /* Running control, either direction. */
    active: grants.find(
      (g) => (mine(g, "controller") || mine(g, "target"))
        && (g.state === "active" || g.state === "paused"),
    ) || null,

    liveGrants: grants.filter((g) => live(g) && (mine(g, "controller") || mine(g, "target"))),
  };
}

export function AssistanceProvider({
  session,
  participantSid,
  currentUserId,
  /* The caller's own gate. Stays false until the release gate opens; the
   * backend flags are the real switch, this just avoids the request. */
  enabled = false,
  children,
}) {
  const { available, bindingId, snapshot, error, actions } = useCollaboration({
    session, participantSid, enabled,
  });

  const derived = useMemo(
    () => deriveAssistance(snapshot, currentUserId),
    [snapshot, currentUserId],
  );

  /* ── "control just ended" notice ───────────────────────────────────────
   * The snapshot shows a terminal grant, but only a grant this user was
   * actually in the middle of deserves an announcement. Without the ref, a
   * stale terminal row in a fresh snapshot would pop a "Control stopped"
   * banner at someone who never started one. */
  const wasLive = useRef(new Set());
  const [ended, setEnded] = useState(null);

  useEffect(() => {
    const grants = Array.isArray(snapshot?.grants) ? snapshot.grants : [];
    const seen = wasLive.current;
    for (const g of grants) {
      if (!g?.id) continue;
      const involved = g.controller?.user_id === currentUserId
        || g.target?.user_id === currentUserId;
      if (!involved) continue;
      if (LIVE_STATES.includes(g.state)) {
        seen.add(g.id);
      } else if (ENDED_STATES.includes(g.state) && seen.has(g.id)) {
        seen.delete(g.id);
        setEnded({
          id: g.id,
          state: g.state,
          reason: g.reason || null,
          text: ENDED_REASON_TEXT[g.state] || "Control stopped.",
        });
      }
    }
  }, [snapshot, currentUserId]);

  const dismissEnded = useCallback(() => setEnded(null), []);

  /* ── host's "stop asking me" switch ────────────────────────────────────
   * frontend-ux: "Host can decline or mute future requests for this meeting;
   * persist in Redis host binding and apply server side."
   *
   * Server side specifically. A local-only mute would still let the request
   * reach the host's tab, and anything that reaches the tab can be made to
   * render. The host binding is the authority; this is a view of it. */
  const allowRequests = derived.myHostBinding?.allow_requests !== false;

  const setAllowRequests = useCallback((allow) => {
    const id = derived.myHostBinding?.id;
    if (!id) return Promise.resolve(null);
    return actions.setAllowRequests(id, allow);
  }, [actions, derived.myHostBinding?.id]);

  /* RC-010's hook deliberately exposes only the actions it needed. `resume`
   * is not among them, and it is the one action whose absence would be
   * invisible: a Resume button wired to a missing function still renders,
   * still looks enabled, and does nothing when a host is trying to get their
   * machine back. So it is composed here explicitly rather than reached for
   * with optional chaining.
   *
   * It is `resume-intent`, never `resume`. The browser records that the host
   * wants control back; the companion still demands a fresh native physical
   * reapproval. api-contracts.md: "no browser-only resume". */
  const composedActions = useMemo(() => ({
    ...actions,
    resumeIntent: (grantId, expectedVersion) =>
      collaboration.resumeIntent(grantId, expectedVersion)
        .then((g) => { actions.refresh(); return g; }),
  }), [actions]);

  const value = useMemo(() => ({
    available,
    bindingId,
    error,
    enabled,
    currentUserId,
    capabilities: CAPABILITIES,
    ...derived,
    ended,
    dismissEnded,
    allowRequests,
    setAllowRequests,
    actions: composedActions,
  }), [
    available, bindingId, error, enabled, currentUserId, derived,
    ended, dismissEnded, allowRequests, setAllowRequests, composedActions,
  ]);

  return (
    <AssistanceContext.Provider value={value}>
      {children}
    </AssistanceContext.Provider>
  );
}

export default AssistanceProvider;
