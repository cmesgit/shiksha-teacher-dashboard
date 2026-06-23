/**
 * FILE: TEACHER_UI/src/pages/GroupSessions.jsx
 *
 * Teacher Figma-style Group Sessions page.
 * Flow included:
 *   - Main Group Sessions cards page
 *   - Join Session dialog
 *   - Host Session dialog
 *   - Scheduled Session create dialog: Details → Participants → Summary
 *   - Scheduled Session details dialog for Host / Participant
 *   - Edit Session dialog for Host: Details → Participants → Summary
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/apiClient";
import groupSessionService, { extractApiError } from "../api/groupSessionService";
import "../styles/teacherGroupSessions.css";

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

function getUserInitial(user) {
  return (
    user?.full_name ||
    user?.name ||
    user?.username ||
    user?.email ||
    "U"
  ).charAt(0).toUpperCase();
}

function getHostPhoto(group) {
  return (
    group?.hostPhoto ||
    group?.host_photo ||
    group?.host_profile_photo ||
    group?.hostAvatar ||
    group?.host_avatar ||
    ""
  );
}

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
  // Your service file currently has create/cancel/decline/join APIs, but no
  // update API. This helper tries the common backend routes. If your backend
  // uses a different route, add it in groupSessionService.js later.
  const candidates = [
    { method: "patch", url: `/sessions/group-sessions/${sessionId}/` },
    { method: "patch", url: `/sessions/group-sessions/${sessionId}/update/` },
    { method: "post", url: `/sessions/group-sessions/${sessionId}/update/` },
  ];

  let lastErr = null;
  for (const c of candidates) {
    try {
      const res = await api[c.method](c.url, payload);
      if (res?.data) return res.data;
    } catch (err) {
      lastErr = err;
      const status = err?.response?.status;
      if (status && ![404, 405].includes(status)) throw err;
    }
  }
  throw lastErr || new Error("Update endpoint not available.");
}

const DURATIONS = [
  { label: "30 minutes", value: 30 },
  { label: "60 minutes", value: 60 },
  { label: "90 minutes", value: 90 },
];

const MAX_PARTICIPANTS = 10;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ═══════════════════════════════════════════════════════════
   SESSION CARD
═══════════════════════════════════════════════════════════ */
function GroupSessionCard({ group, onOpen }) {
  const status = isEndedNow(group) ? "completed" : (group.status || "scheduled");
  const isLive = status === "live";
  const isScheduled = status === "scheduled";
  const hostPhoto = getHostPhoto(group);
  const startedAt = group.roomStartedAt ? new Date(group.roomStartedAt) : null;
  const startTime = startedAt && !Number.isNaN(startedAt.getTime())
    ? startedAt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
    : formatTime(group.time);
  const participantCount = Math.max(1, 1 + Number(group.acceptedCount || 0));

  return (
    <button
      type="button"
      className={`sg__sessionCard sg__sessionCard--${status}`}
      onClick={() => onOpen(group)}
    >
      <div className="sg__sessionCardTop">
        <div className="sg__sessionHostBlock">
          <span className="sg__sessionAvatar">
            {hostPhoto ? (
              <img src={hostPhoto} alt={group.hostName || "Host"} />
            ) : (
              <span>{(group.hostName || "H").charAt(0).toUpperCase()}</span>
            )}
          </span>

          <div className="sg__sessionHostText">
            <span className="sg__sessionHostName">{group.hostName || "Host Name"}</span>
            <span className="sg__sessionTitle">{group.topic || "Title (Only If Entered)"}</span>
          </div>
        </div>

        <span className={`sg__figmaStatus sg__figmaStatus--${status}`}>
          {isLive ? "LIVE" : isScheduled ? "Scheduled" : statusLabel(status)}
        </span>
      </div>

      <div className="sg__sessionCardBottom">
        {isLive ? (
          <>
            <span><strong>Duration</strong> {group.durationMinutes ? `${group.durationMinutes} min` : "—"}</span>
            <span><strong>Start Time</strong> {startTime}</span>
            <span><strong>Participants</strong> {participantCount}</span>
          </>
        ) : (
          <>
            <span><strong>Date</strong> {formatDate(group.date)}</span>
            <span><strong>Session Timing</strong> {formatTiming(group.time, group.durationMinutes)}</span>
          </>
        )}
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════
   PARTICIPANT SEARCH
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
        <div style={styles.searchDrop}>
          {loading && <div style={styles.searchRowMuted}>Searching…</div>}
          {!loading && results.length === 0 && (
            <div style={styles.searchRowMuted}>
              {query ? "No teacher found for this subject" : "Start typing to search same-subject teachers"}
            </div>
          )}
          {!loading && results.slice(0, 8).map((t) => {
            const tid = String(t.user_id || t.userId || t.id || "");
            return (
              <button
                key={tid}
                type="button"
                style={styles.searchRow}
                onMouseDown={(e) => { e.preventDefault(); choose(t); }}
              >
                <span style={styles.searchAvatar}>{(t.name || t.full_name || "?").charAt(0).toUpperCase()}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong style={styles.searchName}>{t.name || t.full_name || "Teacher"}</strong>
                  <small style={styles.searchSub}>{t.phone || t.teacher_id || t.employee_id || shortId(tid)}</small>
                </span>
                <span style={styles.searchAdd}>Add</span>
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
      <div style={styles.teacherSearchLine}>
        <ParticipantSearch
          subjectId={subjectId}
          selected={participants}
          onAdd={addParticipant}
          disabled={disabled || participants.length >= MAX_PARTICIPANTS}
          currentUserId={currentUserId}
        />
      </div>

      <div style={styles.participantListBox}>
        {participants.length === 0 ? (
          <div style={styles.noParticipants}>No teachers added yet.</div>
        ) : (
          participants.map((p, index) => (
            <div key={p.user_id || p.userId || index} style={styles.participantEditRow}>
              <span style={styles.participantIndex}>{index + 1}.</span>
              <span style={styles.participantNameBox}>
                {p.name || "Teacher"}
                {(p.teacher_id || p.teacherId || p.teacher_id || p.teacherId) ? ` (${p.teacher_id || p.teacherId || p.teacher_id || p.teacherId})` : ""}
              </span>
              <button
                type="button"
                style={styles.removeBtn}
                onClick={() => removeParticipant(p.user_id || p.userId)}
              >
                x
              </button>
            </div>
          ))
        )}
      </div>

      <div style={styles.participantCount}>Participants: {participants.length}/{MAX_PARTICIPANTS}</div>
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
      <div style={styles.figmaDialog} onClick={(e) => e.stopPropagation()}>
        <h3 style={styles.dialogTitle}>{title}</h3>

        <StepHeader step={step} />
        {error && <div className="sg__errorBox">{error}</div>}

        {step === 1 && (
          <div style={styles.formArea}>
            <div style={styles.inlineField}>
              <label style={styles.compactLabel}>Select Date:</label>
              <input
                type="date"
                className="sg__input"
                style={styles.dateInput}
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

            <div style={styles.inlineField}>
              <label style={styles.compactLabel}>Start Time:</label>
              <input
                type="time"
                className="sg__input"
                style={styles.timeInput}
                value={time}
                min={date === getLocalDateValue() ? minTimeToday : undefined}
                onChange={(e) => {
                  setTime(e.target.value);
                  if (error && error.toLowerCase().includes("past")) setError("");
                }}
              />
              {time && duration ? (
                <span style={styles.endTimeHint}>End: {formatTime(endTime)}</span>
              ) : null}
            </div>
            {schedulePast && (
              <p className="sg__hint" style={{ color: "#b91c1c", marginTop: 6 }}>
                Please select a future start time. Current or past time cannot be scheduled.
              </p>
            )}

            <label style={styles.compactLabel}>Select Duration:</label>
            <div style={styles.durationRow}>
              {DURATIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  style={duration === d.value ? styles.durationBtnActive : styles.durationBtn}
                  onClick={() => setDuration(d.value)}
                >
                  {d.label}
                </button>
              ))}
            </div>

            <label style={styles.compactLabel}>Topic (optional):</label>
            <input
              className="sg__input"
              style={styles.topicInput}
              value={topic}
              maxLength={255}
              placeholder='Discussion on "What comes first ?"'
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>
        )}

        {step === 2 && (
          <div style={styles.formArea}>
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

        <div style={styles.dialogFoot}>
          {step === 1 ? (
            <button type="button" style={styles.tealGhostBtn} disabled={saving} onClick={onClose}>
              Cancel
            </button>
          ) : (
            <button type="button" style={styles.tealGhostBtn} disabled={saving} onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}

          {step < 3 ? (
            <button
              type="button"
              style={styles.tealBtn}
              disabled={saving || (step === 1 && !canStep1) || (step === 2 && !canStep2)}
              onClick={() => setStep(step + 1)}
            >
              Continue
            </button>
          ) : (
            <button type="button" style={styles.tealBtn} disabled={saving} onClick={submit}>
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
    <div style={styles.stepWrap}>
      {items.map((name, index) => {
        const n = index + 1;
        const active = step >= n;
        return (
          <div key={name} style={styles.stepItem}>
            <span style={active ? styles.stepCircleActive : styles.stepCircle}>{n}</span>
            <span style={active ? styles.stepTextActive : styles.stepText}>{name}</span>
            {index < items.length - 1 && <span style={styles.stepLine} />}
          </div>
        );
      })}
    </div>
  );
}

function SummaryStep({ date, time, duration, topic, participants }) {
  return (
    <div style={styles.summaryBox}>
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
    <div style={styles.summaryRow}>
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
      <div style={styles.detailsDialog} onClick={(e) => e.stopPropagation()}>
        <h3 style={styles.dialogTitle}>Session Details</h3>
        {error && <div className="sg__errorBox">{error}</div>}

        <div style={styles.detailsGrid}>
          <SummaryRow label="Date:" value={formatDateLong(session.date)} />
          <SummaryRow label="Timing:" value={formatTiming(session.time, session.durationMinutes)} />
          <SummaryRow label="Duration:" value={`${session.durationMinutes || "—"} minutes`} />
          <SummaryRow label="Participants:" value={`${participants.length} people`} />
        </div>

        <div style={styles.detailsParticipantsBox}>
          {participants.map((p, index) => (
            <div key={p.id || index} style={styles.detailsParticipantRow}>
              <span style={styles.participantIndex}>{index + 1}.</span>
              <span style={{ flex: 1 }}>
                {p.name || "Participant"}
                {p.teacherId ? ` (${shortId(p.teacherId)})` : ""}
              </span>
              {p.isHost && <span style={styles.hostLabel}>HOST</span>}
              {!p.isHost && p.status === "declined" && <span style={styles.declinedLabel}>DECLINED</span>}
            </div>
          ))}
        </div>

        <div style={styles.detailsTopic}>
          <strong>Topic:</strong>
          <span>{session.topic || "—"}</span>
        </div>

        <div style={styles.dialogFoot}>
          <button type="button" style={styles.tealGhostBtn} disabled={busy} onClick={onClose}>
            Back
          </button>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {isHost && isScheduled && (
              <button type="button" style={styles.cancelTextBtn} disabled={busy} onClick={cancelSession}>
                Cancel Session
              </button>
            )}

            {isHost && isScheduled && (
              <button
                type="button"
                style={editUsed ? styles.tealBtnMuted : styles.tealBtn}
                disabled={busy || editUsed}
                title={editUsed ? "Can be edited only once" : "Edit session details"}
                onClick={onEdit}
              >
                Edit
              </button>
            )}

            {isHost && isScheduled && (
              <button type="button" style={styles.tealBtn} disabled={busy} onClick={startSession}>
                Start Session
              </button>
            )}

            {!isHost && isScheduled && (
              <button type="button" style={styles.cancelTextBtn} disabled={busy} onClick={decline}>
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
      <div style={styles.joinDialog} onClick={(e) => e.stopPropagation()}>
        <h3 style={styles.dialogTitle}>Join Session</h3>

        <label style={{ ...styles.compactLabel, textAlign: "center" }}>Enter Session ID:</label>
        <input
          className="sg__input"
          style={styles.joinInput}
          value={code}
          autoFocus
          placeholder="SHR7J2"
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && code.trim() && !busy) onEnter(code.trim());
          }}
        />

        {error && <div style={styles.joinError}>Error:<br />{error}</div>}

        <div style={styles.dialogFootCenter}>
          <button type="button" style={styles.tealGhostBtn} disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            style={styles.tealBtn}
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
          ✕
        </button>

        <h3 className="sg__modalTitle">Host Session</h3>
        <p className="sg__hint sg__modalHint">Choose how you want to host your group session.</p>
        {error && <div className="sg__errorBox">{error}</div>}

        <div className="sg__hostChoiceList">
          <button type="button" className="sg__hostChoice" disabled={busy} onClick={onInstant}>
            <strong>Instant Session</strong>
            <span>Go LIVE directly and share the session ID with teachers.</span>
          </button>

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

  const [joinBusy, setJoinBusy] = useState(false);
  const [hostBusy, setHostBusy] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [hostError, setHostError] = useState("");

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

  const visibleGroups = useMemo(() => {
    const active = groups
      .filter((g) => !isEndedNow(g))
      .filter((g) => {
        if (!selectedCourseId) return true;
        if (!g.courseId && !g.courseTitle) return true;
        return String(g.courseId) === String(selectedCourseId) ||
               String(g.courseTitle) === String(selectedCourse?.course_label);
      });

    return active.sort((a, b) => {
      const order = { live: 0, scheduled: 1, completed: 2, cancelled: 3, expired: 4 };
      const aOrder = order[a.status] ?? 9;
      const bOrder = order[b.status] ?? 9;
      if (aOrder !== bOrder) return aOrder - bOrder;

      const aTime = new Date(`${a.date || "9999-12-31"}T${a.time || "23:59"}`).getTime();
      const bTime = new Date(`${b.date || "9999-12-31"}T${b.time || "23:59"}`).getTime();
      return (Number.isNaN(aTime) ? Infinity : aTime) - (Number.isNaN(bTime) ? Infinity : bTime);
    });
  }, [groups, selectedCourseId, selectedCourse, _tick]);

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

  const startInstantMeeting = async () => {
    setHostBusy(true);
    setHostError("");
    try {
      // Use 60 minutes instead of the old service default of 180.
      // Many backends only allow 30/60/90 or 30/45/60 minute choices.
      const sg = await groupSessionService.createInstant({
        duration_minutes: 60,
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

  const userInitial = getUserInitial(user);

  return (
    <div className="sg__page sg__page--figma">

      <div className="sg__figmaPanel">
        <div className="sg__figmaPanelHeader">
          <h2>Group Sessions</h2>
          <div className="sg__figmaActions">
            <button
              type="button"
              className="sg__figmaActionBtn"
              onClick={() => { setJoinError(""); setShowJoinDialog(true); }}
            >
              Join Session
            </button>
            <button
              type="button"
              className="sg__figmaActionBtn"
              onClick={() => { setHostError(""); setShowHostDialog(true); }}
            >
              Host Session
            </button>
          </div>
        </div>

        {loading ? (
          <div className="sg__loading sg__loading--figma">Loading group sessions…</div>
        ) : visibleGroups.length > 0 ? (
          <div className="sg__figmaGrid">
            {visibleGroups.map((g) => (
              <GroupSessionCard key={g.id} group={g} onOpen={openCard} />
            ))}
          </div>
        ) : null}
      </div>

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

/* ═══════════════════════════════════════════════════════════
   INLINE STYLES FOR FIGMA DIALOGS
   These avoid requiring another CSS paste for the modal layout.
═══════════════════════════════════════════════════════════ */
const styles = {
  figmaDialog: {
    width: "min(92vw, 430px)",
    background: "#eef7fb",
    borderRadius: 10,
    padding: "24px 28px 20px",
    boxShadow: "0 20px 60px rgba(15,23,42,0.28)",
    boxSizing: "border-box",
  },
  detailsDialog: {
    width: "min(92vw, 430px)",
    background: "#eef7fb",
    borderRadius: 10,
    padding: "24px 28px 20px",
    boxShadow: "0 20px 60px rgba(15,23,42,0.28)",
    boxSizing: "border-box",
  },
  joinDialog: {
    width: "min(92vw, 250px)",
    background: "#eef7fb",
    borderRadius: 10,
    padding: "24px 22px 18px",
    boxShadow: "0 20px 60px rgba(15,23,42,0.28)",
    boxSizing: "border-box",
    textAlign: "center",
  },
  dialogTitle: {
    margin: "0 0 18px",
    textAlign: "center",
    color: "#0f172a",
    fontSize: 16,
    fontWeight: 800,
  },
  stepWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
    marginBottom: 20,
  },
  stepItem: {
    display: "flex",
    alignItems: "center",
    gap: 5,
  },
  stepCircle: {
    width: 18,
    height: 18,
    borderRadius: "50%",
    border: "1px solid #a8b8c0",
    color: "#94a3b8",
    background: "#fff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: 800,
  },
  stepCircleActive: {
    width: 18,
    height: 18,
    borderRadius: "50%",
    border: "1px solid #007181",
    color: "#fff",
    background: "#007181",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: 800,
  },
  stepText: {
    fontSize: 11,
    fontWeight: 600,
    color: "#94a3b8",
  },
  stepTextActive: {
    fontSize: 11,
    fontWeight: 700,
    color: "#007181",
  },
  stepLine: {
    width: 38,
    height: 1,
    background: "#99aab3",
    display: "inline-block",
    margin: "0 7px",
  },
  formArea: {
    padding: "0 4px",
  },
  inlineField: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  compactLabel: {
    fontSize: 12,
    color: "#0f172a",
    fontWeight: 700,
    marginBottom: 6,
    display: "block",
  },
  dateInput: {
    width: 160,
    height: 28,
    padding: "3px 8px",
    fontSize: 12,
  },
  timeInput: {
    width: 100,
    height: 28,
    padding: "3px 8px",
    fontSize: 12,
  },
  endTimeHint: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: 700,
  },
  durationRow: {
    display: "flex",
    gap: 18,
    margin: "8px 0 14px",
    flexWrap: "wrap",
  },
  durationBtn: {
    border: "none",
    background: "#2d83a0",
    color: "#fff",
    borderRadius: 5,
    padding: "7px 14px",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
  },
  durationBtnActive: {
    border: "none",
    background: "#007181",
    color: "#fff",
    borderRadius: 5,
    padding: "7px 14px",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 0 0 2px rgba(0,113,129,0.22)",
  },
  topicInput: {
    height: 30,
    fontSize: 12,
  },
  dialogFoot: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginTop: 18,
  },
  dialogFootCenter: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    marginTop: 18,
  },
  tealBtn: {
    border: "none",
    background: "#008a99",
    color: "#fff",
    borderRadius: 5,
    padding: "8px 16px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  tealBtnMuted: {
    border: "none",
    background: "#94a3b8",
    color: "#fff",
    borderRadius: 5,
    padding: "8px 16px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "not-allowed",
    opacity: 0.75,
  },
  tealGhostBtn: {
    border: "none",
    background: "#008a99",
    color: "#fff",
    borderRadius: 5,
    padding: "8px 16px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  cancelTextBtn: {
    border: "1px solid #fecaca",
    background: "#fff",
    color: "#dc2626",
    borderRadius: 5,
    padding: "7px 12px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  teacherSearchLine: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  participantListBox: {
    maxHeight: 165,
    overflowY: "auto",
    paddingRight: 6,
    marginTop: 10,
  },
  participantEditRow: {
    display: "grid",
    gridTemplateColumns: "24px 1fr 26px",
    alignItems: "center",
    gap: 6,
    marginBottom: 7,
    fontSize: 12,
  },
  participantIndex: {
    color: "#0f172a",
    fontWeight: 700,
    fontSize: 12,
  },
  participantNameBox: {
    background: "#fff",
    border: "1px solid #9fb5bd",
    borderRadius: 4,
    padding: "5px 8px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  removeBtn: {
    border: "none",
    background: "#2d83a0",
    color: "#fff",
    borderRadius: 4,
    height: 24,
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  participantCount: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: 700,
    color: "#0f172a",
    marginTop: 10,
  },
  noParticipants: {
    textAlign: "center",
    color: "#64748b",
    fontSize: 12,
    padding: "18px 0",
  },
  searchDrop: {
    position: "absolute",
    top: "calc(100% + 4px)",
    left: 0,
    right: 0,
    background: "#fff",
    border: "1px solid #dbe7eb",
    borderRadius: 8,
    boxShadow: "0 10px 24px rgba(15,23,42,0.16)",
    zIndex: 20,
    maxHeight: 220,
    overflowY: "auto",
  },
  searchRow: {
    width: "100%",
    border: "none",
    background: "#fff",
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    cursor: "pointer",
    textAlign: "left",
  },
  searchRowMuted: {
    padding: "10px 12px",
    color: "#94a3b8",
    fontSize: 12,
    textAlign: "left",
  },
  searchAvatar: {
    width: 26,
    height: 26,
    borderRadius: "50%",
    background: "#008a99",
    color: "#fff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 800,
  },
  searchName: {
    display: "block",
    fontSize: 12,
    color: "#0f172a",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  searchSub: {
    display: "block",
    color: "#64748b",
    fontSize: 10,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  searchAdd: {
    color: "#008a99",
    fontWeight: 800,
    fontSize: 11,
  },
  summaryBox: {
    marginTop: 10,
    padding: "10px 4px",
  },
  summaryRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 18,
    fontSize: 12,
    marginBottom: 9,
    color: "#0f172a",
  },
  detailsGrid: {
    padding: "4px 0 6px",
  },
  detailsParticipantsBox: {
    maxHeight: 165,
    overflowY: "auto",
    paddingRight: 6,
    margin: "8px 0 12px",
  },
  detailsParticipantRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    color: "#0f172a",
    padding: "4px 0",
  },
  hostLabel: {
    background: "#2d83a0",
    color: "#fff",
    borderRadius: 4,
    padding: "3px 8px",
    fontSize: 10,
    fontWeight: 800,
  },
  declinedLabel: {
    background: "#fee2e2",
    color: "#b91c1c",
    borderRadius: 4,
    padding: "3px 8px",
    fontSize: 10,
    fontWeight: 800,
  },
  detailsTopic: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    fontSize: 12,
    color: "#0f172a",
    marginTop: 8,
  },
  joinInput: {
    width: 100,
    height: 28,
    padding: "3px 8px",
    fontSize: 12,
    textAlign: "center",
    margin: "0 auto",
  },
  joinError: {
    color: "#dc2626",
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1.45,
    marginTop: 12,
    textAlign: "center",
  },
};
