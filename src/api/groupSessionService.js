import api from "./apiClient";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function tryGet(candidates) {
  let lastErr = null;

  for (const url of candidates) {
    try {
      const res = await api.get(url);
      return res.data;
    } catch (err) {
      lastErr = err;
      const status = err?.response?.status;
      if (status && ![404, 405].includes(status)) throw err;
    }
  }

  throw lastErr || new Error("No matching endpoint found.");
}

const groupSessionService = {
  async getMySubjects() {
    const data = await tryGet([
      "/sessions/group-sessions/my-subjects/",
      "/sessions/my-subjects/",
      "/teacher/subjects/",
    ]);

    return data || [];
  },

  async getTeachers(subjectId, query = "") {
    const q = query ? `?q=${encodeURIComponent(query)}` : "";

    const data = await tryGet([
      `/sessions/subjects/${subjectId}/teachers/${q}`,
      `/sessions/group-sessions/subjects/${subjectId}/teachers/${q}`,
      `/teacher/subjects/${subjectId}/teachers/${q}`,
    ]);

    return data || [];
  },

  async createGroupSession(payload) {
    const cleanPayload = {
      subject_id: payload.subject_id,
      invited_teacher_id: payload.invited_teacher_id || null,
      invited_user_ids: Array.isArray(payload.invited_user_ids)
        ? payload.invited_user_ids.filter((id) => UUID_RE.test(String(id)))
        : [],
      scheduled_date: payload.scheduled_date,
      scheduled_time: payload.scheduled_time,
      duration_minutes: Number(payload.duration_minutes || 60),
      topic: payload.topic || "",
    };

    const res = await api.post(
      "/sessions/group-sessions/create/",
      cleanPayload
    );

    return transformGroupSession(res.data);
  },

  async cancelGroupSession(sessionId) {
    const res = await api.post(`/sessions/group-sessions/${sessionId}/cancel/`);
    return transformGroupSession(res.data);
  },

  async getMyGroupSessions(tab = "upcoming") {
    const res = await api.get(
      `/sessions/group-sessions/mine/?tab=${encodeURIComponent(tab)}`
    );
    return (res.data || []).map(transformGroupSession);
  },

  async getDetail(sessionId) {
    const res = await api.get(`/sessions/group-sessions/${sessionId}/`);
    return transformGroupSession(res.data);
  },

  async acceptInvite(sessionId) {
    const res = await api.post(`/sessions/group-sessions/${sessionId}/accept/`);
    return transformGroupSession(res.data);
  },

  async declineInvite(sessionId) {
    const res = await api.post(`/sessions/group-sessions/${sessionId}/decline/`);
    return transformGroupSession(res.data);
  },

  async unacceptInvite(sessionId) {
    const res = await api.post(`/sessions/group-sessions/${sessionId}/unaccept/`);
    return transformGroupSession(res.data);
  },

  async joinRoom(sessionId) {
    const res = await api.post(`/sessions/group-sessions/${sessionId}/join/`);
    return res.data;
  },

  async createInstant({ duration_minutes = 60, topic = "" } = {}) {
    const res = await api.post("/sessions/group-sessions/instant/", {
      duration_minutes,
      topic,
    });
    return transformGroupSession(res.data);
  },

  async joinByCode(code) {
    const res = await api.post("/sessions/group-sessions/join-by-code/", {
      code: (code || "").trim(),
    });
    return res.data;
  },

  async endSession(sessionId) {
    const res = await api.post(`/sessions/group-sessions/${sessionId}/end/`);
    return res.data;
  },

  async setAdmitMode(sessionId, mode) {
    const res = await api.post(
      `/sessions/group-sessions/${sessionId}/admit-mode/`,
      { admit_mode: mode }
    );
    return res.data;
  },

  async hideFromHistory(sessionId) {
    const res = await api.post(`/sessions/group-sessions/${sessionId}/hide/`);
    return res.data;
  },

  async clearHistory({ all = false, sessionIds = null } = {}) {
    const body = all ? { all: true } : { session_ids: sessionIds || [] };
    const res = await api.post(
      "/sessions/group-sessions/history/clear/",
      body
    );
    return res.data;
  },
};

function transformGroupSession(sg) {
  if (!sg) return sg;

  return {
    ...sg,
    id: sg.id,
    shortCode: sg.short_code || "",
    sessionType: sg.session_type || "scheduled",
    admitMode: sg.admit_mode || "open",

    subjectId: sg.subject_id || null,
    subjectName: sg.subject_name,
    courseId: sg.course_id || null,
    courseTitle: sg.course_title,

    topic: sg.topic,
    hostName: sg.host_name || "",
    hostId: sg.host_id,
    hostPhoto:
      sg.host_photo ||
      sg.host_profile_photo ||
      sg.host_avatar ||
      "",

    invitedTeacher: sg.invited_teacher_name || null,
    invitedTeacherId: sg.invited_teacher_id || null,

    date: sg.scheduled_date,
    time: sg.scheduled_time,
    durationMinutes: sg.duration_minutes,
    maxInvitees: sg.max_invitees,

    status: sg.status,
    cancelReason: sg.cancel_reason || "",
    roomStartedAt: sg.room_started_at,
    endedAt: sg.ended_at,

    invites: (sg.invites || []).map((inv) => ({
      id: inv.id,
      userId: inv.user_id,
      name: inv.name,
      studentId: inv.student_id,
      teacherId: inv.teacher_id || inv.employee_id || "",
      role: inv.invite_role,
      status: inv.status,
      declineCount: inv.decline_count || 0,
      reinvitedAt: inv.reinvited_at || null,
      joinedAt: inv.joined_at || null,
      respondedAt: inv.responded_at || null,
    })),

    acceptedCount: sg.accepted_count || 0,
    pendingCount: sg.pending_count || 0,
    declinedCount: sg.declined_count || 0,
  };
}

export function extractApiError(err, fallback = "Something went wrong.") {
  const data = err?.response?.data;

  if (!data) return fallback;

  if (typeof data === "string") {
    const lower = data.toLowerCase();

    if (
      lower.includes("<!doctype html") ||
      lower.includes("<html") ||
      lower.includes("server error") ||
      lower.includes("internal server error")
    ) {
      return fallback;
    }

    return data;
  }

  if (data.error) return data.error;
  if (data.detail) return data.detail;

  if (typeof data === "object") {
    const parts = [];

    for (const [key, value] of Object.entries(data)) {
      const text = Array.isArray(value) ? value.join(" ") : String(value);
      parts.push(key === "non_field_errors" ? text : `${key}: ${text}`);
    }

    if (parts.length) return parts.join(" • ");
  }

  return fallback;
}

export const {
  getMySubjects,
  getTeachers,
  createGroupSession,
  cancelGroupSession,
  getMyGroupSessions,
  getDetail,
  acceptInvite,
  declineInvite,
  unacceptInvite,
  joinRoom,
  createInstant,
  joinByCode,
  endSession,
  setAdmitMode,
  hideFromHistory,
  clearHistory,
} = groupSessionService;

export default groupSessionService;