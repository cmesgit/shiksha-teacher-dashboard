/**
 * src/pages/skill/ExpertBookings.jsx — rebuilt to design_handoff_skilldev's
 * Expert "2. Bookings" (verified against the live standalone prototype):
 * Requests/Upcoming/Past tabs, a 24h-SLA amber notice + per-request expiry
 * chip (danger tint at ≤6h), Accept/Decline/Propose new time, and a
 * Report-no-show + per-student note flow on Past.
 *
 * GET  /skill/teacher/sessions/                          → this expert's sessions
 * POST /skill/teacher/sessions/<id>/confirm/ | /decline/
 * POST /skill/teacher/sessions/<id>/reschedule/           → propose new time
 * POST /skill/teacher/sessions/<id>/report-no-show/
 * PUT  /skill/teacher/sessions/<id>/note/
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/SkillIcons";
import api from "../../shared/apiClient";
import SkillModal from "../../components/SkillModal";
import ConfirmDialog from "../../components/ConfirmDialog";
import { useSkillToast } from "../../components/useSkillToast";
import "../../styles/skillDev.css";
import "../../styles/expertBookings.css";
import { LoadingState } from "../../components/StateViews";
import { DAYS, SLOTS, label as slotLabel } from "../../api/availabilityStore";

function fmtRupees(paise) {
  return `₹${Math.round((paise || 0) / 100)}`;
}

function fmtWhen(iso) {
  if (!iso) return "TBC";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
      + " · " + d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  } catch { return iso; }
}

function hoursLeft(createdAt) {
  if (!createdAt) return null;
  const elapsedMs = Date.now() - new Date(createdAt).getTime();
  return Math.max(0, Math.ceil(24 - elapsedMs / 3600000));
}

export default function ExpertBookings() {
  const navigate = useNavigate();
  const showToast = useSkillToast();
  const [tab, setTab] = useState("requests");
  const [sessions, setSessions] = useState([]);
  const [avail, setAvail] = useState({ open: [], booked: [] });
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState({});
  const [proposeFor, setProposeFor] = useState(null);
  const [noShowFor, setNoShowFor] = useState(null);
  const [noteFor, setNoteFor] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get("/skill/teacher/sessions/"),
      api.get("/skill/teacher/availability/"),
    ])
      .then(([sRes, aRes]) => {
        setSessions(sRes.data || []);
        setAvail({ open: aRes.data.open || [], booked: aRes.data.booked || [] });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const requests = sessions.filter((s) => s.status === "requested");
  const upcoming = sessions.filter((s) => s.status === "confirmed" || s.status === "needs_reconfirmation");
  const past = sessions.filter((s) => s.status === "completed");

  const openChat = (sess) => navigate("/teacher/expert/inbox", {
    state: { learnerId: sess.learner?.id, learnerName: sess.learner?.name },
  });

  const act = async (id, key, fn) => {
    setActing((a) => ({ ...a, [id]: key }));
    try { await fn(); } finally { setActing((a) => { const n = { ...a }; delete n[id]; return n; }); }
  };

  const accept = (s) => act(s.id, "accepting", async () => {
    await api.post(`/skill/teacher/sessions/${s.id}/confirm/`);
    setSessions((ss) => ss.map((x) => (x.id === s.id ? { ...x, status: "confirmed" } : x)));
    showToast("Session confirmed.");
  });

  const decline = (s) => act(s.id, "declining", async () => {
    await api.post(`/skill/teacher/sessions/${s.id}/decline/`);
    setSessions((ss) => ss.filter((x) => x.id !== s.id));
    showToast("Request declined.");
  });

  const startClass = (s) => navigate(`/teacher/skill-session/live/${s.id}`);

  const markPaid = (s) => act(s.id, "marking-paid", async () => {
    const res = await api.post(`/skill/teacher/sessions/${s.id}/mark-paid/`);
    setSessions((ss) => ss.map((x) => (x.id === s.id
      ? { ...x, payment_status: res.data.payment_status, paid_at: res.data.paid_at }
      : x)));
    showToast("Marked as paid.");
  });

  const reportNoShow = async () => {
    if (!noShowFor) return;
    await api.post(`/skill/teacher/sessions/${noShowFor.id}/report-no-show/`);
    setSessions((ss) => ss.map((x) => (x.id === noShowFor.id ? { ...x, no_show: true } : x)));
    showToast("No-show reported. Session forfeited, you're paid in full.");
    setNoShowFor(null);
  };

  return (
    <div className="sk-page">
      <div className="sk-head">
        <div>
          <div className="sk-head__title">Bookings</div>
        </div>
      </div>

      <div className="eb-seg">
        <button className={`eb-seg__btn ${tab === "requests" ? "is-active" : ""}`} onClick={() => setTab("requests")}>
          Requests{requests.length > 0 && <span className="eb-seg__count">{requests.length}</span>}
        </button>
        <button className={`eb-seg__btn ${tab === "upcoming" ? "is-active" : ""}`} onClick={() => setTab("upcoming")}>Upcoming</button>
        <button className={`eb-seg__btn ${tab === "past" ? "is-active" : ""}`} onClick={() => setTab("past")}>Past</button>
      </div>

      {loading ? (
        <LoadingState label="Loading" />
      ) : tab === "requests" ? (
        <>
          {requests.length > 0 && (
            <div className="eb-notice">
              Requests auto-decline after 24 hours and the student is refunded — responding quickly protects your ranking.
            </div>
          )}
          {requests.length === 0 ? (
            <div className="sk-empty">No pending requests right now.</div>
          ) : requests.map((s) => {
            const left = hoursLeft(s.created_at);
            const name = s.learner?.name || "Student";
            const busy = acting[s.id];
            return (
              <div key={s.id} className="eb-row">
                <div className="eb-avatar">{name[0]}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="eb-topic">{s.note || "Session request"}</div>
                  <div className="eb-meta">{name} · {fmtWhen(s.scheduled_for)}</div>
                </div>
                <span className="eb-tag eb-tag--pending">Pending</span>
                {left != null && (
                  <span className={`eb-expiry ${left <= 6 ? "is-danger" : ""}`}>{left}h left to respond</span>
                )}
                <div className="eb-actions">
                  <button className="eb-btn eb-btn--outline" disabled={!!busy} onClick={() => decline(s)}>Decline</button>
                  <button className="eb-btn eb-btn--primary" disabled={!!busy} onClick={() => accept(s)}>Accept</button>
                  <button className="eb-btn eb-btn--outline" disabled={!!busy} onClick={() => setProposeFor(s)}>Propose new time</button>
                  <button className="eb-iconBtn" title="Message" disabled={!s.learner?.id} onClick={() => openChat(s)}><Icon.msg size={14} /></button>
                  <button className="eb-link" onClick={() => setNoteFor(s)}>{s.teacher_note ? "● Notes" : "+ Note"}</button>
                </div>
              </div>
            );
          })}
        </>
      ) : tab === "upcoming" ? (
        upcoming.length === 0 ? (
          <div className="sk-empty">No upcoming sessions.</div>
        ) : upcoming.map((s) => {
          const name = s.learner?.name || "Student";
          const awaiting = s.status === "needs_reconfirmation";
          const isPaid = s.payment_status === "paid";
          const busy = acting[s.id];
          return (
            <div key={s.id} className="eb-row">
              <div className="eb-avatar">{name[0]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="eb-topic">{s.note || "1-on-1 session"}</div>
                <div className="eb-meta">{name} · {fmtWhen(s.scheduled_for)} · {fmtRupees(s.amount)}, direct to you</div>
                {awaiting && <div className="eb-awaitingNote">Awaiting student confirmation</div>}
              </div>
              {!awaiting && <span className="eb-tag eb-tag--confirmed">Confirmed</span>}
              <span className={`eb-tag ${isPaid ? "eb-tag--completed" : "eb-tag--pending"}`}>
                {isPaid ? "Paid" : "Payment pending"}
              </span>
              <div className="eb-actions">
                {!awaiting && <button className="eb-btn eb-btn--primary" onClick={() => startClass(s)}><Icon.vid size={13} /> Start session</button>}
                {!awaiting && <button className="eb-btn eb-btn--outline" onClick={() => setProposeFor(s)}>Reschedule</button>}
                {!isPaid && (
                  <button className="eb-btn eb-btn--outline" disabled={!!busy} onClick={() => markPaid(s)}>
                    {busy === "marking-paid" ? "Marking…" : "Mark as paid"}
                  </button>
                )}
                <button className="eb-iconBtn" title="Message" disabled={!s.learner?.id} onClick={() => openChat(s)}><Icon.msg size={14} /></button>
                <button className="eb-link" onClick={() => setNoteFor(s)}>{s.teacher_note ? "● Notes" : "+ Note"}</button>
              </div>
            </div>
          );
        })
      ) : (
        past.length === 0 ? (
          <div className="sk-empty">No completed sessions yet.</div>
        ) : past.map((s) => {
          const name = s.learner?.name || "Student";
          const isPaid = s.payment_status === "paid";
          const busy = acting[s.id];
          return (
            <div key={s.id} className="eb-row">
              <div className="eb-avatar">{name[0]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="eb-topic">{s.note || "1-on-1 session"}</div>
                <div className="eb-meta">{name} · {fmtWhen(s.scheduled_for)} · {fmtRupees(s.amount)}, direct to you</div>
                {s.no_show && <div className="eb-noShowTag">No-show reported</div>}
              </div>
              <span className="eb-tag eb-tag--completed">Completed</span>
              <span className={`eb-tag ${isPaid ? "eb-tag--completed" : "eb-tag--pending"}`}>
                {isPaid ? "Paid" : "Payment pending"}
              </span>
              <div className="eb-actions">
                {!isPaid && (
                  <button className="eb-btn eb-btn--outline" disabled={!!busy} onClick={() => markPaid(s)}>
                    {busy === "marking-paid" ? "Marking…" : "Mark as paid"}
                  </button>
                )}
                {!s.no_show && <button className="eb-btn eb-btn--outline" onClick={() => setNoShowFor(s)}>Report no-show</button>}
                <button className="eb-link" onClick={() => setNoteFor(s)}>{s.teacher_note ? "● Notes" : "+ Note"}</button>
              </div>
            </div>
          );
        })
      )}

      <ProposeModal
        key={proposeFor?.id}
        session={proposeFor}
        avail={avail}
        onClose={() => setProposeFor(null)}
        onProposed={() => { setProposeFor(null); load(); showToast("New time proposed to the student."); }}
      />

      <NoteModal key={noteFor?.id} session={noteFor} onClose={() => setNoteFor(null)} onSaved={(note) => {
        setSessions((ss) => ss.map((x) => (x.id === noteFor.id ? { ...x, teacher_note: note } : x)));
        setNoteFor(null);
      }} />

      <ConfirmDialog
        dialog={noShowFor ? {
          title: "Report no-show?",
          message: `This forfeits the session — you're paid in full and the slot is released. This can't be undone.`,
          confirmLabel: "Report no-show",
          danger: true,
          tone: "skill",
          onConfirm: reportNoShow,
        } : null}
        onClose={() => setNoShowFor(null)}
      />
    </div>
  );
}

function ProposeModal({ session, avail, onClose, onProposed }) {
  // Keyed on session.id so switching to a different session's modal starts
  // fresh, without a setState-in-effect reset (React resets local state for
  // a changed key automatically — see the <ProposeModal key=...> below).
  const [slot, setSlot] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (!session) return null;
  const openSlots = avail.open.filter((k) => !avail.booked.includes(k));

  const submit = async () => {
    if (!slot || busy) return;
    setBusy(true);
    try {
      await api.post(`/skill/teacher/sessions/${session.id}/reschedule/`, { slot_key: slot, reason });
      onProposed();
    } catch { setBusy(false); }
  };

  return (
    <SkillModal open onClose={onClose} title="Propose a new time">
      <p className="eb-modalSub">
        &ldquo;{session.note || "This session"}&rdquo; with {session.learner?.name} — the class is only officially
        booked once the student accepts your new time.
      </p>
      <div className="eb-modalLabel">Current</div>
      <div className="eb-modalCurrent">{fmtWhen(session.scheduled_for)}</div>
      <div className="eb-modalLabel">Pick from your open slots</div>
      <div className="eb-slotGrid">
        {openSlots.length === 0 ? (
          <div className="eb-modalSub">No open slots available.</div>
        ) : openSlots.map((k) => (
          <span key={k} className={`eb-slotPill ${slot === k ? "is-selected" : ""}`} onClick={() => setSlot(k)}>
            {slotLabel(k)}
          </span>
        ))}
      </div>
      <textarea
        className="eb-textarea"
        placeholder="Message to the student (optional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
      />
      <div className="eb-modalActions">
        <button className="eb-btn eb-btn--outline" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="eb-btn eb-btn--primary" onClick={submit} disabled={!slot || busy}>
          {busy ? "Sending…" : !slot ? "Pick a slot first" : "Propose new time"}
        </button>
      </div>
    </SkillModal>
  );
}

function NoteModal({ session, onClose, onSaved }) {
  // Keyed on session.id at the call site — see ProposeModal's comment.
  const [note, setNote] = useState(session?.teacher_note || "");
  const [saving, setSaving] = useState(false);

  if (!session) return null;

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/skill/teacher/sessions/${session.id}/note/`, { note });
      onSaved(note);
    } finally { setSaving(false); }
  };

  return (
    <SkillModal open onClose={onClose} title={`Note about ${session.learner?.name || "this student"}`}>
      <textarea
        className="eb-textarea"
        placeholder="Private note — never shown to the student…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={5}
        autoFocus
      />
      <div className="eb-modalActions">
        <button className="eb-btn eb-btn--outline" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="eb-btn eb-btn--primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save note"}</button>
      </div>
    </SkillModal>
  );
}
