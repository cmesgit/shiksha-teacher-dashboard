// ============================================================
// SHARED — src/hooks/useNotificationSocket.js
// Drop the SAME file into BOTH apps (FULL REPLACEMENT):
//   shiksha-student-dashboard/src/hooks/useNotificationSocket.js
//   shiksha-teacher-dashboard/src/hooks/useNotificationSocket.js
// ============================================================
//
// WHAT CHANGED vs the previous version
// ────────────────────────────────────
// 1. ONE SOCKET PER TAB (singleton store). Every useNotificationSocket()
//    call used to open its OWN WebSocket + its OWN feed fetch — the
//    NotificationBell and the Dashboard each held a separate copy, so
//    unread counts diverged and "mark all read" in the bell never
//    cleared the dashboard list. All consumers now share one
//    module-level store. Public API is unchanged, so NotificationBell
//    works without edits.
//    (Implemented with a plain useState force-update subscription —
//    NOT useSyncExternalStore — so it works on any React 16.8+ setup
//    without depending on a React-18-only API.)
// 2. CANONICAL TYPES. Items are normalized once, on entry:
//        item.type ← raw_type (new serializer field) when present,
//                    else mapped from the legacy lowercase vocabulary
//                    (session→SESSION, quiz→QUIZ, material→ASSIGNMENT,
//                     assignment→ASSIGNMENT, submission→SUBMISSION,
//                     live_session→SESSION)
//    so the UPPERCASE filters/labels in both dashboards, the bell,
//    NotificationCard and ActivityItem finally match real data.
// 3. REAL DEDUPE + MARK-READ. WS pushes now carry the serialized
//    Activity row (same id as the REST feed — see activity/signals.py),
//    so the id-based dedupe actually dedupes and markOneRead PATCHes a
//    real row instead of 404ing on an assignment uuid.
// 4. EVENT SUBSCRIPTIONS. New onEvent(cb) lets dashboards revalidate
//    their data slices when a relevant push lands (e.g. a SUBMISSION
//    arrives while the teacher dashboard is open).
// 5. Everything that already worked is preserved: /ws/updates/ route,
//    cookie auth with ?token= fallback, 25s keepalive pings, 4401 →
//    one silent /accounts/refresh/ → reconnect, exponential backoff,
//    StrictMode-safe teardown (via refcounting instead of a flag).
//
// 6. TRACK SCOPING (Academy vs Skill Dev). useNotificationSocket({ track })
//    scopes the feed server-side via ?track=, so an Academy bell never
//    renders a Skill Dev booking (and vice versa) — the isolation had to be
//    server-side, not a .filter() on the results, because `limit=20` across
//    both tracks can return twenty academy rows and leave the skill bell
//    looking empty while skill rows exist.
//    Cross-track rows (chat/forum/counselling) are returned by BOTH scopes;
//    only the opposite track is hidden. `crossTrackUnread` is how many
//    unread rows the OTHER track is holding, for the "2 new in Skill Dev"
//    peek. Live WS pushes are filtered with the same rule, so the realtime
//    path can't leak what the REST scope excluded.
//
// Public API: { notifications, unreadCount, crossTrackUnread, loading, error,
//               markAllRead, markOneRead, clearNotifications,
//               onEvent }

import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/apiClient";
import { refreshSession } from "../api/refreshSession";
import { useAuth } from "../contexts/AuthContext";
import { WS_HOST } from "../config/urls";

// WS_HOST is IMPORTED, not re-declared. It used to be
// `import.meta.env.VITE_WS_HOST || "api.shikshacom.com"` right here, which
// skipped config/urls.js's hostname-based dev detection: on
// app.dev.shikshacom.com, where no VITE_WS_HOST is set in the deployed env,
// REST went to api.dev while this socket connected to PRODUCTION. A
// cross-environment connection that silently never delivered dev pushes.
const MAX_NOTIFICATIONS = 50;
const BASE_RECONNECT_DELAY = 3000;
const MAX_RECONNECT_DELAY = 30000;
const PING_MS = 25000;

// ── canonical type normalization ────────────────────────────────────
const CANON = {
  session: "SESSION",
  live_session: "SESSION",
  recording: "SESSION",
  quiz: "QUIZ",
  material: "ASSIGNMENT",
  assignment: "ASSIGNMENT",
  submission: "SUBMISSION",
};

function normalize(raw) {
  if (!raw || typeof raw !== "object") return raw;
  const legacy = String(raw.type || "");
  const canonical =
    raw.raw_type ||
    CANON[legacy.toLowerCase()] ||
    (legacy ? legacy.toUpperCase() : "SESSION");
  return {
    ...raw,
    type: canonical,          // what all web components compare against
    legacy_type: raw.type,    // kept for debugging / mobile parity
    is_read: raw.is_read ?? (raw.unread != null ? !raw.unread : false),
  };
}

// ── track scoping helpers ───────────────────────────────────────────
// Vocabulary matches the backend (notifications/tracks.py + the
// ?track= filter on /activity/feed/): "academy" | "skill" | null.
const VALID_TRACKS = new Set(["academy", "skill"]);

function normalizeTrack(track) {
  const value = String(track ?? "").trim().toLowerCase();
  return VALID_TRACKS.has(value) ? value : null;
}

// Does a pushed row belong in a bell scoped to `scope`?
// A row with no track (cross-track: chat, forum, counselling) belongs in
// BOTH — same rule the server's `__in=["", track]` filter applies. An
// unscoped bell (scope === null) accepts everything.
function belongsToScope(row, scope) {
  if (!scope) return true;
  const rowTrack = normalizeTrack(row?.track);
  return rowTrack === null || rowTrack === scope;
}

// ── module-level singleton store ────────────────────────────────────
const store = {
  // `error` is a human-readable string when the LAST feed fetch failed, else
  // null. Without it, offline / a 500 / the 409 `profile_required` you get in
  // account context all rendered as a confident "No notifications" — a wrong
  // answer stated with certainty, which is worse than an error.
  state: { notifications: [], unreadCount: 0, crossTrackUnread: 0, loading: true, error: null },
  // The track this shared feed is currently scoped to. One store per tab
  // means one scope per tab: whichever consumer passes an explicit
  // `track` owns it (in practice the bell, which is the only component
  // that renders a scoped list). Consumers that pass nothing simply read
  // whatever scope the bell established, which is what you want — the
  // dashboard list and the bell should never disagree about what exists.
  track: null,
  listeners: new Set(),      // React subscribers (state changes)
  eventListeners: new Set(), // onEvent subscribers (raw pushes)
  consumers: 0,              // mounted hook instances (refcount)
  ws: null,
  reconnectTimer: null,
  reconnectDelay: BASE_RECONNECT_DELAY,
  pingTimer: null,
  refreshTried: false,
  started: false,
};

function emit() {
  store.listeners.forEach((l) => l());
}

function setState(patch) {
  store.state = { ...store.state, ...patch };
  emit();
}

function upsert(item) {
  const n = normalize(item);

  // Out-of-scope push: don't put it in this bell's list. It still has to
  // COUNT though — that's exactly what the cross-track peek reports, and
  // dropping it silently is how a user misses a booking confirmation.
  if (!belongsToScope(n, store.track)) {
    if (!n.is_read) {
      setState({ crossTrackUnread: store.state.crossTrackUnread + 1 });
    }
    return;
  }

  const prev = store.state.notifications;
  const withoutDupe = prev.filter((x) => !(x.id && n.id && x.id === n.id));
  const isNew = withoutDupe.length === prev.length;
  const notifications = [n, ...withoutDupe].slice(0, MAX_NOTIFICATIONS);
  setState({
    notifications,
    unreadCount: isNew && !n.is_read
      ? store.state.unreadCount + 1
      : notifications.filter((x) => !x.is_read).length,
  });
}

// ── REST feed (fills the bell on load / after profile switch) ───────
async function fetchFeed() {
  const scope = store.track;
  try {
    const query = `limit=20${scope ? `&track=${encodeURIComponent(scope)}` : ""}`;
    const res = await api.get(`/activity/feed/?${query}`);
    // A scope change mid-flight would otherwise land the OLD track's rows
    // in the new track's bell — the classic stale-response race. Drop it.
    if (store.track !== scope) return;
    const items = (res.data?.results ?? res.data ?? []).map(normalize);
    setState({
      notifications: items,
      unreadCount: items.filter((x) => !x.is_read).length,
      crossTrackUnread: res.data?.cross_track_unread ?? 0,
      loading: false,
      error: null,
    });
  } catch (err) {
    if (store.track !== scope) return;   // same stale-response rule as above
    // WS may still deliver, so this is not fatal — but the list is now
    // EMPTY-BECAUSE-IT-FAILED, not empty-because-there-is-nothing, and the
    // caller has to be able to tell those apart.
    const code = err?.response?.data?.code;
    setState({
      loading: false,
      error: code === "profile_required"
        ? "Pick a profile to see its notifications."
        : err?.response
          ? "Couldn't load notifications."
          : "You appear to be offline.",
    });
  }
}

// Re-scope the shared feed. No-op when the scope is unchanged, so the
// effect that calls this can run on every render without thrashing.
function setFeedTrack(track) {
  const next = normalizeTrack(track);
  if (store.track === next) return;
  store.track = next;
  if (!store.started) return;   // start() will fetch with the new scope
  setState({ notifications: [], unreadCount: 0, crossTrackUnread: 0, loading: true, error: null });
  fetchFeed();
}

// ── websocket lifecycle ─────────────────────────────────────────────
function stopPing() {
  if (store.pingTimer) {
    clearInterval(store.pingTimer);
    store.pingTimer = null;
  }
}

function startPing(ws) {
  stopPing();
  store.pingTimer = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify({ type: "ping" })); } catch { /* */ }
    }
  }, PING_MS);
}

function clearReconnect() {
  if (store.reconnectTimer) {
    clearTimeout(store.reconnectTimer);
    store.reconnectTimer = null;
  }
}

// Detach EVERY handler before closing. A socket closed with its `onclose`
// still attached runs the reconnect branch below on its way out, so the
// previous socket schedules a reconnect on top of the one that replaced it.
// stop() had the same hole (a post-stop `onclose` set a timer nothing
// tracked), which is how route churn left orphan sockets reconnecting into
// a store that no longer had any consumers.
function discard(ws) {
  if (!ws) return;
  ws.onopen = null;
  ws.onmessage = null;
  ws.onclose = null;
  ws.onerror = null;
  try { ws.close(); } catch { /* already closing */ }
}

function connect() {
  if (store.consumers === 0) return; // nobody mounted — stay closed

  clearReconnect();
  discard(store.ws);   // never leave the socket we are replacing running
  store.ws = null;

  const token =
    localStorage.getItem("access") ||
    sessionStorage.getItem("access") ||
    "";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${protocol}//${WS_HOST}/ws/updates/${
    token ? `?token=${encodeURIComponent(token)}` : ""
  }`;

  const ws = new WebSocket(url);
  store.ws = ws;

  ws.onopen = () => {
    store.reconnectDelay = BASE_RECONNECT_DELAY;
    store.refreshTried = false;
    startPing(ws);
    clearReconnect();
  };

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === "notification" && msg.data) {
        upsert(msg.data);
        const n = normalize(msg.data);
        store.eventListeners.forEach((cb) => {
          try { cb(n); } catch { /* subscriber errors never kill the bus */ }
        });
      }
      // "user_update" reserved; "pong" = keepalive reply — ignored.
    } catch { /* malformed frame */ }
  };

  ws.onclose = async (event) => {
    stopPing();
    // Only the CURRENT socket may drive reconnection. discard() nulls this
    // handler, so reaching here on a replaced socket should be impossible —
    // the identity check makes that explicit rather than implicit.
    if (store.ws !== ws) return;
    if (store.consumers === 0 || !store.started) return;

    // 4401 = expired/absent token. Refresh once, reconnect immediately.
    // Through the shared single-flight (api/refreshSession.js): this used to
    // be a raw POST, i.e. a fifth racer against a backend that blacklists the
    // refresh token it just rotated.
    if (event.code === 4401 && !store.refreshTried) {
      store.refreshTried = true;
      try {
        await refreshSession();
        if (store.consumers > 0) connect();
        return;
      } catch { /* fall through to backoff */ }
    }

    store.reconnectTimer = setTimeout(() => {
      store.reconnectDelay = Math.min(
        store.reconnectDelay * 2,
        MAX_RECONNECT_DELAY
      );
      connect();
    }, store.reconnectDelay);
  };

  ws.onerror = () => {
    try { ws.close(); } catch { /* */ }
  };
}

function start() {
  if (store.started) return;
  store.started = true;
  fetchFeed();
  connect();
}

function stop() {
  store.started = false;
  stopPing();
  clearReconnect();
  discard(store.ws);
  store.ws = null;
}

// ── actions (shared by every consumer) ──────────────────────────────
async function markAllRead() {
  setState({
    unreadCount: 0,
    notifications: store.state.notifications.map((n) => ({ ...n, is_read: true })),
  });
  try {
    // Scoped: clearing the Academy bell must not clear the Skill Dev one.
    // crossTrackUnread is deliberately NOT zeroed above — those rows are
    // still unread, and the peek should keep reporting them.
    await api.post("/activity/feed/read-all/",
                   store.track ? { track: store.track } : {});
  } catch { /* */ }
}

async function markOneRead(id) {
  const notifications = store.state.notifications.map((n) =>
    n.id === id ? { ...n, is_read: true } : n
  );
  setState({
    notifications,
    unreadCount: notifications.filter((x) => !x.is_read).length,
  });
  try { await api.patch(`/activity/feed/${id}/read/`); } catch { /* */ }
}

// The bell's "Clear" button. It used to make NO API call and additionally
// zero `crossTrackUnread` — a SERVER-supplied count of unread rows in the
// OTHER track, which this bell never displayed and has no business
// dismissing. Net effect: the list emptied, both badges went dark, and a
// reload brought everything back exactly as it was.
//
// /activity/feed/ has no delete endpoint, so "clear" can only mean "mark this
// track's rows read" — which is at least persistent, and is what the empty
// badge was already claiming. The rows themselves come back on reload; that
// is what a feed does, and read rows render quietly.
async function clearNotifications() {
  setState({ notifications: [], unreadCount: 0 });
  try {
    await api.post("/activity/feed/read-all/",
                   store.track ? { track: store.track } : {});
  } catch { /* local clear already applied; the reload will show the truth */ }
}

// Identity switched (profile / context). The feed + unread count are
// per-identity, so drop the previous profile's items and refetch the new
// one's.
//
// The socket has to be REOPENED, not reused. Its previous comment ("the WS
// group is per-ACCOUNT, so the socket itself stays valid") predates
// accounts/consumers.py's identity gate: `self.ctx`, `self.profile_id` and
// `self.identity_key` are captured once in connect() from the token on the
// handshake and never refreshed. A parent switching child A → child B kept a
// socket still authenticated as A, so `_wanted()` DROPPED B's pushes and
// DELIVERED A's into B's bell. Only a full page reload used to fix it.
function resetForIdentity() {
  setState({ notifications: [], unreadCount: 0, crossTrackUnread: 0, loading: true, error: null });
  fetchFeed();
  if (store.started) {
    store.refreshTried = false;
    store.reconnectDelay = BASE_RECONNECT_DELAY;
    connect();   // closes the stale-identity socket first — see discard()
  }
}

// ── the hook ────────────────────────────────────────────────────────
export default function useNotificationSocket({ track } = {}) {
  // Force-update tick: every setState() in the module store calls every
  // subscribed listener, and each listener just bumps its own component's
  // state to trigger a re-render. Plain useState — works on any React
  // 16.8+ setup, no dependency on a React-18-only API.
  const [, setTick] = useState(0);
  // Active identity — the bell lives in the header (outside the routed
  // Outlet), so an in-place profile/context switch would otherwise leave the
  // previous profile's notifications on screen.
  const { activeProfile, context } = useAuth();
  const idRef = useRef(undefined);

  // Scope BEFORE the mount effect below runs start(). Effects fire in
  // declaration order, and setFeedTrack() is a no-op fetch-wise while
  // `started` is false — so start()'s own fetchFeed() is the one that
  // runs, already carrying the right ?track=. Declaring this second would
  // cost an extra unscoped round-trip on every mount.
  //
  // `track: undefined` means "don't care" (the dashboard list), and must
  // NOT reset the bell's scope to null — hence the explicit check rather
  // than calling setFeedTrack(track) unconditionally.
  useEffect(() => {
    if (track !== undefined) setFeedTrack(track);
  }, [track]);

  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    store.listeners.add(listener);
    store.consumers += 1;
    start();
    return () => {
      store.listeners.delete(listener);
      store.consumers -= 1;
      // Last consumer gone (real unmount, not StrictMode's fake one —
      // the refcount makes the double-invoke harmless): tear down after
      // a microtask so an immediate remount reuses the live socket.
      if (store.consumers === 0) {
        setTimeout(() => { if (store.consumers === 0) stop(); }, 0);
      }
    };
  }, []);

  // Reset the shared feed when the active identity actually changes (not on
  // first mount — start() already fetched it there).
  useEffect(() => {
    const key = `${context ?? ""}:${activeProfile?.id ?? ""}`;
    if (idRef.current === undefined) { idRef.current = key; return; }
    if (idRef.current === key) return;
    idRef.current = key;
    resetForIdentity();
  }, [activeProfile?.id, context]);

  const onEvent = useCallback((cb) => {
    store.eventListeners.add(cb);
    return () => store.eventListeners.delete(cb);
  }, []);

  const state = store.state;

  return {
    notifications: state.notifications,
    unreadCount: state.unreadCount,
    // Unread rows sitting in the OTHER track — 0 when unscoped.
    crossTrackUnread: state.crossTrackUnread,
    loading: state.loading,
    // Non-null when the last feed fetch failed. Render it instead of the
    // "No notifications" empty state — an empty list after a 500 is not the
    // same fact as an empty list after a 200.
    error: state.error,
    markAllRead,
    markOneRead,
    clearNotifications,
    onEvent,
  };
}
