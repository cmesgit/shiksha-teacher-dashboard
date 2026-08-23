// PLACEMENT: put this file in BOTH apps (identical):
//   student_dashboard/src/shared/MessagesPopover.jsx
//   teacher_ui/src/shared/MessagesPopover.jsx
//
// The header's "messages" icon used to be a bare link to the full
// Communication Center (see the retired MessageIcon.jsx). This turns it
// into a real popover — recent conversations, open one, reply inline —
// modeled on NotificationBell's trigger+dropdown pattern but fixing the
// gaps that component has: this one closes on Escape (and returns focus
// to the trigger), moves focus into the panel on open, carries
// aria-haspopup/aria-expanded/role="dialog", and clamps its width on
// narrow viewports instead of a bare fixed 320px.
//
// Deliberately reuses ConversationList/ConversationThread as-is rather
// than re-deriving a smaller chat UI — both already take fully-resolved
// props (a flat conversations array, a single conversation object), not
// ChatPanel's internal state, so they drop in here unmodified. Pin/mute/
// archive/report already work inside ConversationList with no extra
// wiring (its CardMenu calls ChatAPI directly).
//
// Scope cut, on purpose: starting a NEW conversation (the list's "+"
// button, or a global-search "people" hit) and opening a ROOM/BROADCAST
// conversation (course room / announcements, which need Course Hub) both
// hand off to the full Communication Center instead of being embedded in
// a ~360px popover. `viewAllHref` is the caller's job to compute — pass
// the same track-aware route Header.jsx already resolves for the old
// MessageIcon (`/chat` vs `/skill-messages`, `/teacher/chat` vs
// `/teacher/expert/inbox`).
//
// Deliberately NOT re-skinned per track (unlike the full ChatPanel page,
// which does switch cc-theme-academy/cc-theme-skill). The inbox shown here
// is the exact same account-wide, track-neutral list either way — chat is
// intentionally track-neutral end to end (see notifications/tracks.py's own
// "a DM is a DM regardless of which dashboard you're looking at") — so
// reskinning it by whichever page you happen to be standing on implied a
// distinction that isn't real. It renders with ChatPanel.css's own base
// :root variables (a terracotta/teal identity, no theme class applied),
// which is that stylesheet's actual neutral default, not a third theme
// invented for this.
//
// Data: no new network call. useMessageBadge() already fetches
// GET /chat/conversations/ to sum the unread badge and now also exposes
// the raw list — this reads straight off that singleton store and
// inherits its refresh triggers (chat push, window focus/visibility, the
// shiksha:messages-read event, profile switch) for free.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiMessageSquare, FiX } from "react-icons/fi";
import useMessageBadge from "./useMessageBadge";
import ConversationList from "./comm/ConversationList";
import ConversationThread from "./comm/ConversationThread";
import ProfileView from "./comm/ProfileView";
// ConversationList/ConversationThread render with .cc-* classes defined in
// ChatPanel.css. Following this codebase's convention (ChatPanel.jsx itself
// doesn't import ChatPanel.css either — its consumer page does), the CALLER
// of MessagesPopover is responsible for importing BOTH ChatPanel.css and
// MessagesPopover.css. That's Header.jsx here, which is new: ChatPanel.css
// was previously only pulled in by the /chat and /skill-messages route
// pages, but this popover mounts in the Header on every page.

export default function MessagesPopover({ viewAllHref }) {
  const navigate = useNavigate();
  const { unreadCount, conversations: liveConversations, loading, refresh } = useMessageBadge();

  const [open, setOpen] = useState(false);
  const [activeConv, setActiveConv] = useState(null);
  const [profileIdentity, setProfileIdentity] = useState(null);
  // Optimistic pin/mute/archive/read feedback, keyed by conversation id.
  // Cleared on every close so a reopen always starts from server truth —
  // the singleton store's own refresh triggers keep it current regardless.
  const [overrides, setOverrides] = useState({});

  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const closeBtnRef = useRef(null);

  const conversations = useMemo(() => {
    if (!Object.keys(overrides).length) return liveConversations;
    return liveConversations.map((c) => (overrides[c.id] ? { ...c, ...overrides[c.id] } : c));
  }, [liveConversations, overrides]);

  const close = () => {
    setOpen(false);
    setActiveConv(null);
    setProfileIdentity(null);
    setOverrides({});
  };

  const toggle = () => {
    if (open) close();
    else setOpen(true);
  };

  const goToViewAll = () => {
    close();
    navigate(viewAllHref);
  };

  const updateLocalConv = (updated) => {
    if (!updated || !updated.id) return;
    setOverrides((prev) => ({ ...prev, [updated.id]: updated }));
    setActiveConv((prev) => (prev && prev.id === updated.id ? updated : prev));
  };

  const onSelectConv = (conv) => {
    // ROOM/BROADCAST need Course Hub, which doesn't belong in a popover.
    if ((conv.kind === "ROOM" || conv.kind === "BROADCAST") && conv.course_id) {
      goToViewAll();
      return;
    }
    setActiveConv(conversations.find((c) => c.id === conv.id) || conv);
  };

  // Click-outside + Escape. Escape also returns focus to the trigger —
  // the one thing NotificationBell's own dropdown never does.
  useEffect(() => {
    if (!open) return undefined;
    const onMouseDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) close();
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        close();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Move focus into the panel on open.
  useEffect(() => {
    if (open) closeBtnRef.current?.focus();
  }, [open]);

  return (
    <div className="notif-bell-wrap" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className="notif-bell-btn"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unreadCount > 0 ? `Messages, ${unreadCount} unread` : "Messages"}
        title="Messages"
      >
        <FiMessageSquare size={21} color={unreadCount > 0 ? "#2563eb" : undefined} />
        {unreadCount > 0 && (
          <span className="notif-bell-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="msg-pop-panel" role="dialog" aria-label="Messages">
          <div className="msg-pop-head">
            <span className="msg-pop-title">Messages</span>
            <div className="msg-pop-head-actions">
              <button type="button" className="msg-pop-viewall" onClick={goToViewAll}>
                View all
              </button>
              <button
                ref={closeBtnRef}
                type="button"
                className="msg-pop-close"
                aria-label="Close"
                onClick={close}
              >
                <FiX size={16} />
              </button>
            </div>
          </div>

          <div className="msg-pop-body">
            {activeConv ? (
              <ConversationThread
                key={activeConv.id}
                conversation={activeConv}
                onConversationChange={updateLocalConv}
                onBack={() => setActiveConv(null)}
                onOpenCourseHub={goToViewAll}
                onOpenMembers={goToViewAll}
                onOpenProfile={(identity) => identity && setProfileIdentity(identity)}
                onDmFromRoom={goToViewAll}
                compact
              />
            ) : (
              <ConversationList
                conversations={conversations}
                loading={loading}
                error={false}
                onRetry={refresh}
                activeId={null}
                onSelect={onSelectConv}
                onChanged={updateLocalConv}
                onNewChat={goToViewAll}
                onStartDirect={goToViewAll}
              />
            )}
          </div>

          {profileIdentity && (
            <ProfileView
              identity={profileIdentity}
              onClose={() => setProfileIdentity(null)}
              onMessage={goToViewAll}
            />
          )}
        </div>
      )}
    </div>
  );
}
