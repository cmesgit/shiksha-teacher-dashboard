/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  GENERATED FILE — DO NOT EDIT HERE.                                       │
 * │  Canonical source: <workspace>/shared/src/tour/WelcomeBackBar.jsx         │
 * │  Edit the canonical copy, then run `npm run sync:shared` (any app) to     │
 * │  propagate. `npm run check:shared` fails if an app's copy has drifted.    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * WelcomeBackBar.jsx — §6.3. NOT rendered by TourProvider (unlike TourOverlay
 * /HelpPanel) — spec is explicit this is "inline at the top of the dashboard
 * content column ... never a modal, never an overlay, never fixed-position",
 * so it has to be a real child in the host page's own layout. Each app drops
 * `<WelcomeBackBar registry={...} welcomeKey="..." />` where its dashboard
 * wants it; it renders nothing if the conditions in §6.3 aren't met.
 *
 * `absence_days`/`tours` come from the server (`useTour().state`); the
 * 7-day auto-expire and 45-day reappear-cooldown are NOT modelled anywhere
 * in TourState (§4.1 has no field for them) — tracked client-side only, in
 * the same `localStorage` convention `tourApi.js` already uses for the
 * state mirror. Losing this on a private-mode/cleared-storage browser just
 * means the bar can reappear a bit early, never a bar that's stuck forever.
 */
import { useEffect, useMemo, useState } from "react";
import { useTour } from "./useTour";

const KEY_PREFIX = "shiksha_welcomeback_";
const DAY_MS = 24 * 60 * 60 * 1000;
const REAPPEAR_COOLDOWN_MS = 45 * DAY_MS;
const AUTO_EXPIRE_MS = 7 * DAY_MS;

function readRecord(identityKey) {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + identityKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeRecord(identityKey, record) {
  try {
    localStorage.setItem(KEY_PREFIX + identityKey, JSON.stringify(record));
  } catch {
    // fail open — see file header
  }
}

export default function WelcomeBackBar({ welcomeKey }) {
  const { state, replay } = useTour();
  // A frozen snapshot, not a live clock — react-hooks/purity forbids calling
  // Date.now() during render (React may re-run the render body more than
  // once per commit). A lazy useState initializer is the documented escape
  // hatch: it runs exactly once, so it's fine for it to be impure. Good
  // enough here — nothing about this bar needs to react to the wall clock
  // ticking while the component happens to stay mounted.
  const [mountTime] = useState(() => Date.now());
  // Bumped only from the click handler below (never from the effect) so a
  // dismiss re-renders with the freshly-written localStorage record.
  const [, forceRecompute] = useState(0);

  const identityKey = state?.identity_key;
  const absenceDays = state?.absence_days ?? 0;
  const hasCompletedAny = useMemo(
    () => Object.values(state?.tours || {}).some((t) => t.status === "completed"),
    [state?.tours]
  );

  const eligible = absenceDays >= 45 && hasCompletedAny;
  const record = identityKey ? readRecord(identityKey) : null;
  const suppressedByCooldown = !!(record?.suppressedUntil && mountTime < record.suppressedUntil);
  const expired = !!(record?.firstShownAt && !record?.suppressedUntil && mountTime - record.firstShownAt > AUTO_EXPIRE_MS);

  // Persists the record; visibility itself is derived above from `state` +
  // `record`, not from anything this effect sets — so it never setStates.
  useEffect(() => {
    if (!identityKey || !eligible) return;
    if (!record?.firstShownAt) {
      writeRecord(identityKey, { firstShownAt: mountTime });
    } else if (expired) {
      writeRecord(identityKey, { firstShownAt: record.firstShownAt, suppressedUntil: mountTime + REAPPEAR_COOLDOWN_MS });
    }
  }, [identityKey, eligible, expired, record?.firstShownAt, mountTime]);

  const suppress = () => {
    if (!identityKey) return;
    writeRecord(identityKey, { firstShownAt: mountTime, suppressedUntil: mountTime + REAPPEAR_COOLDOWN_MS });
    forceRecompute((n) => n + 1);
  };

  if (!eligible || suppressedByCooldown || expired) return null;

  const fullRefresher = absenceDays >= 120;

  return (
    <div className="tour-welcomeback" role="status">
      <div className="tour-welcomeback__text">
        {fullRefresher
          ? "Welcome back — it's been a while. Want to run through everything again?"
          : "Welcome back. A few things have changed since your last visit — want a 60-second refresher?"}
      </div>
      <div className="tour-welcomeback__actions">
        <button
          type="button"
          className="tour-welcomeback__show"
          onClick={() => { suppress(); replay(welcomeKey); }}
        >
          Show me
        </button>
        <button type="button" className="tour-welcomeback__dismiss" onClick={suppress}>
          No thanks
        </button>
      </div>
    </div>
  );
}
