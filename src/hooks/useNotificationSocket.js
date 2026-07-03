// ============================================================
// SHARED — src/hooks/useNotificationSocket.js
// Used by BOTH student and teacher apps (FULL REPLACEMENT)
// ============================================================
//
// WHAT CHANGED vs the previous version
// ────────────────────────────────────
// 1. ROUTE FIX: connects to /ws/updates/ (the route that exists in
//    accounts/routing.py). The old /ws/notifications/ route never existed —
//    the socket failed its handshake forever and the bell only worked via
//    the REST feed fetch.
// 2. AUTH: relies on the `access` cookie (how the rest of the app
//    authenticates). A ?token= param is appended only when a token exists in
//    storage — the patched JWTAuthMiddleware now honors it as a fallback,
//    which makes localhost / cross-port dev work too.
// 3. ENVELOPE: the patched UserUpdateConsumer frames messages as
//    {"type": "notification" | "user_update" | "pong", "data": {...}}.
//    Only "notification" events feed the bell.
// 4. KEEPALIVE: pings every 25s so Nginx/proxies don't idle-close the socket
//    (same pattern as shared/chatClient.js).
// 5. 4401 HANDLING: if the server closes with 4401 (expired/absent token),
//    we call /accounts/refresh/ once, then reconnect immediately instead of
//    hammering with a dead cookie.
// 6. STRICTMODE-SAFE: the "unmounted" flag is reset on every mount, so React
//    18 dev double-mount no longer permanently disables the socket.
//
// Public API is unchanged: { notifications, unreadCount, loading,
// markAllRead, markOneRead, clearNotifications }.

import { useEffect, useRef, useState, useCallback } from "react";
import api from "../api/apiClient";

const WS_HOST = import.meta.env.VITE_WS_HOST || "api.shikshacom.com";
const MAX_NOTIFICATIONS = 50;
const BASE_RECONNECT_DELAY = 3000;   // 3s
const MAX_RECONNECT_DELAY = 30000;   // 30s cap
const PING_MS = 25000;               // keepalive interval

export default function useNotificationSocket() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectDelay = useRef(BASE_RECONNECT_DELAY);
  const pingTimer = useRef(null);
  const refreshTried = useRef(false); // one refresh attempt per auth failure
  const unmounted = useRef(false);

  // ----------------------------------------------------------
  // 1. Fetch persisted feed on mount — fills the bell on reload
  // ----------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/activity/feed/?limit=20");
        if (cancelled) return;
        const items = res.data?.results ?? res.data ?? [];
        setNotifications(items);
        setUnreadCount(items.filter((n) => !n.is_read).length);
      } catch {
        // silently fail — WS will still work
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ----------------------------------------------------------
  // 2. WebSocket connection
  // ----------------------------------------------------------
  const stopPing = () => {
    if (pingTimer.current) {
      clearInterval(pingTimer.current);
      pingTimer.current = null;
    }
  };

  const startPing = (ws) => {
    stopPing();
    pingTimer.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ type: "ping" })); } catch {}
      }
    }, PING_MS);
  };

  const connect = useCallback(() => {
    if (unmounted.current) return;

    // Auth rides on the `access` cookie. A stored token (if any) is appended
    // as ?token= for cookie-less contexts (e.g. localhost dev cross-port).
    const token =
      localStorage.getItem("access") ||
      sessionStorage.getItem("access") ||
      "";

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${WS_HOST}/ws/updates/${token ? `?token=${encodeURIComponent(token)}` : ""}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmounted.current) return;
      reconnectDelay.current = BASE_RECONNECT_DELAY;
      refreshTried.current = false;
      startPing(ws);
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };

    ws.onmessage = (e) => {
      if (unmounted.current) return;
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "notification" && msg.data) {
          setNotifications((prev) => [msg.data, ...prev].slice(0, MAX_NOTIFICATIONS));
          setUnreadCount((prev) => prev + 1);
        }
        // "user_update" events are available here for future use;
        // "pong" is the keepalive reply — ignored.
      } catch {}
    };

    ws.onclose = async (event) => {
      stopPing();
      if (unmounted.current) return;

      // 4401 = unauthenticated (expired access token). Refresh once, then
      // reconnect right away — the new cookie rides on the next handshake.
      if (event.code === 4401 && !refreshTried.current) {
        refreshTried.current = true;
        try {
          await api.post("/accounts/refresh/");
          if (!unmounted.current) connect();
          return;
        } catch {
          // refresh failed — fall through to normal backoff; the axios
          // interceptor will handle redirect-to-login on the next REST call.
        }
      }

      reconnectTimer.current = setTimeout(() => {
        reconnectDelay.current = Math.min(
          reconnectDelay.current * 2,
          MAX_RECONNECT_DELAY
        );
        connect();
      }, reconnectDelay.current);
    };

    ws.onerror = () => {
      try { ws.close(); } catch {}
    };
  }, []);

  useEffect(() => {
    unmounted.current = false; // StrictMode remount resets the flag
    connect();
    return () => {
      unmounted.current = true;
      stopPing();
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
      }
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect]);

  // ----------------------------------------------------------
  // 3. markAllRead — persists to backend
  // ----------------------------------------------------------
  const markAllRead = useCallback(async () => {
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await api.post("/activity/feed/read-all/");
    } catch {}
  }, []);

  // ----------------------------------------------------------
  // 4. markOneRead — for single item clicks
  // ----------------------------------------------------------
  const markOneRead = useCallback(async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await api.patch(`/activity/feed/${id}/read/`);
    } catch {}
  }, []);

  // ----------------------------------------------------------
  // 5. clearNotifications — UI-only, does not delete from backend
  // ----------------------------------------------------------
  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    markAllRead,
    markOneRead,
    clearNotifications,
  };
}
