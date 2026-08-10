import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../api/apiClient";
import { IoChevronBack } from "react-icons/io5";
import { LoadingState, EmptyState } from "../components/StateViews";
import ScheduleSessionModal from "../components/live/ScheduleSessionModal";
import "../styles/academyScreens.css";
import "../styles/live-session-detail.css";

export default function LiveSessionDetail() {
  const { id, subjectId } = useParams();
  const navigate = useNavigate();
  const backTo = subjectId
    ? `/teacher/classes/${subjectId}/live-sessions`
    : `/teacher/live-sessions`;
  const [session, setSession] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [recording, setRecording] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await api.get(`/livestream/sessions/${id}/detail/`);
        if (cancelled) return;
        setSession(res.data.session);
        setAttendance(res.data.attendance || []);
        setRecording(res.data.recording || null);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id, reloadKey]);

  if (loading) return <div className="ac-screen"><LoadingState label="Loading session" /></div>;
  if (!session) {
    return (
      <div className="ac-screen">
        <button type="button" className="lsd-back-btn" onClick={() => navigate(backTo)}>
          <IoChevronBack size={14} /> Back
        </button>
        <EmptyState icon="video" title="Session not found" message="It may have been removed." />
      </div>
    );
  }

  const start = new Date(session.start_time);
  const end = new Date(session.end_time);
  const duration = Math.round((end - start) / 60000);

  const stats = [
    { label: "Date", value: start.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) },
    { label: "Start time", value: start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true }) },
    { label: "Duration", value: `${duration} min` },
    { label: "Students attended", value: attendance.length },
  ];

  return (
    <div className="ac-screen">
      <button type="button" className="lsd-back-btn" onClick={() => navigate(backTo)}>
        <IoChevronBack size={14} /> Back
      </button>

      <div className="lsd-head">
        <div>
          <h1 className="lsd-title">{session.title}</h1>
          <p className="lsd-sub">{session.subject_name} — {session.course_name} · {session.teacher}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className={`ac-tag ac-tag--${session.computed_status === "COMPLETED" ? "success" : session.computed_status === "CANCELLED" ? "danger" : "neutral"}`}>
            {session.computed_status}
          </span>
          {session.computed_status === "SCHEDULED" && (
            <button type="button" className="ac-btn" onClick={() => setShowEdit(true)}>
              Edit / reschedule
            </button>
          )}
        </div>
      </div>

      <div className="lsd-statGrid">
        {stats.map((s) => (
          <div className="lsd-statTile" key={s.label}>
            <div className="lsd-statValue">{s.value}</div>
            <div className="lsd-statLabel">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="lsd-section">
        <h3 className="lsd-sectionTitle">Attendance ({attendance.length})</h3>
        <div className="ac-listCard">
          {attendance.length === 0 ? (
            <div className="ac-emptyRow">No attendance records for this session.</div>
          ) : (
            <div className="ac-list">
              {attendance.map((a, i) => (
                <div className="ac-row" key={i}>
                  <div className="ac-row__body">
                    <div className="ac-row__topic">{a.user_name || a.user_email}</div>
                  </div>
                  <span className="ac-row__sub">
                    {a.joined_at ? new Date(a.joined_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—"}
                    {a.left_at ? ` → ${new Date(a.left_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true })}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="lsd-section">
        <h3 className="lsd-sectionTitle">Session recording</h3>
        <div className="ac-listCard" style={{ padding: 16 }}>
          {recording ? (
            <div className="lsd-recFoot">
              <div className="lsd-recBody">
                {recording.thumbnail_url && (
                  <img className="lsd-recThumb" src={recording.thumbnail_url} alt={recording.title} />
                )}
                <div>
                  <p className="lsd-recTitle">{recording.title}</p>
                  <p className="lsd-recStatus">{recording.status === 4 ? "Ready" : "Processing…"}</p>
                </div>
              </div>
              {recording.status === 4 && (
                <button
                  type="button"
                  className="ac-btn ac-btn--primary"
                  onClick={() => navigate(
                    `/teacher/classes/${session.subject_id}/session-recordings/${recording.id}/${recording.bunny_video_id}`
                  )}
                >
                  Watch
                </button>
              )}
            </div>
          ) : session.computed_status === "COMPLETED" ? (
            <div className="lsd-recFoot">
              <p className="lsd-recStatus">No recording uploaded yet.</p>
              <button
                type="button"
                className="ac-btn ac-btn--primary"
                onClick={() => navigate(
                  `/teacher/classes/${session.subject_id}/session-recordings/upload`,
                  { state: { live_session_id: id, title: session.title, date: start.toISOString().split("T")[0] } }
                )}
              >
                + Upload recording
              </button>
            </div>
          ) : (
            <p className="lsd-recStatus">Available once the session has ended.</p>
          )}
        </div>
      </div>

      {showEdit && (
        <ScheduleSessionModal
          editSession={session}
          onClose={() => setShowEdit(false)}
          onScheduled={() => { setShowEdit(false); setReloadKey((k) => k + 1); }}
        />
      )}
    </div>
  );
}
