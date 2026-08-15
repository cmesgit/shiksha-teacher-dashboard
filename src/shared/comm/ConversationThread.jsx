// PLACEMENT: put this file in BOTH apps (identical):
//   student_dashboard/src/shared/comm/ConversationThread.jsx
//   teacher_ui/src/shared/comm/ConversationThread.jsx
//
// CC-007/008/009/010/011/012. Owns one open conversation end to end: REST
// history + pagination, the live WS socket (message/typing/reaction/delete/
// read/presence), and the composer (text, reply, attachment upload).
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  FiChevronLeft, FiSearch, FiUsers, FiMoreVertical, FiPaperclip, FiSend,
  FiX, FiBookOpen, FiVolumeX, FiFlag, FiFolder, FiDownload, FiFileText, FiSmile,
} from "react-icons/fi";
import { ChatAPI, openChatSocket } from "../chatClient";
import MessageBubble from "./MessageBubble";
import { Avatar, dayLabel, lastSeenLabel, rolesLabel, parseIdentity, Spinner, OfflineBanner } from "./common";

const uid = () => Math.random().toString(36).slice(2);
const QUICK_EMOJI = ["😀", "👍", "🎉", "❤️", "🙏", "😂"];

function groupByDay(messages) {
  const groups = [];
  let currentDay = null;
  let bucket = null;
  for (const m of messages) {
    const d = dayLabel(m.created_at);
    if (d !== currentDay) {
      currentDay = d;
      bucket = { day: d, items: [] };
      groups.push(bucket);
    }
    bucket.items.push(m);
  }
  return groups;
}

export default function ConversationThread({
  conversation,
  onConversationChange,
  onBack,
  onOpenCourseHub,
  onOpenMembers,
  onOpenProfile,
  onDmFromRoom,
  initialDraft = "",
  compact = false,
}) {
  const [conv, setConv] = useState(conversation);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(initialDraft || "");
  const [replyTo, setReplyTo] = useState(null);
  const [typingName, setTypingName] = useState("");
  const [toast, setToast] = useState(null);
  const [offline, setOffline] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState(null); // message or "conversation"
  const [filesOpen, setFilesOpen] = useState(false);
  const [sharedFiles, setSharedFiles] = useState(null);

  const sockRef = useRef(null);
  const endRef = useRef(null);
  const scrollRef = useRef(null);
  const typingTimer = useRef(null);
  const toastTimer = useRef(null);
  const fileInputRef = useRef(null);
  const seededDraft = useRef(false);
  const pendingFilesRef = useRef(new Map()); // tempId -> { file, caption, reply_to } for retry

  useEffect(() => { setConv(conversation); }, [conversation]);

  const pushToast = useCallback((text, kind = "err") => {
    setToast({ text, kind });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const myIdentity = conv?.me?.identity;
  const isMine = (m) => m._pending || m.sender?.identity === "me" || (myIdentity && m.sender?.identity === myIdentity);
  const iBlocked = !!conv?.blocking?.i_blocked;
  const isRoom = conv?.kind === "ROOM";
  const isBroadcast = conv?.kind === "BROADCAST";
  const isSupport = conv?.kind === "SUPPORT";
  const canPost = conv?.can_post !== false && !iBlocked;

  // Seed composer once from a carried-over draft (e.g. landing-page handoff).
  useEffect(() => {
    if (initialDraft && !seededDraft.current) {
      seededDraft.current = true;
      setDraft(initialDraft);
    }
  }, [initialDraft]);

  // Load history + open the socket whenever the conversation changes.
  useEffect(() => {
    if (!conv?.id) return;
    let alive = true;
    setLoading(true);
    setMessages([]);
    setHasMore(true);
    setReplyTo(null);
    setShowSearch(false);
    setSearchResults(null);

    (async () => {
      try {
        const msgs = await ChatAPI.messages(conv.id, { limit: 40 });
        if (alive) { setMessages(msgs); setHasMore(msgs.length >= 40); }
      } catch { /* the WS history frame will still populate it */ }
      if (alive) setLoading(false);
    })();

    sockRef.current?.close();
    const sock = openChatSocket(conv.id, {
      onOpen: () => setOffline(false),
      onDisconnect: () => setOffline(true),
      onHistory: (data) => { setMessages((prev) => (prev.length ? prev : data)); setLoading(false); },
      onMessage: (m) => {
        setMessages((prev) => {
          if (prev.some((x) => (m.client_id && x.client_id === m.client_id) || x.id === m.id)) {
            return prev.map((x) => ((m.client_id && x.client_id === m.client_id) || x.id === m.id) ? m : x);
          }
          return [...prev, m];
        });
      },
      onTyping: (t) => {
        setTypingName(t.name);
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTypingName(""), 2500);
      },
      onReaction: (d) => {
        setMessages((prev) => prev.map((m) => (m.id === d.message_id ? { ...m, reactions: d.reactions } : m)));
      },
      onMessageDeleted: (d) => {
        setMessages((prev) => prev.map((m) => (m.id === d.id ? { ...m, deleted: true, body: "", attachment: null, reactions: [] } : m)));
      },
      onRead: (d) => {
        setConv((prev) => (prev ? { ...prev, counterpart: prev.counterpart ? { ...prev.counterpart, last_read_at: d.last_read_at } : prev.counterpart } : prev));
      },
      onPresence: (d) => {
        setConv((prev) => {
          if (!prev?.counterpart || prev.counterpart.identity !== d.identity) return prev;
          return { ...prev, counterpart: { ...prev.counterpart, online: d.online, last_seen: d.online ? new Date().toISOString() : prev.counterpart.last_seen } };
        });
      },
      onError: (data) => {
        if (data?.client_id) {
          setMessages((prev) => prev.map((x) => (x.client_id === data.client_id ? { ...x, _pending: false, _failed: true } : x)));
        }
        pushToast(data?.reason || "Message couldn't be sent.", "err");
      },
    });
    sockRef.current = sock;
    ChatAPI.markRead(conv.id).catch(() => {});
    // Tell the global Messages badge (Header) to re-fetch its unread total.
    window.dispatchEvent(new Event("shiksha:messages-read"));
    return () => { alive = false; sock.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv?.id]);

  // Auto-scroll to bottom on new messages, unless the reader has scrolled up.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (nearBottom) endRef.current?.scrollIntoView({ behavior: "smooth" });
    else setShowJump(true);
  }, [messages]);

  const onScroll = async () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowJump(el.scrollHeight - el.scrollTop - el.clientHeight > 300);
    if (el.scrollTop < 80 && hasMore && !loadingMore && messages.length) {
      setLoadingMore(true);
      const oldestAt = messages[0]?.created_at;
      const prevHeight = el.scrollHeight;
      try {
        const older = await ChatAPI.messages(conv.id, { before: oldestAt, limit: 40 });
        if (older.length) {
          setMessages((prev) => [...older, ...prev]);
          requestAnimationFrame(() => { el.scrollTop = el.scrollHeight - prevHeight; });
        }
        setHasMore(older.length >= 40);
      } catch { /* leave hasMore as-is; a manual retry is just scrolling again */ }
      setLoadingMore(false);
    }
  };

  const jumpToLatest = () => { endRef.current?.scrollIntoView({ behavior: "smooth" }); setShowJump(false); };

  const jumpToMessage = (id) => {
    const el = document.getElementById(`cc-msg-${id}`);
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("cc-msg-highlight"); setTimeout(() => el.classList.remove("cc-msg-highlight"), 1400); }
  };

  const send = () => {
    const body = draft.trim();
    if (!body || iBlocked || !canPost) return;
    const client_id = uid();
    setMessages((prev) => [...prev, {
      id: client_id, client_id, body, created_at: new Date().toISOString(),
      message_type: "TEXT", reactions: [], reply_to: replyTo,
      sender: { name: "You", identity: "me" }, _pending: true,
    }]);
    sockRef.current?.send(body, client_id, replyTo?.id);
    setDraft(""); setReplyTo(null);
  };

  const retrySend = (msg) => {
    if (msg.message_type === "FILE" && pendingFilesRef.current.has(msg.client_id)) {
      retryUpload(msg.client_id);
      return;
    }
    setMessages((prev) => prev.map((x) => (x.client_id === msg.client_id ? { ...x, _pending: true, _failed: false } : x)));
    sockRef.current?.send(msg.body, msg.client_id, msg.reply_to?.id);
  };

  const runUpload = async (tempId) => {
    const entry = pendingFilesRef.current.get(tempId);
    if (!entry || !conv?.id) return;
    setUploading(true);
    try {
      const msg = await ChatAPI.uploadAttachment(conv.id, entry.file, { caption: entry.caption, reply_to: entry.reply_to });
      pendingFilesRef.current.delete(tempId);
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        return withoutTemp.some((m) => m.id === msg.id) ? withoutTemp : [...withoutTemp, msg];
      });
    } catch (err) {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, _pending: false, _uploading: false, _failed: true } : m)));
      pushToast(err?.response?.data?.reason || "Couldn't send that file.", "err");
    } finally {
      setUploading(false);
    }
  };

  const retryUpload = (tempId) => {
    setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, _pending: true, _uploading: true, _failed: false } : m)));
    runUpload(tempId);
  };

  // Optimistic like send(): the bubble appears immediately with a "sending"
  // placeholder instead of the composer just freezing until the upload
  // resolves — the file object itself is kept in pendingFilesRef so a
  // failed upload can be retried without re-picking the file.
  const onPickFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !conv?.id) return;
    const tempId = uid();
    pendingFilesRef.current.set(tempId, { file, caption: draft.trim(), reply_to: replyTo?.id });
    setMessages((prev) => [...prev, {
      id: tempId, client_id: tempId,
      body: draft.trim(), message_type: "FILE",
      attachment: { name: file.name, size: file.size },
      reactions: [], reply_to: replyTo,
      created_at: new Date().toISOString(),
      sender: { name: "You", identity: "me" },
      _pending: true, _uploading: true,
    }]);
    setDraft(""); setReplyTo(null);
    runUpload(tempId);
  };

  const refreshConv = useCallback(async () => {
    try {
      const list = await ChatAPI.conversations();
      const updated = list.find((c) => c.id === conv.id);
      if (updated) { setConv(updated); onConversationChange?.(updated); }
    } catch { /* */ }
  }, [conv?.id, onConversationChange]);

  const toggleBlock = async () => {
    const cp = conv?.counterpart;
    if (!cp) return;
    const ident = parseIdentity(cp.identity);
    if (!ident) return;
    try {
      if (conv.blocking?.i_blocked) { await ChatAPI.unblock(ident.kind, ident.id); pushToast(`Unblocked ${cp.name}.`, "ok"); }
      else { await ChatAPI.block(ident.kind, ident.id); pushToast(`Blocked ${cp.name}.`, "ok"); }
      await refreshConv();
    } catch (e) { pushToast(e?.response?.data?.detail || "Couldn't update block.", "err"); }
    setShowMenu(false);
  };

  const togglePin = async () => { const c = await ChatAPI.pin(conv.id); setConv(c); onConversationChange?.(c); setShowMenu(false); };
  const toggleMute = async () => {
    const c = conv.muted_until ? await ChatAPI.mute(conv.id, { unmute: true }) : await ChatAPI.mute(conv.id, { minutes: 480 });
    setConv(c); onConversationChange?.(c); setShowMenu(false);
    pushToast(conv.muted_until ? "Unmuted." : "Muted for 8 hours.", "ok");
  };
  const toggleArchive = async () => {
    const c = await ChatAPI.archive(conv.id);
    setConv(c); onConversationChange?.(c); setShowMenu(false);
    pushToast(c.archived ? "Moved to Archived." : "Restored to Recent.", "ok");
    if (c.archived) onBack?.();
  };

  const runSearch = async (q) => {
    setSearchQ(q);
    if (!q.trim()) { setSearchResults(null); return; }
    try { setSearchResults(await ChatAPI.searchInConversation(conv.id, q.trim())); } catch { setSearchResults([]); }
  };

  const submitReport = async (reason, detail) => {
    try {
      await ChatAPI.reportConversation(conv.id, {
        message_id: reportTarget && reportTarget !== "conversation" ? reportTarget.id : undefined,
        reason, detail,
      });
      pushToast("Thanks — our team will review this.", "ok");
    } catch { pushToast("Couldn't submit the report.", "err"); }
    setReportTarget(null);
  };

  const deleteMsg = async (msg) => {
    try {
      await ChatAPI.deleteMessage(msg.id);
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, deleted: true, body: "", attachment: null, reactions: [] } : m)));
    } catch { pushToast("Couldn't delete that message.", "err"); }
  };

  const reactMsg = async (msg, emoji) => {
    try {
      const { reactions } = await ChatAPI.react(msg.id, emoji);
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, reactions } : m)));
    } catch { pushToast("Couldn't react to that message.", "err"); }
  };

  const openFiles = async () => {
    setFilesOpen(true);
    try { setSharedFiles(await ChatAPI.sharedFiles(conv.id)); } catch { setSharedFiles([]); }
  };

  const groups = useMemo(() => groupByDay(messages), [messages]);
  const otherLastRead = conv?.counterpart?.last_read_at;

  if (!conv) return null;

  const title = conv.title || conv.counterpart?.name || "Conversation";
  const subtitle = conv.kind === "DIRECT"
    ? rolesLabel(conv.counterpart?.roles)
    : conv.kind === "ROOM" ? "Class discussion"
    : conv.kind === "BROADCAST" ? "Announcements · read-only"
    : conv.kind === "SUPPORT" ? "Support ticket"
    : "";

  return (
    <section className="cc-thread">
      <header className="cc-thread-head">
        {compact && <button className="cc-icon-btn" onClick={onBack}><FiChevronLeft size={18} /></button>}
        <button
          className="cc-thread-id"
          onClick={() => (conv.kind === "DIRECT" ? onOpenProfile?.(conv.counterpart?.identity) : null)}
        >
          <Avatar
            src={conv.kind === "DIRECT" ? conv.counterpart?.avatar : null}
            name={title}
            identity={conv.counterpart?.identity}
            online={conv.kind === "DIRECT" ? conv.counterpart?.online : undefined}
            size={34}
          />
          <span className="cc-thread-id-text">
            <span className="cc-thread-title">{title}</span>
            <span className="cc-thread-role">
              {conv.kind === "DIRECT" && conv.counterpart?.online != null
                ? (conv.counterpart.online ? "Online now" : lastSeenLabel(conv.counterpart.last_seen))
                : subtitle}
              {conv.course && <> · {conv.course.title}</>}
              {conv.participant_count > 2 && <> · {conv.participant_count} members</>}
            </span>
          </span>
        </button>

        <div className="cc-thread-actions">
          {conv.muted_until && <FiVolumeX size={15} className="cc-muted-icon" title="Muted" />}
          <button className="cc-icon-btn" title="Search in conversation" onClick={() => setShowSearch((v) => !v)}><FiSearch size={16} /></button>
          <button className="cc-icon-btn" title="Shared files" onClick={openFiles}><FiFolder size={16} /></button>
          {(isRoom || conv.participant_count > 2) && (
            <button className="cc-icon-btn" title="Members" onClick={onOpenMembers}><FiUsers size={16} /></button>
          )}
          {isRoom && conv.course_id && onOpenCourseHub && (
            <button className="cc-icon-btn" title="Course Hub" onClick={() => onOpenCourseHub?.(conv.course_id, conv.course?.title)}><FiBookOpen size={16} /></button>
          )}
          <div className="cc-menu-anchor">
            <button className="cc-icon-btn" onClick={() => setShowMenu((v) => !v)}><FiMoreVertical size={16} /></button>
            {showMenu && (
              <div className="cc-dropdown-menu" onMouseLeave={() => setShowMenu(false)}>
                <button onClick={togglePin}>{conv.pinned ? "Unpin" : "Pin"} conversation</button>
                <button onClick={toggleMute}>{conv.muted_until ? "Unmute" : "Mute 8 hours"}</button>
                <button onClick={toggleArchive}>{conv.archived ? "Restore" : "Archive"}</button>
                {conv.kind === "DIRECT" && conv.can_block && (
                  <button className="cc-menu-danger" onClick={toggleBlock}>{iBlocked ? "Unblock" : "Block"}</button>
                )}
                <button className="cc-menu-danger" onClick={() => { setReportTarget("conversation"); setShowMenu(false); }}>
                  <FiFlag size={13} /> Report
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {showSearch && (
        <div className="cc-inline-search">
          <FiSearch size={14} />
          <input autoFocus value={searchQ} onChange={(e) => runSearch(e.target.value)} placeholder="Search in this conversation…" />
          <button onClick={() => { setShowSearch(false); setSearchResults(null); }}><FiX size={14} /></button>
        </div>
      )}

      <OfflineBanner show={offline} />

      <div className="cc-messages" ref={scrollRef} onScroll={onScroll}>
        {searchResults ? (
          searchResults.length === 0 ? (
            <div className="cc-empty-hint" style={{ padding: 24 }}>No messages match "{searchQ}".</div>
          ) : (
            searchResults.map((m) => (
              <button key={m.id} className="cc-search-hit" onClick={() => { setShowSearch(false); setSearchResults(null); jumpToMessage(m.id); }}>
                <strong>{m.sender?.name}</strong>: {m.body || "(attachment)"} <span>{dayLabel(m.created_at)}</span>
              </button>
            ))
          )
        ) : loading ? (
          <Spinner label="Loading conversation…" />
        ) : messages.length === 0 ? (
          <div className="cc-empty-hint" style={{ padding: 32, textAlign: "center" }}>
            {isBroadcast ? "No announcements yet." : "Say hello 👋 — this is the start of your conversation."}
          </div>
        ) : (
          <>
            {loadingMore && <Spinner label="Loading earlier messages…" />}
            {groups.map((g) => (
              <div key={g.day}>
                <div className="cc-day-sep"><span>{g.day}</span></div>
                {g.items.map((m) => {
                  const mine = isMine(m);
                  const roomLike = isRoom || isBroadcast || isSupport;
                  return (
                    <div id={`cc-msg-${m.id}`} key={m.id}>
                      <MessageBubble
                        msg={m}
                        mine={mine}
                        showSender={roomLike && !mine}
                        isRead={mine && conv.kind === "DIRECT" && otherLastRead ? new Date(otherLastRead) >= new Date(m.created_at) : false}
                        failed={!!m._failed}
                        variant={isBroadcast ? "announcement" : "default"}
                        onReply={setReplyTo}
                        onReact={reactMsg}
                        onDelete={deleteMsg}
                        onReport={(msg) => setReportTarget(msg)}
                        onJumpTo={jumpToMessage}
                        onOpenSender={roomLike ? onDmFromRoom : undefined}
                        onRetry={retrySend}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
            {typingName && <div className="cc-typing">{typingName} is typing…</div>}
            <div ref={endRef} />
          </>
        )}
        {showJump && (
          <button className="cc-jump-btn" onClick={jumpToLatest}>↓ Jump to latest</button>
        )}
      </div>

      {iBlocked ? (
        <div className="cc-blocked-note">You've blocked this person. Unblock to send messages.</div>
      ) : !canPost ? (
        <div className="cc-blocked-note cc-readonly-note">
          {isBroadcast ? "Only this course's teachers can post announcements here." : "This conversation is read-only."}
        </div>
      ) : (
        <div className="cc-composer">
          {replyTo && (
            <div className="cc-reply-preview">
              <span><strong>{replyTo.sender?.name || "Replying"}</strong> {replyTo.body?.slice(0, 80) || "attachment"}</span>
              <button onClick={() => setReplyTo(null)}><FiX size={13} /></button>
            </div>
          )}
          <div className="cc-composer-row">
            <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={onPickFile}
                   accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv" />
            <button className="cc-icon-btn" title="Attach a file" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
              <FiPaperclip size={17} />
            </button>
            <div className="cc-emoji-anchor">
              <button className="cc-icon-btn" title="Emoji" onClick={() => setEmojiOpen((v) => !v)}><FiSmile size={17} /></button>
              {emojiOpen && (
                <div className="cc-emoji-picker cc-emoji-picker-up">
                  {QUICK_EMOJI.map((e) => (
                    <button key={e} onClick={() => { setDraft((d) => d + e); setEmojiOpen(false); }}>{e}</button>
                  ))}
                </div>
              )}
            </div>
            <input
              className="cc-composer-input"
              value={draft}
              placeholder={uploading ? "Sending file…" : "Type a message…"}
              disabled={uploading}
              onChange={(e) => { setDraft(e.target.value); sockRef.current?.typing(); }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <button className="cc-send-btn" onClick={send} disabled={!draft.trim() || uploading}><FiSend size={16} /></button>
          </div>
        </div>
      )}

      {toast && <div className={"cc-toast cc-toast-" + toast.kind}>{toast.text}</div>}

      {reportTarget && (
        <ReportModal
          onClose={() => setReportTarget(null)}
          onSubmit={submitReport}
        />
      )}

      {filesOpen && (
        <div className="cc-modal-backdrop" onClick={() => setFilesOpen(false)}>
          <div className="cc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cc-modal-head"><span>Shared files</span><button onClick={() => setFilesOpen(false)}><FiX size={18} /></button></div>
            <div className="cc-modal-list">
              {sharedFiles === null ? (
                <Spinner label="Loading files…" />
              ) : sharedFiles.length === 0 ? (
                <div className="cc-empty-hint" style={{ padding: 20, textAlign: "center" }}>No files shared here yet.</div>
              ) : (
                sharedFiles.map((f) => (
                  <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="cc-hub-file-chip" style={{ margin: "4px 8px", display: "flex" }}>
                    <FiFileText size={13} /> {f.name} <span style={{ marginLeft: "auto", opacity: .6 }}>{f.uploaded_by}</span> <FiDownload size={12} />
                  </a>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ReportModal({ onClose, onSubmit }) {
  const [reason, setReason] = useState("INAPPROPRIATE");
  const [detail, setDetail] = useState("");
  const REASONS = [
    ["SPAM", "Spam or scam"],
    ["HARASSMENT", "Harassment or bullying"],
    ["INAPPROPRIATE", "Inappropriate content"],
    ["OTHER", "Something else"],
  ];
  return (
    <div className="cc-modal-backdrop" onClick={onClose}>
      <div className="cc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cc-modal-head"><span>Report</span><button onClick={onClose}><FiX size={18} /></button></div>
        <div className="cc-modal-body">
          <div className="cc-field-label">Reason</div>
          <div className="cc-radio-list">
            {REASONS.map(([val, label]) => (
              <label key={val} className="cc-radio-row">
                <input type="radio" checked={reason === val} onChange={() => setReason(val)} /> {label}
              </label>
            ))}
          </div>
          <div className="cc-field-label">Anything else we should know? (optional)</div>
          <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} placeholder="Add details…" />
        </div>
        <div className="cc-modal-foot">
          <button className="cc-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="cc-btn-primary" onClick={() => onSubmit(reason, detail)}>Submit report</button>
        </div>
      </div>
    </div>
  );
}
