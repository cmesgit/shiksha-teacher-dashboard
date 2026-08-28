/* shared/extractError.js — normalise DRF error payloads to a single string. */

/* A 5xx from Django (or an nginx/gateway page) is not JSON — axios leaves the
 * body as a raw string, and returning it put this in front of a learner:
 *
 *   <!doctype html> <html lang="en"> <head> <title>Server Error (500)</title>
 *   </head> <body> <h1>Server Error (500)</h1><p></p> </body> </html>
 *
 * rendered as the error banner on Browse Courses. Markup is never a message
 * for a human, and an error page can also carry a stack trace when DEBUG is
 * on, so this refuses anything that looks like a document and lets the
 * caller's own copy ("Couldn't load courses…") through instead.
 *
 * Kept deliberately dumb — a leading "<" after trimming, or an oversized
 * blob. A real DRF `detail` string is short and never starts with a tag. */
const MAX_MESSAGE_LENGTH = 300;

function usableString(s) {
  const t = String(s).trim();
  if (!t) return null;
  if (t.startsWith("<")) return null;            // HTML/XML error document
  if (t.length > MAX_MESSAGE_LENGTH) return null; // page body, stack trace, dump
  return t;
}

export function extractError(err) {
  const d = err?.response?.data;
  if (!d) return err?.message || "Something went wrong.";
  if (typeof d === "string") return usableString(d) || "Something went wrong.";
  if (d.detail) return usableString(d.detail) || "Something went wrong.";
  // First field error.
  for (const k of Object.keys(d)) {
    if (k === "code") continue; // machine token, never user-facing
    const v = d[k];
    if (Array.isArray(v) && v.length) {
      const m = usableString(v[0]);
      if (m) return m;
    }
    if (typeof v === "string") {
      const m = usableString(v);
      if (m) return m;
    }
  }
  return "Something went wrong.";
}
export default extractError;
