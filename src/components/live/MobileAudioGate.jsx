// src/components/live/MobileAudioGate.jsx
// ──────────────────────────────────────────────────────────────────────────
// Fixes "no audio on mobile" in LiveKit rooms.
//
// Mobile browsers (iOS Safari, Android Chrome) start the audio context
// suspended and BLOCK autoplay of remote audio until a user gesture calls
// room.startAudio(). RoomAudioRenderer creates the <audio> elements, but the
// browser won't actually play them until we resume audio from within a tap.
// Desktop is usually fine (no autoplay block), which is why this only showed
// up for mobile users.
//
// This component:
//   • tries room.startAudio() immediately (works where no gesture is needed),
//   • listens for AudioPlaybackStatusChanged, and
//   • when playback is blocked, shows a full-width "Tap to enable sound"
//     banner whose onClick (a real user gesture) resumes audio.
//
// Mount it INSIDE <LiveKitRoom>, alongside <RoomAudioRenderer />.
// ──────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useRoomContext } from "@livekit/components-react";

// String value of RoomEvent.AudioPlaybackStatusChanged — used directly so this
// works whether or not the RoomEvent enum is imported (stable across livekit
// client v1/v2).
const AUDIO_STATUS_EVENT = "audioPlaybackChanged";

export default function MobileAudioGate() {
  const room = useRoomContext();
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!room) return;

    const sync = () => setBlocked(!room.canPlaybackAudio);

    // Attempt an immediate unblock (succeeds on desktop / already-gestured tabs).
    Promise.resolve(room.startAudio?.()).catch(() => {}).finally(sync);

    room.on?.(AUDIO_STATUS_EVENT, sync);
    return () => room.off?.(AUDIO_STATUS_EVENT, sync);
  }, [room]);

  const enable = async () => {
    try {
      await room.startAudio();
    } catch {
      /* user can tap again */
    }
    setBlocked(!room.canPlaybackAudio);
  };

  if (!blocked) return null;

  return (
    <button
      type="button"
      onClick={enable}
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        padding: "14px 16px",
        border: "none",
        background: "#015865",
        color: "#fff",
        fontWeight: 700,
        fontSize: 15,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        boxShadow: "0 -4px 18px rgba(0,0,0,.25)",
      }}
      aria-label="Enable session audio"
    >
      <span aria-hidden="true" style={{ fontSize: 18 }}>🔊</span>
      Tap to enable sound
    </button>
  );
}
