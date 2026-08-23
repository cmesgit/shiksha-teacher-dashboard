/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  GENERATED FILE — DO NOT EDIT HERE.                                      │
 * │  Canonical source: <workspace>/shared/src/api/refreshSession.js          │
 * │  Edit the canonical copy, then run `npm run sync:shared` (any app) to    │
 * │  propagate. `npm run check:shared` fails if an app's copy has drifted.   │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * refreshSession() — the ONE refresh single-flight for the whole tab.
 *
 * WHY THIS FILE EXISTS
 * ────────────────────
 * Each app runs several axios instances: `api/apiClient.js` (pages),
 * `shared/apiClient.js` (the chat/live surfaces) and the instance inside
 * `contexts/AuthContext.jsx` — plus AuthContext.bootstrap() and the
 * notification socket's 4401 handler, both of which POST /accounts/refresh/
 * directly. Every one of them used to own a PRIVATE `isRefreshing` flag, so
 * the single-flight only ever covered its own instance.
 *
 * The backend both ROTATES and BLACKLISTS on refresh (config/settings_base.py
 * ROTATE_REFRESH_TOKENS, accounts/views.py RefreshView calls
 * `old_token.blacklist()`). So a cold load of a page that 401s in three places
 * at once sent three refreshes carrying the SAME refresh cookie: the first one
 * won and blacklisted it, and the two losers came back "Token is blacklisted"
 * → `window.location.href = LOGIN_URL`. A perfectly valid 7-day session got
 * thrown away and the user was bounced to login. That is the bug this closes.
 *
 * Everything that needs a refresh must go through refreshSession(). Because
 * this module is a singleton within the bundle, concurrent callers share one
 * request and one outcome — success retries them all, failure rejects them
 * all with the same error.
 *
 * The request deliberately runs on a BARE axios instance with no interceptors:
 * a refresh that flowed through the very interceptor waiting on it would
 * deadlock (or recurse) the moment the refresh itself 401s.
 *
 * KNOWN LIMIT: this is per-TAB. Two tabs of the same app still hold two
 * modules and can still race each other across the rotate-and-blacklist
 * window. Fixing that needs either a BroadcastChannel lock here or a grace
 * period on the server; neither is done yet.
 */
import axios from "axios";
import { API_URL, LOGIN_URL } from "../config/urls";

// No interceptors, ever — see the header note about deadlocking.
const bare = axios.create({ baseURL: API_URL, withCredentials: true });

let inFlight = null;

/**
 * POST /accounts/refresh/, at most once at a time.
 * Resolves with the axios response; rejects with the axios error. Callers
 * that lost the race get the winner's outcome, not a second round-trip.
 */
export function refreshSession() {
  if (inFlight) return inFlight;
  inFlight = bare.post("/accounts/refresh/", {}).finally(() => {
    // Cleared on settle, not on success: a failed refresh must not pin the
    // tab to a permanently-rejected promise. The next 401 after a genuine
    // re-login is entitled to try again.
    inFlight = null;
  });
  return inFlight;
}

const AUTH_PATHS = ["/login", "/signup", "/verify-email", "/forgot-password", "/email-verified"];

/**
 * Send the user to the login page — unless they are already on an auth page.
 *
 * Without the guard, arriving at /login (where the unauthenticated /me/ call
 * naturally 401s) triggers a redirect to /login, which triggers another,
 * forever. This used to live only in AuthContext's interceptor; the two
 * apiClients redirected unconditionally, so whichever of them lost the
 * refresh race is what actually produced the loop.
 */
export function redirectToLogin() {
  const p = window.location.pathname;
  const onAuthPage = AUTH_PATHS.some((a) => p === a || p.startsWith(`${a}/`) || p.startsWith(a));
  if (onAuthPage) return;
  window.location.href = LOGIN_URL;
}

export default refreshSession;
