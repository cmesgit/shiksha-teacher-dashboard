import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { IoChevronBack } from "react-icons/io5";
import { MdCancel } from "react-icons/md";
import api from "../api/apiClient";
import "../styles/live-sessions.css";
import sessionBanner from "../assets/live-session-banner.png";
import { LoadingState, EmptyState, ErrorState } from "../components/StateViews";

function getLiveDuration(startTime) {
  const diffMinutes = Math.floor((Date.now() - new Date(startTime).getTime()) / 60000);
  if (diffMinutes < 60) return `${diffMinutes} min live`;
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  return `${hours}h ${mins}m live`;
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

  // Forces a re-render every minute so live-duration badges stay current.
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
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
            {session.computed_status === "LIVE" ? (
              <span className="live-duration">🔴 {getLiveDuration(session.start_time)}</span>
            ) : (
              <>
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
              </>
            )}
          </div>

          {["SCHEDULED", "WAITING_FOR_TEACHER"].includes(
            session.computed_status
          ) && (
            <button
              type="button"
              className="session-cancel-btn"
              onClick={(e) => handleCancel(e, session.id)}
            >
              <MdCancel /> Cancel session
            </button>
          )}
          {["LIVE", "PAUSED", "RECONNECTING"].includes(
            session.computed_status
          ) && (
            <button
              type="button"
              className="session-cancel-btn"
              onClick={(e) => handleEnd(e, session.id)}
            >
              <MdCancel /> End session
            </button>
          )}
        </div>
      </div>
    );
  };

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
        {error && <ErrorState plain message={error} onRetry={fetchSessions} />}

        {!loading && !error && (
          <div className="today-sessions-grid">
            {sortedSessions.length > 0 ? (
              sortedSessions.map(renderCard)
            ) : (
              <EmptyState
                plain
                icon="video"
                title="No live sessions today"
                message={
                  subjectId
                    ? "Schedule a live session for this class to see it here."
                    : "You have no live sessions scheduled for today."
                }
                action={
                  subjectId
                    ? { label: "Schedule a live session", to: `/teacher/classes/${subjectId}/live-sessions/create` }
                    : undefined
                }
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
