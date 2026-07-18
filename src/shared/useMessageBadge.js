// ============================================================
// SHARED — src/shared/useMessageBadge.js
// Drop the SAME file into BOTH dashboards (identical):
//   shiksha-teacher-dashboard/src/shared/useMessageBadge.js
//   shiksha-student-dashboard/src/shared/useMessageBadge.js
// ============================================================
//
// WHY THIS EXISTS
// ───────────────
// Chat used to be reachable only as a sidebar item, with no global
// unread indicator — a teacher on the Students or Courses page never
// knew a message had arrived. This hook powers a Messages icon that
// lives in the Header (so it's on EVERY page), showing a single
// account-wide unread badge that stays live.
//
// DESIGN — mirrors useNotificationSocket.js on purpose:
//   • ONE module-level store shared by every consumer (the Header icon
//     is the only one today, but a future "recent messages" dropdown or
//     the inbox page can subscribe without opening a second feed).
//   • The count is the SUM of per-conversation `unread` returned by
//     GET /chat/conversations/ (see chat/services.serialize_conversation).
//     That total spans BOTH tracks (Academy + Skill-Dev) so nothing is
//     ever stranded in an inactive context — the multi-profile
//     cross-context-visibility rule.
//   • LIVE updates without a second socket: chat messages already push a
//     `notification` frame over /ws/updates/ (chat/outbox_handlers.py →
//     notifications.services.notify, ws_extra.type = "chat"). We reuse
//     useNotificationSocket()'s onEvent bus and re-fetch (debounced) when
//     a chat-type push lands.
//   • DECREMENT on read: ConversationThread dispatches a
//     `shiksha:messages-read` window event after ChatAPI.markRead; we
//     re-fetch on that, plus on window focus / tab visibility.
//
// Public API: { unreadCount, loading, refresh }

import { useEffect, useState } from "react";
import { ChatAPI } from "./chatClient";
import { useAuth } from "../contexts/AuthContext";
import useNotificationSocket from "../hooks/useNotificationSocket";

export const MESSAGES_READ_EVENT = "shiksha:messages-read";
const REFRESH_DEBOUNCE_MS = 350;

// ── module-level singleton store ────────────────────────────────────
const store = {
  state: { unreadCount: 0, loading: true },
  listeners: new Set(), // React subscribers (state changes)
  consumers: 0, // mounted hook instances (refcount)
  refreshing: false, // an in-flight fetch is running
  pending: false, // a refresh was requested while one was in flight
  debounceTimer: null,
  windowBound: false, // focus/visibility/read listeners attached
};

function emit() {
  store.listeners.forEach((l) => l());
}

function setState(patch) {
  store.state = { ...store.state, ...patch };
  emit();
}

// ── the actual fetch (coalesced so bursts collapse to one trailing run)
async function runRefresh() {
  if (store.refreshing) {
    store.pending = true;
    return;
  }
  store.refreshing = true;
  try {
    const convs = await ChatAPI.conversations();
    const list = Array.isArray(convs) ? convs : [];
    const total = list.reduce((n, c) => n + (Number(c?.unread) || 0), 0);
    setState({ unreadCount: total, loading: false });
  } catch {
    // Leave the last known count in place; a later push/focus retries.
    setState({ loading: false });
  } finally {
    store.refreshing = false;
    if (store.pending) {
      store.pending = false;
      runRefresh();
    }
  }
}

// Public, debounced entry point. Safe to call on every chat push.
export function refreshMessageBadge() {
  if (store.debounceTimer) clearTimeout(store.debounceTimer);
  store.debounceTimer = setTimeout(() => {
    store.debounceTimer = null;
    runRefresh();
  }, REFRESH_DEBOUNCE_MS);
}

// ── window-level triggers (focus / visibility / read) ───────────────
function onFocusOrVisible() {
  if (document.visibilityState === "visible") refreshMessageBadge();
}
function onMessagesRead() {
  refreshMessageBadge();
}

function bindWindow() {
  if (store.windowBound) return;
  store.windowBound = true;
  window.addEventListener("focus", onFocusOrVisible);
  document.addEventListener("visibilitychange", onFocusOrVisible);
  window.addEventListener(MESSAGES_READ_EVENT, onMessagesRead);
}

function unbindWindow() {
  if (!store.windowBound) return;
  store.windowBound = false;
  window.removeEventListener("focus", onFocusOrVisible);
  document.removeEventListener("visibilitychange", onFocusOrVisible);
  window.removeEventListener(MESSAGES_READ_EVENT, onMessagesRead);
}

// ── is this notification frame a chat message? ──────────────────────
function isChatEvent(n) {
  if (!n) return false;
  const t = String(n.type || n.legacy_type || "").toLowerCase();
  return t === "chat" || !!n.conversation_id || !!n?.payload?.conversation_id;
}

// ── the hook ────────────────────────────────────────────────────────
export default function useMessageBadge() {
  const [, setTick] = useState(0);
  // Shares the ONE notification socket (refcounted) — no new connection.
  const { onEvent } = useNotificationSocket();
  // Active identity — switching profile in-app is an in-place bootstrap (no
  // full reload), so we must reset the badge or it shows the previous
  // profile's unread count (cross-profile data leak).
  const { activeProfile, context } = useAuth();

  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    store.listeners.add(listener);
    store.consumers += 1;

    // First consumer on the page: wire window triggers + seed the count.
    if (store.consumers === 1) {
      bindWindow();
    }
    if (store.state.loading) runRefresh();

    return () => {
      store.listeners.delete(listener);
      store.consumers -= 1;
      if (store.consumers === 0) {
        // StrictMode-safe: only tear down if still nobody after a microtask.
        setTimeout(() => {
          if (store.consumers === 0) unbindWindow();
        }, 0);
      }
    };
  }, []);

  // Live bump when a chat message pushes over the notification socket.
  useEffect(
    () =>
      onEvent((n) => {
        if (isChatEvent(n)) refreshMessageBadge();
      }),
    [onEvent]
  );

  // Reset on profile/context switch: zero the stale count immediately, then
  // re-fetch the new identity's total. Runs on mount too (harmless — the
  // count is already 0 and a fetch is already in flight).
  useEffect(() => {
    setState({ unreadCount: 0, loading: true });
    refreshMessageBadge();
  }, [activeProfile?.id, context]);

  return {
    unreadCount: store.state.unreadCount,
    loading: store.state.loading,
    refresh: refreshMessageBadge,
  };
}
