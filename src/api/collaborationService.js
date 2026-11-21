/* shared/src/api/collaborationService.js — Shiksha Remote control plane v1.
 * ─────────────────────────────────────────────────────────────────────────
 * The browser half of docs/architecture/shiksha-remote/api-contracts.md,
 * mounted at /api/sessions/collaboration/v1/.
 *
 * 🔴 This plane is NOT the ordinary API, and three differences bite:
 *
 * 1. Every unsafe call needs an `X-CSRFToken`. DRF does not validate CSRF
 *    anywhere else in this codebase, so no existing client sends one; these
 *    routes opt back in, and a request without it is a 403.
 * 2. Every non-heartbeat mutation needs a UUID `Idempotency-Key`. The same
 *    actor + route + key replays the first result; the same key with a
 *    DIFFERENT body is a 409, so a key must never be reused across calls.
 * 3. While the feature flags are off, every route answers **404** — the
 *    feature is absent, not forbidden. A 404 from here means "not
 *    available", not "something broke", and must never surface as an error
 *    banner.
 *
 * Errors are `{code, detail, request_id}`, not DRF's `{detail}`, so
 * `extractError` would drop the `code` — which is the part a caller needs
 * to tell "busy" from "expired" from "the owner declined".
 *
 * Deliberately UI-free: this file talks to the server and nothing else.
 * Feature activation is RC-011's.
 */
/* 🔴 `./apiClient`, not `../shared/apiClient`.
 *
 * This file is synced into all three web apps, but `src/shared/apiClient.js`
 * exists only in the two dashboards — it is not a sync target for
 * shiksha-frontend, which has `src/api/apiClient.js` and nothing else. The
 * sibling path resolves in all three.
 *
 * RC-010 shipped the other spelling and nothing caught it, because the module
 * shipped inert: no component imported it, so Rollup never resolved it and
 * the build stayed green. RC-011 is the first thing to import it, and the
 * frontend build failed immediately with "Could not resolve
 * ../shared/apiClient". A latent broken import is the cost of landing code
 * nothing exercises yet; worth remembering for the rest of this feature,
 * which is deliberately built the same way.
 *
 * The two clients are equivalent — same axios instance, same API_URL, same
 * withCredentials, same refreshSession interceptor, same default export — so
 * this changes no behaviour in the dashboards. */
import api from "./apiClient";

const BASE = "/api/sessions/collaboration/v1";

/* ── errors ─────────────────────────────────────────────────────────── */

export class CollaborationError extends Error {
  constructor({ code, detail, status, requestId, fieldErrors }) {
    super(detail || code || "Collaboration request failed.");
    this.name = "CollaborationError";
    this.code = code || "unknown";
    this.status = status ?? 0;
    this.requestId = requestId || null;
    this.fieldErrors = fieldErrors || null;
  }

  /** The feature is switched off, or this principal cannot see it. */
  get unavailable() { return this.status === 404; }
  /** Someone else holds the device, or a slot is taken. */
  get busy() { return this.code === "busy" || this.status === 409; }
  /** Gone for good — do not retry, refetch. */
  get expired() { return this.status === 410; }
  /** Transient: a dependency was unreachable, or we are going too fast. */
  get retryable() { return this.status === 503 || this.status === 429; }
}

function toError(err) {
  const res = err?.response;
  const body = res?.data;
  if (body && typeof body === "object") {
    return new CollaborationError({
      code: body.code,
      detail: body.detail,
      status: res.status,
      requestId: body.request_id,
      fieldErrors: body.field_errors,
    });
  }
  return new CollaborationError({
    code: "network",
    detail: err?.message || "Could not reach the server.",
    status: res?.status ?? 0,
  });
}

/* ── CSRF ───────────────────────────────────────────────────────────── */

let csrfToken = null;

/** Bootstrap, once per session. Safe GET; refreshes the cookie too. */
export async function ensureCsrf(force = false) {
  if (csrfToken && !force) return csrfToken;
  try {
    const { data } = await api.get(BASE + "/csrf/");
    csrfToken = data?.csrf_token || null;
    return csrfToken;
  } catch (err) {
    throw toError(err);
  }
}

function newIdempotencyKey() {
  // crypto.randomUUID is unavailable on insecure origins and older Safari.
  // The fallback is NOT a security value — a key only has to be unique per
  // call, and the server treats it as an opaque UUID.
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const b = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(b);
  } else {
    for (let i = 0; i < b.length; i += 1) b[i] = Math.floor(Math.random() * 256);
  }
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return [h.slice(0, 8), h.slice(8, 12), h.slice(12, 16), h.slice(16, 20), h.slice(20)].join("-");
}

async function send(method, path, body, headers) {
  const { data } = await api({ method, url: BASE + path, data: body, headers });
  return data;
}

async function request(method, path, body, { idempotent = true } = {}) {
  const headers = {};
  if (method !== "get") {
    headers["X-CSRFToken"] = await ensureCsrf();
    // Heartbeats and lease renewals are exempt by contract; everything else
    // carries a fresh key. Reusing one with a changed body is a 409, so a
    // key is generated per call and never cached.
    if (idempotent) headers["Idempotency-Key"] = newIdempotencyKey();
  }
  try {
    return await send(method, path, body, headers);
  } catch (err) {
    const mapped = toError(err);
    // A stale CSRF token outlives a login. Retry once with a fresh one
    // rather than handing the caller a 403 it cannot act on.
    if (mapped.status === 403 && mapped.code === "csrf_failed" && method !== "get") {
      headers["X-CSRFToken"] = await ensureCsrf(true);
      try {
        return await send(method, path, body, headers);
      } catch (retryErr) {
        throw toError(retryErr);
      }
    }
    throw mapped;
  }
}

/* ── participant bindings ───────────────────────────────────────────── */

export const createBinding = (session, participantSid) =>
  request("post", "/bindings/", { session, participant_sid: participantSid });

/** Every 2s. No Idempotency-Key — the contract exempts heartbeats. */
export const heartbeatBinding = (bindingId, participantSid) =>
  request("post", "/bindings/" + bindingId + "/heartbeat/",
    { participant_sid: participantSid }, { idempotent: false });

export const deleteBinding = (bindingId) =>
  request("delete", "/bindings/" + bindingId + "/");

export const getSnapshot = (bindingId) =>
  request("get", "/snapshot/?binding_id=" + encodeURIComponent(bindingId));

export const getWsTicket = (bindingId) =>
  request("post", "/ws-ticket/", { binding_id: bindingId });

/* ── host bindings (sharing your own screen) ────────────────────────── */

export const createHostBinding = (bindingId, deviceId) =>
  request("post", "/host-bindings/", { binding_id: bindingId, device_id: deviceId });

export const getHostBinding = (hostBindingId) =>
  request("get", "/host-bindings/" + hostBindingId + "/");

export const setAllowRequests = (hostBindingId, allowRequests) =>
  request("patch", "/host-bindings/" + hostBindingId + "/preferences/",
    { allow_requests: allowRequests });

export const stopSharing = (hostBindingId) =>
  request("delete", "/host-bindings/" + hostBindingId + "/");

/* ── devices ────────────────────────────────────────────────────────── */

export const listDevices = () => request("get", "/devices/");
export const unlinkDevice = (deviceId) => request("delete", "/devices/" + deviceId + "/");
export const confirmPairing = (userCode) =>
  request("post", "/pairings/confirm/", { user_code: userCode });

/* ── control grants ─────────────────────────────────────────────────── */

export const requestControl = (controllerBindingId, hostBindingId, capabilities) =>
  request("post", "/grants/", {
    controller_binding_id: controllerBindingId,
    host_binding_id: hostBindingId,
    capabilities,
  });

export const getGrant = (grantId) => request("get", "/grants/" + grantId + "/");

export const decideGrant = (grantId, allow, capabilities, expectedVersion) =>
  request("post", "/grants/" + grantId + "/decision/", {
    allow, capabilities, expected_version: expectedVersion,
  });

export const pauseGrant = (grantId, expectedVersion, reason = "user_pause") =>
  request("post", "/grants/" + grantId + "/pause/", {
    expected_version: expectedVersion, reason,
  });

export const resumeIntent = (grantId, expectedVersion) =>
  request("post", "/grants/" + grantId + "/resume-intent/",
    { expected_version: expectedVersion });

/**
 * Stop. `expected_version` is required by the contract and deliberately NOT
 * enforced by the server — "stop wins" — so a stale value still stops
 * control rather than failing the one call whose entire job is stopping it.
 */
export const terminateGrant = (grantId, reason, expectedVersion) =>
  request("post", "/grants/" + grantId + "/terminate/", {
    reason, expected_version: expectedVersion,
  });

/* 🔴 There is deliberately no activate(), resume() or lease() here.
 * Those are DEVICE routes: they need a device token and a DPoP proof, and
 * the server refuses a cookie on them. Only the companion can open an
 * injection gate — that split is this feature's core guarantee, and a
 * browser helper named `activate` would invite someone to try to erase it. */

export const CAPABILITIES = Object.freeze([
  "pointer.move", "pointer.button", "pointer.scroll",
  "keyboard.physical", "keyboard.text",
]);

export default {
  ensureCsrf, createBinding, heartbeatBinding, deleteBinding, getSnapshot,
  getWsTicket, createHostBinding, getHostBinding, setAllowRequests,
  stopSharing, listDevices, unlinkDevice, confirmPairing, requestControl,
  getGrant, decideGrant, pauseGrant, resumeIntent, terminateGrant,
  CollaborationError, CAPABILITIES,
};
