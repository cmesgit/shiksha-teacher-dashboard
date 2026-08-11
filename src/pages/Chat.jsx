// teacher_dashboard/src/pages/Chat.jsx
//
// Teacher Messages. Full Communication Center hub (categories, Directory,
// Notifications, Settings, Support, pin/mute/archive/report, reactions,
// attachments, read receipts — see shared/ChatPanel.jsx), repainted onto the
// Academy design tokens via `theme="academy"` (shared/ChatPanel.css's
// `.cc-theme-academy` block) instead of the hub's original terracotta/teal
// theme. pages/SkillInbox.jsx mounts the exact same component with
// `theme="skill"` instead.
import { useLocation } from "react-router-dom";
import ChatPanel from "../shared/ChatPanel";
import "../shared/ChatPanel.css";

const DIRECTORY_NOTE = "To reach a student, reply to their message or message them from a course room.";

export default function Chat() {
  const { state } = useLocation();

  const directTo = state?.learnerId
    ? { kind: "LEARNER", id: state.learnerId }
    : undefined;

  const courseRoom = state?.courseId
    ? { id: state.courseId, title: state.courseTitle || "" }
    : undefined;

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
      <ChatPanel directTo={directTo} courseRoom={courseRoom} conversationId={state?.conversationId} theme="academy" directoryContactsNote={DIRECTORY_NOTE} />
    </div>
  );
}
