// src/components/live/ReconnectingBanner.jsx
// Mount inside a <LiveKitRoom> (it needs the Room context from
// useConnectionState). Every classroom page previously wired
// onDisconnected straight to navigate(...) with no feedback in between —
// a transient network blip triggered LiveKit's silent built-in retry with
// nothing shown to the user.
import { useConnectionState } from "@livekit/components-react";
import { ConnectionState } from "livekit-client";

export default function ReconnectingBanner() {
  const state = useConnectionState();
  if (state !== ConnectionState.Reconnecting && state !== ConnectionState.SignalReconnecting) {
    return null;
  }
  return (
    <div
      role="status"
      style={{
        position: "absolute",
        top: 14,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
        background: "rgba(20, 20, 20, 0.85)",
        color: "#fff",
        padding: "8px 16px",
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "#facc15",
          animation: "reconnect-pulse 1s ease-in-out infinite",
          display: "inline-block",
        }}
      />
      Reconnecting…
      <style>{"@keyframes reconnect-pulse{0%,100%{opacity:1}50%{opacity:.35}}"}</style>
    </div>
  );
}
