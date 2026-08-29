import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IoChevronBack } from "react-icons/io5";
import { FiEdit2 } from "react-icons/fi";
import api from "../api/apiClient";
import NotesViewModal from "../components/live/NotesViewModal";
import EditRecordingModal from "../components/EditRecordingModal";
import { LoadingState, EmptyState, ErrorState } from "../components/StateViews";
import useRecordingPlayback from "../hooks/useRecordingPlayback";
import {
  parsePlayerJsMessage,
  readTimeupdate,
  subscribePlayerJs,
} from "../utils/playerjs";
import "../styles/recording-player.css";

export default function RecordingPlayer() {
  const navigate = useNavigate();
  const { recordingId } = useParams();
  const iframeRef = useRef(null);

  const [recording, setRecording] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNotes, setShowNotes] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [startTime, setStartTime] = useState(0);

  // The last position Player.js reported, for the trim panel's "Set from
  // player" buttons. Held in a REF, not state: timeupdate fires several times
  // a second and re-rendering this page (and the iframe's siblings) at that
  // rate to track a number only read on a button click would be wasteful.
  // `playerReported` is the one bit of it that has to be reactive — it flips
  // once, and it is what decides whether those buttons are enabled or
  // disabled-with-a-hint.
  const lastPlayerSecondsRef = useRef(null);
  const [playerReported, setPlayerReported] = useState(false);
  const getPlayerSeconds = useCallback(() => lastPlayerSecondsRef.current, []);
  // Bumped to remount the iframe when the trim end is reached — the only way
  // to actually stop a cross-origin player we cannot call pause() on.
  const [iframeKey, setIframeKey] = useState(0);
  const [reachedEnd, setReachedEnd] = useState(false);

  // The signed, expiring embed URL. This page used to build
  // `iframe.mediadelivery.net/embed/{BUNNY_LIBRARY_ID}/{bunny_video_id}`
  // itself from a library id shipped in the bundle and a guid shipped in the
  // serializer — a permanent, unauthenticated link anyone could copy out and
  // pass on forever. `start` is the resume point read below; the server
  // clamps it into the trim window rather than any client doing that maths.
  const {
    embedUrl,
    error: playbackError,
    trimEnd,
    reload: reloadPlayback,
  } = useRecordingPlayback(recordingId, { start: startTime });

  // ── 1. load recording + saved position ───────────────────────────────────
  useEffect(() => {
    if (!recordingId) return;
    let alive = true;

    const fetchAll = async () => {
      setLoading(true);
      try {
        const [recRes, progRes] = await Promise.all([
          api.get(`/courses/recordings/${recordingId}/`),
          // Best-effort: a missing/failed progress read must not stop
          // playback, it just means starting from the top of the clip.
          api
            .get(`/courses/recordings/${recordingId}/progress/`)
            .catch(() => ({ data: {} })),
        ]);
        if (!alive) return;
        setRecording(recRes.data);
        const saved = progRes.data?.last_position || 0;
        // Only resume past the first 10 seconds — otherwise "resume" is just
        // a noisier way of starting at the beginning.
        setStartTime(saved > 10 ? Math.floor(saved) : 0);
      } catch {
        if (alive) setRecording(null);
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchAll();
    return () => {
      alive = false;
    };
  }, [recordingId]);

  // ── 2. Player.js subscription ────────────────────────────────────────────
  //
  // Bunny's player speaks Player.js: it posts a JSON *string* shaped
  // {context:"player.js", event, value:{seconds, duration}}, and it sends
  // nothing at all until we ask for it. Every listener in this codebase
  // expected a flat OBJECT with `currentTime` and never subscribed, so none
  // of them has ever fired. See utils/playerjs.js for the full write-up.
  useEffect(() => {
    const handleMessage = (e) => {
      const msg = parsePlayerJsMessage(e.data);
      if (!msg) return;

      // The player announces itself when it's ready; that is the moment a
      // subscription is guaranteed to stick. We also subscribe onLoad below,
      // because `ready` can fire before this listener is attached.
      if (msg.event === "ready") {
        subscribePlayerJs(iframeRef.current, ["timeupdate", "ended"]);
        return;
      }

      if (msg.event === "ended") {
        setReachedEnd(true);
        return;
      }

      if (msg.event !== "timeupdate") return;
      const t = readTimeupdate(msg);
      if (!t) return;

      lastPlayerSecondsRef.current = t.seconds;
      // Setting the same `true` again is a no-op React bails out of, so this
      // does not re-render on every tick.
      setPlayerReported(true);

      // Trim end is BEST-EFFORT and cannot be anything else: the iframe is
      // cross-origin, so there is no pause() to call. Remounting it with no
      // src is the only lever that actually stops the audio. A trim tidies
      // playback; it does not restrict access.
      if (trimEnd && t.seconds >= trimEnd && !reachedEnd) {
        setReachedEnd(true);
        setIframeKey((k) => k + 1);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [trimEnd, reachedEnd]);

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
        <div className="rp-headActions">
          {/* A teacher who spots the typo while watching shouldn't have to
              navigate back to the grid to fix it — and this is the one screen
              where "Set from player" can actually read a position. */}
          {recording && (
            <button type="button" className="ac-btn" onClick={() => setShowEdit(true)}>
              <FiEdit2 aria-hidden="true" /> Edit / Trim
            </button>
          )}
          <button type="button" className="ac-btn" onClick={() => setShowNotes(true)}>
            Notes
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading recording" />
      ) : !recording ? (
        <EmptyState
          icon="video"
          title="Recording not found"
          message="This recording may have been removed, or it isn't one of your classes."
        />
      ) : playbackError ? (
        // 403 / 404 / 503 read differently and are told apart here rather
        // than all rendering as one blank frame.
        <ErrorState
          title="Can't play this recording"
          message={playbackError}
          onRetry={reloadPlayback}
        />
      ) : (
        <div className="rp-player">
          {embedUrl ? (
            <iframe
              key={iframeKey}
              ref={iframeRef}
              src={reachedEnd ? undefined : embedUrl}
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              className="rp-playerFrame"
              title={recording.title || "Recording"}
              onLoad={() =>
                // `ready` may fire before the message listener mounts, so
                // subscribe here too. Duplicate addEventListener frames are
                // harmless.
                subscribePlayerJs(iframeRef.current, ["timeupdate", "ended"])
              }
            />
          ) : (
            <div className="rp-playerLoading">
              <LoadingState label="Preparing video" plain />
            </div>
          )}

          {reachedEnd && (
            <div className="rp-endCard">
              <p className="rp-endTitle">End of clip</p>
              <button
                type="button"
                className="rp-endBtn"
                onClick={() => {
                  setReachedEnd(false);
                  setIframeKey((k) => k + 1);
                }}
              >
                Replay
              </button>
            </div>
          )}
        </div>
      )}

      {showNotes && (
        <NotesViewModal sessionId={recordingId} sessionType="recording" onClose={() => setShowNotes(false)} />
      )}

      {showEdit && recording && (
        <EditRecordingModal
          recording={recording}
          playerAvailable={playerReported}
          getPlayerSeconds={getPlayerSeconds}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => {
            setRecording(updated);
            // The trim window is resolved SERVER-side into the signed embed
            // URL, so a changed trim leaves the URL in hand stale. Refetch it
            // and clear the end-of-clip card, or the player keeps honouring
            // the window that was just edited away.
            setReachedEnd(false);
            setIframeKey((k) => k + 1);
            reloadPlayback();
          }}
        />
      )}
    </div>
  );
}
