/**
 * PLACEMENT: src/pages/SkillInbox.jsx
 * ACTION:    Replace the entire file.
 *
 * What changed:
 *   The old file was a custom polling-REST inbox that hit /skill/teacher/inbox/
 *   every 15 seconds against the skills.Conversation model — no WebSocket.
 *
 *   This replaces it with shared/ChatPanel (the same live WS inbox already
 *   used by Chat.jsx) so expert teachers get real-time messaging.
 *
 *   When a Message button on ExpertBookings is clicked, it navigates here
 *   with state: { learnerId, learnerName }. ChatPanel reads directTo and
 *   immediately calls ChatAPI.startDirect("LEARNER", learnerId) to open
 *   that conversation — so the teacher lands directly in the right thread.
 *
 *   learnerId = LearnerProfile UUID — what StartDirectView KIND_LEARNER expects.
 */
import { useLocation } from "react-router-dom";
import ChatPanel from "../shared/ChatPanel";
import "../shared/ChatPanel.css";

export default function SkillInbox() {
  const { state } = useLocation();

  // When arriving from ExpertBookings Message button, open that learner's DM directly.
  const directTo = state?.learnerId
    ? { kind: "LEARNER", id: state.learnerId }
    : undefined;

  return (
    <div style={{ padding: "20px", height: "calc(100vh - 80px)", boxSizing: "border-box" }}>
      <ChatPanel directTo={directTo} />
    </div>
  );
}
