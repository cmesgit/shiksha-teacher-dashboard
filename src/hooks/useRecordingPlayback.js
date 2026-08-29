import { useCallback, useEffect, useState } from "react";
import api from "../api/apiClient";

/**
 * Fetch a SIGNED, expiring embed URL for a recording.
 *
 * Replaces every screen building
 * `https://iframe.mediadelivery.net/embed/{LIBRARY_ID}/{guid}` itself. That
 * URL was permanent and unauthenticated: the library id ships in the JS bundle
 * (VITE_BUNNY_LIBRARY_ID, see config/urls.js) and the guid ships in the
 * recording serializer, so anyone entitled to watch once could reconstruct a
 * link and pass it to anyone at all, forever. It also meant Bunny's "Embed
 * View Token Authentication" could never be switched on without breaking all
 * three players at once.
 *
 * `GET /courses/recordings/:id/playback/` runs the full entitlement check on
 * EVERY playback and returns a URL that expires. It also resolves the trim
 * window server-side, so no client re-implements that arithmetic.
 *
 * `tokenAuth: false` is the honest signal that BUNNY_STREAM_TOKEN_KEY is not
 * configured — the URL is still the old permanent one and nothing is gated.
 * Do not treat a successful response as proof playback is protected.
 *
 * Kept byte-comparable with the student dashboard's copy of this hook (only
 * the apiClient import path differs — this app has two axios clients and
 * RecordingPlayer.jsx uses `api/apiClient`). Fix bugs in both.
 */
export default function useRecordingPlayback(recordingId, { start } = {}) {
  const [state, setState] = useState({
    loading: true,
    embedUrl: null,
    error: null,
    trimStart: 0,
    trimEnd: null,
    effectiveDuration: null,
    resolvedStart: 0,
    tokenAuth: false,
  });

  // Reload is a counter rather than a callback so the fetch can live entirely
  // INSIDE the effect. A memoised `load()` called from an effect trips
  // react-hooks/set-state-in-effect, because its first statement sets state
  // synchronously during the effect; awaiting first is what makes it legal.
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    if (!recordingId) return undefined;
    // `ignore` rather than an AbortController: two rapid recording switches
    // must not let the first response overwrite the second's URL.
    let ignore = false;

    (async () => {
      try {
        const params = {};
        if (Number.isFinite(start) && start > 0) {
          params.start = Math.floor(start);
        }
        const { data } = await api.get(
          `/courses/recordings/${recordingId}/playback/`,
          { params },
        );
        if (ignore) return;
        setState({
          loading: false,
          error: null,
          embedUrl: data.embed_url,
          trimStart: data.trim_start_seconds ?? 0,
          trimEnd: data.trim_end_seconds ?? null,
          effectiveDuration:
            data.effective_duration_seconds ?? data.duration_seconds ?? null,
          resolvedStart: data.start ?? 0,
          tokenAuth: Boolean(data.token_auth),
        });
      } catch (err) {
        if (ignore) return;
        // Three genuinely different failures that must not collapse into one
        // blank frame — a viewer who lost access, a recording with no video
        // attached, and a server missing its Bunny config need different
        // words.
        const code = err?.response?.status;
        const message =
          code === 403
            ? "You no longer have access to this recording."
            : code === 404
              ? "This recording has no video attached yet."
              : code === 503
                ? "Video playback isn't configured on this server."
                : "Couldn't start playback. Please try again.";
        setState((s) => ({
          ...s, loading: false, error: message, embedUrl: null,
        }));
      }
    })();

    return () => {
      ignore = true;
    };
  }, [recordingId, start, reloadToken]);

  return { ...state, reload };
}
