// OfflineBanner — design_handoff_dashboards_v2, "Dashboard Home.dc.html" :83.
//
// PARALLEL COPY across the two dashboard apps; shared/sync.mjs does not cover
// screen components. Change one, change the other.
//
// ⚠ The design's string is "You're offline. Showing what was saved at 8:52 AM.
// Joining a class needs a connection." That middle sentence is a CLAIM about
// cached data, and it is only true if a successful load actually happened —
// these dashboards fetch fresh and keep nothing on disk. So the time is the
// caller's real `lastLoadedAt`, and when there isn't one the sentence is
// replaced rather than printed with a blank or a fabricated time. Telling
// someone they are looking at 8:52's data when the screen is empty is worse
// than saying nothing.
//
// Driven by navigator.onLine plus the online/offline events. That flag is
// honest about "no network interface" and NOT about "the server is
// unreachable" — a captive portal or a dead backend both read as online. It
// is therefore a hint, not a diagnosis, which is why the banner never claims
// the data is stale, only that the connection is.

import { useEffect, useState } from "react";
import { FiWifiOff } from "react-icons/fi";

export function useIsOffline() {
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" && navigator.onLine === false
  );
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return offline;
}

export default function OfflineBanner({ lastLoadedAt, onRetry, retrying }) {
  const offline = useIsOffline();
  if (!offline) return null;

  const saved = lastLoadedAt
    ? ` Showing what was saved at ${new Date(lastLoadedAt).toLocaleTimeString(
        "en-GB", { hour: "numeric", minute: "2-digit", hour12: true })}.`
    : "";

  return (
    <div className="dv2-offline" role="status">
      <FiWifiOff size={18} aria-hidden="true" />
      <span style={{ flex: 1, minWidth: 0 }}>
        You&rsquo;re offline.{saved} Joining a class needs a connection.
      </span>
      {onRetry && (
        <button
          type="button"
          className="dv2-offlineRetry"
          onClick={onRetry}
          disabled={retrying}
        >
          {retrying ? "Retrying…" : "Retry"}
        </button>
      )}
    </div>
  );
}
