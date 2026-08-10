// PLACEMENT: teacher_ui/src/pages/skill/SkillSessionLive.jsx   (NEW FILE)
// DEPLOY:    /app/teacher_ui/src/pages/skill/SkillSessionLive.jsx
//
// Teacher-side LiveKit room for skill-dev 1-on-1 sessions. This is the skill
// equivalent of pages/PrivateSessionLive.jsx (which is Academy-only and queries
// the academy sessions_app). It joins the skill room and mounts LiveKit.
//
//     POST /skill/sessions/<id>/join/  → { token, ws_url, room, identity, is_expert }
//
// Previously ExpertBookings."Start class" called join, logged the token to the
// console, then navigated to /teacher/private-sessions — so the expert never
// actually entered a room. ExpertBookings now navigates here instead.
//
// NOTE: the skill backend returns `ws_url` (not `livekit_url` like the academy
// join). serverUrl uses ws_url with a livekit_url fallback for safety.
//
// Leaving the room returns to Bookings WITHOUT auto-completing the session —
// the expert marks it done explicitly via the "Mark done" button (which calls
// POST /skill/teacher/sessions/<id>/complete/ and releases the weekly slot).

import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import api from "../../shared/apiClient";
import TeacherPrivateClassroomUI from "../../components/live/TeacherPrivateClassroomUI";
import ReconnectingBanner from "../../components/live/ReconnectingBanner";
import "../../styles/privateSessions.css";

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
  textAlign: "center",
  padding: "0 24px",
};

export default function SkillSessionLive() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [livekitData, setLivekitData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const joinData = (await api.post(`/skill/sessions/${id}/join/`)).data;
        if (cancelled) return;
        setLivekitData(joinData);
      } catch (err) {
        if (cancelled) return;
        setError(
          err?.response?.data?.detail ||
            err?.response?.data?.error ||
            "Unable to start the session room."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const goBack = () => navigate("/teacher/expert/bookings");

  if (loading) {
    return (
      <div style={centerMsg}>
        <p style={{ fontSize: 16, color: "#102a2a", margin: 0 }}>
          Starting your session room…
        </p>
      </div>
    );
  }

  if (error || !livekitData) {
    return (
      <div style={centerMsg}>
        <h2 style={{ margin: 0, color: "#102a2a" }}>Couldn't start the room</h2>
        <p style={{ color: "#475569", margin: 0, maxWidth: 440 }}>
          {error || "The session room isn't available right now."}
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
          <button
            onClick={goBack}
            style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "#3b5c7c", color: "#fff", fontWeight: 600, cursor: "pointer" }}
          >
            Back to Bookings
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

  return (
    <div style={fullscreenWrap}>
      <LiveKitRoom
        serverUrl={livekitData.ws_url || livekitData.livekit_url}
        token={livekitData.token}
        connect={true}
        video={true}
        audio={true}
        style={liveKitWrap}
        onDisconnected={goBack}
        onError={(err) => setError(err?.message || "Lost connection to the skill session.")}
      >
        <ReconnectingBanner />
        <TeacherPrivateClassroomUI role="PRESENTER" sessionId={id} onLeave={goBack} />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}
