/* shared/extractError.js — normalise DRF error payloads to a single string. */
export function extractError(err) {
  const d = err?.response?.data;
  if (!d) return err?.message || "Something went wrong.";
  if (typeof d === "string") return d;
  if (d.detail) return d.detail;
  // First field error.
  for (const k of Object.keys(d)) {
    const v = d[k];
    if (Array.isArray(v) && v.length) return v[0];
    if (typeof v === "string") return v;
  }
  return "Something went wrong.";
}
export default extractError;
