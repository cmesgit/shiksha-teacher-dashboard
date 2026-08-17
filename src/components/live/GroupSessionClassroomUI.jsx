/**
 * GroupSessionClassroomUI.jsx  (TEACHER app)
 *
 * Group-session live room — Google-Meet-style multi-participant layout.
 *
 * WHAT CHANGED vs the old version
 * --------------------------------
 * 1. Every participant now gets their own video tile (grid mode) instead of
 *    a single "main" video. Uses useTracks({ withPlaceholder:true }) so
 *    camera-OFF participants still appear as an avatar tile.
 * 2. Screen-share promotes to a large focus pane + a horizontal film-strip
 *    of every camera (spotlight mode).
 * 3. Removed the old `if (!mainTrack) return <waiting/>` block. That hid the
 *    control bar whenever your camera was off, so you could never turn it on.
 *    The room (and controls) now always render.
 * 4. Active-speaker highlight, per-tile mic state, raise-hand and host badges.
 *
 * Everything else (chat, raise-hand data messages, panels, control bar,
 * fullscreen) is unchanged. Private Sessions and normal Live Sessions are
 * not affected — this component and its CSS use the tgs-* prefix only.
 */

import { useTracks, VideoTrack, useRoomContext } from "@livekit/components-react";
import { Track } from "livekit-client";
import TeacherGroupSessionChatPanel from "./TeacherGroupSessionChatPanel";
import NotesPanel from "./NotesPanel";
import FilesPanel from "./FilesPanel";
import TeacherGroupSessionControlBar from "./TeacherGroupSessionControlBar";
import React, { useState, useRef, useEffect } from "react";
import "../../styles/teacherGroupSessionLive.css";
import api from "../../api/apiClient";
import groupSessionService from "../../api/groupSessionService";
import { useAuth } from "../../contexts/AuthContext";
import soundManager from "../../utils/soundManager";
import { MdFullscreen, MdFullscreenExit } from "react-icons/md";

function formatDate(d) {
  if (!d) return "—";
  try {
    return new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "2-digit",
    });
  } catch {
    return d;
  }
}

function formatTime(t) {
  if (!t) return "—";
  try {
    const [h, m] = String(t).split(":");
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "p.m" : "a.m";
    const h12 = hour % 12 || 12;
    return `${h12}:${m || "00"} ${ampm}`;
  } catch {
    return t;
  }
}

function addMinutesToTime(time, minutes) {
  if (!time || !minutes) return "";
  const [h, m] = String(time).split(":").map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  d.setMinutes(d.getMinutes() + Number(minutes || 0));
  return d.toTimeString().slice(0, 5);
}

function formatTiming(session) {
  if (!session?.time) return "—";
  const end = addMinutesToTime(session.time, session.durationMinutes || session.duration_minutes || 0);
  return `${formatTime(session.time)}${end ? ` (${formatTime(end)})` : ""}`;
}

function sameId(a, b) {
  return a && b && String(a) === String(b);
}

function formatMmSs(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function readParticipantMeta(participant) {
  try {
    return participant?.metadata ? JSON.parse(participant.metadata) : {};
  } catch {
    return {};
  }
}

/* Small mic glyph reused inside each tile */
function MicIcon({ on }) {
  return on ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
    </svg>
  );
}

/**
 * One participant tile. Renders live video when the camera track is
 * published + unmuted, otherwise an avatar placeholder.
 */
function ParticipantTile({ trackRef, variant, isLocal, isHost, micOn, speaking, handRaised, displayName }) {
  const pub = trackRef?.publication;
  const showVideo = !!pub && !pub.isMuted;
  const initial = String(displayName || "?").trim().charAt(0).toUpperCase() || "?";

  const cls = [
    "tgs-tile",
    variant === "strip" ? "tgs-tile--strip" : "",
    isLocal ? "tgs-tile--self" : "",
    speaking ? "tgs-tile--speaking" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={cls}>
      {showVideo ? (
        <VideoTrack trackRef={trackRef} />
      ) : (
        <div className="tgs-tile-placeholder">
          <div className="tgs-tile-avatar">{initial}</div>
        </div>
      )}

      <div className="tgs-tile-badges">
        {handRaised ? <span className="tgs-tile-hand">✋</span> : <span />}
        {isHost && <span className="tgs-tile-tag">Host</span>}
      </div>

      <div className="tgs-tile-footer">
        <span className={`tgs-tile-mic ${micOn ? "is-on" : "is-off"}`}>
          <MicIcon on={micOn} />
        </span>
        <span className="tgs-tile-name">{isLocal ? `${displayName} (You)` : displayName}</span>
      </div>
    </div>
  );
}

export default function GroupSessionClassroomUI({
  role,
  session,
  chatConfig,
  onLeave,
  groupSessionRemainingMs = null,
  isHost = false,
  onEndSession = null,
  liveLimits = null,
}) {
  const isPresenter = role === "PRESENTER" || role === "teacher";

  const [raisedHands, setRaisedHands] = useState({});
  const [raiseHandToasts, setRaiseHandToasts] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activePanel, setActivePanel] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatSocket, setChatSocket] = useState(null);
  const [peopleTab, setPeopleTab] = useState("participants");
  const [joinRequests, setJoinRequests] = useState([]);
  const [admitMode, setAdmitMode] = useState(session?.admitMode || "open");
  const [, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);

  const containerRef = useRef(null);
  const room = useRoomContext();
  const { user } = useAuth();
  const myUserId = user?.id ? String(user.id) : null;
  const hostId = session?.hostId ? String(session.hostId) : null;
  const hostName = session?.hostName || "";

  // Poll pending join requests while the host has the requests tab open —
  // admit/deny is low-frequency, so a short poll is simpler and lower-risk
  // than a dedicated realtime channel (the guest has no LiveKit room yet to
  // receive a data-channel nudge on).
  useEffect(() => {
    if (!isHost || admitMode !== "lobby" || activePanel !== "people" || peopleTab !== "requests") {
      return undefined;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await groupSessionService.getJoinRequests(session?.id);
        if (!cancelled) setJoinRequests(rows);
      } catch {
        /* transient poll failure — try again next tick */
      }
    };
    load();
    const interval = setInterval(load, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [isHost, admitMode, activePanel, peopleTab, session?.id]);

  const toggleAdmitMode = async () => {
    const next = admitMode === "lobby" ? "open" : "lobby";
    try {
      await groupSessionService.setAdmitMode(session?.id, next);
      setAdmitMode(next);
    } catch (e) {
      console.error("setAdmitMode failed", e);
    }
  };

  const admitRequest = async (requestId) => {
    try {
      await groupSessionService.admitJoinRequest(session?.id, requestId);
      setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (e) {
      console.error("admit failed", e);
    }
  };

  const denyRequest = async (requestId) => {
    try {
      await groupSessionService.denyJoinRequest(session?.id, requestId);
      setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (e) {
      console.error("deny failed", e);
    }
  };

  const togglePanel = (panel) => {
    setActivePanel((current) => (current === panel ? null : panel));
    if (panel === "people") setPeopleTab("participants");
  };

  /* Fullscreen */
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
    } catch {}
  };

  useEffect(() => {
    const fn = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", fn);
    document.addEventListener("webkitfullscreenchange", fn);

    return () => {
      document.removeEventListener("fullscreenchange", fn);
      document.removeEventListener("webkitfullscreenchange", fn);
    };
  }, []);

  /* Re-render on LiveKit track / participant / speaker changes */
  useEffect(() => {
    if (!room) return;

    const events = [
      "trackMuted", "trackUnmuted", "trackPublished", "trackUnpublished",
      "trackSubscribed", "trackUnsubscribed", "participantConnected",
      "participantDisconnected", "localTrackPublished", "localTrackUnpublished",
      "activeSpeakersChanged",
    ];

    events.forEach((evt) => room.on(evt, bump));
    return () => events.forEach((evt) => room.off(evt, bump));
  }, [room]);

  /* Raise hand data messages */
  useEffect(() => {
    if (!room) return;

    const handleData = (payload, participant) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));

        if (msg.type === "raise-hand" || msg.type === "RAISE_HAND") {
          const identity = participant.identity;
          const displayName = participant.name || identity;

          setRaisedHands((prev) => ({ ...prev, [identity]: true }));

          const toastId = Date.now() + Math.random();
          setRaiseHandToasts((prev) => [...prev, { id: toastId, identity, displayName }]);

          setTimeout(() => {
            setRaiseHandToasts((prev) => prev.filter((t) => t.id !== toastId));
          }, 5000);
        }

        if (msg.type === "lower-hand" || msg.type === "LOWER_HAND") {
          const identity = participant.identity;
          setRaisedHands((prev) => {
            const u = { ...prev };
            delete u[identity];
            return u;
          });
        }
      } catch {}
    };

    room.on("dataReceived", handleData);
    return () => room.off("dataReceived", handleData);
  }, [room]);

  /* Load chat history */
  useEffect(() => {
    if (!chatConfig || !session?.id) return;

    api.get(chatConfig.restGetPath).then((res) => {
      setChatMessages((res.data || []).map((m) => ({
        id: m.id,
        sender: m.sender_name,
        text: m.message,
        isTeacher: m.sender_role === "teacher",
        isMe: myUserId && String(m.sender_id) === myUserId,
        time: new Date(m.created_at),
      })));
    }).catch(() => {});
  }, [session?.id, myUserId, chatConfig?.restGetPath]);

  /* WebSocket chat */
  useEffect(() => {
    if (!chatConfig || !session?.id) return;

    let ws;
    let reconnectTimer;
    let unmounted = false;

    const connect = () => {
      if (unmounted) return;

      const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
      const wsHost = import.meta.env.VITE_WS_HOST || (isLocal ? window.location.host : "api.shikshacom.com");
      const proto = isLocal && window.location.protocol !== "https:" ? "ws:" : "wss:";
      const token = localStorage.getItem("access") || sessionStorage.getItem("access") || "";

      try {
        ws = new WebSocket(`${proto}//${wsHost}${chatConfig.wsPath}${token ? `?token=${token}` : ""}`);
        setChatSocket(ws);

        ws.onmessage = (ev) => {
          try {
            const { data } = JSON.parse(ev.data);
            if (!data) return;

            setChatMessages((prev) => {
              if (prev.some((m) => m.id === data.id)) return prev;

              const isMe = myUserId && String(data.sender_id) === myUserId;
              if (!isMe) soundManager.messageReceive?.();

              return [...prev, {
                id: data.id,
                sender: data.sender_name,
                text: data.message,
                isTeacher: data.sender_role === "teacher",
                isMe,
                time: new Date(data.created_at),
              }];
            });
          } catch {}
        };

        ws.onclose = () => {
          setChatSocket(null);
          if (!unmounted) reconnectTimer = setTimeout(connect, 3000);
        };

        ws.onerror = () => ws.close();
      } catch {}
    };

    connect();

    return () => {
      unmounted = true;
      clearTimeout(reconnectTimer);
      setChatSocket(null);
      ws?.close();
    };
  }, [session?.id, myUserId, chatConfig?.wsPath]);

  const sendMessage = async (text) => {
    soundManager.messageSend?.();

    if (!chatConfig) return;

    try {
      const res = await api.post(chatConfig.restPostPath, { message: text });
      const msg = res.data;

      setChatMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;

        return [...prev, {
          id: msg.id,
          sender: "You",
          text: msg.message,
          isMe: true,
          isTeacher: isPresenter,
          time: new Date(msg.created_at),
        }];
      });
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { sender: "You", text, isMe: true, time: new Date() },
      ]);
    }
  };

  /* ---------------------------------------------------------------
     Tracks — one camera track PER participant (placeholder when off)
     plus any screen-share. This is what makes it behave like Meet.
     --------------------------------------------------------------- */
  const trackRefs = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const localId = room?.localParticipant?.identity || null;
  const localName = room?.localParticipant?.name || localId || "You";

  const describeParticipant = (p) => {
    const meta = readParticipantMeta(p);
    const idPrefix = String(p?.identity || "").split("_")[0];
    const participantIsHost =
      sameId(idPrefix, hostId) ||
      sameId(meta?.user_id || meta?.userId || meta?.id, hostId) ||
      (!!hostName && String(p?.name || "").trim() === String(hostName).trim());
    const rawRole = String(meta?.role || meta?.user_role || "").toLowerCase();
    const roleLabel = participantIsHost
      ? "Host"
      : rawRole.includes("teacher")
        ? "Teacher"
        : rawRole.includes("student")
          ? "Student"
          : "Participant";
    return { isHost: participantIsHost, rawRole, roleLabel };
  };

  const screenShareTrack = trackRefs.find(
    (t) => t.source === Track.Source.ScreenShare && t.publication
  );

  const cameraTiles = trackRefs.filter((t) => t.source === Track.Source.Camera);

  /* Host first, then teachers, then students, then yourself last */
  const orderedTiles = [...cameraTiles].sort((a, b) => {
    const rank = (t) => {
      const p = t.participant;
      if (p.identity === localId) return isHost ? 0 : 3;
      const { isHost: h, rawRole } = describeParticipant(p);
      if (h) return 0;
      if (rawRole.includes("teacher")) return 1;
      return 2;
    };
    return rank(a) - rank(b);
  });

  const isAlone = orderedTiles.length <= 1;
  const gridCols = Math.max(1, Math.ceil(Math.sqrt(orderedTiles.length || 1)));

  const renderTile = (tr, variant) => {
    const p = tr.participant;
    const isLocalP = p.identity === localId;
    const { isHost: pHost } = describeParticipant(p);
    return (
      <ParticipantTile
        key={p.identity}
        trackRef={tr}
        variant={variant}
        isLocal={isLocalP}
        isHost={isLocalP ? isHost : pHost}
        micOn={!!p.isMicrophoneEnabled}
        speaking={!!p.isSpeaking}
        handRaised={!!raisedHands[p.identity]}
        displayName={p.name || p.identity}
      />
    );
  };

  /* People panel list (unchanged behaviour) */
  const remoteParticipants = room?.remoteParticipants
    ? Array.from(room.remoteParticipants.values()).map((p) => {
        const { isHost: participantIsHost, roleLabel } = describeParticipant(p);
        return {
          identity: p.identity,
          name: p.name || p.identity,
          role: roleLabel,
          micOn: p.isMicrophoneEnabled,
          camOn: p.isCameraEnabled,
          handRaised: !!raisedHands[p.identity],
          isHost: participantIsHost,
          isMe: false,
        };
      })
    : [];

  const peopleList = [
    {
      identity: localId,
      name: localName,
      role: isHost ? "Host" : "Teacher",
      micOn: room?.localParticipant?.isMicrophoneEnabled,
      camOn: room?.localParticipant?.isCameraEnabled,
      handRaised: false,
      isHost,
      isMe: true,
    },
    ...remoteParticipants,
  ];

  const fullscreenBtn = (
    <button
      className="tgs-video-fs-btn"
      onClick={toggleFullscreen}
      aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
    >
      {isFullscreen ? <MdFullscreenExit size={22} /> : <MdFullscreen size={22} />}
    </button>
  );

  return (
    <div
      className={
        "tgs-room" +
        (isFullscreen ? " tgs-room--fs" : "") +
        (!activePanel ? " tgs-room--panel-closed" : "")
      }
      ref={containerRef}
    >
      {raiseHandToasts.length > 0 && (
        <div className="tgs-rh-toasts">
          {raiseHandToasts.map((t) => (
            <div key={t.id} className="tgs-rh-toast">
              <span>✋ <strong>{t.displayName || t.identity}</strong> raised their hand</span>
            </div>
          ))}
        </div>
      )}

      <div className="tgs-main" style={{ position: "relative" }}>
        {groupSessionRemainingMs != null && (
          <div
            style={{
              position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
              zIndex: 5, background: "rgba(245,158,11,.15)", color: "#b45309",
              border: "1px solid var(--tgs-warning, #f59e0b)", borderRadius: 999,
              padding: "4px 14px", fontSize: 12, fontWeight: 700,
            }}
          >
            Trial: {formatMmSs(groupSessionRemainingMs)} left
          </div>
        )}
        {screenShareTrack ? (
          /* ---------- SPOTLIGHT (screen share) ---------- */
          <div className="tgs-stage tgs-stage--spotlight">
            <div className="tgs-spotlight-main">
              <VideoTrack trackRef={screenShareTrack} />
              <span className="tgs-spotlight-label">
                {(screenShareTrack.participant?.name || "Presenter")} · Presenting
              </span>
            </div>

            <div className="tgs-filmstrip">
              {orderedTiles.map((tr) => renderTile(tr, "strip"))}
            </div>

            {fullscreenBtn}
          </div>
        ) : (
          /* ---------- GRID (everyone's camera) ---------- */
          <div
            className="tgs-stage tgs-stage--grid"
            data-count={orderedTiles.length}
            style={{ "--tgs-cols": gridCols }}
          >
            {orderedTiles.map((tr) => renderTile(tr, "grid"))}

            {isAlone && (
              <div className="tgs-waiting-pill">Waiting for others to join…</div>
            )}

            {fullscreenBtn}
          </div>
        )}

        <TeacherGroupSessionControlBar
          onLeave={onLeave}
          role={role}
          activePanel={activePanel}
          onTogglePanel={togglePanel}
          session={session}
          isHost={isHost}
          onHostEndSession={onEndSession}
        />
      </div>

      {activePanel && (
        <div className="tgs-right-sidebar">
          {activePanel === "chat" && (
            <TeacherGroupSessionChatPanel
              messages={chatMessages}
              onSendMessage={sendMessage}
            />
          )}

          {activePanel === "notes" && <NotesPanel sessionId={session?.id} sessionType="group" />}

          {activePanel === "files" && (
            <FilesPanel sessionId={session?.id} sessionType="group" isHost={isHost} currentUserId={myUserId} socket={chatSocket} limits={liveLimits} />
          )}

          {activePanel === "people" && (
            <div className="tgs-ppl-panel">
              <div className="tgs-ppl-tabs">
                <button
                  type="button"
                  className={`tgs-ppl-tab ${peopleTab === "participants" ? "tgs-ppl-tab--active" : ""}`}
                  onClick={() => setPeopleTab("participants")}
                >
                  Participants ({peopleList.length})
                </button>

                <button
                  type="button"
                  className={`tgs-ppl-tab ${peopleTab === "requests" ? "tgs-ppl-tab--active" : ""}`}
                  onClick={() => setPeopleTab("requests")}
                >
                  Join Requests ({joinRequests.length})
                </button>
              </div>

              {peopleTab === "participants" && (
                <div className="tgs-ppl-list">
                  {peopleList.length === 0 ? (
                    <p className="tgs-ppl-empty">No participants yet.</p>
                  ) : (
                    peopleList.map((p, i) => (
                      <div
                        key={p.identity || i}
                        className={"tgs-ppl-card" + (p.isHost ? " tgs-ppl-card--host" : "")}
                      >
                        <div className="tgs-ppl-avatar">
                          {p.avatarUrl
                            ? <img src={p.avatarUrl} alt={p.name} />
                            : p.name?.charAt(0)?.toUpperCase() || "?"}
                        </div>

                        <div className="tgs-ppl-info">
                          <div className="tgs-ppl-name">{p.isMe ? "You" : p.name}</div>
                          <div className="tgs-ppl-role">{p.role}</div>
                        </div>

                        <div className="tgs-ppl-actions">
                          <div className={`tgs-ppl-mic ${p.micOn ? "tgs-ppl-mic--on" : "tgs-ppl-mic--off"}`}>
                            {p.micOn ? (
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                              </svg>
                            ) : (
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="1" y1="1" x2="23" y2="23"/>
                                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {peopleTab === "requests" && (
                <div className="tgs-ppl-list">
                  {isHost && (
                    <label className="tgs-ppl-card" style={{ cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={admitMode === "lobby"}
                        onChange={toggleAdmitMode}
                        style={{ marginRight: 10 }}
                      />
                      <span className="tgs-ppl-info">
                        <span className="tgs-ppl-name">Require approval to join</span>
                      </span>
                    </label>
                  )}
                  {admitMode !== "lobby" ? (
                    <p className="tgs-ppl-empty">Approval is off — anyone with the link joins directly.</p>
                  ) : joinRequests.length === 0 ? (
                    <p className="tgs-ppl-empty">No join requests yet.</p>
                  ) : (
                    joinRequests.map((r) => (
                      <div key={r.id} className="tgs-ppl-card">
                        <div className="tgs-ppl-avatar">{(r.name || "?").charAt(0).toUpperCase()}</div>
                        <div className="tgs-ppl-info">
                          <div className="tgs-ppl-name">{r.name}</div>
                        </div>
                        <div className="tgs-ppl-actions" style={{ gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => admitRequest(r.id)}
                            style={{ background: "#006d78", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                          >
                            Admit
                          </button>
                          <button
                            type="button"
                            onClick={() => denyRequest(r.id)}
                            style={{ background: "transparent", color: "#ef4444", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                          >
                            Deny
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {activePanel === "info" && (
            <div className="tgs-info-panel">
              <div className="tgs-info-header">
                <h3>Session Information</h3>
              </div>

              <div className="tgs-info-body">
                <div className="tgs-info-field">
                  <span className="tgs-info-label">Session ID:</span>
                  <span className="tgs-info-value">{session?.shortCode || session?.id || "—"}</span>
                </div>

                <div className="tgs-info-field">
                  <span className="tgs-info-label">Session Type:</span>
                  <span className="tgs-info-value">
                    {session?.sessionType === "instant" ? "Instant Group" : "Study Group"}
                  </span>
                </div>

                <div className="tgs-info-field">
                  <span className="tgs-info-label">Host:</span>
                  <span className="tgs-info-value">{session?.hostName || localName || "—"}</span>
                </div>

                <div className="tgs-info-gap" />

                <div className="tgs-info-field">
                  <span className="tgs-info-label">Subject:</span>
                  <span className="tgs-info-value">{session?.subject || session?.subjectName || "—"}</span>
                </div>

                <div className="tgs-info-field">
                  <span className="tgs-info-label">Topic:</span>
                  <span className="tgs-info-value">{session?.topic || "(Entered by Host)"}</span>
                </div>

                <div className="tgs-info-gap" />

                <div className="tgs-info-field">
                  <span className="tgs-info-label">Date:</span>
                  <span className="tgs-info-value">{formatDate(session?.date)}</span>
                </div>

                <div className="tgs-info-field">
                  <span className="tgs-info-label">Session Timing:</span>
                  <span className="tgs-info-value">{formatTiming(session)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
