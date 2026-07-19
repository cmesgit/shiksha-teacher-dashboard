import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../api/apiClient";
import { IoChevronBack } from "react-icons/io5";
import { LoadingState } from "../components/StateViews";

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

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get("/livestream/sessions/" + id + "/detail/");
        setSession(res.data.session);
        setAttendance(res.data.attendance || []);
        setRecording(res.data.recording || null);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id]);

  if (loading) return <LoadingState label="Loading session" />;
  if (!session) return <div style={{ padding: 20 }}>Session not found.</div>;

  const start = new Date(session.start_time);
  const end = new Date(session.end_time);
  const duration = Math.round((end - start) / 60000);

  return (
    <div style={{ padding: "24px 32px", maxWidth: 800, margin: "0 auto" }}>
      <button
        onClick={() => navigate(backTo)}
        style={{
          display: "flex", alignItems: "center", gap: 4,
          background: "none", border: "none", cursor: "pointer",
          color: "var(--brand, #0d9488)", fontSize: 14, marginBottom: 24,
        }}
      >
        <IoChevronBack /> Back
      </button>

      <div style={{
        background: "var(--card-bg, #1e293b)", borderRadius: 12,
        padding: 24, marginBottom: 20, color: "var(--text, #e2e8f0)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ margin: "0 0 4px", fontSize: 20 }}>{session.title}</h2>
            <p style={{ margin: "0 0 2px", color: "#94a3b8", fontSize: 13 }}>{session.subject_name} — {session.course_name}</p>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: 13 }}>by {session.teacher}</p>
          </div>
          <span style={{
            padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
            background: session.computed_status === "COMPLETED" ? "#064e3b" : "#450a0a",
            color: session.computed_status === "COMPLETED" ? "#6ee7b7" : "#fca5a5",
          }}>
            {session.computed_status}
          </span>
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16, marginTop: 20,
        }}>
          {[
            ["Date", start.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })],
            ["Start Time", start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true })],
            ["End Time", end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true })],
            ["Duration", duration + " min"],
            ["Students Attended", attendance.length],
          ].map(([label, value]) => (
            <div key={label} style={{
              background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: "12px 16px",
            }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>{label}</p>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {attendance.length > 0 && (
        <div style={{
          background: "var(--card-bg, #1e293b)", borderRadius: 12,
          padding: 24, color: "var(--text, #e2e8f0)",
        }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>Attendance ({attendance.length})</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {attendance.map((a, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", padding: "10px 14px",
                background: "rgba(255,255,255,0.04)", borderRadius: 8,
              }}>
                <span style={{ fontSize: 14 }}>{a.user_name || a.user_email}</span>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  {a.joined_at ? new Date(a.joined_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—"}
                  {a.left_at ? " → " + new Date(a.left_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true }) : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {attendance.length === 0 && (
        <div style={{
          background: "var(--card-bg, #1e293b)", borderRadius: 12,
          padding: 24, color: "#64748b", textAlign: "center",
        }}>
          No attendance records for this session.
        </div>
      )}

      <div style={{
        background: "var(--card-bg, #1e293b)", borderRadius: 12,
        padding: 24, marginTop: 20, color: "var(--text, #e2e8f0)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Session Recording</h3>
          {!recording && session?.computed_status === "COMPLETED" && (
            <button
              onClick={() => navigate(
                "/teacher/classes/" + session.subject_id + "/session-recordings/upload",
                { state: { live_session_id: id, title: session.title, date: new Date(session.start_time).toISOString().split("T")[0] } }
              )}
              style={{
                padding: "8px 16px", borderRadius: 8, border: "none",
                background: "#0d9488", color: "#fff", cursor: "pointer",
                fontSize: 13, fontWeight: 600,
              }}
            >
              + Upload Recording
            </button>
          )}
        </div>
        {recording ? (
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {recording.thumbnail_url && (
              <img src={recording.thumbnail_url} alt={recording.title}
                style={{ width: 120, height: 70, objectFit: "cover", borderRadius: 8 }} />
            )}
            <div style={{ flex: 1 }}>
              <p style={{ margin: "0 0 4px", fontWeight: 600 }}>{recording.title}</p>
              <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                {recording.status === 4 ? "Ready" : "Processing..."}
              </p>
            </div>
            {recording.status === 4 && (
              <button
                onClick={() => navigate(
                  "/teacher/classes/" + session.subject_id +
                  "/session-recordings/" + recording.id + "/" + recording.bunny_video_id
                )}
                style={{
                  padding: "8px 16px", borderRadius: 8, border: "none",
                  background: "#1e40af", color: "#fff", cursor: "pointer",
                  fontSize: 13, fontWeight: 600,
                }}
              >
                Watch
              </button>
            )}
          </div>
        ) : (
          <p style={{ color: "#64748b", margin: 0, fontSize: 13 }}>No recording uploaded yet.</p>
        )}
      </div>
    </div>
  );
}
