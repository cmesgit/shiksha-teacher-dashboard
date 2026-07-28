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
import { Routes, Route, Navigate, useParams } from "react-router-dom";
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
import CreateQuiz from "../pages/CreateQuiz";
import QuizBank from "../pages/QuizBank";
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
import ExpertCourse from "../pages/skill/ExpertCourse";      // "My Course" — 1-on-1 profile + availability
import ExpertBookings from "../pages/skill/ExpertBookings";
import ExpertAvailability from "../pages/skill/ExpertAvailability";
// Earnings removed — guest experts settle payment directly with learners.
import ExpertPromote from "../pages/skill/ExpertPromote";       // subscription (reached from dashboard)
import ExpertProfileEdit from "../pages/skill/ExpertProfileEdit"; // profile + location + UPI ("Edit Course")
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
  const goesToExpert =
    teacherInfo?.type === "GUEST" ||
    teacherInfo?.active_track === "skill";
  if (goesToExpert) return <Navigate to="/teacher/expert" replace />;
  return <TeacherDashboard />;
}

export default function TeacherRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RedirectToMainLogin />} />

      {/* Fullscreen live routes */}
      <Route path="/teacher/live/:id" element={<ProtectedTeacherRoute><TeacherLiveSession /></ProtectedTeacherRoute>} />
      <Route path="/teacher/private-session/live/:id" element={<ProtectedTeacherRoute><PrivateSessionLive /></ProtectedTeacherRoute>} />
      <Route path="/teacher/group-session/live/:id" element={<ProtectedTeacherRoute><GroupSessionLive /></ProtectedTeacherRoute>} />
      {/* Skill-dev 1-on-1 LiveKit room (separate from Academy private sessions) */}
      <Route path="/teacher/skill-session/live/:id" element={<ProtectedTeacherRoute><SkillSessionLive /></ProtectedTeacherRoute>} />

      {/* ── Skill Dev / Expert — SkillDevLayout ── */}
      <Route
        path="/teacher/expert"
        element={<ProtectedTeacherRoute><SkillDevLayout /></ProtectedTeacherRoute>}
      >
        <Route index element={<ExpertDashboard />} />
        <Route path="course" element={<ExpertCourse />} />       {/* My Course — 1-on-1 profile + availability */}
        <Route path="bookings" element={<ExpertBookings />} />
        {/* availability kept as a deep link; it now lives inside "My Course" */}
        <Route path="availability" element={<ExpertAvailability />} />
        <Route path="promote" element={<ExpertPromote />} />
        <Route path="profile" element={<ExpertProfileEdit />} /> {/* opened via "Edit Course" */}
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
        <Route path="profile" element={<FacultyProfile />} />
        {/* Old split pages both fold into the unified faculty profile. */}
        <Route path="private-details" element={<Navigate to="/teacher/profile" replace />} />
        <Route path="dashboard" element={<DashboardEntry />} />
        <Route path="students" element={<AllStudents />} />
        <Route path="students/:studentId" element={<AllStudentDetail />} />
        <Route path="classes" element={<ClassesList />} />
        <Route path="classes/:subjectId" element={<Classes />} />
        <Route path="change-password" element={<ChangePassword />} />
        <Route path="chat" element={<Chat />} />
        <Route path="settings/teacher-password" element={<TeacherPasswordSettings />} />

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
        <Route path="classes/:subjectId/quizzes" element={<Quizzes />} />

        {/* A quiz's own child screens — flat, matching the list's root. Create
            stays subject-scoped (a new quiz needs a subject up front, same as
            Create Assignment); the rest need only quizId/studentId/attemptId. */}
        <Route path="quizzes/create/:subjectId" element={<CreateQuiz />} />
        <Route path="quizzes/:quizId/draft" element={<QuizDraftPreview />} />
        <Route path="quizzes/:quizId" element={<QuizView />} />
        <Route path="quizzes/:quizId/submissions" element={<QuizSubmissionView />} />
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
        <Route path="classes/:subjectId/session-recordings/:recordingId/:videoId" element={<RecordingPlayer />} />

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
      </Route>
    </Routes>
  );
}
