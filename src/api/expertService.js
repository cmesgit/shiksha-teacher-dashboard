/**
 * src/api/expertService.js
 * ─────────────────────────────────────────────────────────────────────────
 * Data layer for the GUEST EXPERT dashboard (Courses · Applications ·
 * Expert Profile · Earnings).
 *
 * This is the single API seam for the guest-expert experience, mirroring the
 * pattern in the design package's `skillApi.js`: every screen calls this
 * service, and the screens never change when the backend is wired.
 *
 * Each method attempts a real backend endpoint first and, if that endpoint
 * does not exist yet (404 / 405) or fails, falls back to a small illustrative
 * dataset so the dashboard is fully usable and demonstrable today. When the
 * Django routes below land, the dashboard switches to live data with NO
 * component changes.
 *
 * Suggested backend routes (align these with your DRF urls when ready):
 *   GET  /skill/expert/profile/        → expert's public profile
 *   GET  /skill/expert/courses/        → courses this expert created
 *   GET  /skill/expert/applications/   → pending enrolments / 1:1 requests
 *   POST /skill/expert/applications/:id/  { action: "accept" | "decline" }
 *   GET  /skill/expert/earnings/       → { available, next_payout, payouts[] }
 */
import api from "./apiClient";

/* Flip to true to force the fallback dataset (useful for design review). */
const FORCE_FALLBACK = false;

/* Treat only "endpoint isn't there yet" as a soft miss; surface real errors. */
const isMissing = (err) => {
  const s = err?.response?.status;
  return s === 404 || s === 405 || s === 501 || !err?.response;
};

async function withFallback(realCall, fallback) {
  if (FORCE_FALLBACK) return { data: fallback, live: false };
  try {
    const data = await realCall();
    return { data, live: true };
  } catch (err) {
    if (isMissing(err)) return { data: fallback, live: false };
    throw err;
  }
}

/* ── Fallback dataset (clearly illustrative; replaced by live data) ───────── */
const FALLBACK = {
  courses: [
    { id: "c1", title: "UX Research Fundamentals", students: 34, lessons: 8, status: "Published", price: 1499, revenue: 50966, category: "Design" },
    { id: "c2", title: "Figma from Zero to Hire",   students: 21, lessons: 12, status: "Published", price: 1999, revenue: 41979, category: "Design" },
    { id: "c3", title: "Design Systems Crash Course", students: 0, lessons: 6, status: "Draft",     price: 1299, revenue: 0,     category: "Design" },
  ],
  applications: [
    { id: "a1", name: "Zovi R.",   course: "UX Research Fundamentals",     when: "Sat 6 Jun · 10:00 AM", kind: "enroll" },
    { id: "a2", name: "Lala H.",   course: "1:1 Design critique session",  when: "Sun 7 Jun · 4:00 PM",  kind: "session", rate: 550 },
    { id: "a3", name: "Andrew K.", course: "Figma from Zero to Hire",      when: "Mon 8 Jun · 6:00 PM",  kind: "enroll" },
  ],
  earnings: {
    available: 4598,
    next_payout: "Mon 9 Jun",
    payouts: [
      { id: "p1", label: "UX Research Fundamentals · enrollment", amt: 1499, when: "Today" },
      { id: "p2", label: "Portfolio review · Andrew K.",          amt: 550,  when: "Yesterday" },
      { id: "p3", label: "Figma from Zero to Hire · enrollment",  amt: 1999, when: "2 Jun" },
      { id: "p4", label: "Design critique · Ruati",               amt: 550,  when: "31 May" },
    ],
  },
};

/* ── Profile ──────────────────────────────────────────────────────────────
   Pulled from the live /accounts/me/ response so the name, rate and bio are
   always the signed-in expert's own data. */
async function getProfile() {
  try {
    const me = (await api.get("/accounts/me/")).data;
    const teacher = me?.teacher || {};
    const display =
      me?.active_profile?.display_name ||
      me?.profile?.full_name ||
      me?.username ||
      "Your profile";
    return {
      name: display,
      title: teacher.type === "GUEST" ? "Guest expert" : "Expert teacher",
      bio: teacher.bio || "",
      rate: teacher.rate || null,
      rating: teacher.rating || null,
      sessions: teacher.sessions || 0,
      verified: !!teacher.is_approved,
      skills: Array.isArray(teacher.skills) ? teacher.skills : [],
      availability: teacher.availability || "Set your weekly availability so learners can book you.",
      tier: teacher.tier || "",
    };
  } catch {
    return {
      name: "Your profile", title: "Guest expert", bio: "", rate: null,
      rating: null, sessions: 0, verified: false, skills: [],
      availability: "Set your weekly availability so learners can book you.",
      tier: "",
    };
  }
}

const expertService = {
  getProfile,

  async getCourses() {
    const { data, live } = await withFallback(
      async () => (await api.get("/skill/expert/courses/")).data,
      FALLBACK.courses
    );
    return { courses: data, live };
  },

  async getApplications() {
    const { data, live } = await withFallback(
      async () => (await api.get("/skill/expert/applications/")).data,
      FALLBACK.applications
    );
    return { applications: data, live };
  },

  async getEarnings() {
    const { data, live } = await withFallback(
      async () => (await api.get("/skill/expert/earnings/")).data,
      FALLBACK.earnings
    );
    return { earnings: data, live };
  },

  /* Optimistic on the UI side; best-effort on the wire. */
  async respondToApplication(id, action) {
    try {
      await api.post(`/skill/expert/applications/${id}/`, { action });
      return true;
    } catch (err) {
      if (isMissing(err)) return true; // no endpoint yet — let the UI proceed
      throw err;
    }
  },
};

export default expertService;
