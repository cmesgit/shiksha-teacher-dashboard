/**
 * teacher_dashboard/src/pages/Chat.jsx
 *
 * Teacher inbox. Identity = the teacher profile (resolved server-side
 * from JWT context=teacher claim). All course rooms the teacher is in,
 * plus all 1:1 messages with students.
 *
 * Navigation:
 *   navigate("/teacher/chat")                                            → inbox
 *   navigate("/teacher/chat", { state: { learnerId } })                 → DM a student
 *   navigate("/teacher/chat", { state: { courseId, courseTitle } })     → a course room
 */
import { useLocation } from "react-router-dom";
import ChatPanel from "../shared/ChatPanel";
import "../shared/ChatPanel.css";

export default function Chat() {
  const { state } = useLocation();

  const directTo = state?.learnerId
    ? { kind: "LEARNER", id: state.learnerId }
    : undefined;

  const courseRoom = state?.courseId
    ? { id: state.courseId, title: state.courseTitle || "" }
    : undefined;

  return (
    <div style={{ padding: "20px", height: "calc(100vh - 80px)", boxSizing: "border-box" }}>
      <ChatPanel directTo={directTo} courseRoom={courseRoom} />
    </div>
  );
}
