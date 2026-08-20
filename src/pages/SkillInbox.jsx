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
import { useLocation, useSearchParams } from "react-router-dom";
import ChatPanel from "../shared/ChatPanel";
import "../shared/ChatPanel.css";

const DIRECTORY_NOTE = "To reach a student, reply to their message or message them from a course room.";

// A cross-APP hop (from the public site) can only carry a URL, not router
// state — so a chat deep link from there used to land on the inbox with no
// conversation selected. Accept ?conversation=<id> as an equivalent to
// state.conversationId; in-app navigation keeps using state, which survives
// a shared link being pasted around less readily.
export default function SkillInbox() {
  const { state } = useLocation();
  const [searchParams] = useSearchParams();

  // When arriving from ExpertBookings Message button, open that learner's DM directly.
  const directTo = state?.learnerId
    ? { kind: "LEARNER", id: state.learnerId }
    : undefined;

  // Chat notifications now land in whichever inbox matches the expert's
  // current track, so this one has to be able to open a specific thread —
  // it previously only ever opened the list.
  const conversationId =
    state?.conversationId || searchParams.get("conversation") || undefined;

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
      <ChatPanel
        directTo={directTo}
        conversationId={conversationId}
        theme="skill"
        directoryContactsNote={DIRECTORY_NOTE}
      />
    </div>
  );
}
