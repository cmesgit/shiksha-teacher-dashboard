/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  GENERATED FILE — DO NOT EDIT HERE.                                       │
 * │  Canonical source: <workspace>/shared/src/tour/tourApi.js                 │
 * │  Edit the canonical copy, then run `npm run sync:shared` (any app) to     │
 * │  propagate. `npm run check:shared` fails if an app's copy has drifted.    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * tourApi.js — the three endpoints (TOUR_SYSTEM_SPEC.md §4.2) plus the
 * localStorage mirror (§7.5).
 *
 * The mirror is keyed `shiksha_tours_<identity_key>` (per-profile — matches
 * CourseContext's existing overrideKey(profileId) idiom). identity_key is
 * computed CLIENT-SIDE from auth state already resolved by AuthProvider by
 * the time TourProvider mounts (the same "L:<uuid>" / "T:<uuid>" format the
 * server uses — see accounts/settings_views.py:_identity_for_tours), so the
 * mirror can be read synchronously at boot without waiting on this module's
 * own network round-trip.
 *
 * Fail-open (mirrors FirstVisitTour's existing behaviour): if localStorage
 * throws (private mode / quota), reading returns null and writing is a
 * silent no-op. A null mirror is treated as "nothing seen yet" upstream, so
 * a blocked localStorage means tours are still offered — never permanently
 * suppressed by a storage failure.
 */

const MIRROR_PREFIX = "shiksha_tours_";

export function computeIdentityKey({ isLearnerContext, isTeacherContext, activeProfile, teacherInfo, userId }) {
  if (isLearnerContext && activeProfile?.id) return `L:${activeProfile.id}`;
  // `teacherInfo` (the `/accounts/me/` response's `teacher` object) carries
  // type/tracks/tier fields but no id — a teacher account has exactly one
  // TeacherProfile, so `userId` is a stable 1:1 proxy for it. This key is
  // only ever used client-side (the localStorage mirror + boot-fetch gate);
  // the server independently resolves its own "T:<TeacherProfile.id>" key
  // from the session, so the two never need to match.
  if (isTeacherContext && userId) return `T:${userId}`;
  return null;
}

export function readMirror(identityKey) {
  if (!identityKey) return null;
  try {
    const raw = localStorage.getItem(MIRROR_PREFIX + identityKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeMirror(identityKey, state) {
  if (!identityKey || !state) return;
  try {
    localStorage.setItem(MIRROR_PREFIX + identityKey, JSON.stringify(state));
  } catch {
    /* private mode / quota — in-memory state still works this session */
  }
}

// A safe, fully-permissive starting point for the brief window before the
// real GET resolves (and there's no mirror to seed from either) — nothing
// here should ever block the rule engine from considering a tour.
export function emptyTourState() {
  return {
    identity_key: null,
    autoplay_enabled: true,
    tours: {},
    last_auto_tour_at: null,
    consecutive_dismissals: 0,
    absence_days: 0,
    is_first_session: true,
    server_now: null,
    features: { tours_enabled: true, show_tour: true },
  };
}

/** Client-side mirror of the server's PATCH merge logic (accounts/settings_views.py),
 * used only for the optimistic local update — the next real GET is authoritative. */
export function mergeTourPatch(state, body) {
  const next = { ...state, tours: { ...state.tours } };

  if (typeof body.autoplay_enabled === "boolean") {
    next.autoplay_enabled = body.autoplay_enabled;
  }

  if (body.tour_key) {
    const existing = next.tours[body.tour_key] || {};
    next.tours[body.tour_key] = {
      status: body.status,
      version: body.version ?? existing.version ?? 1,
      step: body.step ?? existing.step ?? 0,
      at: new Date().toISOString(),
      count: (existing.count || 0) + 1,
    };
    if (body.status === "dismissed") {
      next.consecutive_dismissals = (state.consecutive_dismissals || 0) + 1;
      if (next.consecutive_dismissals >= 3) next.autoplay_enabled = false;
    } else {
      next.consecutive_dismissals = 0;
    }
    if (body.auto) next.last_auto_tour_at = new Date().toISOString();
  }

  return next;
}

export async function fetchTourState(api) {
  const res = await api.get("/accounts/tours/");
  return res.data;
}

/** Writes the mirror first, then fires the PATCH without waiting on it — a
 * failed PATCH must not re-show the tour this session (R1 already covers
 * that via sessionStorage), so failures are logged in DEV only and swallowed. */
export function patchTourFireAndForget(api, identityKey, currentState, body) {
  const next = mergeTourPatch(currentState, body);
  writeMirror(identityKey, next);
  api.patch("/accounts/tours/", body).catch((err) => {
    if (import.meta.env?.DEV) {
      console.warn("[tour] PATCH failed (not re-shown this session):", err);
    }
  });
  return next;
}

export async function setAutoplay(api, enabled) {
  const res = await api.patch("/accounts/tours/", { autoplay_enabled: enabled });
  return res.data;
}

export async function resetTours(api, body) {
  const res = await api.post("/accounts/tours/reset/", body);
  return res.data;
}
