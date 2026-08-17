import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import MobileAudioGate from "../components/live/MobileAudioGate";
import ReconnectingBanner from "../components/live/ReconnectingBanner";
import groupSessionService, { extractApiError } from "../api/groupSessionService";
import GroupSessionClassroomUI from "../components/live/GroupSessionClassroomUI";
import { useAuth } from "../contexts/AuthContext";
import { ACADEMY_BROWSE_URL } from "../config/urls";

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
  // "idle" (not gated) | "pending" (knocking) | "denied" | "paywall"
  const [gateStatus, setGateStatus] = useState("idle");
  const [denyMessage, setDenyMessage] = useState("");

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

        // 202 { status: "pending" } — the host has admit_mode="lobby" and
        // hasn't let us in yet. Start knocking instead of rendering the room.
        if (joinData?.status === "pending") {
          setGateStatus("pending");
          return;
        }
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

  // While knocking: poll every 2s for the host's decision. Admit/deny is a
  // one-time, low-frequency event, so a short poll is simpler and lower-risk
  // than a dedicated realtime channel here (the guest has no LiveKit room
  // yet to receive a data-channel message on).
  //
  // This effect ONLY updates gateStatus — it deliberately does NOT also fetch
  // the real LiveKit credentials inline. Doing both in one async closure is
  // unsafe: setGateStatus("admitted") is a dependency of this very effect, so
  // it tears the effect down (running the cleanup that flips this closure's
  // own `cancelled` to true) before the *same* tick's later `await
  // joinRoom()` resolves — which then bails out via `if (cancelled) return`
  // and never calls setLoading(false), leaving the screen stuck forever.
  // The actual join happens in a separate effect below, keyed off gateStatus.
  useEffect(() => {
    if (gateStatus !== "pending" || !resolvedId) return undefined;
    let cancelled = false;
    let resolved = false;

    const tick = async () => {
      if (resolved) return;
      try {
        const res = await groupSessionService.getJoinStatus(resolvedId);
        if (cancelled || resolved) return;
        if (res.status === "admitted") {
          resolved = true;
          setGateStatus("admitted");
        } else if (res.status === "denied") {
          resolved = true;
          setGateStatus("denied");
          setDenyMessage(res.deny_message || "");
        }
      } catch {
        /* transient poll failure — try again next tick */
      }
    };

    const interval = setInterval(tick, 2000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [gateStatus, resolvedId]);

  // Just been admitted — fetch the real LiveKit credentials. Separate from
  // the polling effect above (see the comment there for why).
  useEffect(() => {
    if (gateStatus !== "admitted" || !resolvedId) return undefined;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const joinData = await groupSessionService.joinRoom(resolvedId);
        if (cancelled) return;
        setLivekitData(joinData);
        setRemainingMs(joinData.remaining_ms ?? null);
      } catch (err) {
        if (cancelled) return;
        setError(extractApiError(err, "Unable to join group session."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [gateStatus, resolvedId]);

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
      setGateStatus("paywall");
    }
  }, [remainingMs, livekitData]);

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

  if (gateStatus === "pending") {
    return (
      <div style={centerMsg}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%", background: "#415B7E",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 700, fontSize: 22,
        }}>
          {(sessionDetail?.hostName || "?").charAt(0).toUpperCase()}
        </div>
        <h2 style={{ margin: 0, color: "#0f172a" }}>Asking to join…</h2>
        <p style={{ color: "#475569", margin: 0 }}>The host will let you in shortly</p>
        <button
          onClick={() => navigate("/group-sessions")}
          style={{ padding: "10px 24px", borderRadius: 8, border: "2px solid #94a3b8", background: "transparent", color: "#475569", fontWeight: 600, cursor: "pointer" }}
        >
          Cancel
        </button>
      </div>
    );
  }

  if (gateStatus === "denied") {
    return (
      <div style={centerMsg}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>The host didn't let you in</h2>
        {denyMessage && <p style={{ color: "#475569", margin: 0 }}>{denyMessage}</p>}
        <button
          onClick={() => navigate("/group-sessions")}
          style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "#015865", color: "#fff", fontWeight: 600, cursor: "pointer" }}
        >
          Back to Group Sessions
        </button>
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

  if (gateStatus === "paywall") {
    return (
      <div style={centerMsg}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>Your free 15 minutes are up</h2>
        <p style={{ color: "#475569", margin: 0, maxWidth: 360, textAlign: "center" }}>
          Enroll in a course or subscribe to keep watching live sessions.
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => { window.location.href = ACADEMY_BROWSE_URL; }}
            style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "#006d78", color: "#fff", fontWeight: 700, cursor: "pointer" }}
          >
            See courses
          </button>
          <button
            onClick={() => navigate("/subscribe")}
            style={{ padding: "10px 24px", borderRadius: 8, border: "2px solid #415B7E", background: "transparent", color: "#415B7E", fontWeight: 700, cursor: "pointer" }}
          >
            Subscribe
          </button>
        </div>
        <button
          onClick={() => navigate("/group-sessions")}
          style={{ background: "none", border: "none", color: "#64748b", textDecoration: "underline", cursor: "pointer", fontSize: 13 }}
        >
          Leave
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
        video={false}
        audio={true}
        style={liveKitWrap}
        onDisconnected={() => navigate("/group-sessions")}
        onError={(err) => setError(err?.message || "Lost connection to the group session.")}
      >
        <ReconnectingBanner />
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
          liveLimits={livekitData.limits}
          onLeave={() => navigate("/group-sessions")}
          onEndSession={isHost ? handleEndSession : null}
        />
        <RoomAudioRenderer />
        <MobileAudioGate />
      </LiveKitRoom>
    </div>
  );
}
