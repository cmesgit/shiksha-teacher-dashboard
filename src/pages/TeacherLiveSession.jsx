import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import api from "../api/apiClient";
import ClassroomUI from "../components/live/ClassroomUI";
import ReconnectingBanner from "../components/live/ReconnectingBanner";
import ReviewModal from "../components/live/ReviewModal";

const cacheKey = (id) => `livekit_session_${id}`;

function readCache(id) {
  try {
    const raw = sessionStorage.getItem(cacheKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const payload = JSON.parse(atob(parsed.token.split(".")[1]));
    if (payload.exp * 1000 > Date.now() + 30_000) return parsed;
    sessionStorage.removeItem(cacheKey(id));
    return null;
  } catch {
    sessionStorage.removeItem(cacheKey(id));
    return null;
  }
}

/* ── Fullscreen wrapper styles (kills scroll). Full-viewport dark overlay
   per the design handoff's video-conference spec (section 10) — no padding,
   edge-to-edge. ── */
const fullscreenWrap = {
  width: "100vw",
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  background: "#0f1117",
  boxSizing: "border-box",
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
  background: "#0f1117",
};

export default function TeacherLiveSession() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showReview, setShowReview] = useState(false);
  const joiningRef = useRef(false);

  useEffect(() => {
    if (!id) return;
    if (joiningRef.current) return;
    joiningRef.current = true;

    const join = async () => {
      // Reuse cached token on refresh — teacher stays in session
      const cached = readCache(id);
      if (cached) {
        setSessionData(cached);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const res = await api.post(`/livestream/sessions/${id}/join/`);
        sessionStorage.setItem(cacheKey(id), JSON.stringify(res.data));
        setSessionData(res.data);
      } catch (err) {
        console.error(err);
        setError(err?.response?.data?.detail || "Unable to join session.");
      } finally {
        setLoading(false);
      }
    };

    join();
  }, [id]);

  // Called when teacher intentionally leaves — clears cache
  const handleLeave = () => {
    sessionStorage.removeItem(cacheKey(id));
    navigate(-1);
  };

  // Show the review prompt first — it calls handleLeave itself once
  // submitted or skipped (spec section 10: live/private sessions show a
  // review modal on leave, group sessions never do).
  const handleControlBarLeave = () => setShowReview(true);

  if (loading) {
    return (
      <div style={centerMsg}>
        <p style={{ fontSize: 16, color: "#e5eaed", margin: 0 }}>
          Connecting...
        </p>
      </div>
    );
  }

  if (error || !sessionData?.token) {
    return (
      <div style={centerMsg}>
        <p style={{ fontSize: 16, color: "#e5eaed", margin: 0 }}>
          {error || "Session unavailable"}
        </p>
        <button
          onClick={() => {
            sessionStorage.removeItem(cacheKey(id));
            joiningRef.current = false;
            window.location.reload();
          }}
          style={{
            padding: "10px 24px",
            borderRadius: 999,
            border: "none",
            background: "#425f7f",
            color: "#fff",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={fullscreenWrap}>
      <LiveKitRoom
        serverUrl={sessionData.livekit_url}
        token={sessionData.token}
        connect={true}
        video
        audio
        style={liveKitWrap}
        onError={(err) => setError(err?.message || "Lost connection to the session.")}
      >
        <ReconnectingBanner />
        <ClassroomUI
          role={sessionData.role}
          sessionId={id}
          onLeave={handleControlBarLeave}
        />
        <RoomAudioRenderer />
      </LiveKitRoom>
      {showReview && <ReviewModal sessionId={id} onDone={handleLeave} />}
    </div>
  );
}
