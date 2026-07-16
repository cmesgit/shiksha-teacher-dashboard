/**
 * PLACEMENT: src/pages/skill/ExpertBookings.jsx
 * ACTION:    Replace the entire file.
 *
 * Change from original:
 *   Both Message buttons previously navigated to "/teacher/skill-inbox" —
 *   a route that was never registered, causing a silent 404.
 *
 *   Fixed: both now call openChat(sess) which navigates to "/teacher/chat"
 *   with state { learnerId: s.learner.id }. Chat.jsx at that path already
 *   reads state.learnerId and calls ChatAPI.startDirect("LEARNER", id),
 *   opening the WS DM immediately.
 *
 *   s.learner.id = LearnerProfile UUID (from _session_card() in livekit_views.py)
 *   which is exactly what StartDirectView KIND_LEARNER expects.
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/SkillIcons";
import api from "../../shared/apiClient";
import "../../styles/skillDev.css";

/* ── helpers ── */
function fmtWhen(iso) {
  if (!iso) return "TBC";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
      + " · "
      + d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  } catch { return iso; }
}

function isLive(s) {
  if (!s.scheduled_for) return false;
  const now   = Date.now();
  const start = new Date(s.scheduled_for).getTime();
  const end   = start + (s.duration_mins || 60) * 60 * 1000;
  return now >= start - 5 * 60 * 1000 && now <= end;
}

function groupByDay(sessions) {
  const today    = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const fmt = (d) => d.toDateString();
  const map = {};
  sessions.forEach(s => {
    if (!s.scheduled_for) { (map["Unscheduled"] = map["Unscheduled"] || []).push(s); return; }
    const d   = new Date(s.scheduled_for);
    const key = fmt(d) === fmt(today)    ? `Today · ${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
              : fmt(d) === fmt(tomorrow) ? `Tomorrow · ${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
              : d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
    (map[key] = map[key] || []).push(s);
  });
  return Object.entries(map).map(([day, items]) => ({ day, items }));
}

/* ── Main component ── */
export default function ExpertBookings() {
  const navigate = useNavigate();
  const [sessions,   setSessions]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [acting,     setActing]     = useState({});

  const load = useCallback(() => {
    setLoading(true);
    api.get("/skill/teacher/sessions/")
      .then((sRes) => setSessions(sRes.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const pending   = sessions.filter(s => s.status === "requested");
  const scheduled = sessions.filter(s => s.status === "confirmed");
  const grouped   = groupByDay(scheduled);

  const confirm = async (sess) => {
    setActing(a => ({ ...a, [sess.id]: "confirming" }));
    try {
      await api.post(`/skill/teacher/sessions/${sess.id}/confirm/`);
      setSessions(ss => ss.map(s => s.id === sess.id ? { ...s, status: "confirmed" } : s));
    } catch { /* leave the request as-is on failure */ } finally {
      setActing(a => { const n = { ...a }; delete n[sess.id]; return n; });
    }
  };

  const decline = async (sess) => {
    setActing(a => ({ ...a, [sess.id]: "declining" }));
    try {
      await api.post(`/skill/teacher/sessions/${sess.id}/decline/`);
      setSessions(ss => ss.filter(s => s.id !== sess.id));
    } catch { /* leave the request as-is on failure */ } finally {
      setActing(a => { const n = { ...a }; delete n[sess.id]; return n; });
    }
  };

  const startClass = (sess) => {
    // Enter the skill LiveKit room. The room page (SkillSessionLive) performs
    // POST /skill/sessions/<id>/join/ and mounts LiveKit. Previously this
    // joined here, logged the token to the console, then navigated to the
    // Academy /teacher/private-sessions list — so the room was never entered.
    navigate(`/teacher/skill-session/live/${sess.id}`);
  };

  const complete = async (sess) => {
    try {
      await api.post(`/skill/teacher/sessions/${sess.id}/complete/`);
      setSessions(ss => ss.map(s => s.id === sess.id ? { ...s, status: "completed" } : s));
    } catch { /* keep the session as-is on failure */ }
  };

  // Navigate to /teacher/expert/inbox with this learner pre-selected.
  // SkillInbox reads state.learnerId and opens that DM directly via ChatPanel.
  // s.learner.id = LearnerProfile UUID — what StartDirectView KIND_LEARNER expects.
  const openChat = (sess) => {
    navigate("/teacher/expert/inbox", {
      state: {
        learnerId: sess.learner?.id,
        learnerName: sess.learner?.name,
      },
    });
  };

  return (
    <div className="sk-page">
      <div className="sk-head">
        <div>
          <div className="sk-head__title">Bookings</div>
          <div className="sk-head__sub">1-on-1 live tutoring — requests and your schedule</div>
        </div>
      </div>

      {/* Pending requests */}
      <div className="rd-card teacher">
        <h4 style={{ margin: "0 0 4px" }}>
          Pending requests{pending.length ? ` (${pending.length})` : ""}
        </h4>
        <p style={{ fontSize: 11.5, color: "#6b7c83", margin: "0 0 10px" }}>
          Accepting a request confirms the slot for the learner.
        </p>
        {loading ? (
          <div className="sk-empty">Loading…</div>
        ) : pending.length === 0 ? (
          <div className="sk-empty">No pending requests right now.</div>
        ) : pending.map((s) => {
          const act  = acting[s.id];
          const name = s.learner?.name || "Student";
          return (
            <div key={s.id} className="rd-book">
              <div style={{ width: 46, height: 46, borderRadius: 11, background: "linear-gradient(135deg,#13899b,#0a808a)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 18, flexShrink: 0 }}>
                {name[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1a2c33" }}>{name}</div>
                <div style={{ fontSize: 12, color: "#6b7c83" }}>{s.note || "Session request"}</div>
                <div style={{ fontSize: 11.5, color: "#0a808a", fontWeight: 700, marginTop: 3 }}>
                  {fmtWhen(s.scheduled_for)} · {s.duration_mins || 60} min
                </div>
              </div>
              {/* FIXED: was navigate("/teacher/skill-inbox") — unregistered route */}
              <button
                className="rd-book__icon-btn"
                title="Message"
                onClick={() => openChat(s)}
                disabled={!s.learner?.id}
              >
                <Icon.msg size={15} />
              </button>
              <button className="rd-book__ghost" onClick={() => decline(s)} disabled={!!act}>
                {act === "declining" ? "…" : "Decline"}
              </button>
              <button className="rd-book__accept" onClick={() => confirm(s)} disabled={!!act}>
                {act === "confirming" ? "…" : <><Icon.check size={13} /> Accept</>}
              </button>
            </div>
          );
        })}
      </div>

      {/* Scheduled sessions */}
      <div className="rd-card teacher">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h4 style={{ margin: 0 }}>Scheduled sessions</h4>
          <span style={{ fontSize: 11.5, color: "#6b7c83" }}>{scheduled.length} upcoming</span>
        </div>
        {loading ? (
          <div className="sk-empty" style={{ marginTop: 14 }}>Loading…</div>
        ) : scheduled.length === 0 ? (
          <div className="sk-empty" style={{ marginTop: 14 }}>No scheduled sessions yet.</div>
        ) : grouped.map((g) => (
          <div key={g.day}>
            <div className="rd-daygroup">{g.day}</div>
            {g.items.map((s) => {
              const live = isLive(s);
              const act  = acting[s.id];
              const name = s.learner?.name || "Student";
              const time = s.scheduled_for
                ? new Date(s.scheduled_for).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
                : "TBC";
              return (
                <div key={s.id} className="rd-book">
                  <span className="bt" style={{ background: "#13899b" }}>
                    {time.split(":")[0]}
                    <span style={{ fontSize: 9, opacity: .8 }}>{time.includes("PM") ? "PM" : "AM"}</span>
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1a2c33" }}>{name}</div>
                    <div style={{ fontSize: 12, color: "#6b7c83" }}>{s.note || "1-on-1 session"}</div>
                    <div style={{ fontSize: 11.5, color: "#0a808a", fontWeight: 700, marginTop: 3 }}>
                      {time} · {s.duration_mins || 60} min
                    </div>
                  </div>
                  {/* A confirmed session can be started by the expert at ANY
                      time — they're not locked to a 5-min window. `live` only
                      drives a "Live now" hint + styling. */}
                  <button
                    className="start"
                    onClick={() => startClass(s)}
                    disabled={!!act}
                    style={live ? undefined : { background: "#13899b" }}
                  >
                    {act === "starting"
                      ? "…"
                      : <><Icon.vid size={14} /> {live ? "Start class · Live" : "Start class"}</>}
                  </button>
                  {/* FIXED: was navigate("/teacher/skill-inbox") — unregistered route */}
                  <button
                    className="rd-book__icon-btn"
                    title="Message"
                    onClick={() => openChat(s)}
                    disabled={!s.learner?.id}
                  >
                    <Icon.msg size={15} />
                  </button>
                  <button className="rd-book__ghost" style={{ fontSize: 11 }} onClick={() => complete(s)}>
                    Mark done
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
