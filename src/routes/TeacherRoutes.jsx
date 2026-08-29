/**
 * PLACEMENT: src/routes/TeacherRoutes.jsx
 * ACTION:    Replace the entire file.
 *
 * Change from original:
 *   Added import for SkillInbox and added route:
 *     <Route path="inbox" element={<SkillInbox />} />
 *   inside the /teacher/expert SkillDevLayout block.
 *   This makes it accessible at /teacher/expert/inbox — the path that
 *   ExpertBookings.openChat() and the SkillDevLayout Messages nav both point to.
 */
import { Routes, Route, Navigate, Outlet, useParams } from "react-router-dom";
import { useEffect } from "react";

import { useAuth } from "../contexts/AuthContext";
import PrivateSessionLive from "../pages/PrivateSessionLive";
import TeacherLayout from "../layout/TeacherLayout";
import SkillDevLayout from "../layout/SkillDevLayout";
import TeacherDashboard from "../pages/TeacherDashboard";
import ClassesList from "../pages/ClassesList";
import Classes from "../pages/Classes";
import TeacherLiveSession from "../pages/TeacherLiveSession";
import Assignments from "../pages/Assignments";
import CreateAssignment from "../pages/CreateAssignment";
import AssignmentView from "../pages/AssignmentView";
import SubmissionView from "../pages/SubmissionView";
import Quizzes from "../pages/Quizzes";
import QuizBuilder from "../pages/QuizBuilder";
import QuizAnalytics from "../pages/QuizAnalytics";
import QuizBank from "../pages/QuizBank";
import BankStatus from "../pages/BankStatus";
import QuizView from "../pages/QuizView";
import QuizDraftPreview from "../pages/QuizDraftPreview";
import QuizSubmissionView from "../pages/QuizSubmissionView";
import QuizReviewView from "../pages/QuizReviewView";
import StudyMaterials from "../pages/StudyMaterials";
import UploadMaterial from "../pages/UploadMaterial";
import StudyMaterialView from "../pages/StudyMaterialView";
import SessionRecordings from "../pages/SessionRecordings";
import UploadRecording from "../pages/UploadRecording";
import RecordingPlayer from "../pages/RecordingPlayer";
import LiveSessions from "../pages/LiveSessions";
import LiveSessionDetail from "../pages/LiveSessionDetail";
import FacultyProfile from "../pages/FacultyProfile";
import StudentsList from "../pages/StudentsList";
import StudentDetail from "../pages/StudentDetail";
import AllStudents from "../pages/AllStudents";
import AllStudentDetail from "../pages/AllStudentDetail";
import ProtectedTeacherRoute from "./ProtectedTeacherRoute";
import RequireTrack from "./RequireTrack";
import QuizStudentAttemptsView from "../pages/QuizStudentAttemptsView";
import PrivateSessionsDashboard from "../pages/PrivateSessionsDashboard";
import PrivateSessionAvailability from "../pages/PrivateSessionAvailability";
import PrivateSessionDetail from "../pages/PrivateSessionDetail";
import ChangePassword from "../pages/ChangePassword";
import Chat from "../pages/Chat";
import TeacherPasswordSettings from "../pages/TeacherPasswordSettings";
import GroupSessions from "../pages/GroupSessions";
import GroupSessionLive from "../pages/GroupSessionLive";
import BatchProgress from "../pages/BatchProgress";
import BatchProgressDetail from "../pages/BatchProgressDetail";

// Skill Dev (Expert) pages
import ExpertDashboard from "../pages/skill/ExpertDashboard";
import ExpertSkills from "../pages/skill/ExpertSkills";       // "My skills" — one row per SkillListing
import SkillListingForm from "../pages/skill/SkillListingForm"; // add / edit one skill
import ExpertBookings from "../pages/skill/ExpertBookings";
import ExpertStudents from "../pages/skill/ExpertStudents";
import ExpertAvailability from "../pages/skill/ExpertAvailability";
// Earnings removed — guest experts settle payment directly with learners.
import ExpertPromote from "../pages/skill/ExpertPromote";       // subscription
import ExpertProfileEdit from "../pages/skill/ExpertProfileEdit"; // profile + location + UPI
import SkillInbox from "../pages/SkillInbox";
import SkillSessionLive from "../pages/skill/SkillSessionLive"; // skill LiveKit room

// Counselling (career counsellor console) — third track, gated on the
// COUNSELOR role. CounselorLayout is its own onboarding gate: teachers
// without an approved counsellor profile see the apply form / status
// screen instead of these child routes' content.
import CounselorLayout from "../layout/CounselorLayout";
import CounselorSchedule from "../pages/counsellor/CounselorSchedule";
import CounselorSession from "../pages/counsellor/CounselorSession";
import CounselorAvailability from "../pages/counsellor/CounselorAvailability";
import CounselorProfile from "../pages/counsellor/CounselorProfile";

import { LOGIN_URL } from "../config/urls";

function RedirectToMainLogin() {
  useEffect(() => { window.location.href = LOGIN_URL; }, []);
  return null;
}

// A single quiz's own child screens (view/draft/submissions/student-attempts/
// review) used to be reachable ONLY via classes/:subjectId/quizzes/:quizId/...
// — a relic of the pre-flattening nav, kept only because none of those
// screens actually need subjectId for anything (their own API calls are
// keyed on quizId/studentId/attemptId alone; subjectId was only ever there to
// satisfy the URL shape). They now live under the same /teacher/quizzes root
// as the list. The old paths still resolve — via a plain redirect — so any
// existing bookmark or notification link built on the old shape keeps working.
function LegacyQuizRedirect({ to }) {
  const params = useParams();
  const path = to.replace(/:(\w+)/g, (_, key) => params[key]);
  return <Navigate to={path} replace />;
}

function DashboardEntry() {
  const { teacherInfo } = useAuth();
  const academy = teacherInfo?.tracks?.academy ?? "locked";
  const skill = teacherInfo?.tracks?.skill ?? "locked";

  // Route on real approval, not the legacy `type` field. `type` (GUEST /
  // FACULTY / BOTH) is a display label that sync_type_from_tracks() counts as
  // "on" while a track is merely PENDING, and it isn't updated when a track is
  // revoked — so a BOTH teacher who lost academy approval still landed here.
  if (teacherInfo?.active_track === "skill" && skill === "approved") {
    return <Navigate to="/teacher/expert" replace />;
  }
  if (academy !== "approved" && skill === "approved") {
    return <Navigate to="/teacher/expert" replace />;
  }
  // This route now sits outside the pathless academy RequireTrack (so the
  // redirects above can actually run), which means the academy gate has to
  // be applied here instead — otherwise an unapproved teacher would reach
  // the real dashboard.
  return (
    <RequireTrack track="academy">
      <TeacherDashboard />
    </RequireTrack>
  );
}

export default function TeacherRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RedirectToMainLogin />} />

      {/* Fullscreen live routes.
          TRACK-GATED. These were the only routes in the app with no
          RequireTrack, so a skill-only expert could open an Academy live
          room and an academy-only teacher could open the Skill Dev one just
          by URL. The rooms request a LiveKit token on mount, so this was the
          highest-value gap in the route table. The backend enforces its own
          checks too — this stops the wrong room ever mounting. */}
      <Route path="/teacher/live/:id" element={<ProtectedTeacherRoute><RequireTrack track="academy"><TeacherLiveSession /></RequireTrack></ProtectedTeacherRoute>} />
      <Route path="/teacher/private-session/live/:id" element={<ProtectedTeacherRoute><RequireTrack track="academy"><PrivateSessionLive /></RequireTrack></ProtectedTeacherRoute>} />
      <Route path="/teacher/group-session/live/:id" element={<ProtectedTeacherRoute><RequireTrack track="academy"><GroupSessionLive /></RequireTrack></ProtectedTeacherRoute>} />
      {/* Skill-dev 1-on-1 LiveKit room (separate from Academy private sessions) */}
      <Route path="/teacher/skill-session/live/:id" element={<ProtectedTeacherRoute><RequireTrack track="skill"><SkillSessionLive /></RequireTrack></ProtectedTeacherRoute>} />

      {/* ── Skill Dev / Expert — SkillDevLayout ── */}
      <Route
        path="/teacher/expert"
        element={
          <ProtectedTeacherRoute>
            <RequireTrack track="skill"><SkillDevLayout /></RequireTrack>
          </ProtectedTeacherRoute>
        }
      >
        <Route index element={<ExpertDashboard />} />
        <Route path="bookings" element={<ExpertBookings />} />
        <Route path="students" element={<ExpertStudents />} />
        <Route path="availability" element={<ExpertAvailability />} />
        <Route path="skills" element={<ExpertSkills />} />
        {/* "new" must precede ":listingId" or it would be read as an id. */}
        <Route path="skills/new" element={<SkillListingForm />} />
        <Route path="skills/:id" element={<SkillListingForm />} />
        <Route path="profile" element={<ExpertProfileEdit />} />
        <Route path="promote" element={<ExpertPromote />} />
        <Route path="inbox" element={<SkillInbox />} />
      </Route>

      {/* ── Counselling — CounselorLayout (own onboarding gate) ── */}
      <Route
        path="/teacher/counsellor"
        element={<ProtectedTeacherRoute><CounselorLayout /></ProtectedTeacherRoute>}
      >
        <Route index element={<CounselorSchedule />} />
        <Route path="appointments/:id" element={<CounselorSession />} />
        <Route path="availability" element={<CounselorAvailability />} />
        <Route path="profile" element={<CounselorProfile />} />
      </Route>

      {/* ── Academy / Faculty — TeacherLayout ── */}
      <Route
        path="/teacher"
        element={<ProtectedTeacherRoute><TeacherLayout /></ProtectedTeacherRoute>}
      >
        {/* ACCOUNT-LEVEL, deliberately OUTSIDE the academy gate below. These
            belong to the person, not the track — gating them would lock a
            skill-only expert out of their own password. Chat is out too
            because DMs are cross-track by design (chat.services
            .teacher_is_public_faculty). */}
        <Route path="change-password" element={<ChangePassword />} />
        <Route path="chat" element={<Chat />} />
        <Route path="settings/teacher-password" element={<TeacherPasswordSettings />} />

        {/* Everything below teaches board classes and is Academy-only.
            Pathless layout route so one gate covers all of it — previously
            each of these was reachable by typing the URL regardless of track,
            rendering empty gradebooks and rosters to guest experts. */}
        {/* dashboard is deliberately OUTSIDE the academy gate. It is the
            landing route the header, profile switcher and track switcher all
            point at, and DashboardEntry's job is to decide WHICH dashboard a
            teacher should see. Inside the gate that decision was unreachable:
            a skill-only expert following their own header link hit "Academy
            track not added yet" instead of their expert dashboard.
            DashboardEntry now renders the gate itself when appropriate. */}
        <Route path="dashboard" element={<DashboardEntry />} />

        <Route element={<RequireTrack track="academy"><Outlet /></RequireTrack>}>
        <Route path="profile" element={<FacultyProfile />} />
        {/* Old split pages both fold into the unified faculty profile. */}
        <Route path="private-details" element={<Navigate to="/teacher/profile" replace />} />
        <Route path="students" element={<AllStudents />} />
        <Route path="students/:studentId" element={<AllStudentDetail />} />
        <Route path="classes" element={<ClassesList />} />
        <Route path="classes/:subjectId" element={<Classes />} />

        {/* Assignments */}
        <Route path="classes/:subjectId/assignments" element={<Assignments />} />
        <Route path="classes/:subjectId/assignments/create" element={<CreateAssignment />} />
        <Route path="classes/:subjectId/assignments/:assignmentId" element={<AssignmentView />} />
        <Route path="classes/:subjectId/assignments/:assignmentId/submissions" element={<SubmissionView />} />

        {/* CONTENT nav items are flat, subject-filtered lists (design screens
            11/12/13) — the class-picker step is gone. The classes/:subjectId
            variants above and below still resolve so existing deep links work;
            they render the same screen with that subject's pill preselected. */}
        <Route path="assignments" element={<Assignments />} />
        <Route path="study-materials" element={<StudyMaterials />} />
        <Route path="recordings" element={<SessionRecordings />} />
        <Route path="quizzes" element={<Quizzes />} />

        {/* Quizzes. NOTE: quiz-bank is the QUESTION BANK, a different screen —
            the sidebar's "Quizzes" item used to point here, which is why the
            real quiz list was only reachable via Classes. It now points at
            /teacher/quizzes; the bank stays routable. */}
        <Route path="quiz-bank" element={<QuizBank />} />
        {/* T4 · ShikshaCom bank status (Phase 6). */}
        <Route path="bank-status" element={<BankStatus />} />
        <Route path="classes/:subjectId/quizzes" element={<Quizzes />} />

        {/* A quiz's own child screens — flat, matching the list's root. Create
            stays subject-scoped (a new quiz needs a subject up front, same as
            Create Assignment); the rest need only quizId/studentId/attemptId. */}
        <Route path="quizzes/create/:subjectId" element={<QuizBuilder />} />
        <Route path="quizzes/:quizId/edit" element={<QuizBuilder />} />
        <Route path="quizzes/:quizId/draft" element={<QuizDraftPreview />} />
        <Route path="quizzes/:quizId" element={<QuizView />} />
        <Route path="quizzes/:quizId/submissions" element={<QuizSubmissionView />} />
        <Route path="quizzes/:quizId/analytics" element={<QuizAnalytics />} />
        <Route path="quizzes/:quizId/student/:studentId" element={<QuizStudentAttemptsView />} />
        <Route path="quizzes/:quizId/review/:attemptId" element={<QuizReviewView />} />

        {/* Old nested paths — kept as redirects so an existing bookmark or
            notification link built before this flattening still resolves. */}
        <Route path="classes/:subjectId/quizzes/create" element={<LegacyQuizRedirect to="/teacher/quizzes/create/:subjectId" />} />
        <Route path="classes/:subjectId/quizzes/:quizId/draft" element={<LegacyQuizRedirect to="/teacher/quizzes/:quizId/draft" />} />
        <Route path="classes/:subjectId/quizzes/:quizId" element={<LegacyQuizRedirect to="/teacher/quizzes/:quizId" />} />
        <Route path="classes/:subjectId/quizzes/:quizId/submissions" element={<LegacyQuizRedirect to="/teacher/quizzes/:quizId/submissions" />} />
        <Route path="classes/:subjectId/quizzes/:quizId/student/:studentId" element={<LegacyQuizRedirect to="/teacher/quizzes/:quizId/student/:studentId" />} />
        <Route path="classes/:subjectId/quizzes/:quizId/review/:attemptId" element={<LegacyQuizRedirect to="/teacher/quizzes/:quizId/review/:attemptId" />} />

        {/* Study Materials */}
        <Route path="classes/:subjectId/study-materials" element={<StudyMaterials />} />
        <Route path="classes/:subjectId/study-materials/upload" element={<UploadMaterial />} />
        <Route path="classes/:subjectId/study-materials/:materialId" element={<StudyMaterialView />} />

        {/* Session Recordings */}
        <Route path="classes/:subjectId/session-recordings" element={<SessionRecordings />} />
        <Route path="classes/:subjectId/session-recordings/upload" element={<UploadRecording />} />
        {/* No :videoId segment: it only ever existed so the player could build
            an unauthenticated Bunny embed URL itself. The player now asks
            /recordings/:id/playback/ for a signed one, so the guid never
            needs to be in the address bar. The legacy 5-segment URL is kept
            mounted so old links/bookmarks still play. */}
        <Route path="classes/:subjectId/session-recordings/:recordingId" element={<RecordingPlayer />} />
        <Route path="classes/:subjectId/session-recordings/:recordingId/:legacyVideoId" element={<RecordingPlayer />} />

        {/* Students (per class) */}
        <Route path="classes/:subjectId/students" element={<StudentsList />} />
        <Route path="classes/:subjectId/students/:studentId" element={<StudentDetail />} />

        {/* Live Sessions */}
        <Route path="live-sessions" element={<LiveSessions />} />
        <Route path="classes/:subjectId/live-sessions" element={<LiveSessions />} />
        <Route path="live-sessions/:id/detail" element={<LiveSessionDetail />} />
        <Route path="classes/:subjectId/live-sessions/:id/detail" element={<LiveSessionDetail />} />

        {/* Private Sessions */}
        <Route path="private-sessions" element={<PrivateSessionsDashboard />} />
        <Route path="private-sessions/availability" element={<PrivateSessionAvailability />} />
        <Route path="private-sessions/scheduled/:id" element={<PrivateSessionDetail />} />
        <Route path="private-sessions/request/:id" element={<PrivateSessionDetail />} />
        <Route path="private-sessions/history/:id" element={<PrivateSessionDetail />} />

        {/* Group Sessions */}
        <Route path="group-sessions" element={<GroupSessions />} />

        {/* Batch Progress (linked from Sidebar; param name must be :batchId) */}
        <Route path="batch-progress" element={<BatchProgress />} />
        <Route path="batch-progress/:batchId" element={<BatchProgressDetail />} />
        </Route>{/* /RequireTrack academy */}
      </Route>

      {/* Catch-all, genuinely last. This app had none, so any unmatched
          /teacher/... URL rendered a completely blank page — no layout, no
          header, no way back. Send it to the dashboard, which then routes on
          the user's own track entitlement. */}
      <Route path="*" element={<Navigate to="/teacher/dashboard" replace />} />
    </Routes>
  );
}
