import { useEffect, useRef, useState } from "react";
import api from "../../api/apiClient";
import "./NotesViewModal.css";

// Live/Private/Group sessions (and a recording, the same idea applied to a
// past session's video) are backed by different Django apps with different
// URL prefixes — no single shared notes path.
const NOTES_URL = {
  live: (id) => `/livestream/sessions/${id}/notes/`,
  private: (id) => `/sessions/${id}/notes/`,
  group: (id) => `/sessions/group-sessions/${id}/notes/`,
  recording: (id) => `/courses/recordings/${id}/notes/`,
};

// Opened from a past/history-tab "Notes" button — lets a participant re-read
// (and keep editing) the private notes they took during a since-ended session.
export default function NotesViewModal({ sessionId, onClose, sessionType = "live" }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("idle"); // idle | saving | saved
  const saveTimer = useRef(null);
  const url = NOTES_URL[sessionType](sessionId);

  useEffect(() => {
    let cancelled = false;
    api
      .get(url)
      .then((res) => {
        if (!cancelled) setContent(res.data?.content || "");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(saveTimer.current);
    };
  }, [url]);

  const handleChange = (e) => {
    const value = e.target.value;
    setContent(value);
    setStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api
        .patch(url, { content: value })
        .then(() => setStatus("saved"))
        .catch(() => setStatus("idle"));
    }, 800);
  };

  return (
    <div className="notesViewModal__overlay" onClick={onClose}>
      <div className="notesViewModal__panel" onClick={(e) => e.stopPropagation()}>
        <div className="notesViewModal__header">
          <h2 className="notesViewModal__title">Your notes</h2>
          <button type="button" className="notesViewModal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {loading ? (
          <p className="notesViewModal__loading">Loading…</p>
        ) : (
          <>
            <textarea
              className="notesViewModal__textarea"
              value={content}
              onChange={handleChange}
              placeholder="No notes taken for this session yet."
              rows={8}
            />
            <div className="notesViewModal__status">
              {status === "saving" && "Saving…"}
              {status === "saved" && "Saved"}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
