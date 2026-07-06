// PLACEMENT: src_teacher/src/api/expertService.js   (FULL REPLACEMENT)
//
// WHAT CHANGED vs the previous version
// ────────────────────────────────────
// The old service called four endpoints that don't exist on the backend
// (/skill/expert/applications/, .../applications/:id/, /skill/expert/courses/,
// /skill/expert/earnings/) and, on failure, silently returned HARDCODED MOCK
// DATA — so the Expert dashboard showed fake pending applications and fake
// earnings/payouts to real teachers.
//
// Now wired to the endpoints that actually exist in skills/urls.py:
//   applications  → GET  /skill/teacher/sessions/            (filter: requested)
//   accept        → POST /skill/teacher/sessions/:id/confirm/
//   decline       → POST /skill/teacher/sessions/:id/decline/
//   courses       → GET  /skill/teacher/courses/
//   earnings      → NO backend endpoint exists. Returns an explicit
//                   { available: null, supported: false } so the UI renders an
//                   honest "coming soon" state instead of fabricated numbers.
//
// Errors now REJECT (surface to the caller) instead of being swapped for
// mocks — a dashboard that fails loudly beats one that lies quietly.

import api from "./apiClient";

const expertService = {
  /** Pending 1-1 session requests for this expert.
   *  Returns { applications, live: true } — `live` kept for callers that
   *  previously distinguished mock vs real data. It is now always true. */
  async getApplications() {
    const res = await api.get("/skill/teacher/sessions/");
    const sessions = res.data?.results ?? res.data ?? [];
    const applications = sessions.filter((s) => s.status === "requested");
    return { applications, live: true };
  },

  /** Accept or decline a pending session request.
   *  action: "accept" | "decline" */
  async actOnApplication(sessionId, action) {
    const verb = action === "accept" ? "confirm" : "decline";
    const res = await api.post(`/skill/teacher/sessions/${sessionId}/${verb}/`);
    return res.data;
  },

  /** The expert's skill courses (drafts + published). */
  async getCourses() {
    const res = await api.get("/skill/teacher/courses/");
    return res.data?.results ?? res.data ?? [];
  },

  /** Earnings: no backend endpoint exists yet. Signal that honestly so the
   *  dashboard can show a "payouts coming soon" card instead of mock money.
   *  When the endpoint ships, replace the body with the real call. */
  async getEarnings() {
    return { supported: false, available: null, next_payout: null, payouts: [] };
  },

  /** All sessions (any status) — for the bookings list. */
  async getSessions() {
    const res = await api.get("/skill/teacher/sessions/");
    return res.data?.results ?? res.data ?? [];
  },
};

export default expertService;
