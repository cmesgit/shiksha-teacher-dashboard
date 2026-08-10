import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../../api/apiClient";
import "./ScheduleSessionModal.css";

// Spec section 5: 440px modal, title + Subject/Batch 2-up + Date/Time 2-up,
// Cancel + Schedule session (#7a1c1c) footer. No duration field in the spec —
// the server defaults end_time to start_time + 60min.
//
// Edit mode (editSession set): same shell, prefilled from the session being
// rescheduled. Subject/batch are shown read-only — the backend's reschedule
// endpoint only accepts title/description/start/end, since changing either
// would make this a different class's timetable entry, not a reschedule of
// this one. Duration is preserved from the original session rather than
// reset to 60min, so a longer/shorter session keeps its length when moved.
export default function ScheduleSessionModal({ initialSubjectId, editSession, onClose, onScheduled }) {
  const isEdit = Boolean(editSession);
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState(initialSubjectId || "");
  const [batches, setBatches] = useState([]);
  const [batchId, setBatchId] = useState("");
  const [title, setTitle] = useState(editSession?.title || "");
  const [date, setDate] = useState(
    editSession ? new Date(editSession.start_time).toISOString().slice(0, 10) : ""
  );
  const [time, setTime] = useState(
    editSession ? new Date(editSession.start_time).toTimeString().slice(0, 5) : ""
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isEdit) return; // subject/batch are fixed in edit mode — nothing to pick
    api
      .get("/courses/teacher/my-classes/")
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        // De-dupe by subject_id — a teacher can appear once per batch in this list.
        const seen = new Map();
        list.forEach((c) => {
          const id = c.subject_id || c.id;
          if (id && !seen.has(id)) seen.set(id, { id, name: c.subject_name || c.name });
        });
        const uniq = [...seen.values()];
        setSubjects(uniq);
        if (!subjectId && uniq.length) setSubjectId(String(uniq[0].id));
      })
      .catch(() => setSubjects([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isEdit) return;
    if (!subjectId) { setBatches([]); setBatchId(""); return; }
    let cancelled = false;
    api
      .get(`/courses/subjects/${subjectId}/batches/`)
      .then((res) => {
        if (cancelled) return;
        const list = res.data || [];
        setBatches(list);
        setBatchId(list.length ? String(list[0].id) : "");
      })
      .catch(() => {
        if (!cancelled) { setBatches([]); setBatchId(""); }
      });
    return () => { cancelled = true; };
  }, [subjectId, isEdit]);

  const submit = async () => {
    if (!title.trim() || !date || !time) {
      toast.error("Please fill in the session title, date, and time.");
      return;
    }
    if (!isEdit && (!subjectId || !batchId)) {
      toast.error("Please select a subject and batch.");
      return;
    }

    const start = new Date(`${date}T${time}`);
    if (Number.isNaN(start.getTime())) {
      toast.error("Please enter a valid date and time.");
      return;
    }
    const durationMs = isEdit
      ? new Date(editSession.end_time) - new Date(editSession.start_time)
      : 60 * 60000;
    const end = new Date(start.getTime() + durationMs);

    setSubmitting(true);
    try {
      if (isEdit) {
        await api.patch(`/livestream/sessions/${editSession.id}/reschedule/`, {
          title: title.trim(),
          start_time: start.toISOString(),
          end_time: end.toISOString(),
        });
        toast.success("Session updated!");
      } else {
        await api.post("/livestream/sessions/", {
          title: title.trim(),
          description: "",
          subject_id: subjectId,
          batch_id: batchId,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
        });
        toast.success("Session scheduled!");
      }
      onScheduled();
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.non_field_errors?.[0] ||
        err.response?.data?.start_time?.[0] ||
        err.response?.data?.end_time?.[0] ||
        (isEdit ? "Failed to update session." : "Failed to schedule session.");
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="scheduleModal__overlay" onClick={onClose}>
      <div className="scheduleModal__panel" onClick={(e) => e.stopPropagation()}>
        <div className="scheduleModal__header">
          <div className="scheduleModal__iconTile">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </div>
          <div>
            <h2 className="scheduleModal__title">{isEdit ? "Edit live session" : "Schedule a live session"}</h2>
            <p className="scheduleModal__sub">
              {isEdit
                ? "Students in this batch will see the updated time."
                : "Students in the selected batch will be notified and can join at the scheduled time."}
            </p>
          </div>
        </div>

        <div className="scheduleModal__field">
          <label className="scheduleModal__label">Session title</label>
          <input
            type="text"
            className="scheduleModal__input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Optics — refraction revision"
          />
        </div>

        {isEdit ? (
          <div className="scheduleModal__row">
            <div className="scheduleModal__field">
              <label className="scheduleModal__label">Subject</label>
              <input className="scheduleModal__input" value={editSession.subject_name || ""} disabled />
            </div>
            <div className="scheduleModal__field">
              <label className="scheduleModal__label">Batch</label>
              <input className="scheduleModal__input" value={editSession.batch_name || "All batches"} disabled />
            </div>
          </div>
        ) : (
          <div className="scheduleModal__row">
            <div className="scheduleModal__field">
              <label className="scheduleModal__label">Subject</label>
              <select className="scheduleModal__input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="scheduleModal__field">
              <label className="scheduleModal__label">Batch</label>
              <select className="scheduleModal__input" value={batchId} onChange={(e) => setBatchId(e.target.value)} disabled={!batches.length}>
                {batches.length === 0 ? (
                  <option value="">No batches</option>
                ) : (
                  batches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))
                )}
              </select>
            </div>
          </div>
        )}

        <div className="scheduleModal__row">
          <div className="scheduleModal__field">
            <label className="scheduleModal__label">Date</label>
            <input type="date" className="scheduleModal__input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="scheduleModal__field">
            <label className="scheduleModal__label">Time</label>
            <input type="time" className="scheduleModal__input" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>

        <div className="scheduleModal__footer">
          <button type="button" className="scheduleModal__btn scheduleModal__btn--outline" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="scheduleModal__btn scheduleModal__btn--primary" disabled={submitting} onClick={submit}>
            {submitting ? (isEdit ? "Saving…" : "Scheduling…") : (isEdit ? "Save changes" : "Schedule session")}
          </button>
        </div>
      </div>
    </div>
  );
}
