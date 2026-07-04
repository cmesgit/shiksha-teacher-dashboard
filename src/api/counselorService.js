// PLACEMENT: src/api/counselorService.js   (NEW FILE — teacher dashboard app)
//
// Counselor-console slice of the counseling API (/api/counseling/).
// Everything here requires an APPROVED CounselorProfile except apply/me.

import api from "../shared/apiClient";

// onboarding / profile
export async function applyCounselor(payload) {
  return (await api.post("/counseling/counselor/apply/", payload)).data;
}
export async function getMe() {
  return (await api.get("/counseling/counselor/me/")).data; // 404 = no profile yet
}
export async function updateMe(payload) {
  return (await api.put("/counseling/counselor/me/", payload)).data;
}
export async function getSpecializations() {
  return (await api.get("/counseling/specializations/")).data;
}

// availability
export async function getAvailability() {
  return (await api.get("/counseling/counselor/availability/")).data;
}
export async function addAvailability(slot) {
  // {weekday: 0-6, start_time: "09:00", end_time: "12:00"}
  return (await api.post("/counseling/counselor/availability/", slot)).data;
}
export async function deleteAvailability(id) {
  return (await api.delete(`/counseling/counselor/availability/${id}/`)).data;
}

// sessions
export async function getAppointments(params = {}) {
  return (await api.get("/counseling/counselor/appointments/", { params })).data;
}
export async function getStudentFile(appointmentId) {
  return (await api.get(`/counseling/counselor/appointments/${appointmentId}/student/`)).data;
}
export async function setMeetingLink(appointmentId, meeting_link) {
  return (await api.post(`/counseling/counselor/appointments/${appointmentId}/meeting-link/`, { meeting_link })).data;
}
export async function completeAppointment(appointmentId, noShow = false) {
  return (await api.post(`/counseling/counselor/appointments/${appointmentId}/complete/`, { no_show: noShow })).data;
}
export async function cancelAppointment(appointmentId, reason = "") {
  return (await api.post(`/counseling/appointments/${appointmentId}/cancel/`, { reason })).data;
}

// notes & report
export async function getNotes(appointmentId) {
  return (await api.get(`/counseling/counselor/appointments/${appointmentId}/notes/`)).data;
}
export async function addNote(appointmentId, content) {
  return (await api.post(`/counseling/counselor/appointments/${appointmentId}/notes/`, { content })).data;
}
export async function getReport(appointmentId) {
  return (await api.get(`/counseling/counselor/appointments/${appointmentId}/report/`)).data; // 404 = none yet
}
export async function saveReport(appointmentId, payload, publish = false) {
  return (await api.put(`/counseling/counselor/appointments/${appointmentId}/report/`,
    publish ? { ...payload, publish: true } : payload)).data;
}
