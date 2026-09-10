/**
 * shared/introVideoRules.js — what counts as a valid intro clip.
 *
 * One place for the rules, used by both upload paths (the expert-level clip
 * in pages/skill/ExpertProfileEdit.jsx and the per-listing clip in
 * components/skill/IntroVideoUpload.jsx), which previously disagreed: the
 * expert path checked type and size, the listing path checked nothing at all
 * and reported every failure as the single word "failed".
 *
 * These checks are a courtesy to the person uploading — they catch a bad file
 * in milliseconds instead of after a multi-megabyte upload. They are NOT the
 * control. skills/intro_video.py re-checks the duration against Bunny's own
 * reported length and refuses the save, so skipping the browser gains nothing.
 */

// Keep in step with MAX_INTRO_VIDEO_SECONDS in shiksha-backend/skills/intro_video.py.
export const MAX_SECONDS = 60;
export const MAX_BYTES = 4 * 1024 * 1024 * 1024; // 4 GB

export const ALLOWED_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
export const ACCEPT_ATTR = ALLOWED_TYPES.join(",");

// How long to wait for the browser to decode enough of the file to report a
// duration. A slow read must not stall the upload; it falls through to the
// server check instead.
const METADATA_TIMEOUT_MS = 5000;

/**
 * Read a video file's duration, in seconds.
 *
 * Resolves to null — never rejects — when the browser cannot decode the file
 * or takes too long. Null means "unknown", and an unknown duration must not
 * block an upload: the server has Bunny's authoritative number and will
 * refuse there if it really is too long. Blocking on a failed local decode
 * would reject valid clips in whatever codec this browser happens to lack.
 */
export function readDuration(file) {
  return new Promise((resolve) => {
    let settled = false;
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");

    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      resolve(value);
    };

    const timer = setTimeout(() => finish(null), METADATA_TIMEOUT_MS);

    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const d = video.duration;
      // A stream with no known length reports Infinity; a failed decode NaN.
      finish(Number.isFinite(d) && d > 0 ? d : null);
    };
    video.onerror = () => finish(null);
    video.src = url;
  });
}

/**
 * Validate a chosen file. Resolves to an error string, or null if it passes.
 *
 * Every branch names the actual problem and the actual limit, so "it failed"
 * is never the whole message.
 */
export async function validateIntroVideo(file) {
  if (!file) return "No file selected.";

  if (!ALLOWED_TYPES.includes(file.type)) {
    const what = file.type ? `“${file.type}” files` : "That file type";
    return `${what} can’t be used. Please upload an MP4, WebM, or MOV.`;
  }

  if (file.size > MAX_BYTES) {
    const gb = (file.size / (1024 * 1024 * 1024)).toFixed(1);
    return `That file is ${gb} GB. The limit is 4 GB.`;
  }

  const seconds = await readDuration(file);
  if (seconds !== null && seconds > MAX_SECONDS + 0.5) {
    return `That clip is ${Math.round(seconds)} seconds long. Intro videos must be ${MAX_SECONDS} seconds or shorter — please trim it and upload again.`;
  }

  return null;
}
