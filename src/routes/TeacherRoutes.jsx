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
import { Routes, Route, Navigate } from "react-router-dom";
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
import TeacherCreateLiveSession from "../pages/TeacherCreateLiveSession";
import Profile from "../pages/Profile";
import StudentsList from "../pages/StudentsList";
import StudentDetail from "../pages/StudentDetail";
import AllStudents from "../pages/AllStudents";
import AllStudentDetail from "../pages/AllStudentDetail";
import ProtectedTeacherRoute from "./ProtectedTeacherRoute";
import QuizStudentAttemptsView from "../pages/QuizStudentAttemptsView";
import PrivateSessionsDashboard from "../pages/PrivateSessionsDashboard";
import PrivateRequestDetail from "../pages/PrivateRequestDetail";
import PrivateSessionAvailability from "../pages/PrivateSessionAvailability";
import PrivateSessionDetail from "../pages/PrivateSessionDetail";
import ChangePassword from "../pages/ChangePassword";
import Chat from "../pages/Chat";
import TeacherPasswordSettings from "../pages/TeacherPasswordSettings";
import PrivateDetails from "../pages/PrivateDetails";
import GroupSessions from "../pages/GroupSessions";
import GroupSessionLive from "../pages/GroupSessionLive";

// Skill Dev (Expert) pages
import ExpertDashboard from "../pages/skill/ExpertDashboard";
import ExpertCourses from "../pages/skill/ExpertCourses";
import ExpertBookings from "../pages/skill/ExpertBookings";
import ExpertAvailability from "../pages/skill/ExpertAvailability";
// Earnings removed — guest experts settle payment directly with learners.
import ExpertPromote from "../pages/skill/ExpertPromote";       // NEW (subscription)
import ExpertProfileEdit from "../pages/skill/ExpertProfileEdit"; // NEW (profile + location + UPI)
import SkillInbox from "../pages/SkillInbox"; // NEW

import { LOGIN_URL } from "../config/urls";

function RedirectToMainLogin() {
  useEffect(() => { window.location.href = LOGIN_URL; }, []);
  return null;
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

      {/* ── Skill Dev / Expert — SkillDevLayout ── */}
      <Route
        path="/teacher/expert"
        element={<ProtectedTeacherRoute><SkillDevLayout /></ProtectedTeacherRoute>}
      >
        <Route index element={<ExpertDashboard />} />
        <Route path="courses" element={<ExpertCourses />} />
        <Route path="bookings" element={<ExpertBookings />} />
        <Route path="availability" element={<ExpertAvailability />} />
        <Route path="promote" element={<ExpertPromote />} />     {/* NEW */}
        <Route path="profile" element={<ExpertProfileEdit />} /> {/* NEW */}
        <Route path="inbox" element={<SkillInbox />} /> {/* NEW */}
      </Route>

      {/* ── Academy / Faculty — TeacherLayout ── */}
      <Route
        path="/teacher"
        element={<ProtectedTeacherRoute><TeacherLayout /></ProtectedTeacherRoute>}
      >
        <Route path="profile" element={<Profile />} />
        <Route path="private-details" element={<PrivateDetails />} />
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

        {/* Quizzes */}
        <Route path="classes/:subjectId/quizzes" element={<Quizzes />} />
        <Route path="classes/:subjectId/quizzes/create" element={<CreateQuiz />} />
        <Route path="classes/:subjectId/quizzes/:quizId/draft" element={<QuizDraftPreview />} />
        <Route path="classes/:subjectId/quizzes/:quizId" element={<QuizView />} />
        <Route path="classes/:subjectId/quizzes/:quizId/submissions" element={<QuizSubmissionView />} />
        <Route path="classes/:subjectId/quizzes/:quizId/student/:studentId" element={<QuizStudentAttemptsView />} />
        <Route path="classes/:subjectId/quizzes/:quizId/review/:attemptId" element={<QuizReviewView />} />

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
        <Route path="classes/:subjectId/live-sessions/create" element={<TeacherCreateLiveSession />} />
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
      </Route>
    </Routes>
  );
}
