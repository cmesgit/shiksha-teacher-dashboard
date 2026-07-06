import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import MobileAudioGate from "../components/live/MobileAudioGate";
import groupSessionService, { extractApiError } from "../api/groupSessionService";
import GroupSessionClassroomUI from "../components/live/GroupSessionClassroomUI";
import { useAuth } from "../contexts/AuthContext";

const fullscreenWrap = {
  width: "100vw",
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  background: "#c9dde1",
  boxSizing: "border-box",
  padding: "14px",
};

const liveKitWrap = {
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const centerMsg = {
  width: "100vw",
  height: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "column",
  gap: 16,
  background: "#c9dde1",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function GroupSessionLive() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [resolvedId, setResolvedId] = useState(
    UUID_RE.test(String(id || "")) ? String(id) : null
  );
  const [livekitData, setLivekitData] = useState(null);
  const [sessionDetail, setSessionDetail] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [remainingMs, setRemainingMs] = useState(null);

  const { user } = useAuth();

  const isHost = !!(
    user?.id &&
    sessionDetail?.hostId &&
    String(user.id) === String(sessionDetail.hostId)
  );

  const handleEndSession = async () => {
    const ok = window.confirm(
      "End this session for everyone? Participants will be disconnected immediately."
    );
    if (!ok) return;

    try {
      await groupSessionService.endSession(resolvedId || id);
    } catch (e) {
      console.error("endSession failed", e);
    } finally {
      navigate("/group-sessions");
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (!id) return undefined;

    if (UUID_RE.test(String(id))) {
      setResolvedId(String(id));
      return undefined;
    }

    (async () => {
      try {
        const res = await groupSessionService.joinByCode(id);
        if (cancelled) return;

        if (res?.session_id) {
          setResolvedId(String(res.session_id));
        } else {
          setError("No room found for that code.");
          setLoading(false);
        }
      } catch (err) {
        if (cancelled) return;
        setError(extractApiError(err, "No room found for that code."));
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    if (!resolvedId) return undefined;

    const load = async () => {
      try {
        const detail = await groupSessionService.getDetail(resolvedId);
        if (cancelled) return;
        setSessionDetail(detail);

        const joinData = await groupSessionService.joinRoom(resolvedId);
        if (cancelled) return;
        setLivekitData(joinData);
        setRemainingMs(joinData.remaining_ms ?? null);
      } catch (err) {
        if (cancelled) return;
        setError(extractApiError(err, "Unable to join group session. It may not be open yet."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [resolvedId]);

  useEffect(() => {
    if (remainingMs == null || remainingMs <= 0) return;

    const startedAt = Date.now();
    const startValue = remainingMs;
    const interval = setInterval(() => {
      const next = Math.max(0, startValue - (Date.now() - startedAt));
      setRemainingMs(next);
      if (next <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [livekitData]);

  useEffect(() => {
    if (remainingMs != null && remainingMs <= 0 && livekitData) {
      const timer = setTimeout(() => navigate("/group-sessions"), 600);
      return () => clearTimeout(timer);
    }
  }, [remainingMs, livekitData, navigate]);

  if (loading) {
    return (
      <div style={centerMsg}>
        <p style={{ fontSize: 16, color: "#0f172a", margin: 0 }}>Joining group session…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={centerMsg}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>Unable to join group session</h2>
        <p style={{ color: "#475569", margin: 0 }}>{error}</p>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => navigate("/group-sessions")}
            style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "#015865", color: "#fff", fontWeight: 600, cursor: "pointer" }}
          >
            Back to Group Sessions
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: "10px 24px", borderRadius: 8, border: "2px solid #94a3b8", background: "transparent", color: "#475569", fontWeight: 600, cursor: "pointer" }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!livekitData) {
    return (
      <div style={centerMsg}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>Group session not open yet</h2>
        <p style={{ color: "#475569", margin: 0 }}>
          The room hasn't started. Please wait for someone to accept and try again.
        </p>
        <button
          onClick={() => navigate("/group-sessions")}
          style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "#015865", color: "#fff", fontWeight: 600, cursor: "pointer" }}
        >
          Back to Group Sessions
        </button>
      </div>
    );
  }

  return (
    <div style={fullscreenWrap}>
      <LiveKitRoom
        serverUrl={livekitData.livekit_url}
        token={livekitData.token}
        connect={true}
        video={true}
        audio={true}
        style={liveKitWrap}
        onDisconnected={() => navigate("/group-sessions")}
      >
        <GroupSessionClassroomUI
          role={
            sessionDetail?.sessionType === "instant" || isHost
              ? "PRESENTER"
              : "STUDENT"
          }
          session={{
            ...sessionDetail,
            id: resolvedId || id,
            subject: sessionDetail?.subjectName,
            topic: sessionDetail?.topic,
            shortCode: sessionDetail?.shortCode,
            sessionType: sessionDetail?.sessionType,
            admitMode: sessionDetail?.admitMode,
            roomStartedAt: sessionDetail?.roomStartedAt,
            hostId: sessionDetail?.hostId,
            hostName: sessionDetail?.hostName,
          }}
          chatConfig={{
            restGetPath:  `/sessions/group-sessions/${resolvedId || id}/chat/`,
            restPostPath: `/sessions/group-sessions/${resolvedId || id}/chat/send/`,
            wsPath:       `/ws/group-session/${resolvedId || id}/chat/`,
          }}
          groupSession={true}
          groupSessionRemainingMs={remainingMs}
          isHost={isHost}
          onLeave={() => navigate("/group-sessions")}
          onEndSession={isHost ? handleEndSession : null}
        />
        <RoomAudioRenderer />
        <MobileAudioGate />
      </LiveKitRoom>
    </div>
  );
}
