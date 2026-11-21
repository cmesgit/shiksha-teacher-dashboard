/* shared/src/hooks/useCollaboration.js — the adapter the UI will sit on.
 * ─────────────────────────────────────────────────────────────────────────
 * RC-010 asks for "a stable adapter/provider interface and error mapping
 * WITHOUT feature UI activation". So this owns the binding lifecycle, the
 * notification socket and the refetch loop — and renders nothing, decides
 * nothing about what a user may see, and ships inert.
 *
 * 🔴 **`available` starts false and only a successful snapshot sets it.**
 * Both feature flags default off and every route then answers 404, so a
 * hook that assumed availability would light up controls against a plane
 * that is not there. 404 here means "absent", not "broken": it resolves to
 * `available: false` with NO error, because a disabled feature is not a
 * failure to report to a learner mid-lesson.
 *
 * 🔴 **The socket is a hint, never authority.** The envelope carries only
 * `{type, resource_id, version}` — no grant bodies, no tokens. The only
 * correct reaction is to refetch over REST, where the real authorization
 * check lives. "No write to frontend state can open native gate." Anything
 * that made a payload useful on its own would be a bug.
 *
 * 🔴 **Versions only ever increase.** Events may duplicate or arrive out of
 * order, so a lower version is dropped rather than applied — otherwise a
 * late "grant.changed" could resurrect a grant the user already stopped.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import collaboration, { CollaborationError } from "../api/collaborationService";

const HEARTBEAT_MS = 2000;   // api-contracts.md: bindings heartbeat "every 2s"
const SNAPSHOT_MS = 15000;   // backstop; events drive the common case
const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 30000;

/**
 * @param {object}  options
 * @param {object}  options.session        `{kind, id}` SessionRef
 * @param {string}  options.participantSid LiveKit SID for this tab
 * @param {boolean} options.enabled        caller's own gate; default false
 */
export function useCollaboration({ session, participantSid, enabled = false } = {}) {
  const [available, setAvailable] = useState(false);
  const [bindingId, setBindingId] = useState(null);
  const [snapshot, setSnapshot] = useState({ host_bindings: [], grants: [], transfers: [] });
  const [error, setError] = useState(null);

  const versions = useRef(new Map());
  const socketRef = useRef(null);
  const closedRef = useRef(false);
  const backoffRef = useRef(RECONNECT_MIN_MS);

  /* ── error mapping, in one place ──────────────────────────────────── */

  const handle = useCallback((err) => {
    const e = err instanceof CollaborationError
      ? err
      : new CollaborationError({ code: "unknown", detail: String(err?.message || err) });
    if (e.unavailable) {
      // Absent, not broken. Clear any stale error so the UI does not keep
      // showing a failure for a feature that is simply switched off.
      setAvailable(false);
      setError(null);
      return e;
    }
    setError(e);
    return e;
  }, []);

  /* ── snapshot ─────────────────────────────────────────────────────── */

  const refresh = useCallback(async (id) => {
    const target = id || bindingId;
    if (!target) return null;
    try {
      const data = await collaboration.getSnapshot(target);
      setSnapshot({
        host_bindings: data?.host_bindings || [],
        grants: data?.grants || [],
        transfers: data?.transfers || [],
      });
      setAvailable(true);
      setError(null);
      return data;
    } catch (err) {
      handle(err);
      return null;
    }
  }, [bindingId, handle]);

  /* ── binding lifecycle ────────────────────────────────────────────── */

  useEffect(() => {
    if (!enabled || !session?.id || !participantSid) return undefined;
    let cancelled = false;
    let heartbeat = null;
    let poll = null;
    let localId = null;

    (async () => {
      try {
        const created = await collaboration.createBinding(session, participantSid);
        if (cancelled) {
          // Unmounted mid-flight. Release rather than leak a binding that
          // nothing will heartbeat; its 6s TTL would cover us, but a grant
          // built on it in that window would die with it.
          if (created?.binding_id) collaboration.deleteBinding(created.binding_id).catch(() => {});
          return;
        }
        localId = created?.binding_id || null;
        setBindingId(localId);
        setAvailable(true);
        await refresh(localId);

        heartbeat = setInterval(() => {
          collaboration.heartbeatBinding(localId, participantSid).catch((err) => {
            const e = handle(err);
            // A changed SID (409) or stale membership (503) means this
            // binding describes a connection that no longer exists. Drop
            // it; the effect re-runs and re-binds on the next SID.
            if (e.status === 409 || e.status === 503) {
              clearInterval(heartbeat);
              setBindingId(null);
            }
          });
        }, HEARTBEAT_MS);

        poll = setInterval(() => { refresh(localId); }, SNAPSHOT_MS);
      } catch (err) {
        handle(err);
      }
    })();

    return () => {
      cancelled = true;
      if (heartbeat) clearInterval(heartbeat);
      if (poll) clearInterval(poll);
      // Best effort: the server's TTL is the real guarantee, and a failed
      // release on page-close must not block unload.
      if (localId) collaboration.deleteBinding(localId).catch(() => {});
      setBindingId(null);
    };
  }, [enabled, session?.kind, session?.id, participantSid, refresh, handle]);

  /* ── notification socket ──────────────────────────────────────────── */

  useEffect(() => {
    if (!enabled || !bindingId) return undefined;
    closedRef.current = false;
    let timer = null;

    const open = async () => {
      if (closedRef.current) return;
      try {
        const { ticket, ws_url: wsUrl } = await collaboration.getWsTicket(bindingId);
        if (closedRef.current || !ticket || !wsUrl) return;
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          backoffRef.current = RECONNECT_MIN_MS;
          // The ticket goes in the first FRAME, never the URL — a URL lands
          // in proxy access logs.
          ws.send(JSON.stringify({ v: 1, type: "authenticate", ticket }));
        };

        ws.onmessage = (ev) => {
          let msg;
          try { msg = JSON.parse(ev.data); } catch { return; }
          // Unknown frame types are IGNORED, not treated as errors, so the
          // server can add one without breaking older tabs.
          if (!msg || msg.v !== 1) return;
          if (msg.type === "pong" || msg.type === "authenticated") return;
          if (!msg.type || !msg.resource_id) return;

          const seen = versions.current.get(msg.resource_id);
          if (typeof msg.version === "number" && typeof seen === "number" && msg.version <= seen) {
            return; // duplicate or out-of-order
          }
          if (typeof msg.version === "number") versions.current.set(msg.resource_id, msg.version);
          // The only correct reaction: refetch the authorized resource.
          refresh();
        };

        const retry = () => {
          socketRef.current = null;
          if (closedRef.current) return;
          // On a gap or reconnect, fetch a snapshot — events missed while
          // disconnected are not replayed.
          refresh();
          timer = setTimeout(open, backoffRef.current);
          backoffRef.current = Math.min(backoffRef.current * 2, RECONNECT_MAX_MS);
        };
        ws.onclose = retry;
        ws.onerror = () => { try { ws.close(); } catch { /* already closing */ } };
      } catch (err) {
        handle(err);
        if (!closedRef.current) {
          timer = setTimeout(open, backoffRef.current);
          backoffRef.current = Math.min(backoffRef.current * 2, RECONNECT_MAX_MS);
        }
      }
    };

    open();
    return () => {
      closedRef.current = true;
      if (timer) clearTimeout(timer);
      const ws = socketRef.current;
      socketRef.current = null;
      if (ws) { try { ws.close(); } catch { /* already closed */ } }
    };
  }, [enabled, bindingId, refresh, handle]);

  /* ── actions ──────────────────────────────────────────────────────── */

  const actions = useMemo(() => ({
    requestControl: (hostBindingId, capabilities) =>
      collaboration.requestControl(bindingId, hostBindingId, capabilities)
        .then((g) => { refresh(); return g; })
        .catch((err) => { throw handle(err); }),

    respond: (grantId, allow, capabilities, expectedVersion) =>
      collaboration.decideGrant(grantId, allow, capabilities, expectedVersion)
        .then((g) => { refresh(); return g; })
        .catch((err) => { throw handle(err); }),

    pause: (grantId, expectedVersion) =>
      collaboration.pauseGrant(grantId, expectedVersion)
        .then((g) => { refresh(); return g; })
        .catch((err) => { throw handle(err); }),

    stop: (grantId, expectedVersion, reason = "user_stop") =>
      collaboration.terminateGrant(grantId, reason, expectedVersion)
        .then((g) => { refresh(); return g; })
        .catch((err) => { throw handle(err); }),

    setAllowRequests: (hostBindingId, allow) =>
      collaboration.setAllowRequests(hostBindingId, allow)
        .then((r) => { refresh(); return r; })
        .catch((err) => { throw handle(err); }),

    refresh,
  }), [bindingId, refresh, handle]);

  return { available, bindingId, snapshot, error, actions };
}

export default useCollaboration;
