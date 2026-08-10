/**
 * IntroVideoUpload.jsx — per-listing intro clip.
 *
 * The whole point of multi-skill is that a guitar clip does not advertise a
 * welding class, so the video hangs off the LISTING, not the expert.
 *
 *   POST /skill/teacher/listings/<id>/intro-video/         → {video_id, library_id, expire, signature}
 *   TUS  Bunny's resumable endpoint, signed with that ticket → the file, direct to Bunny
 *   POST /skill/teacher/listings/<id>/intro-video/save/     ← {video_id}
 *   GET  /skill/teacher/listings/<id>/intro-video/status/   poll until status 4
 *
 * The upload goes through tus-js-client (see src/shared/bunnyUpload.js) —
 * the per-video signed ticket keeps the library's master AccessKey server-side.
 *
 * Statuses (ExpertProfile.INTRO_VIDEO_STATUS_CHOICES, reused verbatim):
 *   0 Created · 1 Uploaded · 2 Processing · 3 Transcoding · 4 Finished · 5 Error
 */
import { useEffect, useRef, useState } from "react";
import api from "../../shared/apiClient";
import { uploadToBunny } from "../../shared/bunnyUpload";

const POLL_MS = 4000;

export default function IntroVideoUpload({ listingId, status }) {
  const [progress, setProgress] = useState(null);
  // `status` is what the form loaded from the server; `local` is anything this
  // component has learned since (an upload it started, a poll it ran). Derived
  // rather than mirrored into state, so a re-fetched listing can't clobber a
  // fresher status this component already saw.
  const [local, setLocal]       = useState(null);
  const [name, setName]         = useState("");
  const inputRef = useRef(null);

  const state = local ?? status ?? null;

  // Poll while Bunny transcodes; stop on Finished or Error.
  useEffect(() => {
    if (!listingId || state == null || state >= 4) return undefined;
    const timer = setInterval(() => {
      api.get(`/skill/teacher/listings/${listingId}/intro-video/status/`)
        .then((r) => setLocal(r.data.intro_video_status))
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [listingId, state]);

  const upload = async (file) => {
    if (!file || !listingId) return;
    setName(file.name);
    setProgress(0);
    try {
      const { data } = await api.post(`/skill/teacher/listings/${listingId}/intro-video/`, {
        title: file.name,
      });
      await uploadToBunny(file, data, { onProgress: setProgress });
      await api.post(`/skill/teacher/listings/${listingId}/intro-video/save/`, {
        video_id: data.video_id,
      });
      setProgress(100);
      setLocal(1);
    } catch {
      setLocal(5);
    }
  };

  if (!listingId) {
    return (
      <div className="sk-vid">
        <span>Save the skill first, then add its intro clip.</span>
      </div>
    );
  }

  if (state === 4) {
    return (
      <div className="sk-vid sk-vid--done">
        <span>Intro video live</span>
        <button type="button" onClick={() => inputRef.current?.click()}>Replace</button>
        <input ref={inputRef} type="file" accept="video/*" hidden
               onChange={(e) => upload(e.target.files?.[0])} />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className="sk-drop"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files?.[0]); }}
      >
        <i>▶</i>
        <b>Drop a clip, or browse</b>
        <em>Under 90 seconds. Uploads to Bunny; you&apos;ll see it here once transcoding finishes.</em>
      </button>
      <input ref={inputRef} type="file" accept="video/*" hidden
             onChange={(e) => upload(e.target.files?.[0])} />

      {(progress != null || (state != null && state < 4)) && (
        <div className={`sk-vid${state === 5 ? " sk-vid--err" : ""}`}>
          <span>
            {name || "intro clip"} · {state === 5 ? "failed" : state >= 1 ? "transcoding" : "uploading"}
          </span>
          <i><b style={{ width: `${state >= 1 ? 64 : progress || 0}%` }} /></i>
        </div>
      )}
    </>
  );
}
