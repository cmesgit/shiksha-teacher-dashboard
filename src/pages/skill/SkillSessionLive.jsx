// PLACEMENT: student_dashboard/src/pages/SkillSessionLive.jsx   (NEW FILE)
// DEPLOY:    /app/student_dashboard/src/pages/SkillSessionLive.jsx
//
// Why this file exists
// ────────────────────
// Skill-dev 1-on-1 sessions are a SEPARATE system from Academy private
// sessions. They live in the Django `skills` app and use different routes:
//     GET  /skill/sessions/<id>/        → session detail (has is_live, status)
//     POST /skill/sessions/<id>/join/   → { token, ws_url, room, identity, is_expert }
//
// Previously the skill "Join" buttons navigated to /private-session/live/<id>,
// which is the ACADEMY live page. That page re-queries the academy sessions_app
// (GET /api/sessions/<id>/) and 404s on a skill-session UUID — so a skill
// session could never actually be joined. This page is the skill equivalent of
// PrivateSessionLive: it joins the skill room and mounts LiveKit directly.
//
// NOTE: the skill backend returns `ws_url` (NOT `livekit_url` like the academy
// join does). serverUrl below uses ws_url, falling back to livekit_url just in
// case an older backend is deployed.

import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import api from "../api/apiClient";
import PrivateClassroomUI from "../components/live/PrivateClassroomUI";
import "../styles/privateSessions.css";

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
        // Detail first — lets us show a clear "not started yet" message instead
        // of a raw join error when the slot time hasn't arrived.
        const detail = (await api.get(`/skill/sessions/${id}/`)).data;
        if (cancelled) return;

        const joinable = ["confirmed", "requested"].includes(detail.status);
        if (!joinable) {
          setError(
            detail.status === "completed"
              ? "This session has already ended."
              : detail.status === "cancelled"
              ? "This session was cancelled."
              : "This session can't be joined right now."
          );
          return;
        }

        const joinData = (await api.post(`/skill/sessions/${id}/join/`)).data;
        if (cancelled) return;
        setLivekitData(joinData);
      } catch (err) {
        if (cancelled) return;
        setError(
          err?.response?.data?.detail ||
            err?.response?.data?.error ||
            "Unable to join session. It may not have started yet."
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

  const goBack = () => navigate("/skill-dev/sessions");

  if (loading) {
    return (
      <div style={centerMsg}>
        <p style={{ fontSize: 16, color: "#102a2a", margin: 0 }}>
          Joining your session…
        </p>
      </div>
    );
  }

  if (error || !livekitData) {
    return (
      <div style={centerMsg}>
        <h2 style={{ margin: 0, color: "#102a2a" }}>Can't join just yet</h2>
        <p style={{ color: "#475569", margin: 0, maxWidth: 440 }}>
          {error || "The session room isn't available right now."}
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
          <button
            onClick={goBack}
            style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "#015865", color: "#fff", fontWeight: 600, cursor: "pointer" }}
          >
            Back to sessions
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
      >
        <PrivateClassroomUI role="STUDENT" sessionId={id} onLeave={goBack} />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}
