import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import privateSessionService from "../api/privateSessionService";
import TeacherPrivateClassroomUI from "../components/live/TeacherPrivateClassroomUI";
import ReconnectingBanner from "../components/live/ReconnectingBanner";
import ReviewModal from "../components/live/ReviewModal";
import "../styles/privateSessions.css";

/* ── Same fullscreen wrapper as TeacherLiveSession ── */
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

export default function PrivateSessionLive() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [, setSessionData] = useState(null);
  const [livekitData, setLivekitData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingLeave, setPendingLeave] = useState(null); // "leave" | "end" | null

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const detail = await privateSessionService.getSessionDetail(id);
        if (cancelled) return;
        setSessionData(detail);

        if (detail.status === "ongoing") {
          const joinData = await privateSessionService.joinSession(id);
          if (cancelled) return;
          setLivekitData(joinData);
        }
      } catch (err) {
        if (cancelled) return;
        setError(
          err?.response?.data?.error ||
          err?.response?.data?.detail ||
          "Unable to join session. It may not have started yet."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [id]);

  // Just steps out — the session stays "ongoing" for the student, same as
  // the student's own Leave. Rejoinable later from the sessions list.
  const handleLeave = () => {
    navigate("/teacher/private-sessions");
  };

  // Explicit, confirmed action that actually ends the session for both
  // parties (was previously what the plain Leave button did unconditionally).
  const handleEndSession = async () => {
    try {
      await privateSessionService.endSession(id);
    } catch (err) {
      console.error("Failed to end session:", err);
    }
    navigate("/teacher/private-sessions");
  };

  // Both the plain Leave and the explicit End Session show the review
  // prompt first (spec: live/private sessions show a review modal on leave,
  // group sessions never do) — the modal's onDone runs the real action.
  const handleControlBarLeave = () => setPendingLeave("leave");
  const handleControlBarEndSession = () => setPendingLeave("end");
  const runPendingLeave = () => {
    const action = pendingLeave === "end" ? handleEndSession : handleLeave;
    setPendingLeave(null);
    action();
  };

  if (loading) {
    return (
      <div style={centerMsg}>
        <p style={{ fontSize: 16, color: "#102a2a", margin: 0 }}>
          Joining private session...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={centerMsg}>
        <h2 style={{ margin: 0, color: "#102a2a" }}>Unable to join session</h2>
        <p style={{ color: "#475569", margin: 0 }}>{error}</p>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => navigate("/teacher/private-sessions")}
            style={{
              padding: "10px 24px", borderRadius: 8, border: "none",
              background: "#3b5c7c", color: "#fff", fontWeight: 600, cursor: "pointer",
            }}
          >
            Back to Private Sessions
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 24px", borderRadius: 8,
              border: "2px solid #94a3b8", background: "transparent",
              color: "#475569", fontWeight: 600, cursor: "pointer",
            }}
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
        <h2 style={{ margin: 0, color: "#102a2a" }}>Session not started yet</h2>
        <p style={{ color: "#475569", margin: 0 }}>
          Please go back and click "Start Session" first.
        </p>
        <button
          onClick={() => navigate("/teacher/private-sessions")}
          style={{
            padding: "10px 24px", borderRadius: 8, border: "none",
            background: "#3b5c7c", color: "#fff", fontWeight: 600, cursor: "pointer",
          }}
        >
          Back to Private Sessions
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
        onDisconnected={handleControlBarLeave}
        onError={(err) => setError(err?.message || "Lost connection to the private session.")}
      >
        <ReconnectingBanner />
        <TeacherPrivateClassroomUI
          role="PRESENTER"
          sessionId={id}
          onLeave={handleControlBarLeave}
          onEndSession={handleControlBarEndSession}
        />
        <RoomAudioRenderer />
      </LiveKitRoom>
      {pendingLeave && <ReviewModal sessionId={id} onDone={runPendingLeave} sessionType="private" />}
    </div>
  );
}
