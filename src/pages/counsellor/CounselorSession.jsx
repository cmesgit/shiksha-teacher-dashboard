// PLACEMENT: src/pages/counsellor/CounselorSession.jsx   (NEW FILE — teacher dashboard app)
//
// The session workroom — everything for one appointment on one screen:
//
//   LEFT  — the student file: learner context (class/stream/board),
//           career profile (intake), and the submitted assessment
//           (drafts stay hidden until the student submits — the badge
//           says so), plus private session notes (add + list).
//   RIGHT — session controls: meeting link (notifies the student when
//           set), mark completed / no-show, cancel; and the REPORT
//           EDITOR: summary / recommendations / next steps, save draft
//           (invisible to the student) or publish (bell + email; can't
//           be unpublished — edits after publish stay live).

import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ConfirmDialog from "../../components/ConfirmDialog";
import {
  addNote, cancelAppointment, completeAppointment, getNotes, getReport,
  getStudentFile, saveReport, setMeetingLink,
} from "../../api/counselorService";
import "../../styles/counsellor.css";

const fmtWhen = (iso) =>
  new Date(iso).toLocaleString("en-IN", {
    weekday: "long", day: "numeric", month: "long",
    hour: "numeric", minute: "2-digit", hour12: true,
  });

export default function CounselorSession() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [notes, setNotes] = useState(null);
  const [report, setReport] = useState({ summary: "", recommendations: "", next_steps: "", is_published: false });
  const [noteDraft, setNoteDraft] = useState("");
  const [link, setLink] = useState("");
  const [msg, setMsg] = useState(null);       // {ok|error, text}
  const [busy, setBusy] = useState("");
  const [dlg, setDlg] = useState(null);

  const load = () => {
    getStudentFile(id).then((d) => {
      setFile(d);
      setLink(d.appointment?.meeting_link || "");
    }).catch((e) => setMsg({ error: true, text: e?.response?.status === 404 ? "Appointment not found." : "Couldn't load this session." }));
    getNotes(id).then(setNotes).catch(() => setNotes([]));
    getReport(id).then((r) => setReport(r)).catch(() => {});
  };
  useEffect(load, [id]);

  const appt = file?.appointment;
  const flash = (ok, text) => { setMsg({ ok, text }); setTimeout(() => setMsg(null), 3500); };

  const saveLink = async () => {
    setBusy("link");
    try {
      await setMeetingLink(id, link.trim());
      flash(true, link.trim() ? "Meeting link saved — the student was notified." : "Meeting link cleared.");
    } catch { flash(false, "Couldn't save the link."); }
    setBusy("");
  };

  const doComplete = (noShow) => setDlg({
    title: noShow ? "Mark as no-show?" : "Mark session completed?",
    message: noShow
      ? "Use this when the student didn't attend."
      : "You can write and publish the report right after.",
    confirmLabel: noShow ? "Mark no-show" : "Mark completed",
    danger: noShow,
    onConfirm: async () => {
      setDlg(null);
      try { await completeAppointment(id, noShow); load(); }
      catch { flash(false, "Couldn't update the session."); }
    },
  });

  const doCancel = () => setDlg({
    title: "Cancel this session?",
    message: `${file?.learner?.display_name || "The student"} will be notified by bell and email.`,
    confirmLabel: "Yes, cancel session",
    danger: true,
    onConfirm: async () => {
      setDlg(null);
      try { await cancelAppointment(id); load(); }
      catch { flash(false, "Couldn't cancel."); }
    },
  });

  const submitNote = async () => {
    if (!noteDraft.trim()) return;
    setBusy("note");
    try {
      const n = await addNote(id, noteDraft.trim());
      setNotes((xs) => [n, ...(xs || [])]);
      setNoteDraft("");
    } catch { flash(false, "Couldn't save the note."); }
    setBusy("");
  };

  const persistReport = async (publish) => {
    if (publish && !report.summary?.trim() && !report.recommendations?.trim()) {
      return flash(false, "Write a summary or recommendations before publishing.");
    }
    const go = async () => {
      setDlg(null);
      setBusy(publish ? "publish" : "draft");
      try {
        const saved = await saveReport(id, {
          summary: report.summary || "",
          recommendations: report.recommendations || "",
          next_steps: report.next_steps || "",
        }, publish);
        setReport(saved);
        flash(true, publish ? "Report published — the student was notified by bell and email." : "Draft saved (only you can see it).");
        if (publish) load();
      } catch { flash(false, "Couldn't save the report."); }
      setBusy("");
    };
    if (publish) {
      setDlg({
        title: "Publish this report?",
        message: "The student gets a notification and an email, and the report appears in their dashboard. Publishing can't be undone — later edits go live immediately.",
        confirmLabel: "Publish report",
        onConfirm: go,
      });
    } else go();
  };

  if (!file && !msg) return <div className="co-skel" style={{ height: 300 }} />;
  if (!file) return <div className="co-error">{msg?.text}</div>;

  const intake = file.intake;
  const assessment = file.assessment;
  const setR = (k) => (e) => setReport((r) => ({ ...r, [k]: e.target.value }));

  return (
    <div className="co-page">
      <div className="co-head">
        <div>
          <button className="co-btn co-btn--outline co-btn--sm" onClick={() => navigate("/teacher/counsellor")} style={{ marginBottom: 8 }}>
            ← Schedule
          </button>
          <h1 className="co-title">{file.learner?.display_name}</h1>
          <p className="co-sub">{fmtWhen(appt.scheduled_at)} · {appt.duration_minutes} min · {appt.status}</p>
        </div>
      </div>

      {msg && <div className={msg.ok ? "co-ok" : "co-error"}>{msg.text}</div>}

      <div className="co-grid">
        {/* ── LEFT: student file ── */}
        <div>
          <div className="co-card" style={{ marginBottom: 14 }}>
            <h3 className="co-sec-title">Student file</h3>
            <div className="co-kv">
              {file.learner?.current_class && (<><b>Class</b><span>{file.learner.current_class}</span></>)}
              {file.learner?.stream && (<><b>Stream</b><span>{file.learner.stream}</span></>)}
              {file.learner?.board && (<><b>Board</b><span>{file.learner.board.toUpperCase()}</span></>)}
              {file.learner?.school_name && (<><b>School</b><span>{file.learner.school_name}</span></>)}
            </div>
            {appt.student_note && (
              <>
                <div className="co-sublabel">Booking note</div>
                <p style={{ font: "italic 12.5px/1.6 inherit", color: "#334155", margin: 0 }}>"{appt.student_note}"</p>
              </>
            )}

            <div className="co-sublabel">Career profile</div>
            {!intake ? (
              <p className="co-sub">The student hasn't completed the career profile yet.</p>
            ) : (
              <>
                {intake.career_interests?.length > 0 && (
                  <div className="co-answer">
                    <b>Interests</b>
                    <div>{intake.career_interests.map((s) => (
                      <span key={s.id} className="co-chip co-chip--slate">{s.name}</span>
                    ))}</div>
                  </div>
                )}
                {intake.skills && <div className="co-answer"><b>Skills</b><p>{intake.skills}</p></div>}
                {intake.long_term_goals && <div className="co-answer"><b>Long-term goal</b><p>{intake.long_term_goals}</p></div>}
                {intake.short_term_goals && <div className="co-answer"><b>Short-term goal</b><p>{intake.short_term_goals}</p></div>}
                {intake.preferred_industry && <div className="co-answer"><b>Preferred industry</b><p>{intake.preferred_industry}</p></div>}
                {intake.work_environment && <div className="co-answer"><b>Work environment</b><p>{intake.work_environment}</p></div>}
                {intake.languages && <div className="co-answer"><b>Languages</b><p>{intake.languages}</p></div>}
              </>
            )}

            <div className="co-sublabel">Pre-session assessment</div>
            {assessment ? (
              (assessment.sections || []).map((sec) => (
                <div key={sec.key} style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: "#425f7f", margin: "8px 0 5px" }}>{sec.title}</div>
                  {(sec.questions || []).map((qn) => {
                    const v = assessment.answers?.[qn.key];
                    if (v == null || v === "" || (Array.isArray(v) && !v.length)) return null;
                    return (
                      <div key={qn.key} className="co-answer">
                        <b>{qn.label}</b>
                        {Array.isArray(v)
                          ? <div>{v.map((x) => <span key={x} className="co-chip co-chip--slate">{x}</span>)}</div>
                          : <p>{String(v)}</p>}
                      </div>
                    );
                  })}
                </div>
              ))
            ) : (
              <p className="co-sub">
                {file.assessment_status === "draft"
                  ? "The student started the assessment but hasn't submitted it — answers stay private until they do."
                  : "Not filled in (it's optional)."}
              </p>
            )}
          </div>

          {/* notes */}
          <div className="co-card">
            <h3 className="co-sec-title">Session notes <span className="co-chip co-chip--grey">private to you</span></h3>
            <div className="co-field">
              <textarea className="co-textarea" style={{ minHeight: 64 }}
                placeholder="Observations, follow-ups, things to remember…"
                value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} />
            </div>
            <button className="co-btn co-btn--sm" disabled={busy === "note" || !noteDraft.trim()} onClick={submitNote}>
              Add note
            </button>
            <div style={{ marginTop: 13 }}>
              {notes === null ? <div className="co-skel" style={{ height: 40 }} /> :
                notes.length === 0 ? <p className="co-sub">No notes yet.</p> :
                notes.map((n) => (
                  <div key={n.id} className="co-note-item">
                    <p>{n.content}</p>
                    <span>{new Date(n.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT: controls + report ── */}
        <div>
          <div className="co-card" style={{ marginBottom: 14 }}>
            <h3 className="co-sec-title">Session controls</h3>
            <div className="co-field">
              <label className="co-label">Meeting link (Meet / Zoom / Jitsi)</label>
              <input className="co-input" placeholder="https://meet.google.com/…" value={link} onChange={(e) => setLink(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="co-btn co-btn--sm" disabled={busy === "link"} onClick={saveLink}>
                {busy === "link" ? "Saving…" : "Save link & notify student"}
              </button>
              {appt.status === "confirmed" && (
                <>
                  <button className="co-btn co-btn--green co-btn--sm" onClick={() => doComplete(false)}>Mark completed</button>
                  <button className="co-btn co-btn--outline co-btn--sm" onClick={() => doComplete(true)}>No-show</button>
                  <button className="co-btn co-btn--danger co-btn--sm" onClick={doCancel}>Cancel session</button>
                </>
              )}
            </div>
          </div>

          <div className="co-card">
            <h3 className="co-sec-title">
              Session report{" "}
              {report.is_published
                ? <span className="co-chip co-chip--green">Published — edits go live</span>
                : <span className="co-chip co-chip--grey">Draft — invisible to the student</span>}
            </h3>
            <div className="co-field">
              <label className="co-label">Summary</label>
              <textarea className="co-textarea" placeholder="What you discussed and observed…"
                value={report.summary || ""} onChange={setR("summary")} />
            </div>
            <div className="co-field">
              <label className="co-label">Recommendations</label>
              <textarea className="co-textarea" placeholder="Courses, streams, exams, resources…"
                value={report.recommendations || ""} onChange={setR("recommendations")} />
            </div>
            <div className="co-field">
              <label className="co-label">Next steps</label>
              <textarea className="co-textarea" style={{ minHeight: 60 }} placeholder="Concrete actions before the next session…"
                value={report.next_steps || ""} onChange={setR("next_steps")} />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="co-btn co-btn--outline co-btn--sm" disabled={!!busy} onClick={() => persistReport(false)}>
                {busy === "draft" ? "Saving…" : "Save draft"}
              </button>
              {!report.is_published ? (
                <button className="co-btn co-btn--sm" disabled={!!busy} onClick={() => persistReport(true)}>
                  {busy === "publish" ? "Publishing…" : "Publish to student"}
                </button>
              ) : (
                <button className="co-btn co-btn--sm" disabled={!!busy} onClick={() => persistReport(false)}>
                  {busy === "draft" ? "Saving…" : "Save changes"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog dialog={dlg} onClose={() => setDlg(null)} />
    </div>
  );
}
