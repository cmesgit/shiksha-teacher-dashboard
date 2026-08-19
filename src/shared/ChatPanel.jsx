// PLACEMENT: put this file in BOTH apps (identical):
//   student_dashboard/src/shared/ChatPanel.jsx   (replace whole file)
//   teacher_ui/src/shared/ChatPanel.jsx          (replace whole file)
//
// Communication Center closure. This file keeps the exact prop contract the
// four existing pages already call it with — no changes needed to
// pages/Chat.jsx, pages/SkillMessages.jsx, or the teacher equivalents:
//     <ChatPanel directTo={{kind,id}} />
//     <ChatPanel courseRoom={{id,title}} />
//     <ChatPanel directTo={{...}} initialDraft="…" />
// What's different is what it renders: previously a flat two-pane
// list+thread; now the full hub — a category sidebar (Inbox / Courses /
// Faculty / Guest Experts / Announcements / Support / Directory /
// Notifications / Settings), sectioned conversation list (CC-005),
// Course Hub tabs replacing "room = plain thread" (CC-013), and dedicated
// screens for the pieces that were previously missing entirely (CC-017
// through CC-022).
//
// A DELIBERATE non-change: this does NOT try to collapse /skill-messages
// (student) or /teacher/expert/inbox (teacher) into a single route. The
// former carries a cross-app query-string handoff from the public landing
// page (?teacherProfileId=&draft=) that a redirect would have to
// reproduce for no real benefit; the latter sits under a genuinely
// different layout/sidebar than /teacher/chat, and jumping a Guest Expert
// out of their own shell to reach messages would be a UX regression (see
// the comment already living in layout/SkillDevLayout.jsx about exactly
// this). Both routes mounting the same rich hub — which is what actually
// changed here — already resolves the "two products" confusion the gap
// analysis flagged; only the component needed to unify, not the URLs.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FiInbox, FiUsers, FiBell, FiSettings, FiHeadphones, FiPlus,
  FiMessageSquare, FiRadio,
} from "react-icons/fi";
import { ChatAPI } from "./chatClient";
import ConversationList from "./comm/ConversationList";
import ConversationThread from "./comm/ConversationThread";
import CourseHub from "./comm/CourseHub";
import PeopleDirectory from "./comm/PeopleDirectory";
import NotificationsView from "./comm/NotificationsView";
import SettingsView from "./comm/SettingsView";
import SupportView from "./comm/SupportView";
import ProfileView from "./comm/ProfileView";
import { EmptyState, parseIdentity, CATEGORY_META } from "./comm/common";

const SIDEBAR_ITEMS = [
  { key: "all", label: "Inbox", Icon: FiInbox, kind: "category" },
  { key: "courses", label: "Courses", Icon: CATEGORY_META.courses.Icon, kind: "category" },
  { key: "faculty", label: "Faculty", Icon: CATEGORY_META.faculty.Icon, kind: "category" },
  { key: "guest_experts", label: "Guest Experts", Icon: CATEGORY_META.guest_experts.Icon, kind: "category" },
  { key: "announcements", label: "Announcements", Icon: FiRadio, kind: "category" },
  { key: "support", label: "Support", Icon: FiHeadphones, kind: "view" },
  { key: "directory", label: "Directory", Icon: FiUsers, kind: "view" },
  { key: "notifications", label: "Notifications", Icon: FiBell, kind: "view" },
  { key: "settings", label: "Settings", Icon: FiSettings, kind: "view" },
];

function useCompact() {
  const [compact, setCompact] = useState(() => typeof window !== "undefined" && window.innerWidth < 860);
  useEffect(() => {
    const onResize = () => setCompact(window.innerWidth < 860);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return compact;
}

// directoryContactsNote: optional footer text for the "New message" picker,
// explaining who ISN'T reachable via this directory (it only ever searches
// faculty/experts, never students) and how to reach them instead. Only the
// TEACHER-side callers (Chat.jsx, SkillInbox.jsx) pass this — the copy
// ("To reach a student...") only makes sense from a teacher's perspective;
// a student would never expect to find a student in a staff directory.
export default function ChatPanel({ directTo, courseRoom, conversationId, initialDraft = "", theme, directoryContactsNote }) {
  const [searchParams] = useSearchParams();
  const initialView = (() => {
    const v = searchParams.get("view");
    return ["notifications", "directory", "settings", "support"].includes(v) ? v : "inbox";
  })();

  const [conversations, setConversations] = useState([]);
  const [convLoading, setConvLoading] = useState(true);
  const [convError, setConvError] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [category, setCategory] = useState("all");
  const [view, setView] = useState(initialView);
  const [courseHub, setCourseHub] = useState(null); // { courseId, courseTitle, initialTab }
  const [profileIdentity, setProfileIdentity] = useState(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [showThreadOnMobile, setShowThreadOnMobile] = useState(false);
  // Why a requested conversation (directTo / courseRoom) couldn't be opened.
  const [seedError, setSeedError] = useState(null);
  const compact = useCompact();
  const seeded = useRef(false);

  const loadConversations = useCallback(async () => {
    try {
      setConvError(false);
      const list = await ChatAPI.conversations();
      setConversations(list);
    } catch {
      setConvError(true);
    }
    setConvLoading(false);
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  const openRoomLike = useCallback((conv) => {
    setCourseHub({
      courseId: conv.course_id,
      courseTitle: conv.course?.title || conv.title,
      initialTab: conv.kind === "BROADCAST" ? "announcements" : "discussion",
    });
  }, []);

  // Open a specific conversation by id (e.g. a notification deep link).
  // Unlike directTo/courseRoom (which create-or-fetch a conversation up
  // front), this just waits for the already-in-flight conversations list
  // and selects the matching row once it lands.
  const openedConversationId = useRef(null);
  useEffect(() => {
    if (!conversationId || openedConversationId.current === conversationId) return;
    const conv = conversations.find((c) => c.id === conversationId);
    if (!conv) return;
    openedConversationId.current = conversationId;
    if ((conv.kind === "ROOM" || conv.kind === "BROADCAST") && conv.course_id) {
      openRoomLike(conv);
    } else {
      setActiveId(conv.id);
      setView("inbox");
      setShowThreadOnMobile(true);
    }
  }, [conversationId, conversations, openRoomLike]);

  // Resolve directTo / courseRoom exactly once, on first mount — same
  // contract the previous ChatPanel honored.
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    (async () => {
      try {
        if (directTo) {
          const conv = await ChatAPI.startDirect(directTo.kind, directTo.id);
          setConversations((prev) => (prev.some((c) => c.id === conv.id) ? prev : [conv, ...prev]));
          setActiveId(conv.id);
          setShowThreadOnMobile(true);
        } else if (courseRoom) {
          const conv = await ChatAPI.courseRoom(courseRoom.id, courseRoom.title);
          openRoomLike(conv);
        }
      } catch (err) {
        // Do NOT swallow this. Every caller that passes directTo/courseRoom
        // does so because the user asked for a SPECIFIC conversation — the
        // learner's "Message" button on a teacher's profile, a course-room
        // link, the people directory. Failing silently drops them on the
        // generic inbox looking like the button did nothing, which is
        // exactly how the teacher-profile Message button was reported.
        // The list below still loads, so this is a banner, not a blocker.
        setSeedError(
          err?.response?.data?.detail
          || err?.response?.data?.target_id
          || "Couldn't open that conversation. It may no longer be available to you."
        );
      }
      loadConversations();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directTo?.kind, directTo?.id, courseRoom?.id, courseRoom?.title]);

  const active = conversations.find((c) => c.id === activeId) || null;
  const myKind = conversations.find((c) => c.me)?.me?.kind || null;

  const onConversationChange = useCallback((updated) => {
    setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }, []);

  const onSelect = (conv) => {
    if ((conv.kind === "ROOM" || conv.kind === "BROADCAST") && conv.course_id) {
      openRoomLike(conv);
      return;
    }
    setActiveId(conv.id);
    setView("inbox");
    setShowThreadOnMobile(true);
  };

  const startDirectWith = async (kind, id) => {
    setNewChatOpen(false);
    setProfileIdentity(null);
    try {
      const conv = await ChatAPI.startDirect(kind, id);
      setConversations((prev) => (prev.some((c) => c.id === conv.id) ? prev : [conv, ...prev]));
      setActiveId(conv.id);
      setView("inbox");
      setCategory("all");
      setShowThreadOnMobile(true);
    } catch { /* the picker stays open-ish via its own error state if this ever fires */ }
  };

  const onDmFromRoom = (identityString) => {
    const ident = parseIdentity(identityString);
    if (ident) startDirectWith(ident.kind, ident.id);
  };

  const onSidebarClick = (item) => {
    if (item.kind === "category") {
      setCategory(item.key);
      setView("inbox");
      setShowThreadOnMobile(false);
    } else {
      setView(item.key);
      setShowThreadOnMobile(false);
    }
  };

  const courseChips = useMemo(
    () => conversations.filter((c) => c.category === "courses"),
    [conversations],
  );
  const listConversations = useMemo(
    () => conversations.filter((c) => c.kind !== "SUPPORT"),
    [conversations],
  );
  const presentCategories = useMemo(() => {
    const present = new Set(listConversations.map((c) => c.category));
    return ["all", "courses", "faculty", "guest_experts", "students", "announcements"].filter(
      (c) => c === "all" || present.has(c),
    );
  }, [listConversations]);

  const showList = view === "inbox" && (!compact || !showThreadOnMobile);
  const showThreadPane = view === "inbox" && (!compact || showThreadOnMobile);

  return (
    <div className={"cc-root" + (compact ? " cc-root-compact" : "") + (theme ? ` cc-theme-${theme}` : "")}>
      {seedError && (
        <div className="cc-seed-error" role="alert">
          <span>{seedError}</span>
          <button type="button" onClick={() => setSeedError(null)} aria-label="Dismiss">×</button>
        </div>
      )}
      <nav className="cc-sidebar">
        {SIDEBAR_ITEMS.map((item) => {
          const isActive = item.kind === "category" ? (view === "inbox" && category === item.key) : view === item.key;
          return (
            <button
              key={item.key}
              className={"cc-sidebar-item" + (isActive ? " cc-sidebar-item-active" : "")}
              onClick={() => onSidebarClick(item)}
              title={item.label}
            >
              <item.Icon size={17} />
              <span className="cc-sidebar-label">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {showList && (
        <ConversationList
          conversations={listConversations}
          loading={convLoading}
          error={convError}
          onRetry={loadConversations}
          activeId={activeId}
          category={category}
          categories={presentCategories}
          onSelectCategory={(cat) => { setCategory(cat); setShowThreadOnMobile(false); }}
          onSelect={onSelect}
          onChanged={onConversationChange}
          onNewChat={() => setNewChatOpen(true)}
          onStartDirect={startDirectWith}
        />
      )}

      <main className="cc-main">
        {view === "inbox" && category === "announcements" && !active && courseChips.length > 0 && (
          <div className="cc-announcements-picker">
            <EmptyState
              icon={<FiRadio size={22} />}
              title="Pick a course"
              hint="Open a course's Announcements channel."
            />
            <div className="cc-cat-chips" style={{ justifyContent: "center" }}>
              {courseChips.map((c) => (
                <button key={c.id} className="cc-chip" onClick={() => openRoomLike({ ...c, kind: "BROADCAST" })}>
                  {c.course?.title || c.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {showThreadPane && view === "inbox" && category !== "announcements" && (
          active ? (
            <ConversationThread
              key={active.id}
              conversation={active}
              onConversationChange={onConversationChange}
              onBack={() => setShowThreadOnMobile(false)}
              onOpenCourseHub={(courseId, courseTitle) => setCourseHub({ courseId, courseTitle, initialTab: "discussion" })}
              onOpenMembers={() => active.course_id && setCourseHub({ courseId: active.course_id, courseTitle: active.course?.title, initialTab: "members" })}
              onOpenProfile={(identity) => identity && setProfileIdentity(identity)}
              onDmFromRoom={onDmFromRoom}
              initialDraft={initialDraft}
              compact={compact}
            />
          ) : (
            <EmptyState
              icon={<FiMessageSquare size={26} />}
              title="Select a conversation"
              hint="Pick a thread on the left, or start a new one."
              action={<button className="cc-btn-primary" onClick={() => setNewChatOpen(true)}><FiPlus size={14} /> New message</button>}
            />
          )
        )}

        {view === "notifications" && (
          <NotificationsView onNavigate={() => setView("inbox")} />
        )}
        {view === "directory" && (
          <PeopleDirectory mode="screen" onStart={startDirectWith} />
        )}
        {view === "settings" && <SettingsView />}
        {view === "support" && <SupportView />}
      </main>

      {newChatOpen && (
        <PeopleDirectory mode="picker" onClose={() => setNewChatOpen(false)} onStart={startDirectWith} contactsNote={directoryContactsNote} />
      )}

      {profileIdentity && (
        <ProfileView
          identity={profileIdentity}
          onClose={() => setProfileIdentity(null)}
          onMessage={(p) => startDirectWith(p.kind, p.id)}
        />
      )}

      {courseHub && (
        <CourseHub
          courseId={courseHub.courseId}
          courseTitle={courseHub.courseTitle}
          initialTab={courseHub.initialTab}
          canPostAnnouncements={myKind === "TEACHER"}
          onConversationChange={onConversationChange}
          onDmFromRoom={onDmFromRoom}
          onClose={() => { setCourseHub(null); loadConversations(); }}
        />
      )}
    </div>
  );
}
