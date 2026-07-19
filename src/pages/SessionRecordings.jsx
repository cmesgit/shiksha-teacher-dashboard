import { useNavigate, useParams } from "react-router-dom";
import { IoChevronBack } from "react-icons/io5";
import { useEffect, useState, useRef } from "react";
import api from "../api/apiClient";
import "../styles/session-recordings.css";
import { LoadingState } from "../components/StateViews";

const STATUS_LABELS = {
  0: "Created",
  1: "Uploaded",
  2: "Processing",
  3: "Transcoding",
  4: "Ready",
  5: "Error",
};

export default function SessionRecordings() {

  const navigate = useNavigate();
  const { subjectId } = useParams();

  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);

  useEffect(() => {

    async function fetchRecordings() {

      try {

        const res = await api.get(
          `/courses/subjects/${subjectId}/recordings/`
        );

        setRecordings(res.data || []);

      } catch (err) {

        console.error("Failed to load recordings", err);
        setRecordings([]);

      } finally {

        setLoading(false);

      }

    }

    if (subjectId) fetchRecordings();

  }, [subjectId]);

  // Poll for status of unfinished recordings
  useEffect(() => {
    const unfinished = recordings.filter((r) => r.status < 4);
    if (unfinished.length === 0) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    pollRef.current = setInterval(async () => {
      const updates = await Promise.all(
        unfinished.map((r) =>
          api.get(`/courses/recordings/${r.id}/status/`).then((res) => res.data).catch(() => r)
        )
      );

      setRecordings((prev) =>
        prev.map((rec) => {
          const updated = updates.find((u) => u.id === rec.id);
          return updated || rec;
        })
      );
    }, 10000);

    return () => clearInterval(pollRef.current);
  }, [recordings.map((r) => `${r.id}:${r.status}`).join(",")]);

  function formatDuration(seconds) {
    if (!seconds) return "";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  return (

    <div className="sr-page">

      <button
        className="sr-back-btn"
        onClick={() => navigate(`/teacher/classes/${subjectId}`)}
      >
        <IoChevronBack /> Back
      </button>

      <div className="sr-content">

        <div className="sr-header">

          <h2 className="sr-title">Session Recordings</h2>

        </div>

        <div className="sr-actions">

          <button
            className="sr-add-btn"
            onClick={() =>
              navigate(`/teacher/classes/${subjectId}/session-recordings/upload`)
            }
          >
            + Add Session Recording
          </button>

        </div>

        <div className="sr-grid">

          {loading && <LoadingState plain label="Loading recordings" />}

          {!loading && recordings.length === 0 && (
            <p style={{ opacity: 0.6 }}>
              No recordings uploaded yet.
            </p>
          )}

          {recordings.map((rec) => (

            <div
              className={`sr-card ${rec.status < 4 ? "sr-card-processing" : ""}`}
              key={rec.id}
              onClick={() => {
                if (rec.status === 4) {
                  navigate(
                    `/teacher/classes/${subjectId}/session-recordings/${rec.id}/${rec.bunny_video_id}`
                  );
                }
              }}
            >

              <div className="sr-thumb">

                {rec.status === 4 ? (
                  <img
                    src={
                      rec.thumbnail_url ||
                      `https://${import.meta.env.VITE_BUNNY_CDN_HOST}/${rec.bunny_video_id}/thumbnail.jpg`
                    }
                    alt={rec.title}
                  />
                ) : (
                  <div className="sr-thumb-placeholder">
                    {STATUS_LABELS[rec.status] || "Processing"}...
                  </div>
                )}

                {rec.status === 4 && <div className="sr-play">▶</div>}

                {rec.duration_seconds && (
                  <span className="sr-duration">
                    {formatDuration(rec.duration_seconds)}
                  </span>
                )}

              </div>

              <div className="sr-info">

                <h4>{rec.title}</h4>

                <div className="sr-info-bottom">
                  <p>{rec.session_date}</p>
                  <span className={`sr-status-badge sr-status-${rec.status}`}>
                    {STATUS_LABELS[rec.status] || "Unknown"}
                  </span>
                </div>

              </div>

            </div>

          ))}

        </div>

      </div>

    </div>

  );

}