import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IoChevronBack } from "react-icons/io5";
import api from "../api/apiClient";
import NotesViewModal from "../components/live/NotesViewModal";
import { LoadingState } from "../components/StateViews";
import "../styles/recording-player.css";

export default function RecordingPlayer() {
  const navigate = useNavigate();
  const { recordingId, videoId } = useParams();
  const iframeRef = useRef(null);
  const [recording, setRecording] = useState(null);
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    api
      .get(`/courses/recordings/${recordingId}/`)
      .then((res) => setRecording(res.data))
      .catch(() => setRecording(null));
  }, [recordingId]);

  useEffect(() => {
    api
      .get(`/courses/recordings/${recordingId}/progress/`)
      .then((res) => {
        const startTime = res.data.last_position || 0;
        iframeRef.current.src =
          `https://iframe.mediadelivery.net/embed/${import.meta.env.VITE_BUNNY_LIBRARY_ID || "615730"}/${videoId}?start=${Math.floor(startTime)}`;
      })
      .catch(() => {
        iframeRef.current.src =
          `https://iframe.mediadelivery.net/embed/${import.meta.env.VITE_BUNNY_LIBRARY_ID || "615730"}/${videoId}`;
      });
  }, [recordingId, videoId]);

  return (
    <div className="ac-screen">
      <button type="button" className="rp-back-btn" onClick={() => navigate(-1)}>
        <IoChevronBack size={14} /> Back
      </button>

      <div className="rp-headRow">
        {recording ? (
          <div>
            <h1 className="rp-title">{recording.title}</h1>
            <p className="rp-sub">
              {recording.subject_name}
              {recording.session_date ? ` · ${recording.session_date}` : ""}
            </p>
          </div>
        ) : (
          <div />
        )}
        <button type="button" className="ac-btn" onClick={() => setShowNotes(true)}>
          Notes
        </button>
      </div>

      {!recording && <LoadingState label="Loading recording" />}

      <div className="rp-player">
        <iframe
          ref={iframeRef}
          width="100%"
          height="600"
          allow="autoplay; fullscreen"
          allowFullScreen
          style={{ border: "none", display: "block" }}
          title={recording?.title || "Recording"}
        />
      </div>

      {showNotes && (
        <NotesViewModal sessionId={recordingId} sessionType="recording" onClose={() => setShowNotes(false)} />
      )}
    </div>
  );
}
