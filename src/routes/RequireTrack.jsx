/**
 * RequireTrack — route-level gate for the Academy / Skill Dev tracks.
 *
 * Until this existed, track separation in the teacher app was cosmetic:
 * TrackSwitcher correctly refused to *offer* a track you don't hold, but it
 * then navigated with a plain navigate(), and nothing on the receiving end
 * re-checked. Typing a URL (or following a stale link, or a bookmark from a
 * revoked track) walked straight into the other track's ~45 screens.
 *
 * The blast radius was limited because the backend scopes its querysets by
 * ownership, so an unauthorised teacher mostly saw fully-rendered EMPTY
 * screens rather than someone else's data. "Mostly" is not a security model,
 * and an empty gradebook reads as data loss to the person looking at it.
 *
 * Fails CLOSED: a missing `tracks` object is treated as locked, never
 * approved. Mirrors TrackSwitcher's own `?? "locked"` default so the gate and
 * the switcher cannot disagree about who may go where.
 */
import { useAuth } from "../contexts/AuthContext";
import { HOME_URL } from "../config/urls";

const COPY = {
  academy: {
    pending: {
      title: "Your Faculty application is in review",
      body: "Our team is reviewing your Academy (faculty) application. You'll be notified here the moment it's approved.",
      cta: null,
    },
    rejected: {
      title: "Your Faculty application wasn't approved",
      body: "You can update your details and re-apply from the Faculty application page.",
      cta: { label: "Re-apply as Faculty", href: `${HOME_URL}/become-faculty` },
    },
    locked: {
      title: "Academy track not added yet",
      body: "This account doesn't teach on the Academy track. Add it to teach board classes 8–12 here.",
      cta: { label: "Apply for the Faculty track", href: `${HOME_URL}/become-faculty` },
    },
  },
  skill: {
    pending: {
      title: "Your Skill Dev application is in review",
      body: "Our team is reviewing your guest-expert application. You'll be notified here the moment it's approved.",
      cta: null,
    },
    rejected: {
      title: "Your Skill Dev application wasn't approved",
      body: "You can update your details and re-apply from the guest-expert application page.",
      cta: { label: "Re-apply as an expert", href: `${HOME_URL}/expert-apply` },
    },
    locked: {
      title: "Skill Dev track not added yet",
      body: "This account doesn't teach on the Skill Dev track. Add it to offer 1-on-1 skill sessions.",
      cta: { label: "Apply for the Skill Dev track", href: `${HOME_URL}/expert-apply` },
    },
  },
};

function TrackGate({ track, status }) {
  const copy = COPY[track]?.[status] || COPY[track]?.locked;
  const other = track === "academy" ? "Skill Dev" : "Academy";
  const otherHref = track === "academy" ? "/teacher/expert" : "/teacher/dashboard";

  return (
    <div className="dashboard">
      <div
        className="dash-card"
        style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", padding: "32px 28px" }}
      >
        <h3 style={{ marginBottom: 10 }}>{copy.title}</h3>
        <p style={{ color: "#5b6b74", fontSize: 14, lineHeight: 1.55 }}>{copy.body}</p>
        {copy.cta && (
          <a
            href={copy.cta.href}
            className="dash-pill pill-active"
            style={{ display: "inline-block", marginTop: 18, textDecoration: "none", padding: "10px 18px" }}
          >
            {copy.cta.label}
          </a>
        )}
        <div style={{ marginTop: 16 }}>
          <a href={otherHref} style={{ fontSize: 13, color: "#5b6b74" }}>
            Go to your {other} dashboard
          </a>
        </div>
      </div>
    </div>
  );
}

export default function RequireTrack({ track, children }) {
  const { teacherInfo, loading } = useAuth();

  // While /me/ is in flight, render NEITHER the children nor the gate.
  //
  // Returning `children` here (the previous behaviour) avoided flashing the
  // locked card at legitimate teachers, but bought that with a worse
  // problem: on every cold load or deep link the protected screens mounted
  // and fired their API calls before entitlement was known — so an
  // academy-only teacher opening /teacher/expert/bookings briefly rendered
  // the Skill Dev layout and requested its data, then had it swapped for the
  // gate. Returning the gate instead would flash "not added yet" at everyone.
  // A neutral placeholder is the only option that is wrong for nobody.
  if (loading) {
    return (
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          minHeight: "60vh", color: "#6b7c83", fontSize: 14,
        }}
        aria-busy="true"
      >
        Loading…
      </div>
    );
  }

  const status = teacherInfo?.tracks?.[track] ?? "locked";
  if (status === "approved") return children;

  return <TrackGate track={track} status={status} />;
}
