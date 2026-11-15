/**
 * ProtectedCounsellorRoute  ·  the gate for /teacher/counsellor/*
 * ───────────────────────────────────────────────────────────────
 * Why this exists instead of ProtectedTeacherRoute:
 *
 * The counsellor console lives inside the teacher app, so it inherited
 * ProtectedTeacherRoute — which admits only a TEACHER-context token. That
 * token is UNMINTABLE for someone who is purely a counsellor:
 * TeacherContextView returns 409 `no_teacher` with no TeacherProfile, then
 * 403 `not_approved` without both approved_tracks() AND the TEACHER role
 * (shiksha-backend/accounts/auth_flow.py). So an approved counsellor who
 * does not also teach could never open the console that is built for them.
 *
 * Nothing on the server required that. Every console endpoint is behind
 * IsApprovedCounselor (counseling/views.py) — authenticated plus an APPROVED
 * CounselorProfile, with no role check and no context claim. The API has
 * always been willing; only this wrapper said no.
 *
 * What this gate does NOT do: decide whether the counsellor is approved.
 * It admits on the COUNSELOR role alone and lets CounselorLayout fetch the
 * profile and render the apply / pending / rejected / suspended screens, the
 * same way TrackSwitcher already gates its Counselling pill on the role.
 * Approval is the server's answer to give, not this component's to guess —
 * and a role without an approved profile simply lands on the apply form.
 *
 * Teacher context still passes, unchanged and first, so every existing
 * counsellor-who-also-teaches keeps byte-for-byte today's path.
 */
import { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { LOGIN_URL, PICK_PROFILE_URL } from "../config/urls";
import { Centered } from "./ProtectedTeacherRoute";

export default function ProtectedCounsellorRoute({ children }) {
  const { isAuthenticated, isTeacherContext, loading, context, hasRole } = useAuth();

  // hasRole reads user.roles, which /accounts/me/ returns regardless of which
  // context the token carries — so this is true for a counsellor sitting in
  // learner context, which is exactly the case this gate exists to admit.
  const allowed = isTeacherContext || hasRole("COUNSELOR");

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      window.location.href = LOGIN_URL;
      return;
    }
    if (!allowed) {
      // Neither a teacher nor a counsellor. The picker is the honest
      // destination: it shows what this account CAN open.
      window.location.href = PICK_PROFILE_URL;
    }
  }, [loading, isAuthenticated, allowed, context]);

  if (loading) return <Centered>Loading your console…</Centered>;
  if (!isAuthenticated) return <Centered>Redirecting to sign in…</Centered>;
  if (!allowed) return <Centered>Taking you to the profile picker…</Centered>;
  return children;
}
