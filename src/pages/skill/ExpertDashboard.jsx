/**
 * src/pages/skill/ExpertDashboard.jsx
 * Wired to GET /skill/teacher/dashboard/
 *
 * Rebuilt to design_handoff_skilldev's Expert Dashboard, verified against
 * the live standalone prototype: stat tiles (Sessions this week / Active
 * students / Hours taught this month / Rating·Rank), a 7-day session bar
 * chart, Today's schedule, Latest reviews.
 *
 * The Advertising card and Recent-activity feed are real, working features
 * the design doesn't show at all — kept per the same "don't delete what
 * works" rule used throughout this redesign, in the right rail.
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../shared/apiClient";
import "../../styles/skillDev.css";
import "../../styles/expertDashboard.css";
import { LoadingState } from "../../components/StateViews";
import { useSkillToast } from "../../components/useSkillToast";
import extractError from "../../shared/extractError";

function fmtTime(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }); }
  catch { return ""; }
}
function fmtDate(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" }); }
  catch { return ""; }
}

/* SkillSession has NINE statuses. Only four can reach an upcoming schedule —
   the rest are terminal — and the design collapses even those into two
   chips, which loses the one that matters most: needs_reconfirmation means
   the EXPERT already proposed a new time and the learner has not answered.
   Showing that as "confirmed" would tell them the opposite of the truth. */
const SESSION_STATUS = {
  requested:            { label: "Awaiting your reply", tone: "warn" },
  confirmed:            { label: "Confirmed",           tone: "ok" },
  needs_reconfirmation: { label: "Waiting on learner",  tone: "info" },
  pending_payment:      { label: "Awaiting payment",    tone: "warn" },
};

function Stars({ n }) {
  const full = Math.round(n || 0);
  return <span className="ed-stars">{"★".repeat(full)}<span className="ed-starsEmpty">{"★".repeat(5 - full)}</span></span>;
}

const EMPTY = {
  stats: {
    taught: 0, total_students: 0, active: 0, pending: 0, avg_rating: null, reviews_count: 0,
    sessions_this_week: 0, sessions_this_week_delta: 0, active_students: 0,
    hours_this_month: 0, rank: null, total_experts: 0,
  },
  week_chart: { labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], counts: [0, 0, 0, 0, 0, 0, 0] },
  accepting_bookings: true,
  today_schedule: [],
  next_up: [],
  recent_reviews: [],
  advertising: { is_advertised: false, is_featured: false, reach_count: 0,
                 billing_free: true, sub_status: "none", sub_active: false, period_end: null },
  profile_todo: { needs_payment: false, needs_location: false },
  activity: [],
};

export default function ExpertDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState({ name: "" });

  const showToast = useSkillToast();
  // Which row is mid-action, so both buttons on it can disable together.
  const [acting, setActing] = useState({});
  const [savingAccepting, setSavingAccepting] = useState(false);

  /* ExpertBookings' equivalent is `try { await fn() } finally {...}` — no
     catch. A failed confirm there leaves the button un-spinning and says
     NOTHING, so the expert cannot tell whether the learner is now booked.
     This one reports, and re-loads rather than guessing the new state:
     confirm can legitimately land in several statuses (pending_payment when
     the listing is paid, confirmed when it is free), so an optimistic
     `status: "confirmed"` would be a guess that is sometimes wrong. */
  const act = async (id, key, fn, okMsg) => {
    setActing((a) => ({ ...a, [id]: key }));
    try {
      await fn();
      showToast(okMsg);
      load();
    } catch (err) {
      /* extractError, not err.response.data.detail — these endpoints raise
         DRF ValidationError, whose body is a bare ARRAY
         (["Session is not in 'requested' state."]), so a `.detail` lookup
         finds nothing and throws away a perfectly good server message. The
         shared helper handles that shape, and refuses HTML error documents,
         which is how a Django 500 page once reached a user as a banner. */
      showToast(extractError(err));
    } finally {
      setActing((a) => { const n = { ...a }; delete n[id]; return n; });
    }
  };

  const acceptSession = (b) => act(b.id, "accept",
    () => api.post(`/skill/teacher/sessions/${b.id}/confirm/`), "Session confirmed.");

  const declineSession = (b) => act(b.id, "decline",
    () => api.post(`/skill/teacher/sessions/${b.id}/decline/`), "Request declined.");

  /* Optimistic, and reverted on failure. This one IS safe to be optimistic
     about, unlike confirm/decline: the server echoes exactly the boolean we
     sent, so there is no second state it can legitimately land in. */
  const toggleAccepting = async () => {
    const next = !acceptingBookings;
    setSavingAccepting(true);
    setData((d) => ({ ...d, accepting_bookings: next }));
    try {
      await api.patch("/skill/teacher/profile/", { accepting_bookings: next });
      showToast(next
        ? "You're taking new bookings again."
        : "New booking requests are paused. Confirmed sessions are unaffected.");
    } catch (err) {
      setData((d) => ({ ...d, accepting_bookings: !next }));
      showToast(extractError(err));
    } finally {
      setSavingAccepting(false);
    }
  };

  const load = () => {
    setError("");
    api.get("/skill/teacher/dashboard/")
      .then(r => setData({ ...EMPTY, ...r.data, stats: { ...EMPTY.stats, ...(r.data.stats || {}) } }))
      .catch(() => setError("Couldn't load your dashboard."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api.get("/accounts/me/").then(r => {
      const me = r.data;
      const name = me?.active_profile?.display_name || me?.active_profile?.first_name || me?.username || "there";
      setProfile({ name });
    }).catch(() => {});
  }, []);

  const { stats, week_chart, today_schedule, recent_reviews, advertising, profile_todo, activity } = data;
  // Default TRUE so a slow load shows the normal state rather than flashing
  // "Not taking new bookings" at an expert who is.
  const acceptingBookings = data.accepting_bookings !== false;
  const greetHour = new Date().getHours();
  const greeting = greetHour < 12 ? "Good morning" : greetHour < 17 ? "Good afternoon" : "Good evening";

  const tiles = [
    { value: stats.sessions_this_week, delta: stats.sessions_this_week_delta, label: "Sessions this week" },
    { value: stats.active_students, label: "Active students" },
    { value: `${stats.hours_this_month}h`, label: "Hours taught this month" },
    {
      value: stats.avg_rating != null ? Number(stats.avg_rating).toFixed(1) : "—",
      label: stats.rank ? `Rating · Rank #${stats.rank}` : "Rating",
      sub: stats.reviews_count ? `${stats.reviews_count} reviews` : null,
    },
  ];

  const maxCount = Math.max(1, ...week_chart.counts);
  const todos = buildTodos(profile_todo);
  const adv = advertised(advertising);

  return (
    <div className="sk-page">
      <div className="ed-head">
        <div>
          <h1 className="ed-greet">{loading ? "Loading…" : `${greeting}, ${profile.name}`}</h1>
        </div>
        {/* Was a hardcoded <span> reading "Accepting bookings" for every
            expert, always — true or not, and impossible to turn off. It is
            now the real `accepting_bookings` field, and pausing is ENFORCED:
            SessionRequestView 409s a new request while it is off. */}
        <button
          type="button"
          className={`ed-badge ed-badge--toggle${acceptingBookings ? "" : " ed-badge--paused"}`}
          onClick={toggleAccepting}
          disabled={savingAccepting}
          aria-pressed={acceptingBookings}
          title={acceptingBookings
            ? "You're taking new requests. Click to pause."
            : "New requests are paused. Your confirmed sessions are unaffected."}
        >
          {savingAccepting
            ? "Saving…"
            : acceptingBookings ? "Accepting bookings" : "Not taking new bookings"}
        </button>
      </div>

      {error && !loading && (
        <div className="rd-card teacher" style={{ borderLeft: "3px solid #c0492f", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontSize: 13, color: "#6b7c83" }}>{error}</span>
          <button className="sk-btn sk-btn--ghost" onClick={() => { setLoading(true); load(); }}>Retry</button>
        </div>
      )}

      {!loading && todos.length > 0 && (
        <div className="rd-card teacher" style={{ borderLeft: "3px solid #ff8f01" }}>
          <h4 style={{ margin: "0 0 8px" }}>Finish setting up</h4>
          {todos.map((t) => (
            <div key={t.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "6px 0" }}>
              <div style={{ fontSize: 13, color: "#6b7c83" }}>{t.text}</div>
              <button className="sk-btn sk-btn--ghost" onClick={() => navigate(t.to)} style={{ flexShrink: 0 }}>{t.cta}</button>
            </div>
          ))}
        </div>
      )}

      <div className="ed-statGrid">
        {tiles.map((t) => (
          <div className="ed-statTile" key={t.label}>
            <div className="ed-statValue">
              {loading ? "—" : t.value}
              {!loading && t.delta != null && t.delta !== 0 && (
                <span className={`ed-delta ${t.delta > 0 ? "is-up" : "is-down"}`}>{t.delta > 0 ? "▲" : "▼"} {Math.abs(t.delta)}</span>
              )}
            </div>
            <div className="ed-statLabel">{t.label}</div>
            {t.sub && <div className="ed-statSub">{t.sub}</div>}
          </div>
        ))}
      </div>

      <div className="ed-twoCol">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="rd-card teacher">
            <h4>Sessions this week</h4>
            <div className="ed-chart">
              {week_chart.labels.map((label, i) => (
                <div className="ed-chartCol" key={label}>
                  <div className="ed-chartCount">{week_chart.counts[i]}</div>
                  <div className="ed-chartBarTrack">
                    <div className="ed-chartBar" style={{ height: `${(week_chart.counts[i] / maxCount) * 100}%` }} />
                  </div>
                  <div className="ed-chartLabel">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rd-card teacher">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <h4 style={{ margin: 0 }}>Today&apos;s schedule</h4>
              <button className="ed-link" onClick={() => navigate("/teacher/expert/bookings")}>All bookings →</button>
            </div>
            {loading ? (
              <LoadingState plain label="Loading sessions" />
            ) : today_schedule.length === 0 ? (
              <div className="sk-empty">No sessions scheduled for today.</div>
            ) : today_schedule.map((b) => (
              <div className="ed-scheduleRow" key={b.id}>
                <div className="ed-scheduleTime">{fmtTime(b.scheduled_for)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ed-scheduleTopic">{b.topic}</div>
                  <div className="ed-scheduleWith">
                    with {b.name}
                    {SESSION_STATUS[b.status] && (
                      <span className={`ed-sessChip ed-sessChip--${SESSION_STATUS[b.status].tone}`}>
                        {SESSION_STATUS[b.status].label}
                      </span>
                    )}
                  </div>
                </div>
                {/* Accept/Decline live HERE, on the row, because this is where
                    the expert sees the request. Previously the only place to
                    answer was the separate Bookings screen. */}
                {b.status === "requested" ? (
                  <div className="ed-sessActions">
                    <button
                      className="ed-startBtn"
                      disabled={!!acting[b.id]}
                      onClick={() => acceptSession(b)}
                    >
                      {acting[b.id] === "accept" ? "Accepting…" : "Accept"}
                    </button>
                    <button
                      className="ed-declineBtn"
                      disabled={!!acting[b.id]}
                      onClick={() => declineSession(b)}
                    >
                      {acting[b.id] === "decline" ? "Declining…" : "Decline"}
                    </button>
                  </div>
                ) : b.live ? (
                  <button className="ed-startBtn" onClick={() => navigate(`/teacher/skill-session/live/${b.id}`)}>Start</button>
                ) : null}
              </div>
            ))}
          </div>

          <div className="rd-card teacher">
            <h4>Latest reviews</h4>
            {loading ? (
              <LoadingState plain label="Loading reviews" />
            ) : recent_reviews.length === 0 ? (
              <div className="sk-empty">No reviews yet — they&apos;ll appear here after your first completed sessions.</div>
            ) : recent_reviews.map((r) => (
              <div key={r.id} className="ed-reviewRow">
                <div className="ed-reviewAvatar">
                  {(r.reviewer || "?").trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span className="ed-reviewName">{r.reviewer}</span>
                    <span className="ed-reviewDate">{fmtDate(r.created_at)}</span>
                  </div>
                  <Stars n={r.rating} />
                  {r.body && <div className="ed-reviewBody">{r.body}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="rd-card teacher">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h4 style={{ margin: 0 }}>Advertising</h4>
              <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 100, background: adv.bg, color: adv.fg }}>{adv.label}</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 12 }}>
              <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: 30, color: "#1a2c33", letterSpacing: "-.7px" }}>
                {loading ? "—" : (advertising.reach_count ?? 0).toLocaleString("en-IN")}
              </span>
              <span style={{ fontSize: 12, color: "#6b7c83", fontWeight: 700 }}>reach</span>
            </div>
            <div style={{ fontSize: 12, color: "#6b7c83", marginTop: 2, lineHeight: 1.5 }}>{adv.blurb}</div>
            <button className="sk-btn sk-btn--primary" onClick={() => navigate("/teacher/expert/promote")} style={{ width: "100%", marginTop: 12, justifyContent: "center" }}>
              {advertising.sub_active ? "Manage subscription" : "Promote my profile"}
            </button>
          </div>

          <div className="rd-card teacher">
            <h4>Recent activity</h4>
            {activity.length === 0 ? (
              <div className="sk-empty">No recent activity.</div>
            ) : activity.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9, marginBottom: 11 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: a.color, marginTop: 5, flexShrink: 0 }} />
                <div style={{ fontSize: 12, color: "#6b7c83", lineHeight: 1.5 }}>{a.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function advertised(a = {}) {
  if (a.is_advertised && a.billing_free) {
    return { label: "Live · free", bg: "#2f9d4222", fg: "#2f9d42", blurb: "You're advertised free during the launch period." };
  }
  if (a.is_advertised) {
    return { label: "Live", bg: "#2f9d4222", fg: "#2f9d42", blurb: "Your profile is promoted across ShikshaCom." };
  }
  if (a.sub_status === "submitted") {
    return { label: "Pending", bg: "#ff8f0122", fg: "#b46a00", blurb: "Payment submitted — we're verifying your subscription." };
  }
  return { label: "Not promoted", bg: "#9aa9af22", fg: "#6b7c83", blurb: "Subscribe to be advertised consistently and grow your reach." };
}

function buildTodos(p = {}) {
  const out = [];
  if (p.needs_location) {
    out.push({ key: "loc", to: "/teacher/expert/profile", cta: "Add location", text: "Add your class location so nearby learners can find you for offline lessons." });
  }
  return out;
}
