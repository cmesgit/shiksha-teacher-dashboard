import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { IoChevronBack } from "react-icons/io5";
import { MdCancel } from "react-icons/md";
import api from "../api/apiClient";
import "../styles/live-sessions.css";
import sessionBanner from "../assets/live-session-banner.png";
import { LoadingState } from "../components/StateViews";

/* =====================================
   🔥 COUNTDOWN FUNCTION
===================================== */
function getCountdown(startTime) {
  const now = new Date();
  const start = new Date(startTime);

  const diff = start - now;

  if (diff <= 0) return "🔴 LIVE";

  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  if (minutes > 0) return `Starts in ${minutes} min`;
  return `Starts in ${seconds}s`;
}

export default function LiveSessions() {
  const navigate = useNavigate();
  const { subjectId } = useParams();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSessions = useCallback(async () => {
    try {
      setError(null);

      const url = subjectId
        ? `/livestream/teacher/sessions/?subject_id=${subjectId}`
        : `/livestream/teacher/sessions/`;

      const res = await api.get(url);
      setSessions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setError("Failed to load sessions.");
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    fetchSessions();

    const interval = setInterval(fetchSessions, 30000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  /* =====================================
     🔥 COUNTDOWN AUTO UPDATE
  ===================================== */
  useEffect(() => {
    const interval = setInterval(() => {
      setSessions((prev) => [...prev]);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleJoin = (session) => {
    const status = session.computed_status;
    if (status === "COMPLETED" || status === "CANCELLED") {
  navigate(
    `/teacher/classes/${session.subject_id}/session-recordings`
  );
  return;
}
    if (!session.can_join) return;
    navigate(`/teacher/live/${session.id}`);
  };

  const handleCancel = async (e, sessionId) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to cancel this session?")) return;

    try {
      await api.post(`/livestream/sessions/${sessionId}/cancel/`);
      fetchSessions();
    } catch (err) {
      console.error("Failed to cancel session:", err);
      alert(err.response?.data?.detail || "Failed to cancel session.");
    }
  };
  const handleEnd = async (e, sessionId) => {
    e.stopPropagation();
    if (!window.confirm("End this session permanently? Students will be disconnected.")) return;
    try {
      await api.post(`/livestream/sessions/${sessionId}/end/`);
    } catch (err) {
      console.error("Failed to end session:", err);
      const msg = err.response?.data?.detail || "";
      if (msg && msg !== "Session already completed.") alert(msg);
    } finally {
      fetchSessions();
    }
  };

  /* =====================================
     🔥 CATEGORIZE
  ===================================== */
 const today = new Date();

const todaysSessions = sessions.filter((session) => {
  const d = new Date(session.start_time);

  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
});

const statusOrder = {
  LIVE: 0,
  PAUSED: 0,
  RECONNECTING: 0,

  SCHEDULED: 1,
  WAITING_FOR_TEACHER: 1,

  COMPLETED: 2,
  CANCELLED: 2,
};

const sortedSessions = [...todaysSessions].sort((a, b) => {
  const orderDiff =
    (statusOrder[a.computed_status] ?? 99) -
    (statusOrder[b.computed_status] ?? 99);

  if (orderDiff !== 0) return orderDiff;

  return (
    new Date(a.start_time) -
    new Date(b.start_time)
  );
});

  /* =====================================
     🔥 RENDER SESSION CARD
  ===================================== */
  const renderCard = (session) => {
    const startDate = new Date(session.start_time);
    const endDate = new Date(session.end_time);

    return (
      <div
        key={session.id}
        className="session-card"
        onClick={() => handleJoin(session)}
      >
        <div
          className="session-card-banner"
          style={{
            backgroundImage: `url(${sessionBanner})`,
          }}
        >
          <div
            className={`session-badge ${
              session.computed_status === "LIVE"
                ? "live"
                : session.computed_status === "COMPLETED"
                ? "completed"
                : session.computed_status === "CANCELLED"
                ? "cancelled"
                : "upcoming"
            }`}
          >
            {session.computed_status === "LIVE"
              ? "LIVE"
              : session.computed_status === "COMPLETED"
              ? "COMPLETED"
              : session.computed_status === "CANCELLED"
              ? "CANCELLED"
              : "UPCOMING"}
          </div>
        </div>

        <div className="session-card-content">
          <h4 className="session-card-subject">
            {session.subject_name}
          </h4>

          <p className="session-card-course">
            {session.course_name}
          </p>

          <div className="session-card-time">
            {startDate.toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            })}
            {" - "}
            {endDate.toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderEmpty = (message) => (
    <div className="live-sessions-empty">
      <p style={{ margin: 0, fontSize: 13, color: "rgba(11,42,42,.4)" }}>{message}</p>
    </div>
  );

  return (
    <div className="live-sessions-page">
      <button
        className="live-sessions-back-btn"
        onClick={() => navigate(subjectId ? `/teacher/classes/${subjectId}` : "/teacher/dashboard")}
      >
        <IoChevronBack /> Back
      </button>

      <div className="live-sessions-header">
        <h2 className="live-sessions-title">
          Live Sessions
        </h2>
      </div>

      <div className="live-sessions-content">
        {subjectId && (
          <div className="live-sessions-actions">
            <button
              className="live-sessions-schedule-btn"
              onClick={() =>
                navigate(`/teacher/classes/${subjectId}/live-sessions/create`)
              }
            >
              Schedule Live Session
            </button>
          </div>
        )}

        {loading && <LoadingState plain label="Loading sessions" />}
        {error && (
          <p className="live-sessions-empty" style={{ color: "#b91c1c" }}>
            {error}
          </p>
        )}

        {!loading && !error && (
          <div className="today-sessions-grid">
            {sortedSessions.length > 0
              ? sortedSessions.map(renderCard)
              : renderEmpty("No live sessions scheduled today")}
          </div>
        )}
      </div>
    </div>
  );
}
