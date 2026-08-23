import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import toast from "react-hot-toast";
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
  const [ending, setEnding] = useState(false);
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

  // End the class for everyone. Deliberately fires BEFORE the review modal,
  // unlike the private-session flow which ends on the modal's onDone: a
  // private session holds one student, a class holds the whole batch, and
  // every second the teacher spends rating the lesson is a second of thirty
  // students sitting in a live room with open mics. End first, rate after.
  const handleEndSession = async () => {
    if (ending) return;
    setEnding(true);
    try {
      await api.post(`/livestream/sessions/${id}/end/`);
    } catch (err) {
      // 400 is the terminal-state pair ("already completed" / "is
      // cancelled") — somebody else ended it first, via the list-page
      // overflow menu, an admin, or LiveKit's room_finished webhook. The
      // class is over either way, so fall through to the review. Anything
      // else (403 not-assigned, network) leaves the teacher in the room
      // with a visible error rather than silently walking them out of a
      // class that is still running.
      if (err?.response?.status !== 400) {
        // ClassroomUI puts the room into NATIVE fullscreen
        // (el.requestFullscreen), and <Toaster> is mounted up in App.jsx as
        // a sibling of the routed tree — outside the fullscreen element,
        // therefore not rendered at all while it is active. Dropping out of
        // fullscreen first is the difference between the teacher seeing
        // "couldn't end the class" and seeing nothing happen, which is the
        // exact failure mode this whole button is being fixed for.
        if (document.fullscreenElement) {
          try { await document.exitFullscreen(); } catch { /* not fatal */ }
        }
        toast.error(
          err?.response?.data?.detail || "Could not end the class. Please try again."
        );
        setEnding(false);
        return;
      }
    }
    setShowReview(true);
  };

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
        video={false}
        audio
        style={liveKitWrap}
        onError={(err) => setError(err?.message || "Lost connection to the session.")}
      >
        <ReconnectingBanner />
        <ClassroomUI
          role={sessionData.role}
          sessionId={id}
          sessionMeta={sessionData}
          onLeave={handleControlBarLeave}
          onEndSession={handleEndSession}
        />
        <RoomAudioRenderer />
      </LiveKitRoom>
      {showReview && <ReviewModal sessionId={id} onDone={handleLeave} />}
    </div>
  );
}
