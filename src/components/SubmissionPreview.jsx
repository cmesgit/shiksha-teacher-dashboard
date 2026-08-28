/**
 * SubmissionPreview — read a student's submitted file without saving it first.
 *
 * The Review button used to be a bare <a target="_blank"> to the file URL, so
 * the browser decided everything: a PDF opened in a separate tab, and a .docx
 * (what most students hand in) just downloaded. A teacher marking thirty
 * submissions had thirty files on their desktop before they'd graded one.
 *
 * Two things make this work without touching the backend or nginx:
 *
 * 1. The file is fetched as a BLOB, not pointed at directly. Django serves
 *    /api/media/secure/<name> through XFrameOptionsMiddleware with the default
 *    X-Frame-Options: DENY, which kills <iframe>/<object> even same-origin. A
 *    blob: URL is not an HTTP response, so no header applies. Fetching also
 *    reuses the existing cookie auth (apiClient has withCredentials), and the
 *    teacher is already authorised for this path by media_security.py's
 *    _check_assignment_submission — no new endpoint, no signed URL.
 *
 * 2. The Blob is constructed with a MIME type WE choose from the extension
 *    allow-list below, never one echoed from the server. assignments/
 *    serializers.py's validate_submission_file docstring records that a
 *    student could once store payload.html and "the teacher's own 'Review'
 *    click executed it". Submitted bytes are the least-trusted input on the
 *    platform; nothing here can be rendered as HTML, because no branch ever
 *    produces a text/html blob.
 *
 * Formats a browser genuinely cannot render (.docx/.doc/.odt/.rtf, .zip, and
 * .heic/.heif which Chrome and Firefox can't decode) fall back to an honest
 * "download to open" panel rather than a blank frame.
 */
import { useEffect, useRef, useState } from "react";
import { IoClose, IoDownloadOutline } from "react-icons/io5";
import api from "../api/apiClient";
import "../styles/submission-preview.css";

// Extension → the MIME type we will hand the browser. Anything absent from
// this map is treated as not previewable. Deliberately excludes every
// active-content type; see the module note above.
const RENDERABLE = {
  pdf: { kind: "pdf", mime: "application/pdf" },
  jpg: { kind: "image", mime: "image/jpeg" },
  jpeg: { kind: "image", mime: "image/jpeg" },
  png: { kind: "image", mime: "image/png" },
  webp: { kind: "image", mime: "image/webp" },
  txt: { kind: "text", mime: "text/plain" },
};

// Why a specific format can't be shown — better than a generic shrug, and it
// tells the teacher whether downloading will actually help.
const CANNOT_RENDER = {
  doc: "Word documents can't be displayed in a browser.",
  docx: "Word documents can't be displayed in a browser.",
  odt: "OpenDocument files can't be displayed in a browser.",
  rtf: "Rich Text files can't be displayed in a browser.",
  zip: "This is a ZIP archive — download it to see what's inside.",
  heic: "HEIC photos (from an iPhone) can't be displayed in this browser.",
  heif: "HEIF photos (from an iPhone) can't be displayed in this browser.",
};

function extensionOf(filename, url) {
  // Prefer the server-provided filename: `upload_to` plus Django's collision
  // suffixes make the URL's tail unreliable, and the URL is rewritten to
  // /api/media/secure/<name> by SecureLocalStorage.
  const source = filename || (url || "").split("?")[0];
  const tail = source.split("/").pop() || "";
  const dot = tail.lastIndexOf(".");
  return dot === -1 ? "" : tail.slice(dot + 1).toLowerCase();
}

export default function SubmissionPreview({ url, filename, studentName, onClose }) {
  const ext = extensionOf(filename, url);
  const renderable = RENDERABLE[ext];
  // Nothing is fetched for a format we can't render, so such a preview is
  // never "loading". Deriving the initial value here rather than correcting it
  // with a setState inside the effect keeps the first paint truthful — and
  // avoids react-hooks/set-state-in-effect. SubmissionView mounts this fresh
  // per preview (it renders only while `previewing` is set), so these props
  // never change under an existing instance.
  const willFetch = Boolean(url && renderable);

  const [blobUrl, setBlobUrl] = useState("");
  const [textBody, setTextBody] = useState("");
  const [loading, setLoading] = useState(willFetch);
  const [failed, setFailed] = useState("");
  // Held in a ref as well as state so cleanup can revoke the CURRENT url
  // without re-running the effect every time it changes.
  const objectUrlRef = useRef("");

  useEffect(() => {
    if (!willFetch) return undefined;

    let cancelled = false;

    (async () => {
      try {
        const res = await api.get(url, { responseType: "blob" });
        if (cancelled) return;

        if (renderable.kind === "text") {
          setTextBody(await res.data.text());
          setLoading(false);
          return;
        }

        // Re-wrap with OUR mime type — res.data.type is whatever the server
        // guessed from the filename and must not be trusted to decide how the
        // browser renders these bytes.
        const typed = new Blob([res.data], { type: renderable.mime });
        const objectUrl = URL.createObjectURL(typed);
        objectUrlRef.current = objectUrl;
        setBlobUrl(objectUrl);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        // A 404 here is media_security.py's unauthenticated branch, not a
        // missing file — worth saying so rather than "not found".
        setFailed(
          err?.response?.status === 404
            ? "Couldn't open this file. Your session may have expired — try reloading the page."
            : "Couldn't load this file. Please try again."
        );
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = "";
      }
    };
  }, [url, renderable, willFetch]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const body = () => {
    if (!renderable) {
      return (
        <div className="sp-fallback">
          <p className="sp-fallback-reason">
            {CANNOT_RENDER[ext] || "This file type can't be previewed."}
          </p>
          <p className="sp-fallback-hint">
            Download it to open in the app it belongs to.
          </p>
        </div>
      );
    }
    if (loading) return <div className="sp-status">Opening the file…</div>;
    if (failed) return <div className="sp-status sp-status--error">{failed}</div>;
    if (renderable.kind === "image") {
      return <img className="sp-image" src={blobUrl} alt={`Submission from ${studentName}`} />;
    }
    if (renderable.kind === "text") {
      return <pre className="sp-text">{textBody}</pre>;
    }
    return (
      <object className="sp-pdf" data={blobUrl} type="application/pdf">
        {/* Reached when the browser has no built-in PDF viewer. */}
        <div className="sp-fallback">
          <p className="sp-fallback-reason">
            This browser can't display PDFs inline.
          </p>
        </div>
      </object>
    );
  };

  return (
    <div className="sp-overlay" role="dialog" aria-modal="true" aria-label="Submission preview">
      {/* Click-outside to dismiss. The panel stops propagation so a click
          inside it (selecting text in the document) never closes the view. */}
      <div className="sp-backdrop" onClick={onClose} />
      <div className="sp-panel" onClick={(e) => e.stopPropagation()}>
        <header className="sp-head">
          <div className="sp-head-text">
            <h3 className="sp-title">{studentName}</h3>
            {filename && <p className="sp-filename">{filename}</p>}
          </div>
          <div className="sp-actions">
            <a
              className="sp-btn"
              href={url}
              target="_blank"
              rel="noreferrer"
              download={filename || undefined}
            >
              <IoDownloadOutline aria-hidden="true" /> Download
            </a>
            <button type="button" className="sp-btn sp-btn--icon" onClick={onClose} aria-label="Close preview">
              <IoClose aria-hidden="true" />
            </button>
          </div>
        </header>
        <div className="sp-body">{body()}</div>
      </div>
    </div>
  );
}
