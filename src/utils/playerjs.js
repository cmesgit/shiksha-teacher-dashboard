/**
 * Minimal Player.js client for the Bunny Stream iframe.
 *
 * WHY THIS EXISTS
 * Bunny's embedded player speaks the Player.js protocol
 * (https://bunny.net/docs/stream/playback-api). Every screen in this codebase
 * previously listened for a FLAT message instead:
 *
 *     const { event, currentTime, duration } = e.data;   // never matched
 *
 * That is wrong in three independent ways, and each one alone is fatal:
 *
 *   1. Player.js posts a JSON **string**, not an object. The old handler's
 *      first line was `if (typeof e.data !== "object") return;`, so it bailed
 *      out before reading anything.
 *   2. The payload is `{context, event, value:{seconds, duration}}` — the
 *      fields are `value.seconds`, not `currentTime`.
 *   3. The player does not broadcast unsolicited. You must first post an
 *      `addEventListener` frame for each event you want.
 *
 * Net effect: the listener never fired, `last_position` was never anything but
 * 0, and the `pos <= 0` guard on the autosave skipped every write. Watch
 * progress — the resume point, the "N% watched" bar, the Continue/Rewatch
 * states — has never worked on any screen since it was written.
 *
 * Deliberately hand-rolled rather than pulling in the `playerjs` npm package:
 * we need three verbs, the wire format is stable and documented, and the
 * package would be a runtime dependency in three separate apps for ~40 lines.
 */

const CONTEXT = "player.js";
const VERSION = "0.0.11";

/**
 * Decode a window message, or null when it isn't a Player.js frame.
 *
 * Never throws: a page hosting this iframe receives messages from all sorts of
 * places (extensions, other embeds), and a malformed one must not take out the
 * whole listener.
 */
export function parsePlayerJsMessage(data) {
  if (typeof data !== "string") return null;
  try {
    const msg = JSON.parse(data);
    if (!msg || msg.context !== CONTEXT) return null;
    return msg;
  } catch {
    return null;
  }
}

/** Post one Player.js command to the iframe. No-op if it isn't mounted yet. */
export function sendPlayerJs(iframe, method, value) {
  const win = iframe?.contentWindow;
  if (!win) return;
  const frame = { context: CONTEXT, version: VERSION, method };
  if (value !== undefined) frame.value = value;
  // targetOrigin "*": the embed host is Bunny's, not ours, and it varies by
  // library region. The frames carry no secrets — they are playback commands —
  // and we validate `context` on everything coming back.
  win.postMessage(JSON.stringify(frame), "*");
}

/** Subscribe to a list of player events. Safe to call more than once. */
export function subscribePlayerJs(iframe, events) {
  events.forEach((event) => sendPlayerJs(iframe, "addEventListener", event));
}

/**
 * Pull `{seconds, duration}` out of a timeupdate frame.
 *
 * Bunny sends `value: {seconds, duration}`. The fallbacks cover the flat
 * shape some Player.js implementations use, so a future player change
 * degrades to "no progress" rather than to wrong progress.
 */
export function readTimeupdate(msg) {
  const v = msg?.value;
  if (v && typeof v === "object") {
    const seconds = Number(v.seconds ?? v.currentTime);
    const duration = Number(v.duration);
    if (Number.isFinite(seconds)) {
      return { seconds, duration: Number.isFinite(duration) ? duration : null };
    }
  }
  return null;
}

export const PLAYERJS_CONTEXT = CONTEXT;
