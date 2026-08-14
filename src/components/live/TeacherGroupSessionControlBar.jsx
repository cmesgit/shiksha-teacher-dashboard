import {
  useRoomContext,
  useLocalParticipant,
} from "@livekit/components-react";
import { useEffect, useRef, useState } from "react";
import groupSessionService from "../../api/groupSessionService";
import { useToast } from "../../contexts/ToastContext";


export default function TeacherGroupSessionControlBar({
  onLeave,
  role,
  activePanel,
  onTogglePanel,
  session,
  isHost = false,
  onHostEndSession = null,
}) {
  const isPresenter = role === "PRESENTER" || role === "teacher";
  const isStudent = !isPresenter;
  const { showToast } = useToast();

  const room = useRoomContext();
  const {
    localParticipant,
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
  } = useLocalParticipant();

  const [micOn, setMicOn] = useState(false);
  const [videoOn, setVideoOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [canUnmute, setCanUnmute] = useState(false);
  const [canVideo, setCanVideo] = useState(false);

  const [otherOpen, setOtherOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [isLocked, setIsLocked] = useState(
    (session?.admitMode || session?.admit_mode || "").toLowerCase() === "locked"
  );
  const [lockBusy, setLockBusy] = useState(false);
  const [handRaised, setHandRaised] = useState(false);

  const mountedAtRef = useRef(Date.now());
  const otherRef = useRef(null);

  const roomCode = session?.shortCode || session?.short_code || session?.id || "";
  const roomCodeText = roomCode ? String(roomCode) : "—";

  const getStartedMs = () => {
    const raw =
      session?.roomStartedAt ||
      session?.room_started_at ||
      session?.roomStarted ||
      null;

    const parsed = raw ? new Date(raw).getTime() : NaN;
    return Number.isNaN(parsed) ? mountedAtRef.current : parsed;
  };

  const formatTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  /* Close Other menu on outside click */
  useEffect(() => {
    const onClick = (e) => {
      if (otherRef.current && !otherRef.current.contains(e.target)) {
        setOtherOpen(false);
      }
    };

    if (otherOpen) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [otherOpen]);

  /* Timer: use backend room_started_at, so rejoin does NOT reset to zero */
  useEffect(() => {
    const update = () => {
      const startedMs = getStartedMs();
      setElapsed(Math.max(0, Math.floor((Date.now() - startedMs) / 1000)));
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [session?.roomStartedAt, session?.room_started_at, session?.id]);

  /* Student-style participant joins with mic + camera off */
  useEffect(() => {
    if (!isStudent || !localParticipant) return;

    localParticipant.setMicrophoneEnabled(false);
    localParticipant.setCameraEnabled(false);
    setMicOn(false);
    setVideoOn(false);
  }, [isStudent, localParticipant]);

  /* Presenter / teacher / instant-meeting state sync.
     Keyed on the reactive enabled-flags so the icon re-syncs once the mic/camera
     track actually publishes (reading the getter once on mount caught a stale
     `false` and forced a double-click to mute). */
  useEffect(() => {
    if (isStudent || !localParticipant) return;

    setMicOn(!!isMicrophoneEnabled);
    setVideoOn(!!isCameraEnabled);
    setScreenOn(!!isScreenShareEnabled);
  }, [isStudent, localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled]);

  /* Commands received from host */
  useEffect(() => {
    if (!room || !localParticipant) return;

    const handleData = (payload) => {
      try {
        const text = new TextDecoder().decode(payload);
        const msg = JSON.parse(text);

        if (msg.type === "force-mute") {
          localParticipant.setMicrophoneEnabled(false);
          setMicOn(false);
          setCanUnmute(false);
        }

        if (msg.type === "force-unmute" || msg.type === "allow-mic") {
          setCanUnmute(true);
          if (msg.type === "force-unmute") {
            localParticipant.setMicrophoneEnabled(true);
            setMicOn(true);
          }
        }

        if (msg.type === "revoke-mic") {
          setCanUnmute(false);
          localParticipant.setMicrophoneEnabled(false);
          setMicOn(false);
        }

        if (msg.type === "force-camera-off") {
          localParticipant.setCameraEnabled(false);
          setVideoOn(false);
          setCanVideo(false);
        }

        if (msg.type === "force-camera-on" || msg.type === "allow-camera") {
          setCanVideo(true);
          if (msg.type === "force-camera-on") {
            localParticipant.setCameraEnabled(true);
            setVideoOn(true);
          }
        }

        if (msg.type === "revoke-camera") {
          setCanVideo(false);
          localParticipant.setCameraEnabled(false);
          setVideoOn(false);
        }

        if (msg.type === "kick") {
          showToast({ type: "error", message: "You have been removed from the session by the host.", duration: 6000 });
          room.disconnect();
          if (onLeave) onLeave();
        }

        if (msg.type === "lower-hand") {
          setHandRaised(false);
        }
      } catch {}
    };

    room.on("dataReceived", handleData);
    return () => room.off("dataReceived", handleData);
  }, [room, localParticipant, onLeave, showToast]);

  const toggleMic = async () => {
    if (!localParticipant) return;
    // A tap is a valid user gesture — use it to also unblock mobile audio
    // playback in case the RoomAudioRenderer was autoplay-suppressed.
    room?.startAudio?.().catch(() => {});
    if (isStudent && !canUnmute && !micOn) return;

    const next = !micOn;
    await localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  };

  const toggleVideo = async () => {
    if (!localParticipant) return;
    if (isStudent && !canVideo && !videoOn) return;

    const next = !videoOn;
    await localParticipant.setCameraEnabled(next);
    setVideoOn(next);
  };

  const toggleScreen = async () => {
    if (!localParticipant) return;

    const next = !screenOn;
    try {
      await localParticipant.setScreenShareEnabled(next);
      setScreenOn(next);
    } catch (e) {
      console.error("screen share failed", e);
    }
  };

  const leaveRoom = async () => {
    await room.disconnect();
    if (onLeave) onLeave();
  };

  // Same raise/lower-hand protocol as the other control bars in this app —
  // kept inline so it renders with this file's tgs-cb-* classes.
  const toggleHand = async () => {
    if (!localParticipant) return;
    const type = handRaised ? "lower-hand" : "raise-hand";
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ type })),
        { reliable: true }
      );
      setHandRaised(!handRaised);
      window.dispatchEvent(new CustomEvent("raise-hand-local", {
        detail: { type, identity: localParticipant.identity },
      }));
    } catch (e) {
      console.error("raise-hand failed", e);
    }
  };

  const copySessionId = async () => {
    try {
      await navigator.clipboard.writeText(roomCodeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      window.prompt("Copy this session ID:", roomCodeText);
    }
  };

  const muteAllParticipants = async () => {
    if (!isHost || !localParticipant) return;

    try {
      const payload = new TextEncoder().encode(JSON.stringify({ type: "force-mute" }));
      await localParticipant.publishData(payload, { reliable: true });
      setOtherOpen(false);
    } catch (e) {
      console.error("Mute all participants failed", e);
    }
  };

  const toggleLockSession = async () => {
    if (!isHost || !session?.id || lockBusy) return;

    const nextMode = isLocked ? "open" : "locked";
    setLockBusy(true);

    try {
      await groupSessionService.setAdmitMode(session.id, nextMode);
      setIsLocked(nextMode === "locked");
      setOtherOpen(false);
    } catch (e) {
      console.error("Lock session failed", e);
    } finally {
      setLockBusy(false);
    }
  };

  const endSession = () => {
    setOtherOpen(false);
    if (onHostEndSession) onHostEndSession();
  };

  return (
    <div className="tgs-control-bar">
      <div className="tgs-cb-timer">{formatTime(elapsed)}</div>

      <div className="tgs-cb-center">
        <button
          className="tgs-cb-btn"
          onClick={toggleMic}
          title={micOn ? "Mute" : "Unmute"}
        >
          <div className={`tgs-cb-icon ${micOn ? "" : "tgs-cb-icon--off"}`}>
            {micOn ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="1" y1="1" x2="23" y2="23"/>
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            )}
          </div>
          <span className="tgs-cb-label">{micOn ? "Mute" : "Unmute"}</span>
        </button>

        <button
          className="tgs-cb-btn"
          onClick={toggleVideo}
          title={videoOn ? "Turn off camera" : "Turn on camera"}
        >
          <div className={`tgs-cb-icon ${videoOn ? "" : "tgs-cb-icon--off"}`}>
            {videoOn ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7"/>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            )}
          </div>
          <span className="tgs-cb-label">Video</span>
        </button>

        <button className="tgs-cb-btn" onClick={toggleScreen} title="Share screen">
          <div className={`tgs-cb-icon ${screenOn ? "tgs-cb-icon--active" : ""}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <polyline points="8 21 12 17 16 21"/>
              <line x1="12" y1="17" x2="12" y2="11"/>
              <polyline points="9 14 12 11 15 14"/>
            </svg>
          </div>
          <span className="tgs-cb-label">Screen</span>
        </button>

        {isStudent && (
          <button className="tgs-cb-btn" onClick={toggleHand} title={handRaised ? "Lower hand" : "Raise hand"}>
            <div className={`tgs-cb-icon ${handRaised ? "tgs-cb-icon--active" : ""}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 12V4.5a1.5 1.5 0 0 1 3 0V11" />
                <path d="M11 11V2.5a1.5 1.5 0 0 1 3 0V11" />
                <path d="M14 11.5V4.5a1.5 1.5 0 0 1 3 0V15" />
                <path d="M17 8.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-2a7 7 0 0 1-6.29-3.94l-2.4-4.79a1.5 1.5 0 0 1 2.63-1.45L8 12" />
              </svg>
            </div>
            <span className="tgs-cb-label">{handRaised ? "Lower" : "Raise"}</span>
          </button>
        )}

        <div className="tgs-cb-other-wrap" ref={otherRef}>
          <button
            className={`tgs-cb-btn ${otherOpen ? "tgs-cb-btn--active" : ""}`}
            title="More options"
            onClick={() => setOtherOpen((v) => !v)}
          >
            <div className="tgs-cb-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="5" r="1"/>
                <circle cx="12" cy="12" r="1"/>
                <circle cx="12" cy="19" r="1"/>
              </svg>
            </div>
            <span className="tgs-cb-label">Other</span>
          </button>

          {otherOpen && (
            <div className="tgs-cb-other-menu">
              <button
                type="button"
                className="tgs-cb-other-session"
                onClick={copySessionId}
                title="Copy session ID"
              >
                <span className="tgs-cb-other-label">Session ID</span>

                <span className="tgs-cb-other-code-row">
                  <strong>{roomCodeText}</strong>
                  <span className="tgs-cb-copy-icon">
                    {copied ? "✓" : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                    )}
                  </span>
                </span>
              </button>

              {isHost && (
                <>
                  <button type="button" className="tgs-cb-other-item" onClick={muteAllParticipants}>
                    <span>Mute All Participants</span>
                    <span className="tgs-cb-other-check" />
                  </button>

                  <button
                    type="button"
                    className="tgs-cb-other-item"
                    disabled={lockBusy}
                    onClick={toggleLockSession}
                  >
                    <span>{isLocked ? "Unlock Session" : "Lock Session"}</span>
                    <span className={`tgs-cb-other-check ${isLocked ? "tgs-cb-other-check--on" : ""}`} />
                  </button>
                </>
              )}

              {isHost && (
                <button type="button" className="tgs-cb-other-item tgs-cb-other-item--danger" onClick={endSession}>
                  <span>End Session</span>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>
                    <line x1="12" y1="2" x2="12" y2="12"/>
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>

        <button className="tgs-cb-btn" onClick={leaveRoom} title="Leave session">
          <div className="tgs-cb-icon tgs-cb-icon--leave">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" transform="rotate(135 12 12)"/>
            </svg>
          </div>
          <span className="tgs-cb-label">Leave</span>
        </button>
      </div>

      <div className="tgs-cb-right">
        <button
          className={`tgs-cb-side-btn ${activePanel === "info" ? "tgs-cb-side-btn--active" : ""}`}
          onClick={() => onTogglePanel("info")}
          title="Session info"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <span>Info</span>
        </button>

        <button
          className={`tgs-cb-side-btn ${activePanel === "people" ? "tgs-cb-side-btn--active" : ""}`}
          onClick={() => onTogglePanel("people")}
          title="Participants"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <span>People</span>
        </button>

        <button
          className={`tgs-cb-side-btn ${activePanel === "chat" ? "tgs-cb-side-btn--active" : ""}`}
          onClick={() => onTogglePanel("chat")}
          title="Chat"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span>Chat</span>
        </button>

        <button
          className={`tgs-cb-side-btn ${activePanel === "notes" ? "tgs-cb-side-btn--active" : ""}`}
          onClick={() => onTogglePanel("notes")}
          title="Notes"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          <span>Notes</span>
        </button>
      </div>
    </div>
  );
}
