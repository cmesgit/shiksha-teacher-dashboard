import { useTracks, VideoTrack, useRoomContext } from "@livekit/components-react";
import { Track } from "livekit-client";
import LiveChatPanel from "./LiveChatPanel";
import TeacherControls from "./TeacherControls";
import ControlBar from "./ControlBar";
import React, { useState, useRef, useEffect } from "react";
import "../../styles/live.css";
import useLiveSessionChat from "../../hooks/useLiveSessionChat";
import { MdFullscreen, MdFullscreenExit } from "react-icons/md";
import { HiDotsVertical } from "react-icons/hi";

export default function ClassroomUI({
  role,
  sessionId: sessionIdProp,
  onLeave,
}) {
  const isPresenter = role === "PRESENTER";

  const [raisedHands, setRaisedHands] = useState({});
  const [raiseHandToasts, setRaiseHandToasts] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [activePanel, setActivePanel] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);

  // Force re-render when any participant's mic/cam/track changes
  const [, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);

  const containerRef = useRef(null);
  const room = useRoomContext();

  const sessionId =
    sessionIdProp ||
    window.location.pathname.split("/").filter(Boolean).pop();

  const { messages: chatMessages, sendMessage } = useLiveSessionChat(sessionId);

  /* ───── PANEL TOGGLE ───── */
  const togglePanel = (panel) => {
    setActivePanel((current) => (current === panel ? null : panel));
    setOpenMenuId(null);
  };

  /* ───── Close menu on outside click ───── */
  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    if (openMenuId) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [openMenuId]);

  /* ───── FULLSCREEN ───── */
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        const el = containerRef.current;
        if (el?.requestFullscreen) await el.requestFullscreen();
        else if (el?.webkitRequestFullscreen) await el.webkitRequestFullscreen();
        else if (el?.msRequestFullscreen) await el.msRequestFullscreen();
      } else {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
        else if (document.msExitFullscreen) await document.msExitFullscreen();
      }
    } catch (e) {
      console.error("Fullscreen failed:", e);
    }
  };

  useEffect(() => {
    const onFSChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFSChange);
    document.addEventListener("webkitfullscreenchange", onFSChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFSChange);
      document.removeEventListener("webkitfullscreenchange", onFSChange);
    };
  }, []);

  /* ───── RE-RENDER ON PARTICIPANT TRACK CHANGES ─────
     LiveKit doesn't auto-trigger React re-renders when a remote
     participant mutes/unmutes — so we force one by bumping a tick.
  */
  useEffect(() => {
    if (!room) return;

    const events = [
      "trackMuted",
      "trackUnmuted",
      "trackPublished",
      "trackUnpublished",
      "trackSubscribed",
      "trackUnsubscribed",
      "participantConnected",
      "participantDisconnected",
      "localTrackPublished",
      "localTrackUnpublished",
    ];

    events.forEach((evt) => room.on(evt, bump));

    return () => {
      events.forEach((evt) => room.off(evt, bump));
    };
  }, [room]);

  /* ───── REMOTE RAISE HAND ───── */
  useEffect(() => {
    const handleData = (payload, participant) => {
      try {
        const text = new TextDecoder().decode(payload);
        const msg = JSON.parse(text);

        if (msg.type === "raise-hand") {
          const identity = participant.identity;
          const displayName = participant.name || identity;
          setRaisedHands((prev) => ({ ...prev, [identity]: true }));

          if (isPresenter) {
            const toastId = Date.now() + Math.random();
            setRaiseHandToasts((prev) => [...prev, { id: toastId, identity, displayName }]);
            setTimeout(() => {
              setRaiseHandToasts((prev) =>
                prev.filter((t) => t.id !== toastId)
              );
            }, 5000);
          }
        }

        if (msg.type === "lower-hand") {
          const identity = participant.identity;
          setRaisedHands((prev) => {
            const updated = { ...prev };
            delete updated[identity];
            return updated;
          });
        }
      } catch {}
    };

    room.on("dataReceived", handleData);
    return () => room.off("dataReceived", handleData);
  }, [room, isPresenter]);

  /* ───── TEACHER ACTIONS ───── */
  const sendToStudent = async (identity, msgObj) => {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(msgObj));
      await room.localParticipant.publishData(data, {
        reliable: true,
        destinationIdentities: [identity],
      });
    } catch (err) {
      console.error("sendToStudent error:", err);
    }
  };

  const lowerStudentHand = async (identity) => {
    await sendToStudent(identity, { type: "lower-hand" });
    setRaisedHands((prev) => {
      const updated = { ...prev };
      delete updated[identity];
      return updated;
    });
    setOpenMenuId(null);
  };

  const toggleStudentMic = async (identity, isMicOn) => {
    if (isMicOn) {
      await sendToStudent(identity, { type: "force-mute" });
    } else {
      await sendToStudent(identity, { type: "force-unmute" });
    }
    setOpenMenuId(null);
  };

  const kickStudent = async (identity, name) => {
    if (!window.confirm(`Remove ${name || identity} from the session?`)) return;
    try {
      await sendToStudent(identity, { type: "kick" });
    } catch (err) {
      console.error("Kick error:", err);
    }
    setOpenMenuId(null);
  };

  /* ───── TRACKS ───── */
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: false },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);

  const screenTrack = tracks.find((t) => t.source === Track.Source.ScreenShare);
  const cameraTrack = tracks.find((t) => t.source === Track.Source.Camera);
  const mainTrack = screenTrack || cameraTrack;
  const pipTrack = screenTrack ? cameraTrack : null;

  /* ───── WAITING ───── */
  if (!mainTrack) {
    return (
      <div className="waiting-screen">
        <div className="waiting-card">
          <div className="waiting-pulse" />
          <h2>
            {isPresenter
              ? "Enable your camera to start the session"
              : "Waiting for teacher to start..."}
          </h2>
          {!isPresenter && (
            <p>You will be connected as soon as the session begins</p>
          )}
        </div>
      </div>
    );
  }

  /* ── Build participants list ── */
  const remoteParticipants = room.remoteParticipants
    ? Array.from(room.remoteParticipants.values()).map((p) => ({
        identity: p.identity,
        name: p.name || p.identity,
        role: "Student",
        micOn: p.isMicrophoneEnabled,
        camOn: p.isCameraEnabled,
        handRaised: !!raisedHands[p.identity],
        isTeacher: false,
        isMe: false,
      }))
    : [];

  const localId = room.localParticipant?.identity;
  const localName = room.localParticipant?.name || localId || "You";

  // Build unified list — teacher at top (dark navy), then me, then peers
  let peopleList = [];

  if (isPresenter) {
    peopleList.push({
      identity: localId,
      name: localName,
      role: "Teacher",
      micOn: room.localParticipant?.isMicrophoneEnabled,
      camOn: room.localParticipant?.isCameraEnabled,
      handRaised: false,
      isTeacher: true,
      isMe: true,
    });
    peopleList = peopleList.concat(remoteParticipants);
  } else {
    peopleList.push({
      identity: localId,
      name: "You",
      role: "Student",
      micOn: room.localParticipant?.isMicrophoneEnabled,
      camOn: room.localParticipant?.isCameraEnabled,
      handRaised: false,
      isTeacher: false,
      isMe: true,
    });
    peopleList = peopleList.concat(remoteParticipants);
  }

  /* ───── MAIN UI ───── */
  return (
    <div
      className={
        "classroom-layout" +
        (isFullscreen ? " fs-mode" : "") +
        (!activePanel ? " panel-closed" : "")
      }
      ref={containerRef}
    >

      {/* TOASTS */}
      {isPresenter && raiseHandToasts.length > 0 && (
        <div className="rh-toasts">
          {raiseHandToasts.map((t) => (
            <div key={t.id} className="rh-toast">
              <span>✋ <strong>{t.displayName || t.identity}</strong> raised their hand</span>
              <button
                className="rh-toast-btn"
                onClick={() => lowerStudentHand(t.identity)}
              >
                Lower
              </button>
            </div>
          ))}
        </div>
      )}

      {/* LEFT COLUMN: video + control bar */}
      <div className="classroom-main">

        {/* VIDEO */}
        <div className="main-stage">
          <VideoTrack trackRef={mainTrack} />

          {pipTrack && (
            <div className="pip-camera">
              <VideoTrack trackRef={pipTrack} />
            </div>
          )}

          {isPresenter && (
            <TeacherControls sessionId={sessionId} onLeave={onLeave} />
          )}

          <button
            className="video-fs-btn"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <MdFullscreenExit size={22} /> : <MdFullscreen size={22} />}
          </button>
        </div>

        {/* CONTROL BAR */}
        <ControlBar
          onLeave={onLeave}
          role={role}
          activePanel={activePanel}
          onTogglePanel={togglePanel}
          sessionId={sessionId}
        />
      </div>

      {activePanel && (
        <div className="right-sidebar">

          {activePanel === "chat" && (
            <LiveChatPanel
              role={role}
              messages={chatMessages}
              onSendMessage={sendMessage}
              participants={peopleList}
            />
          )}

          {activePanel === "people" && (
            <div className="ppl-panel">
              {/* HEADER */}
              <div className="ppl-header">
                Participants ({peopleList.length})
              </div>

              {/* LIST */}
              <div className="ppl-list">
                {peopleList.length === 0 ? (
                  <p className="ppl-empty">No participants yet.</p>
                ) : (
                  peopleList.map((p, i) => (
                    <div
                      key={p.identity || i}
                      className={
                        "ppl-card" +
                        (p.isTeacher ? " ppl-card--teacher" : "")
                      }
                    >
                      <div className="ppl-avatar">
                        {p.avatarUrl ? (
                          <img src={p.avatarUrl} alt={p.name} />
                        ) : (
                          p.name?.charAt(0)?.toUpperCase() || "?"
                        )}
                      </div>

                      <div className="ppl-info">
                        <div className="ppl-name">
                          {p.isMe ? "You" : p.name}
                        </div>
                        <div className="ppl-role">{p.role}</div>
                      </div>

                      <div className="ppl-actions">
                        {/* MIC ICON — clickable for teacher (toggles student mic) */}
                        {isPresenter && !p.isMe ? (
                          <button
                            className={`ppl-mic ppl-mic--btn ${p.micOn ? "ppl-mic--on" : "ppl-mic--off"}`}
                            onClick={() => toggleStudentMic(p.identity, p.micOn)}
                            title={p.micOn ? "Mute student" : "Unmute student"}
                          >
                            {p.micOn ? (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                                <line x1="12" y1="19" x2="12" y2="23"/>
                                <line x1="8" y1="23" x2="16" y2="23"/>
                              </svg>
                            ) : (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="1" y1="1" x2="23" y2="23"/>
                                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
                                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
                                <line x1="12" y1="19" x2="12" y2="23"/>
                                <line x1="8" y1="23" x2="16" y2="23"/>
                              </svg>
                            )}
                          </button>
                        ) : (
                          /* Indicator-only mic icon for self and for student view */
                          <div className={`ppl-mic ${p.micOn ? "ppl-mic--on" : "ppl-mic--off"}`}>
                            {p.micOn ? (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                                <line x1="12" y1="19" x2="12" y2="23"/>
                                <line x1="8" y1="23" x2="16" y2="23"/>
                              </svg>
                            ) : (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="1" y1="1" x2="23" y2="23"/>
                                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
                                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
                                <line x1="12" y1="19" x2="12" y2="23"/>
                                <line x1="8" y1="23" x2="16" y2="23"/>
                              </svg>
                            )}
                          </div>
                        )}

                        {/* 3-DOT MENU — teacher only, never on self, never on teacher row */}
                        {isPresenter && !p.isMe && !p.isTeacher && (
                          <div
                            className="ppl-menu-wrap"
                            ref={openMenuId === p.identity ? menuRef : null}
                          >
                            <button
                              className="ppl-menu-btn"
                              onClick={() =>
                                setOpenMenuId(
                                  openMenuId === p.identity ? null : p.identity
                                )
                              }
                              title="More options"
                            >
                              <HiDotsVertical size={16} />
                            </button>

                            {openMenuId === p.identity && (
                              <div className="ppl-menu">
                                <button
                                  className="ppl-menu-item ppl-menu-item--danger"
                                  onClick={() => kickStudent(p.identity, p.name)}
                                >
                                  Kick from session
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activePanel === "info" && (
            <div className="side-panel">
              <div className="side-panel__header">
                <h3>Session Info</h3>
                <button
                  className="side-panel__close"
                  onClick={() => setActivePanel(null)}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <div className="side-panel__body">
                <div className="side-panel__field">
                  <div className="side-panel__field-label">Session ID</div>
                  <div className="side-panel__field-value">{sessionId}</div>
                </div>
                <div className="side-panel__field">
                  <div className="side-panel__field-label">Your role</div>
                  <div className="side-panel__field-value">
                    {isPresenter ? "Teacher" : "Student"}
                  </div>
                </div>
                <div className="side-panel__field">
                  <div className="side-panel__field-label">Participants</div>
                  <div className="side-panel__field-value">
                    {peopleList.length}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
