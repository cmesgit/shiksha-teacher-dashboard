import { useEffect, useRef, useState } from "react";
import api from "../../api/apiClient";
import "./LiveChatPanel.css";
import "./NotesPanel.css";

// Live/Private/Group sessions are backed by different Django apps with
// different URL prefixes — no single shared notes path.
const NOTES_URL = {
  live: (id) => `/livestream/sessions/${id}/notes/`,
  private: (id) => `/sessions/${id}/notes/`,
  group: (id) => `/sessions/group-sessions/${id}/notes/`,
};

// In-call Notes panel (right rail, alongside Chat) — private per-user
// scratchpad for a session. Autosaves via a debounced PATCH so it behaves
// like a normal notes app rather than requiring an explicit save.
export default function NotesPanel({ sessionId, sessionType = "live" }) {
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("loading"); // loading | idle | saving | saved
  const saveTimer = useRef(null);
  const loadedRef = useRef(false);
  const url = NOTES_URL[sessionType](sessionId);

  useEffect(() => {
    let cancelled = false;
    api
      .get(url)
      .then((res) => {
        if (cancelled) return;
        setContent(res.data?.content || "");
        setStatus("idle");
        loadedRef.current = true;
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("idle");
          loadedRef.current = true;
        }
      });
    return () => {
      cancelled = true;
      clearTimeout(saveTimer.current);
    };
  }, [url]);

  const handleChange = (e) => {
    const value = e.target.value;
    setContent(value);
    if (!loadedRef.current) return;

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
    <div className="cp-outer">
      <div className="cp-header">Notes</div>
      <div className="np-wrap">
        <textarea
          className="np-textarea"
          value={content}
          onChange={handleChange}
          placeholder="Jot down notes during class — only you can see these."
        />
        <div className="np-status">
          {status === "saving" && "Saving…"}
          {status === "saved" && "Saved"}
        </div>
      </div>
    </div>
  );
}
