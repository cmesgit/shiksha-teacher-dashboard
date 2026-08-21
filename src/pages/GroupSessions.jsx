/**
 * FILE: src/pages/GroupSessions.jsx (teacher)
 *
 * Group Sessions — the design's shared Academy list screen (Academy
 * Dashboard.dc.html, `data-screen-label="Group Sessions"`, lines 1319–1360):
 * head + Join/Host buttons, an underline Upcoming/Past tab bar, and one list
 * card of standard rows. The shapes come from the shared styles/
 * academyScreens.css — same file the student dashboard's already-converted
 * GroupSessions.jsx uses, so both apps render this screen identically apart
 * from the per-role accent color.
 *
 * This teacher variant keeps real differences from the student reference:
 *   - Participants are TEACHERS, not students (ParticipantSearch/Step call
 *     groupSessionService.getTeachers, not getCourseStudents).
 *   - The create/edit payload sends `invited_teacher_id` (single-teacher
 *     backend field) alongside `invited_user_ids` — the student payload has
 *     no such field.
 *   - SessionDetailsDialog reads `teacherId`/`hostTeacherId`, not `studentId`.
 *   - HostSessionDialog keeps the teacher-only "pick a duration, then Start
 *     instant session" flow (navigates straight into the room) instead of
 *     the student app's ID-reveal-then-Copy/Share flow.
 *   - Every live-room / join-by-code route is `/teacher/group-session/live/:id`.
 *
 * Flow included:
 *   - Main Group Sessions list screen (Upcoming / Past tabs)
 *   - Join Session dialog
 *   - Host Session dialog
 *   - Scheduled Session create dialog: Details → Participants → Summary
 *   - Scheduled Session details dialog for Host / Participant
 *   - Edit Session dialog for Host: Details → Participants → Summary
 *   - Notes dialog (Past tab row action)
 *
 * The design specifies the list screen only. The dialogs below keep their
 * existing structure and step logic; they've been re-pointed at the shared
 * `sg__` dialog utility classes (now defined in teacherGroupSessions.css)
 * so they stop rendering unstyled.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IoCloseOutline } from "react-icons/io5";
import api from "../api/apiClient";
import groupSessionService, { extractApiError } from "../api/groupSessionService";
import { LoadingState } from "../components/StateViews";
import { subjectChipSlot } from "../utils/subjectChips";
import { fmtClockTime, dayLabel, startsInText } from "../utils/sessionTime";
import "../styles/academyScreens.css";
import "../styles/teacherGroupSessions.css";
import "../styles/groupSessionModals.css";

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */

function getLocalDateValue(dateObj = new Date()) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getLocalTimeValue(dateObj = new Date()) {
  return `${String(dateObj.getHours()).padStart(2, "0")}:${String(dateObj.getMinutes()).padStart(2, "0")}`;
}

function getDefaultFutureTime(minutesAhead = 10) {
  const d = new Date(Date.now() + minutesAhead * 60_000);
  // Round up to the next 5-minute mark so the value looks clean.
  const roundedMinutes = Math.ceil(d.getMinutes() / 5) * 5;
  d.setMinutes(roundedMinutes, 0, 0);
  return getLocalTimeValue(d);
}

function getScheduleStartMs(date, time) {
  if (!date || !time) return NaN;
  return new Date(`${date}T${time}:00`).getTime();
}

function isScheduleInPast(date, time, bufferMinutes = 2) {
  const start = getScheduleStartMs(date, time);
  if (Number.isNaN(start)) return false;
  return start <= Date.now() + bufferMinutes * 60_000;
}

function formatDate(d) {
  if (!d) return "TBD";
  try {
    return new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function formatDateLong(d) {
  if (!d) return "TBD";
  try {
    return new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function formatTime(t) {
  if (!t) return "TBD";
  try {
    const [h, m] = String(t).split(":");
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour % 12 || 12;
    return `${h12}:${m || "00"} ${ampm}`;
  } catch {
    return t;
  }
}

function addMinutesToTime(time, minutes) {
  if (!time || !minutes) return "TBD";
  try {
    const [h, m] = String(time).split(":").map(Number);
    const d = new Date();
    d.setHours(h || 0, m || 0, 0, 0);
    d.setMinutes(d.getMinutes() + Number(minutes || 0));
    return d.toTimeString().slice(0, 5);
  } catch {
    return "TBD";
  }
}

function formatTiming(startTime, durationMinutes) {
  if (!startTime) return "TBD";
  const endTime = addMinutesToTime(startTime, durationMinutes);
  return `${formatTime(startTime)} to ${formatTime(endTime)}`;
}

function statusLabel(status) {
  const m = {
    scheduled: "Scheduled",
    live: "LIVE",
    completed: "Completed",
    cancelled: "Cancelled",
    expired: "Expired",
  };
  return m[status] || status || "Scheduled";
}

function shortId(id) {
  if (!id) return "";
  const s = String(id);
  return s.length > 12 ? `${s.slice(0, 10)}…` : s;
}

/* getUserInitial() and getHostPhoto() used to feed the old unstyled card's
   avatar. The design's row carries no avatar (it uses the time/day block in
   that slot), so both are gone rather than left as dead code — mirrors the
   student app's GroupSessions.jsx. */

function isEndedNow(g) {
  if (!g) return false;
  if (["completed", "cancelled", "expired"].includes(g.status)) return true;

  const durMs = Number(g.durationMinutes || 0) * 60_000;

  if (g.status === "live" && g.roomStartedAt && durMs > 0) {
    const end = new Date(g.roomStartedAt).getTime() + durMs;
    return !Number.isNaN(end) && Date.now() >= end;
  }

  if (g.status === "scheduled" && !g.roomStartedAt && g.date && g.time && durMs > 0) {
    const end = new Date(`${g.date}T${g.time}`).getTime() + durMs;
    return !Number.isNaN(end) && Date.now() >= end;
  }

  return false;
}

function normalizeJoinError(err) {
  const raw = extractApiError(err, "Couldn't join that session.");
  const text = String(raw || "").toLowerCase();

  if (err?.response?.status === 404 || text.includes("not found") || text.includes("does not exist")) {
    return "Session ID Does not Exist";
  }
  if (text.includes("lock") || text.includes("locked")) {
    return "Session is currently Locked by the Host. Try again later";
  }
  if (text.includes("ended") || text.includes("completed") || text.includes("expired")) {
    return "This session has already ended.";
  }
  return raw;
}

function uniqueByUserId(list) {
  const map = new Map();
  (list || []).forEach((p) => {
    const key = String(p.user_id || p.userId || p.id || "");
    if (key && !map.has(key)) map.set(key, p);
  });
  return Array.from(map.values());
}

async function updateScheduledSession(sessionId, payload) {
  // PATCH group_session_detail (host-only, while status="scheduled"):
  // topic/scheduled_date/scheduled_time/duration_minutes, plus additive-only
  // invited_user_ids (new ids get invited; ids missing from the submission
  // are left alone — this never revokes an existing invite).
  const res = await api.patch(`/sessions/group-sessions/${sessionId}/`, payload);
  return res.data;
}

// Teacher hosts get 5 duration choices (incl. 2h/3h) for both the scheduler
// and the instant-session picker — kept wider than the student app's 3.
const DURATIONS = [
  { label: "30 minutes", value: 30 },
  { label: "60 minutes", value: 60 },
  { label: "90 minutes", value: 90 },
  { label: "2 hours", value: 120 },
  { label: "3 hours", value: 180 },
];

const MAX_PARTICIPANTS = 10;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ═══════════════════════════════════════════════════════════
   SESSION ROW
═══════════════════════════════════════════════════════════ */
/* The design's row wants a Date for its time/day block. Group sessions store
   date and time as separate strings, so combine them — and fall back to the
   existing string formatters if the result isn't a valid Date, rather than
   rendering "Invalid Date". */
function groupStartDate(group) {
  if (!group?.date) return null;
  const d = new Date(`${group.date}T${group.time || "00:00"}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Group-session status → shared .ac-tag--* variant.
const GROUP_STATUS_TONE = {
  scheduled: "info",
  live: "live",
  completed: "success",
  cancelled: "danger",
  expired: "neutral",
};

/* One row, shared by the Upcoming and Past tabs — the design uses the same row
   shape for both, differing only in the trailing action. The design's own row
   (dc.html line 1345) shows a subject chip alongside the status tag, and a
   teacher's group session does carry a real subject (subjectName), so it gets
   one here via the same subjectChipSlot() helper Assignments/Live Sessions use. */
function GroupSessionRow({ group, status, actionLabel, onAction }) {
  const start = groupStartDate(group);
  const tone = GROUP_STATUS_TONE[status] || "neutral";
  const isLive = status === "live";
  const participantCount = Math.max(1, 1 + Number(group.acceptedCount || 0));

  return (
    <div className="ac-row">
      <div className="ac-row__when">
        <div className="ac-row__time">
          {start ? fmtClockTime(start) : formatTime(group.time)}
        </div>
        <div className="ac-row__day">
          {start ? dayLabel(start) : formatDate(group.date)}
        </div>
      </div>
      <div className="ac-row__divider" />
      <div className="ac-row__body">
        <div className="ac-row__meta">
          {group.subjectName && (
            <span className={`subj-chip subj-chip--${subjectChipSlot(group.subjectName)}`}>
              {group.subjectName}
            </span>
          )}
          <span className={`ac-tag ac-tag--${tone}`}>{statusLabel(status)}</span>
          {isLive ? (
            <span className="ac-when">{participantCount} in the room</span>
          ) : start && status === "scheduled" ? (
            <span className="ac-when">starts {startsInText(start)}</span>
          ) : (
            <span className="ac-when">{formatTiming(group.time, group.durationMinutes)}</span>
          )}
        </div>
        <div className="ac-row__topic">{group.topic || "Untitled session"}</div>
        <div className="ac-row__sub">
          {group.hostName ? `Hosted by ${group.hostName}` : "Host unknown"}
        </div>
      </div>
      <button
        type="button"
        className="ac-btn ac-btn--primary"
        onClick={() => onAction(group)}
      >
        {actionLabel}
      </button>
    </div>
  );
}

function GroupSessionCard({ group, onOpen }) {
  const status = isEndedNow(group) ? "completed" : (group.status || "scheduled");
  return (
    <GroupSessionRow
      group={group}
      status={status}
      actionLabel={status === "live" ? "Join" : "Open"}
      onAction={onOpen}
    />
  );
}

/* ═══════════════════════════════════════════════════════════
   PAST SESSION ROW (Past tab)
   Same row as GroupSessionCard, but the action is "Notes" rather than
   opening the live/scheduled details dialog — matching the student app's
   already-approved pattern for this screen's Past tab.
═══════════════════════════════════════════════════════════ */
function PastSessionCard({ group, onNotes }) {
  return (
    <GroupSessionRow
      group={group}
      status={group.status === "cancelled" ? "cancelled" : "completed"}
      actionLabel="Notes"
      onAction={onNotes}
    />
  );
}

/* ═══════════════════════════════════════════════════════════
   PARTICIPANT SEARCH (teacher-invites-teacher — NOT the student search)
═══════════════════════════════════════════════════════════ */
function ParticipantSearch({ subjectId, selected, onAdd, disabled, currentUserId }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const wrapRef = useRef(null);

  const excludedIds = useMemo(() => {
    const ids = selected.map((p) => String(p.user_id || p.userId || p.id || ""));
    if (currentUserId) ids.push(String(currentUserId));
    return ids;
  }, [selected, currentUserId]);

  useEffect(() => {
    function handleOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  useEffect(() => {
    if (!open || !subjectId) return undefined;

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await groupSessionService.getTeachers(subjectId, query.trim());
        const filtered = (data || []).filter((t) => {
          const tid = String(t.user_id || t.userId || t.id || "");
          return UUID_RE.test(tid) && !excludedIds.includes(tid);
        });
        setResults(filtered);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [query, open, subjectId, excludedIds]);

  const choose = (teacher) => {
    onAdd(teacher);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", flex: 1 }}>
      <input
        className="sg__input"
        placeholder="Enter Teacher's Phone or Name"
        value={query}
        disabled={disabled || !subjectId}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
      />

      {open && !disabled && subjectId && (
        <div className="gs-search-drop">
          {loading && <div className="gs-search-row-muted">Searching…</div>}
          {!loading && results.length === 0 && (
            <div className="gs-search-row-muted">
              {query ? "No teacher found for this subject" : "Start typing to search same-subject teachers"}
            </div>
          )}
          {!loading && results.slice(0, 8).map((t) => {
            const tid = String(t.user_id || t.userId || t.id || "");
            return (
              <button
                key={tid}
                type="button"
                className="gs-search-row"
                onMouseDown={(e) => { e.preventDefault(); choose(t); }}
              >
                <span className="gs-search-avatar">{(t.name || t.full_name || "?").charAt(0).toUpperCase()}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong className="gs-search-name">{t.name || t.full_name || "Teacher"}</strong>
                  <small className="gs-search-sub">{t.phone || t.teacher_id || t.employee_id || shortId(tid)}</small>
                </span>
                <span className="gs-search-add">Add</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ParticipantsStep({ subjectId, participants, setParticipants, disabled, currentUserId }) {
  const addParticipant = (teacher) => {
    const tid = String(teacher?.user_id || teacher?.userId || teacher?.id || "");
    if (!UUID_RE.test(tid)) return;
    if (currentUserId && tid === String(currentUserId)) return;
    if (participants.length >= MAX_PARTICIPANTS) return;

    const next = uniqueByUserId([
      ...participants,
      {
        user_id: tid,
        name: teacher.name || teacher.full_name || "Teacher",
        teacher_id: teacher.teacher_id || teacher.employee_id || teacher.phone || "",
      },
    ]);

    setParticipants(next.slice(0, MAX_PARTICIPANTS));
  };

  const removeParticipant = (userId) => {
    setParticipants(participants.filter((p) => String(p.user_id || p.userId) !== String(userId)));
  };

  return (
    <div>
      <label className="sg__label">Enter Teacher:</label>
      <div className="gs-teacher-search-line">
        <ParticipantSearch
          subjectId={subjectId}
          selected={participants}
          onAdd={addParticipant}
          disabled={disabled || participants.length >= MAX_PARTICIPANTS}
          currentUserId={currentUserId}
        />
      </div>

      <div className="gs-participant-list-box">
        {participants.length === 0 ? (
          <div className="gs-no-participants">No teachers added yet.</div>
        ) : (
          participants.map((p, index) => (
            <div key={p.user_id || p.userId || index} className="gs-participant-edit-row">
              <span className="gs-participant-index">{index + 1}.</span>
              <span className="gs-participant-name-box">
                {p.name || "Teacher"}
                {(p.teacher_id || p.teacherId) ? ` (${p.teacher_id || p.teacherId})` : ""}
              </span>
              <button
                type="button"
                className="gs-remove-btn"
                onClick={() => removeParticipant(p.user_id || p.userId)}
              >
                x
              </button>
            </div>
          ))
        )}
      </div>

      <div className="gs-participant-count">Participants: {participants.length}/{MAX_PARTICIPANTS}</div>
      {participants.length >= MAX_PARTICIPANTS && (
        <p className="sg__hint" style={{ textAlign: "center", marginTop: 6 }}>
          Maximum {MAX_PARTICIPANTS} participants allowed.
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SCHEDULE / EDIT MODAL
═══════════════════════════════════════════════════════════ */
function ScheduleSessionModal({
  mode = "create",
  open,
  onClose,
  onCreated,
  onUpdated,
  selectedSubjectId,
  initialSession = null,
  currentUserId = null,
}) {
  const isEdit = mode === "edit";
  const [step, setStep] = useState(1);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(30);
  const [topic, setTopic] = useState("");
  const [participants, setParticipants] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setError("");
    if (isEdit && initialSession) {
      setDate(initialSession.date || "");
      setTime(initialSession.time || "");
      setDuration(Number(initialSession.durationMinutes || 30));
      setTopic(initialSession.topic || "");
      setParticipants((initialSession.invites || [])
        .map((inv) => ({
          user_id: inv.userId,
          name: inv.name,
          teacher_id: inv.teacherId,
        }))
        .filter((p) => UUID_RE.test(String(p.user_id || "")) && String(p.user_id) !== String(currentUserId || ""))
      );
    } else {
      setDate(getLocalDateValue());
      setTime(getDefaultFutureTime(10));
      setDuration(30);
      setTopic("");
      setParticipants([]);
    }
  }, [open, isEdit, initialSession]);

  if (!open) return null;

  const canStep1 = Boolean(date && time && duration && !isScheduleInPast(date, time, 2));
  const canStep2 = participants.length > 0;
  const title = isEdit ? "Edit Session" : "Schedule a Session";
  const endTime = addMinutesToTime(time, duration);
  const minTimeToday = getLocalTimeValue(new Date(Date.now() + 2 * 60_000));
  const schedulePast = isScheduleInPast(date, time, 2);

  const invitedUserIds = participants
    .map((p) => String(p.user_id || p.userId || ""))
    .filter((id) => UUID_RE.test(id) && id !== String(currentUserId || ""));

  const payload = {
    subject_id: selectedSubjectId || initialSession?.subjectId,
    // Keep the backend-compatible shape used by the existing group-session API.
    // If the backend only supports one teacher invite, invited_teacher_id is the first selected teacher.
    // invited_user_ids keeps the UI ready for multiple teacher participants when backend allows it.
    invited_teacher_id: invitedUserIds[0] || null,
    invited_user_ids: invitedUserIds,
    scheduled_date: date,
    scheduled_time: time,
    duration_minutes: Number(duration),
    topic: topic || "",
  };

  const submit = async () => {
    if (isScheduleInPast(date, time, 2)) {
      setStep(1);
      setError("Please choose a future start time. Current or past time cannot be scheduled.");
      return;
    }
    if (invitedUserIds.length < 1) {
      setStep(2);
      setError("Please add at least one valid teacher. You cannot invite yourself.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (isEdit) {
        const raw = await updateScheduledSession(initialSession.id, payload);
        let fresh = raw;
        try {
          fresh = await groupSessionService.getDetail(initialSession.id);
        } catch {
          // ignore; use raw response if detail refresh fails
        }
        localStorage.setItem(`sg_edit_used_${initialSession.id}`, "1");
        onUpdated?.(fresh);
      } else {
        if (!payload.subject_id) {
          throw new Error("Please select a course before scheduling a session.");
        }
        const created = await groupSessionService.createGroupSession(payload);
        onCreated?.(created);
      }
      onClose();
    } catch (err) {
      setError(
        err?.message === "Please select a course before scheduling a session."
          ? err.message
          : extractApiError(err, isEdit
              ? "Could not save changes. Please check if the backend edit API is available."
              : "Could not create scheduled session.")
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sg__modalOverlay" onClick={() => !saving && onClose()}>
      <div className="gs-figma-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 className="gs-dialog-title">{title}</h3>

        <StepHeader step={step} />
        {error && <div className="sg__errorBox">{error}</div>}

        {step === 1 && (
          <div className="gs-form-area">
            <div className="gs-inline-field">
              <label className="gs-compact-label">Select Date:</label>
              <input
                type="date"
                className="sg__input gs-date-input"
                value={date}
                min={getLocalDateValue()}
                onChange={(e) => {
                  const nextDate = e.target.value;
                  setDate(nextDate);
                  if (nextDate === getLocalDateValue() && isScheduleInPast(nextDate, time, 2)) {
                    setTime(getDefaultFutureTime(10));
                  }
                }}
              />
            </div>

            <div className="gs-inline-field">
              <label className="gs-compact-label">Start Time:</label>
              <input
                type="time"
                className="sg__input gs-time-input"
                value={time}
                min={date === getLocalDateValue() ? minTimeToday : undefined}
                onChange={(e) => {
                  setTime(e.target.value);
                  if (error && error.toLowerCase().includes("past")) setError("");
                }}
              />
              {time && duration ? (
                <span className="gs-end-time-hint">End: {formatTime(endTime)}</span>
              ) : null}
            </div>
            {schedulePast && (
              <p className="sg__hint" style={{ color: "#b91c1c", marginTop: 6 }}>
                Please select a future start time. Current or past time cannot be scheduled.
              </p>
            )}

            <label className="gs-compact-label">Select Duration:</label>
            <div className="gs-duration-row">
              {DURATIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  className={duration === d.value ? "gs-duration-btn-active" : "gs-duration-btn"}
                  onClick={() => setDuration(d.value)}
                >
                  {d.label}
                </button>
              ))}
            </div>

            <label className="gs-compact-label">Topic (optional):</label>
            <input
              className="sg__input gs-topic-input"
              value={topic}
              maxLength={255}
              placeholder='Discussion on "What comes first ?"'
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>
        )}

        {step === 2 && (
          <div className="gs-form-area">
            <ParticipantsStep
              subjectId={selectedSubjectId || initialSession?.subjectId}
              participants={participants}
              setParticipants={setParticipants}
              currentUserId={currentUserId}
            />
          </div>
        )}

        {step === 3 && (
          <SummaryStep
            date={date}
            time={time}
            duration={duration}
            topic={topic}
            participants={participants}
          />
        )}

        <div className="gs-dialog-foot">
          {step === 1 ? (
            <button type="button" className="gs-teal-ghost-btn" disabled={saving} onClick={onClose}>
              Cancel
            </button>
          ) : (
            <button type="button" className="gs-teal-ghost-btn" disabled={saving} onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}

          {step < 3 ? (
            <button
              type="button"
              className="gs-teal-btn"
              disabled={saving || (step === 1 && !canStep1) || (step === 2 && !canStep2)}
              onClick={() => setStep(step + 1)}
            >
              Continue
            </button>
          ) : (
            <button type="button" className="gs-teal-btn" disabled={saving} onClick={submit}>
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Confirm"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepHeader({ step }) {
  const items = ["Details", "Participants", "Summary"];
  return (
    <div className="gs-step-wrap">
      {items.map((name, index) => {
        const n = index + 1;
        const active = step >= n;
        return (
          <div key={name} className="gs-step-item">
            <span className={active ? "gs-step-circle-active" : "gs-step-circle"}>{n}</span>
            <span className={active ? "gs-step-text-active" : "gs-step-text"}>{name}</span>
            {index < items.length - 1 && <span className="gs-step-line" />}
          </div>
        );
      })}
    </div>
  );
}

function SummaryStep({ date, time, duration, topic, participants }) {
  return (
    <div className="gs-summary-box">
      <SummaryRow label="Date:" value={formatDateLong(date)} />
      <SummaryRow label="Timing:" value={formatTiming(time, duration)} />
      <SummaryRow label="Duration:" value={`${duration} minutes`} />
      <SummaryRow label="Participants:" value={`${participants.length} people`} />
      <SummaryRow label="Topic:" value={topic || "—"} />
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="gs-summary-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DETAILS MODAL
═══════════════════════════════════════════════════════════ */
function SessionDetailsDialog({
  session,
  user,
  open,
  onClose,
  onEdit,
  onChanged,
  onJoinLive,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open || !session) return null;

  const userId = user?.id ? String(user.id) : null;
  const isHost = userId && session.hostId && String(session.hostId) === userId;
  const isScheduled = session.status === "scheduled";
  const editUsed = Boolean(session.editedAt || session.edited_at || localStorage.getItem(`sg_edit_used_${session.id}`));

  const participants = [
    {
      id: "host",
      name: session.hostName || "Host",
      teacherId: session.hostTeacherId || "",
      isHost: true,
    },
    ...(session.invites || []).map((i) => ({
      id: i.id || i.userId,
      userId: i.userId,
      name: i.name,
      teacherId: i.teacherId,
      status: i.status,
      isHost: false,
      declineCount: i.declineCount || 0,
      joinedAt: i.joinedAt,
    })),
  ];

  const decline = async () => {
    setBusy(true);
    setError("");
    try {
      const fresh = await groupSessionService.declineInvite(session.id);
      onChanged?.(fresh);
      onClose();
    } catch (err) {
      setError(extractApiError(err, "Could not decline this session."));
    } finally {
      setBusy(false);
    }
  };

  const cancelSession = async () => {
    if (!window.confirm("Cancel this scheduled session?")) return;
    setBusy(true);
    setError("");
    try {
      const fresh = await groupSessionService.cancelGroupSession(session.id);
      onChanged?.(fresh);
      onClose();
    } catch (err) {
      setError(extractApiError(err, "Could not cancel this session."));
    } finally {
      setBusy(false);
    }
  };

  const startSession = async () => {
    setBusy(true);
    setError("");
    try {
      await groupSessionService.joinRoom(session.id);
      onJoinLive(session.id);
    } catch (err) {
      setError(extractApiError(err, "Unable to start the session right now."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sg__modalOverlay" onClick={() => !busy && onClose()}>
      <div className="gs-details-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 className="gs-dialog-title">Session Details</h3>
        {error && <div className="sg__errorBox">{error}</div>}

        <div className="gs-details-grid">
          <SummaryRow label="Date:" value={formatDateLong(session.date)} />
          <SummaryRow label="Timing:" value={formatTiming(session.time, session.durationMinutes)} />
          <SummaryRow label="Duration:" value={`${session.durationMinutes || "—"} minutes`} />
          <SummaryRow label="Participants:" value={`${participants.length} people`} />
        </div>

        <div className="gs-details-participants-box">
          {participants.map((p, index) => (
            <div key={p.id || index} className="gs-details-participant-row">
              <span className="gs-participant-index">{index + 1}.</span>
              <span style={{ flex: 1 }}>
                {p.name || "Participant"}
                {p.teacherId ? ` (${shortId(p.teacherId)})` : ""}
              </span>
              {p.isHost && <span className="gs-host-label">HOST</span>}
              {!p.isHost && p.status === "declined" && <span className="gs-declined-label">DECLINED</span>}
              {!p.isHost && p.status === "accepted" && p.joinedAt && <span className="gs-joined-label">JOINED</span>}
              {!p.isHost && p.declineCount > 0 && (
                <span className="gs-reinvited-label" title="Number of times this invite was declined and resent">
                  RE-INVITED ×{p.declineCount}
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="gs-details-topic">
          <strong>Topic:</strong>
          <span>{session.topic || "—"}</span>
        </div>

        <div className="gs-dialog-foot">
          <button type="button" className="gs-teal-ghost-btn" disabled={busy} onClick={onClose}>
            Back
          </button>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {isHost && isScheduled && (
              <button type="button" className="gs-cancel-text-btn" disabled={busy} onClick={cancelSession}>
                Cancel Session
              </button>
            )}

            {isHost && isScheduled && (
              <button
                type="button"
                className={editUsed ? "gs-teal-btn-muted" : "gs-teal-btn"}
                disabled={busy || editUsed}
                title={editUsed ? "Can be edited only once" : "Edit session details"}
                onClick={onEdit}
              >
                Edit
              </button>
            )}

            {isHost && isScheduled && (
              <button type="button" className="gs-teal-btn" disabled={busy} onClick={startSession}>
                Start Session
              </button>
            )}

            {!isHost && isScheduled && (
              <button type="button" className="gs-cancel-text-btn" disabled={busy} onClick={decline}>
                Decline
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   NOTES DIALOG (Past tab row action)
   Private per-user scratchpad for a since-ended group session —
   /sessions/group-sessions/:id/notes/ (GET/PATCH), autosaved. Ported from
   the student app's GroupSessions.jsx; the endpoint and shape are role-
   agnostic.
═══════════════════════════════════════════════════════════ */
function NotesDialog({ session, open, onClose }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved
  const saveTimer = useRef(null);

  useEffect(() => {
    if (!open || !session) return undefined;
    let cancelled = false;
    api
      .get(`/sessions/group-sessions/${session.id}/notes/`)
      .then((res) => {
        if (!cancelled) setContent(res.data?.content || "");
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(saveTimer.current);
    };
  }, [open, session]);

  if (!open || !session) return null;

  const handleChange = (e) => {
    const value = e.target.value;
    setContent(value);
    setSaveStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api
        .patch(`/sessions/group-sessions/${session.id}/notes/`, { content: value })
        .then(() => setSaveStatus("saved"))
        .catch(() => setSaveStatus("idle"));
    }, 800);
  };

  return (
    <div className="sg__modalOverlay" onClick={onClose}>
      <div className="sg__smallModal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="sg__modalClose" onClick={onClose} aria-label="Close">
          <IoCloseOutline />
        </button>

        <h3 className="sg__modalTitle">Session Notes</h3>
        <p className="sg__hint sg__modalHint">
          {session.topic || "Group session"} · {formatDate(session.date)}
        </p>

        <div className="sg__notesBody">
          {loading ? (
            <p className="sg__hint">Loading…</p>
          ) : (
            <>
              <textarea
                className="sg__input"
                style={{ width: "100%", minHeight: 140, resize: "vertical", boxSizing: "border-box" }}
                value={content}
                onChange={handleChange}
                placeholder="No notes taken for this session yet — only you can see these."
              />
              <p className="sg__hint" style={{ textAlign: "right", marginTop: 4, minHeight: 16 }}>
                {saveStatus === "saving" && "Saving…"}
                {saveStatus === "saved" && "Saved"}
              </p>
            </>
          )}
        </div>

        <div className="sg__dialogFootEnd">
          <button type="button" className="sg__idShareBtn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   JOIN / HOST DIALOGS
═══════════════════════════════════════════════════════════ */
function JoinSessionDialog({ open, busy, error, onClose, onEnter }) {
  const [code, setCode] = useState("");

  useEffect(() => {
    if (open) setCode("");
  }, [open]);

  if (!open) return null;

  return (
    <div className="sg__modalOverlay" onClick={() => !busy && onClose()}>
      <div className="gs-join-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 className="gs-dialog-title">Join Session</h3>

        <label className="gs-compact-label" style={{ textAlign: "center" }}>Enter Session ID:</label>
        <input
          className="sg__input gs-join-input"
          value={code}
          autoFocus
          placeholder="SHR7J2"
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && code.trim() && !busy) onEnter(code.trim());
          }}
        />

        {error && <div className="gs-join-error">Error:<br />{error}</div>}

        <div className="gs-dialog-foot-center">
          <button type="button" className="gs-teal-ghost-btn" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="gs-teal-btn"
            disabled={busy || !code.trim()}
            onClick={() => onEnter(code.trim())}
          >
            {busy ? "Joining…" : "Join"}
          </button>
        </div>
      </div>
    </div>
  );
}

function HostSessionDialog({ open, busy, error, onClose, onInstant, onScheduled }) {
  const [instantDuration, setInstantDuration] = useState(60);
  if (!open) return null;

  return (
    <div className="sg__modalOverlay" onClick={() => !busy && onClose()}>
      <div className="sg__smallModal" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="sg__modalClose"
          onClick={() => !busy && onClose()}
          aria-label="Close"
        >
          <IoCloseOutline />
        </button>

        <h3 className="sg__modalTitle">Host Session</h3>
        <p className="sg__hint sg__modalHint">Choose how you want to host your group session.</p>
        {error && <div className="sg__errorBox">{error}</div>}

        <div className="sg__hostChoiceList">
          <div className="sg__hostChoice" style={{ cursor: "default" }}>
            <strong>Instant Session</strong>
            <span>Go LIVE directly and share the session ID with teachers.</span>

            <label className="sg__hint" style={{ display: "block", marginTop: 10, marginBottom: 4 }}>
              Duration
            </label>
            <select
              value={instantDuration}
              disabled={busy}
              onChange={(e) => setInstantDuration(Number(e.target.value))}
              onClick={(e) => e.stopPropagation()}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, marginBottom: 10 }}
            >
              {DURATIONS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>

            <button
              type="button"
              className="sg__primaryBtn"
              disabled={busy}
              onClick={() => onInstant(instantDuration)}
              style={{ width: "100%" }}
            >
              {busy ? "Starting…" : "Start instant session"}
            </button>
          </div>

          <button type="button" className="sg__hostChoice" disabled={busy} onClick={onScheduled}>
            <strong>Scheduled Session</strong>
            <span>Create a scheduled group session. It stays Scheduled until the host starts it.</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════════ */
export default function GroupSessions() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    let cancelled = false;

    api.get("/accounts/me/")
      .then((res) => {
        if (!cancelled) setUser(res.data || null);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const [subjectGroups, setSubjectGroups] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showHostDialog, setShowHostDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [detailsSession, setDetailsSession] = useState(null);
  const [editingSession, setEditingSession] = useState(null);
  const [notesSession, setNotesSession] = useState(null);

  const [joinBusy, setJoinBusy] = useState(false);
  const [hostBusy, setHostBusy] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [hostError, setHostError] = useState("");

  // Underline Upcoming / Past tab — the design shows this bar for Group
  // Sessions (dc.html lines 1330–1332); the pre-redesign page had no tabs at
  // all and only ever showed the "upcoming" merge below.
  const [sessTab, setSessTab] = useState("upcoming"); // "upcoming" | "past"
  const [pastGroups, setPastGroups] = useState([]);
  const [pastLoading, setPastLoading] = useState(false);
  const [pastLoaded, setPastLoaded] = useState(false);

  // Small ticker so ended scheduled/live cards update without page reload.
  const [_tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    groupSessionService.getMySubjects()
      .then((data) => {
        if (cancelled) return;

        // Be defensive about backend key names so the course dropdown does
        // not stay stuck on "Select Course" because of courseId/course_title
        // vs course_id/course_label differences.
        const list = (data || [])
          .map((g) => ({
            ...g,
            course_id: g.course_id || g.courseId || g.id || "",
            course_label:
              g.course_label ||
              g.courseTitle ||
              g.course_title ||
              g.title ||
              g.name ||
              "Course",
            subjects: g.subjects || g.subject_list || [],
          }))
          .filter((g) => g.course_id);

        setSubjectGroups(list);
        if (!selectedCourseId && list.length > 0) {
          setSelectedCourseId(String(list[0].course_id));
        }
      })
      .catch((err) => {
        console.error("getMySubjects failed:", err?.response?.data || err);
        if (!cancelled) setSubjectGroups([]);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedCourse = useMemo(() => {
    return subjectGroups.find((g) => String(g.course_id) === String(selectedCourseId)) || null;
  }, [subjectGroups, selectedCourseId]);

  const selectedSubjectId = useMemo(() => {
    const firstSubject = selectedCourse?.subjects?.[0];
    return firstSubject?.id || firstSubject?.subject_id || firstSubject?.subjectId || "";
  }, [selectedCourse]);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const [upcoming, invites] = await Promise.all([
        groupSessionService.getMyGroupSessions("upcoming"),
        groupSessionService.getMyGroupSessions("invites"),
      ]);

      const merged = new Map();
      [...(upcoming || []), ...(invites || [])].forEach((g) => {
        if (g?.id) merged.set(g.id, g);
      });

      setGroups(Array.from(merged.values()));
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  // Does this group belong to the selected course?
  //
  // The id comparison was always correct; the problem was that it was OR'd with
  // a title comparison, so a row WITH a valid id that failed the id check could
  // still be pulled in by its title — and MBSE and CBSE both run a course
  // titled "Class 9", so that fallback matched the wrong course outright.
  // The id is now authoritative whenever the row has one, and the label is only
  // consulted for legacy rows that genuinely carry no courseId. Those labels are
  // board-qualified on both sides now (the backend builds course_label and the
  // denormalised course_title with the board in them), so even that path no
  // longer collides — but it stays a last resort rather than an equal alternative.
  const matchesSelectedCourse = useCallback((g) => {
    if (!selectedCourseId) return true;
    if (!g.courseId && !g.courseTitle) return true;   // no course at all — ad-hoc group
    if (g.courseId) return String(g.courseId) === String(selectedCourseId);
    return String(g.courseTitle) === String(selectedCourse?.course_label);
  }, [selectedCourseId, selectedCourse]);

  const visibleGroups = useMemo(() => {
    const active = groups
      .filter((g) => !isEndedNow(g))
      .filter(matchesSelectedCourse);

    return active.sort((a, b) => {
      const order = { live: 0, scheduled: 1, completed: 2, cancelled: 3, expired: 4 };
      const aOrder = order[a.status] ?? 9;
      const bOrder = order[b.status] ?? 9;
      if (aOrder !== bOrder) return aOrder - bOrder;

      const aTime = new Date(`${a.date || "9999-12-31"}T${a.time || "23:59"}`).getTime();
      const bTime = new Date(`${b.date || "9999-12-31"}T${b.time || "23:59"}`).getTime();
      return (Number.isNaN(aTime) ? Infinity : aTime) - (Number.isNaN(bTime) ? Infinity : bTime);
    });
  }, [groups, matchesSelectedCourse, _tick]);

  // Past tab — backed by the real ?tab=history endpoint (completed /
  // cancelled / expired sessions the teacher was part of). Lazy-loaded the
  // first time the Past pill is opened, same as the student app's page.
  const loadPastGroups = useCallback(async () => {
    setPastLoading(true);
    try {
      const history = await groupSessionService.getMyGroupSessions("history");
      setPastGroups(history || []);
      setPastLoaded(true); // only latch "loaded" on success — a transient
      // failure should retry next time the Past tab is opened, not get
      // stuck showing an empty list forever.
    } catch {
      setPastGroups([]);
    } finally {
      setPastLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessTab === "past" && !pastLoaded) loadPastGroups();
  }, [sessTab, pastLoaded, loadPastGroups]);

  const visiblePastGroups = useMemo(() => {
    let list = pastGroups.filter(matchesSelectedCourse);

    return [...list].sort((a, b) => {
      const aTime = new Date(`${a.date || "1970-01-01"}T${a.time || "00:00"}`).getTime();
      const bTime = new Date(`${b.date || "1970-01-01"}T${b.time || "00:00"}`).getTime();
      const aVal = Number.isNaN(aTime) ? 0 : aTime;
      const bVal = Number.isNaN(bTime) ? 0 : bTime;
      // Newest first, always — the design gives this screen no sort control.
      return bVal - aVal;
    });
  }, [pastGroups, matchesSelectedCourse]);

  const refreshOne = async (sessionId) => {
    try {
      const fresh = await groupSessionService.getDetail(sessionId);
      setGroups((prev) => prev.map((g) => (g.id === sessionId ? fresh : g)));
      setDetailsSession((current) => (current?.id === sessionId ? fresh : current));
      return fresh;
    } catch {
      await loadGroups();
      return null;
    }
  };

  const openCard = async (group) => {
    if (group.status === "live") {
      navigate(`/teacher/group-session/live/${group.id}`);
      return;
    }

    try {
      const fresh = await groupSessionService.getDetail(group.id);
      setDetailsSession(fresh);
    } catch {
      setDetailsSession(group);
    }
  };

  const startInstantMeeting = async (durationMinutes = 60) => {
    setHostBusy(true);
    setHostError("");
    try {
      const sg = await groupSessionService.createInstant({
        duration_minutes: Number(durationMinutes) || 60,
        topic: "",
      });
      setShowHostDialog(false);
      navigate(`/teacher/group-session/live/${sg.id}`);
    } catch (err) {
      console.error("createInstant failed:", err?.response?.data || err);
      setHostError(extractApiError(err, "Could not start an instant session."));
    } finally {
      setHostBusy(false);
    }
  };

  const enterRoomByCode = async (code) => {
    if (!code) return;
    setJoinBusy(true);
    setJoinError("");
    try {
      const { session_id } = await groupSessionService.joinByCode(code);
      setShowJoinDialog(false);
      navigate(`/teacher/group-session/live/${session_id}`);
    } catch (err) {
      setJoinError(normalizeJoinError(err));
    } finally {
      setJoinBusy(false);
    }
  };

  const openScheduledSession = () => {
    setShowHostDialog(false);
    setHostError("");

    // Scheduled sessions need a subject_id for the create API.
    // That subject_id comes from the selected course dropdown.
    if (!selectedSubjectId) {
      setHostError(
        subjectGroups.length === 0
          ? "No course/subject found for this account. Check enrollment or the my-subjects API."
          : "Please select a course before scheduling a session."
      );
      setShowHostDialog(true);
      return;
    }

    setShowScheduleDialog(true);
  };

  const handleCreated = (created) => {
    setGroups((prev) => [created, ...prev.filter((g) => g.id !== created.id)]);
    loadGroups();
  };

  const handleUpdated = (fresh) => {
    if (fresh?.id) {
      setGroups((prev) => prev.map((g) => (g.id === fresh.id ? fresh : g)));
      setDetailsSession(fresh);
    }
    loadGroups();
  };

  return (
    <div className="ac-screen">
      {/* Head — the design pulls this tight against the tab bar (mb 4px). */}
      <div className="ac-head ac-head--tight">
        <div>
          <h1 className="ac-head__title">Group Sessions</h1>
          <p className="ac-head__sub">Study groups and doubt-clearing circles.</p>
        </div>
        <div className="ac-head__actions">
          <button
            type="button"
            className="ac-headBtn ac-headBtn--outline"
            onClick={() => { setJoinError(""); setShowJoinDialog(true); }}
          >
            Join session
          </button>
          <button
            type="button"
            className="ac-headBtn ac-headBtn--success"
            onClick={() => { setHostError(""); setShowHostDialog(true); }}
          >
            Host session
          </button>
        </div>
      </div>

      {/* Underline tab bar — same control as Private Sessions (dc.html line
          1330 shows a 2px-underline bar for this screen). */}
      <div className="ac-tabs ac-tabs--tight" role="tablist" aria-label="Session view">
        <button
          type="button"
          role="tab"
          aria-selected={sessTab === "upcoming"}
          className={`ac-tab${sessTab === "upcoming" ? " is-active" : ""}`}
          onClick={() => setSessTab("upcoming")}
        >
          Upcoming
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={sessTab === "past"}
          className={`ac-tab${sessTab === "past" ? " is-active" : ""}`}
          onClick={() => setSessTab("past")}
        >
          Past
        </button>
      </div>

      {sessTab === "upcoming" ? (
        <section className="ac-listCard">
          {loading ? (
            <LoadingState plain label="Loading group sessions" />
          ) : visibleGroups.length > 0 ? (
            <div className="ac-list">
              {visibleGroups.map((g) => (
                <GroupSessionCard key={g.id} group={g} onOpen={openCard} />
              ))}
            </div>
          ) : (
            <div className="ac-emptyRow">Nothing here yet</div>
          )}
        </section>
      ) : (
        <section className="ac-listCard">
          {pastLoading ? (
            <LoadingState plain label="Loading past sessions" />
          ) : visiblePastGroups.length > 0 ? (
            <div className="ac-list">
              {visiblePastGroups.map((g) => (
                <PastSessionCard key={g.id} group={g} onNotes={setNotesSession} />
              ))}
            </div>
          ) : (
            <div className="ac-emptyRow">Nothing here yet</div>
          )}
        </section>
      )}

      <JoinSessionDialog
        open={showJoinDialog}
        busy={joinBusy}
        error={joinError}
        onClose={() => { if (!joinBusy) { setShowJoinDialog(false); setJoinError(""); } }}
        onEnter={enterRoomByCode}
      />

      <HostSessionDialog
        open={showHostDialog}
        busy={hostBusy}
        error={hostError}
        onClose={() => { if (!hostBusy) { setShowHostDialog(false); setHostError(""); } }}
        onInstant={startInstantMeeting}
        onScheduled={openScheduledSession}
      />

      <NotesDialog
        key={notesSession?.id}
        session={notesSession}
        open={Boolean(notesSession)}
        onClose={() => setNotesSession(null)}
      />

      <ScheduleSessionModal
        mode="create"
        open={showScheduleDialog}
        selectedSubjectId={selectedSubjectId}
        currentUserId={user?.id}
        onClose={() => setShowScheduleDialog(false)}
        onCreated={handleCreated}
      />

      <SessionDetailsDialog
        open={Boolean(detailsSession)}
        session={detailsSession}
        user={user}
        onClose={() => setDetailsSession(null)}
        onEdit={() => {
          setEditingSession(detailsSession);
          setDetailsSession(null);
        }}
        onChanged={(fresh) => {
          if (fresh?.id) handleUpdated(fresh);
          else loadGroups();
        }}
        onJoinLive={(sessionId) => navigate(`/teacher/group-session/live/${sessionId}`)}
      />

      <ScheduleSessionModal
        mode="edit"
        open={Boolean(editingSession)}
        initialSession={editingSession}
        selectedSubjectId={editingSession?.subjectId || selectedSubjectId}
        currentUserId={user?.id}
        onClose={() => {
          if (editingSession) refreshOne(editingSession.id);
          setEditingSession(null);
        }}
        onUpdated={(fresh) => {
          setEditingSession(null);
          handleUpdated(fresh);
        }}
      />
    </div>
  );
}

