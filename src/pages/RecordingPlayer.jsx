import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IoChevronBack } from "react-icons/io5";
import api from "../api/apiClient";
import NotesViewModal from "../components/live/NotesViewModal";
import { LoadingState, ErrorState } from "../components/StateViews";
import { BUNNY_LIBRARY_ID } from "../config/urls";
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
    if (!BUNNY_LIBRARY_ID || !iframeRef.current) return;
    api
      .get(`/courses/recordings/${recordingId}/progress/`)
      .then((res) => {
        const startTime = res.data.last_position || 0;
        iframeRef.current.src =
          `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${videoId}?start=${Math.floor(startTime)}`;
      })
      .catch(() => {
        iframeRef.current.src =
          `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${videoId}`;
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

      {recording && !BUNNY_LIBRARY_ID ? (
        <ErrorState
          title="Playback isn't configured"
          message="This recording can't be played right now — the video library isn't set up. Contact support."
        />
      ) : (
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
      )}

      {showNotes && (
        <NotesViewModal sessionId={recordingId} sessionType="recording" onClose={() => setShowNotes(false)} />
      )}
    </div>
  );
}
