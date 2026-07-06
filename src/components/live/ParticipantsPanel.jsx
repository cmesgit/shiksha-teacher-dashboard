import { useParticipants, useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { useState, useEffect, useCallback } from "react";
import { IoPeople } from "react-icons/io5";
import { BsMicFill, BsMicMuteFill } from "react-icons/bs";

export default function ParticipantsPanel({ raisedHands = {}, onLowerHand }) {
  const participants = useParticipants();
  const room = useRoomContext();
  const [open, setOpen] = useState(true);
  const [mutedMap, setMutedMap] = useState({});

  // Initialize new participants from their REAL mic track state (not a blind
  // "muted" default). A participant is treated as muted when they have no
  // published mic track, or their mic publication is muted. This keeps the
  // per-row mute button pointing the right way so the first click actually
  // mutes a speaking student instead of sending the opposite command.
  useEffect(() => {
    setMutedMap((prev) => {
      const map = { ...prev };
      for (const p of participants) {
        if (!(p.identity in map)) {
          const micPub =
            p.getTrackPublication?.("microphone") ||
            [...(p.trackPublications?.values?.() || [])].find(
              (pub) => pub.source === "microphone"
            );
          map[p.identity] = micPub ? !!micPub.isMuted : true;
        }
      }
      return map;
    });
  }, [participants]);

  // Sync track mute per participant when they self-mute/unmute
  useEffect(() => {
    const onMuted = (pub, participant) => {
      if (pub.source === "microphone") {
        setMutedMap((prev) => ({ ...prev, [participant.identity]: true }));
      }
    };
    const onUnmuted = (pub, participant) => {
      if (pub.source === "microphone") {
        setMutedMap((prev) => ({ ...prev, [participant.identity]: false }));
      }
    };
    room.on(RoomEvent.TrackMuted, onMuted);
    room.on(RoomEvent.TrackUnmuted, onUnmuted);
    return () => {
      room.off(RoomEvent.TrackMuted, onMuted);
      room.off(RoomEvent.TrackUnmuted, onUnmuted);
    };
  }, [room]);

  const handleToggleMute = async (participant) => {
    try {
      const encoder = new TextEncoder();
      const isMuted = mutedMap[participant.identity];
      const type = isMuted ? "force-unmute" : "force-mute";
      const data = encoder.encode(JSON.stringify({ type }));
      await room.localParticipant.publishData(data, {
        reliable: true,
        destinationIdentities: [participant.identity],
      });
      const newMap = Object.assign({}, mutedMap, { [participant.identity]: !isMuted });
      setMutedMap(newMap);
    } catch (err) {
      console.error("Failed to toggle mute:", err);
    }
  };

  const sortedParticipants = [...participants].sort((a, b) => {
    const getMeta = (p) => { try { return JSON.parse(p.metadata || "{}"); } catch { return {}; } };
    return (getMeta(b).role === "presenter" ? 1 : 0) - (getMeta(a).role === "presenter" ? 1 : 0);
  });

  return (
    <div className="participants-wrapper">
      <div className="participants-header" onClick={() => setOpen((o) => !o)}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <IoPeople size={16} />
          Participants ({participants.length})
        </span>
        <span style={{ fontSize: 12 }}>{open ? "▾" : "▸"}</span>
      </div>
      {open && (
        <div className="participants-row">
          {sortedParticipants.map((p) => {
            const meta = (() => { try { return JSON.parse(p.metadata || "{}"); } catch { return {}; } })();
            const isPresenter = meta.role === "presenter";
            const handRaised = raisedHands[p.identity];
            const displayName = p.name || p.identity;
            return (
              <div key={p.identity} className={"participant-card" + (handRaised ? " hand-raised" : "")}>
                <div className="participant-avatar" style={{ background: isPresenter ? "#1a9e9e" : undefined }}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="participant-name" style={{ flex: 1 }}>
                  {displayName}
                  <span style={{ fontSize: 9, marginLeft: 5, fontWeight: 700, textTransform: "uppercase",
                    color: isPresenter ? "#1a9e9e" : "#6b7280" }}>
                    {isPresenter ? "• Teacher" : "• Student"}
                  </span>
                  {handRaised && (
                    <span className="raised-hand-icon" title="Click to lower hand"
                      style={{ cursor: "pointer", marginLeft: 4 }}
                      onClick={() => onLowerHand && onLowerHand(p.identity)}>✋</span>
                  )}
                </div>
                {!isPresenter && (
                  <button className="participant-mute-btn" onClick={() => handleToggleMute(p)}
                    title={mutedMap[p.identity] ? "Unmute student" : "Mute student"}>
                    {mutedMap[p.identity]
                      ? <BsMicMuteFill size={13} color="#b91c1c" />
                      : <BsMicFill size={13} color="#15803d" />}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
