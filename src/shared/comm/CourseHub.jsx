// PLACEMENT: put this file in BOTH apps (identical):
//   student_dashboard/src/shared/comm/CourseHub.jsx
//   teacher_ui/src/shared/comm/CourseHub.jsx
//
// CC-013/014/015/016. The Course Hub composes what already existed
// (materials.StudyMaterial via /chat/course/<id>/resources/,
// assignments.Assignment via /chat/course/<id>/assignments/) with what's
// new (the room's own Discussion thread, its Members, and its
// Announcements channel) behind one set of tabs — replacing "course room =
// a plain chat thread" with the hub the spec actually asked for.
import { useEffect, useRef, useState } from "react";
import {
  FiX, FiMessageCircle, FiFolder, FiUsers, FiClipboard, FiRadio,
  FiFileText, FiDownload, FiCalendar, FiSend,
} from "react-icons/fi";
import { ChatAPI } from "../chatClient";
import ConversationThread from "./ConversationThread";
import MessageBubble from "./MessageBubble";
import { Avatar, rolesLabel, timeAgo, Spinner, EmptyState, useDismissable } from "./common";

const TABS = [
  { key: "discussion", label: "Discussion", Icon: FiMessageCircle },
  { key: "announcements", label: "Announcements", Icon: FiRadio },
  { key: "resources", label: "Resources", Icon: FiFolder },
  { key: "assignments", label: "Assignments", Icon: FiClipboard },
  { key: "members", label: "Members", Icon: FiUsers },
];

function ResourcesTab({ courseId }) {
  const [items, setItems] = useState(null);
  useEffect(() => { ChatAPI.courseResources(courseId).then(setItems).catch(() => setItems([])); }, [courseId]);
  if (items === null) return <Spinner label="Loading resources…" />;
  if (!items.length) return <EmptyState title="No resources yet" hint="Study material your teacher uploads will show up here." />;
  return (
    <div className="cc-hub-list">
      {items.map((m) => (
        <div className="cc-hub-list-item" key={m.id}>
          <div className="cc-hub-list-main">
            <div className="cc-hub-list-title">{m.title}</div>
            <div className="cc-hub-list-sub">{m.chapter} · {timeAgo(m.created_at)} ago</div>
          </div>
          <div className="cc-hub-list-files">
            {m.files.map((f) => (
              <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="cc-hub-file-chip">
                <FiFileText size={13} /> {f.name} <FiDownload size={12} />
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AssignmentsTab({ courseId }) {
  const [items, setItems] = useState(null);
  useEffect(() => { ChatAPI.courseAssignments(courseId).then(setItems).catch(() => setItems([])); }, [courseId]);
  if (items === null) return <Spinner label="Loading assignments…" />;
  if (!items.length) return <EmptyState title="No assignments yet" hint="Assignments posted for this course will show up here." />;
  return (
    <div className="cc-hub-list">
      {items.map((a) => (
        <div className="cc-hub-list-item" key={a.id}>
          <div className="cc-hub-list-main">
            <div className="cc-hub-list-title">{a.title}</div>
            <div className="cc-hub-list-sub">
              <FiCalendar size={11} /> Due {a.due_date ? new Date(a.due_date).toLocaleDateString() : "—"}
              {a.is_expired && <span className="cc-tag-expired">Past due</span>}
              {" · "}{a.chapter}
            </div>
          </div>
          <div className="cc-hub-list-files">
            {a.files.map((f) => (
              <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="cc-hub-file-chip">
                <FiFileText size={13} /> {f.name}
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MembersTab({ courseId, onDm }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    let alive = true;
    ChatAPI.courseRoom(courseId).then((conv) => ChatAPI.members(conv.id)).then((m) => { if (alive) setItems(m); }).catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [courseId]);
  if (items === null) return <Spinner label="Loading members…" />;
  const teachers = items.filter((p) => p.kind === "TEACHER");
  const learners = items.filter((p) => p.kind === "LEARNER");
  return (
    <div className="cc-hub-members">
      {teachers.length > 0 && (
        <>
          <div className="cc-hub-members-group-label">Teachers ({teachers.length})</div>
          {teachers.map((p) => (
            <button className="cc-hub-member-row" key={p.id} onClick={() => onDm?.(p.identity)}>
              <Avatar src={p.avatar} name={p.name} identity={p.identity} size={32} />
              <span><span className="cc-hub-member-name">{p.name}</span><span className="cc-hub-member-role">{rolesLabel(p.roles)}</span></span>
            </button>
          ))}
        </>
      )}
      <div className="cc-hub-members-group-label">Students ({learners.length})</div>
      {learners.map((p) => (
        <div className="cc-hub-member-row cc-hub-member-row-static" key={p.id}>
          <Avatar src={p.avatar} name={p.name} identity={p.identity} size={32} />
          <span className="cc-hub-member-name">{p.name}</span>
        </div>
      ))}
    </div>
  );
}

function AnnouncementsTab({ courseId, canPost }) {
  const [messages, setMessages] = useState(null);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  const load = () => ChatAPI.announcements(courseId).then((r) => setMessages(r.messages));
  useEffect(() => { load(); }, [courseId]); // eslint-disable-line react-hooks/exhaustive-deps

  const post = async () => {
    if (!draft.trim()) return;
    setPosting(true);
    try {
      await ChatAPI.postAnnouncement(courseId, draft.trim());
      setDraft("");
      await load();
    } catch { /* toast could be added; keeping this tab lightweight */ }
    setPosting(false);
  };

  if (messages === null) return <Spinner label="Loading announcements…" />;

  return (
    <div className="cc-announcements-tab">
      {canPost && (
        <div className="cc-announcement-composer">
          <textarea rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Post an announcement to the whole class…" />
          <button className="cc-btn-primary" disabled={!draft.trim() || posting} onClick={post}><FiSend size={13} /> Post</button>
        </div>
      )}
      {messages.length === 0 ? (
        <EmptyState icon={<FiRadio size={22} />} title="No announcements yet" hint={canPost ? "Post the first one above." : "Check back for updates from your teacher."} />
      ) : (
        <div className="cc-messages cc-messages-static">
          {messages.map((m) => (
            <MessageBubble key={m.id} msg={m} mine={false} showSender variant="announcement" />
          ))}
        </div>
      )}
    </div>
  );
}

function DiscussionTab({ courseId, courseTitle, onConversationChange, onDmFromRoom }) {
  const [conv, setConv] = useState(null);
  useEffect(() => {
    let alive = true;
    ChatAPI.courseRoom(courseId, courseTitle).then((c) => { if (alive) setConv(c); }).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);
  if (!conv) return <Spinner label="Opening class discussion…" />;
  return <ConversationThread conversation={conv} onConversationChange={onConversationChange} onDmFromRoom={onDmFromRoom} />;
}

export default function CourseHub({ courseId, courseTitle, onClose, onConversationChange, onDmFromRoom, canPostAnnouncements, initialTab = "discussion" }) {
  const [tab, setTab] = useState(initialTab);
  const closeBtnRef = useRef(null);
  useDismissable(true, { onClose, initialFocusRef: closeBtnRef });

  return (
    <div className="cc-coursehub-overlay" onClick={onClose}>
      <div className="cc-coursehub" onClick={(e) => e.stopPropagation()}>
        <header className="cc-coursehub-head">
          <span className="cc-coursehub-title">{courseTitle || "Course Hub"}</span>
          <button ref={closeBtnRef} className="cc-icon-btn" onClick={onClose}><FiX size={18} /></button>
        </header>
        <nav className="cc-coursehub-tabs">
          {TABS.map((t) => (
            <button key={t.key} className={"cc-coursehub-tab" + (tab === t.key ? " cc-coursehub-tab-active" : "")} onClick={() => setTab(t.key)}>
              <t.Icon size={14} /> {t.label}
            </button>
          ))}
        </nav>
        <div className="cc-coursehub-body">
          {tab === "discussion" && (
            <DiscussionTab courseId={courseId} courseTitle={courseTitle} onConversationChange={onConversationChange} onDmFromRoom={onDmFromRoom} />
          )}
          {tab === "announcements" && <AnnouncementsTab courseId={courseId} canPost={canPostAnnouncements} />}
          {tab === "resources" && <ResourcesTab courseId={courseId} />}
          {tab === "assignments" && <AssignmentsTab courseId={courseId} />}
          {tab === "members" && <MembersTab courseId={courseId} onDm={onDmFromRoom} />}
        </div>
      </div>
    </div>
  );
}
