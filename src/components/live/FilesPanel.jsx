/**
 * FilesPanel.jsx — group- and private-session file sharing, ported from
 * shiksha-frontend's FilesPanel.jsx for feature parity across all live
 * session hosts. `sessionType` picks the URL base, same convention as
 * NotesPanel.jsx's `NOTES_URL` map — the two session kinds are backed by
 * different Django URL prefixes (sessions_app/urls.py: bare
 * `<uuid:session_id>/files/` for private, `group-sessions/<uuid>/files/`
 * for group), not one shared endpoint.
 *
 * Right-hand panel, same 300px shell as the chat/notes/people panels.
 * Everyone uploads; only the host or the uploader may delete a row. Every
 * row shows its own expiry countdown, because files disappear after the
 * admin's retention window (sessions_app/live_rules.py::file_expires_at).
 *
 * `limits.max_upload_mb` / `limits.max_files` drive CLIENT-SIDE pre-checks
 * only (fewer round-trips for an obviously-too-big file) — the real
 * enforcement is server-side in live_files_views.py (413 "too_large" / 409
 * "too_many"), so every server error is surfaced via its `detail` message
 * rather than re-implemented here.
 *
 * Live updates: this deliberately does NOT open a second WebSocket. It
 * receives the *same* chat socket the classroom UI already holds open
 * (`group_session_chat_<id>` for group, `private_session_chat_<id>` for
 * private) and adds an independent `addEventListener("message", …)`
 * listener — additive, side-by-side with the chat panel's own
 * `ws.onmessage` handler, so neither clobbers the other. Passing no socket
 * (e.g. a private-session host with no exposed raw WS reference yet) is
 * safe — the panel just won't get live pushes from other participants
 * until it's reopened, everything else still works.
 * `session_file_added` / `session_file_removed` match the exact broadcast
 * shape in live_files_views.py + consumers.py (both consumers' matching
 * handler methods).
 */
import { useCallback, useEffect, useRef, useState } from "react";

import api from "../../api/apiClient";

const FILES_URL = {
  group: (id) => `/sessions/group-sessions/${id}/files/`,
  private: (id) => `/sessions/${id}/files/`,
};

function expiresIn(iso) {
  if (!iso) return "—";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3_600_000);
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h`;
}

function kindOf(name) {
  const ext = (String(name || "").split(".").pop() || "").toUpperCase();
  return ["PDF", "PNG", "JPG", "JPEG", "DOC", "DOCX", "PPT", "PPTX", "XLSX"].includes(ext)
    ? ext
    : "FILE";
}

export default function FilesPanel({
  sessionId,
  sessionType = "group",
  isHost,
  currentUserId,
  limits,
  socket,
}) {
  const [files, setFiles] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState([]); // [{name, percent}]
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const maxMb = limits?.max_upload_mb ?? 25;
  const maxFiles = limits?.max_files ?? 10;
  const retentionDays = limits?.file_retention_days ?? 2;
  const url = FILES_URL[sessionType](sessionId);

  useEffect(() => {
    let cancelled = false;
    if (!sessionId) return undefined;
    api
      .get(url)
      .then((res) => {
        if (!cancelled) setFiles(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, url]);

  // Additive listener on the room's existing chat socket — see module note.
  useEffect(() => {
    if (!socket) return undefined;
    const onMessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.type === "session_file_added" && msg.file) {
        setFiles((prev) =>
          prev.some((f) => f.id === msg.file.id) ? prev : [...prev, msg.file]
        );
      }
      if (msg.type === "session_file_removed") {
        setFiles((prev) => prev.filter((f) => f.id !== msg.file_id));
      }
    };
    socket.addEventListener("message", onMessage);
    return () => socket.removeEventListener("message", onMessage);
  }, [socket]);

  const upload = useCallback(
    async (fileList) => {
      setError("");
      const incoming = Array.from(fileList || []);
      for (const file of incoming) {
        if (file.size > maxMb * 1024 * 1024) {
          setError(`${file.name} is over ${maxMb} MB.`);
          continue;
        }
        if (files.length + pending.length >= maxFiles) {
          setError(`This room already has ${maxFiles} files, the most it allows.`);
          break;
        }
        setPending((p) => [...p, { name: file.name, percent: 0 }]);
        try {
          const body = new FormData();
          body.append("file", file);
          const { data } = await api.post(url, body, {
            headers: { "Content-Type": "multipart/form-data" },
            onUploadProgress: (e) => {
              const percent = Math.round((e.loaded / (e.total || 1)) * 100);
              setPending((p) =>
                p.map((row) => (row.name === file.name ? { ...row, percent } : row))
              );
            },
          });
          // Own upload lands via the direct response; the WS broadcast also
          // fires for everyone else in the room (and is a harmless no-op
          // dedupe here thanks to the `.some(f.id===)` guard above).
          if (data?.id) {
            setFiles((prev) => (prev.some((f) => f.id === data.id) ? prev : [...prev, data]));
          }
        } catch (err) {
          setError(err?.response?.data?.detail || `Couldn't upload ${file.name}.`);
        } finally {
          setPending((p) => p.filter((row) => row.name !== file.name));
        }
      }
    },
    [maxMb, maxFiles, files.length, pending.length, url]
  );

  const remove = async (fileId) => {
    setError("");
    try {
      await api.delete(`${url}${fileId}/`);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (err) {
      setError(err?.response?.data?.detail || "Couldn't delete that file.");
    }
  };

  return (
    <aside className="gs-panel gs-files">
      <header className="gs-panel__head">
        <span>Files · {files.length}</span>
        <small>kept {retentionDays}d</small>
      </header>

      <div className="gs-panel__body">
        <button
          type="button"
          className={"gs-dropzone" + (dragging ? " is-dragging" : "")}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            upload(e.dataTransfer.files);
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <strong>Drop files here</strong>
          <small>
            PDF, image, doc · up to {maxMb} MB · {maxFiles} per session
          </small>
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            upload(e.target.files);
            e.target.value = "";
          }}
        />

        {error ? <p className="gs-files__error">{error}</p> : null}

        {loaded && files.length === 0 && pending.length === 0 ? (
          <p className="gs-panel__note gs-files__empty">No files shared yet.</p>
        ) : null}

        {files.map((f) => (
          <div className="gs-file" key={f.id}>
            <span className={"gs-file__kind gs-file__kind--" + kindOf(f.name).toLowerCase()}>
              {kindOf(f.name)}
            </span>
            <span className="gs-file__meta">
              <strong>{f.name}</strong>
              <small>
                {((f.size_bytes || 0) / 1_048_576).toFixed(1)} MB · {f.uploaded_by} · expires in{" "}
                {expiresIn(f.expires_at)}
              </small>
            </span>
            <span className="gs-file__actions">
              <a
                href={f.url}
                download
                target="_blank"
                rel="noreferrer"
                className="gs-file__btn"
                aria-label="Download"
                title="Download"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
              </a>
              {isHost || String(f.uploaded_by_id) === String(currentUserId) ? (
                <button
                  type="button"
                  className="gs-file__btn gs-file__btn--danger"
                  onClick={() => remove(f.id)}
                  aria-label="Delete"
                  title="Delete"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                </button>
              ) : null}
            </span>
          </div>
        ))}

        {pending.map((row) => (
          <div className="gs-file gs-file--uploading" key={row.name}>
            <span className="gs-file__kind">···</span>
            <span className="gs-file__meta">
              <strong>{row.name}</strong>
              <small>Uploading · {row.percent}%</small>
              <span className="gs-file__bar">
                <span style={{ width: `${row.percent}%` }} />
              </span>
            </span>
          </div>
        ))}

        <p className="gs-panel__note">
          Files are deleted {retentionDays} day{retentionDays === 1 ? "" : "s"} after the session
          ends, or when the host removes them. Everyone in the room can upload; only the host can
          delete someone else's file.
        </p>
      </div>
    </aside>
  );
}
