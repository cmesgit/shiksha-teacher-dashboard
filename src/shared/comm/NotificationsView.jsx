// PLACEMENT: put this file in BOTH apps (identical):
//   student_dashboard/src/shared/comm/NotificationsView.jsx
//   teacher_ui/src/shared/comm/NotificationsView.jsx
//
// CC-017 Notification Center. Reads the CANONICAL /api/notifications/
// endpoints (list, mark-read, mark-all-read, preferences) — a genuinely
// different data source from the existing bell dropdown, which reads
// /api/activity/feed/ (see this stage's closure report for the full
// architectural note: the two systems aren't unified yet, and this view
// intentionally uses the one chat/announcements/support actually write
// into, rather than the legacy one).
import { useEffect, useState, useMemo } from "react";
import {
  FiBell, FiCheck, FiFilter, FiMessageCircle, FiRadio, FiHeadphones,
  FiCalendar, FiBookOpen, FiCreditCard, FiUserCheck,
} from "react-icons/fi";
import api from "../apiClient";
import useNotificationNavigator from "../useNotificationNavigator";
import { EmptyState, Spinner, dayLabel, timeAgo } from "./common";

const CATEGORY_ICONS = {
  social: FiMessageCircle,
  announcements: FiRadio,
  support: FiHeadphones,
  bookings: FiCalendar,
  reminders: FiCalendar,
  classes: FiBookOpen,
  learning: FiBookOpen,
  payments: FiCreditCard,
  account: FiUserCheck,
};

const VERB_CATEGORY = {
  "chat.message": "social",
  "announcement.posted": "announcements",
  "support.reply": "support",
};

function iconFor(n) {
  const cat = VERB_CATEGORY[n.verb] || n.verb?.split(".")[0];
  return CATEGORY_ICONS[cat] || FiBell;
}

export default function NotificationsView({ identity, track, onNavigate }) {
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState(false);
  // `track` prop overrides, otherwise take the app's current track. The
  // hook is app-local, so this works identically in both dashboards
  // without ChatPanel (shared, no router/CourseContext access) having to
  // thread anything through.
  const { openLink, activeTrack } = useNotificationNavigator();
  const scope = track ?? activeTrack;

  const load = async () => {
    try {
      // `track` scopes the list to the caller's product track, exactly like
      // the bell. Cross-track rows (chat/forum/counselling) come back under
      // BOTH tracks — the server filters on `track__in=["", track]` — so
      // scoping here never hides a DM.
      const params = { page_size: 60 };
      if (identity) params.identity = identity;
      if (scope) params.track = scope;
      const { data } = await api.get("/notifications/", { params });
      setItems(data.results || []);
    } catch { setError(true); setItems([]); }
  };

  useEffect(() => { load(); }, [identity, scope]); // eslint-disable-line react-hooks/exhaustive-deps

  const markAll = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    // Scoped: clearing this track's list must not clear the other one.
    try { await api.post("/notifications/read/", scope ? { track: scope } : {}); } catch { /* */ }
  };

  const markOne = async (n) => {
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    try { await api.post(`/notifications/${n.id}/read/`); } catch { /* */ }

    // Actually navigate. This used to call `onNavigate?.(n.link_url)`, but
    // both mounts passed `onNavigate={() => setView("inbox")}` and dropped
    // the argument, so every click in this view was a dead end. The
    // navigator is app-local (student routes at root, teacher under
    // /teacher) and also persists the track where that app needs it.
    if (!n.link_url) return;
    const routed = openLink(n.link_url);
    // Let the host close/redirect the panel only once we know the link was
    // usable — otherwise a row with an unroutable link_url would still
    // yank the user back to the inbox.
    if (routed) onNavigate?.(n.link_url);
  };

  const verbs = useMemo(() => {
    const set = new Set((items || []).map((n) => n.verb));
    return Array.from(set);
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    if (filter === "all") return items;
    return items.filter((n) => n.verb === filter);
  }, [items, filter]);

  const today = filtered.filter((n) => dayLabel(n.created_at) === "Today");
  const earlier = filtered.filter((n) => dayLabel(n.created_at) !== "Today");
  const unreadCount = (items || []).filter((n) => !n.is_read).length;

  return (
    <div className="cc-notifications-view">
      <header className="cc-view-head">
        <span className="cc-view-title"><FiBell size={16} /> Notifications {unreadCount > 0 && <span className="cc-count-pill">{unreadCount}</span>}</span>
        {unreadCount > 0 && <button className="cc-btn-secondary" onClick={markAll}><FiCheck size={13} /> Mark all read</button>}
      </header>

      {verbs.length > 1 && (
        <div className="cc-cat-chips" style={{ padding: "0 16px 10px" }}>
          <button className={"cc-chip" + (filter === "all" ? " cc-chip-active" : "")} onClick={() => setFilter("all")}><FiFilter size={11} /> All</button>
          {verbs.map((v) => (
            <button key={v} className={"cc-chip" + (filter === v ? " cc-chip-active" : "")} onClick={() => setFilter(v)}>
              {v.split(".")[0]}
            </button>
          ))}
        </div>
      )}

      <div className="cc-notifications-scroll">
        {items === null ? (
          <Spinner label="Loading notifications…" />
        ) : error ? (
          <EmptyState title="Couldn't load notifications" hint="Try again in a moment." />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<FiBell size={22} />} title="You're all caught up" hint="New activity will show up here." />
        ) : (
          <>
            {today.length > 0 && (
              <div className="cc-notif-group">
                <div className="cc-notif-group-label">Today</div>
                {today.map((n) => <NotifRow key={n.id} n={n} onClick={() => markOne(n)} />)}
              </div>
            )}
            {earlier.length > 0 && (
              <div className="cc-notif-group">
                <div className="cc-notif-group-label">Earlier</div>
                {earlier.map((n) => <NotifRow key={n.id} n={n} onClick={() => markOne(n)} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function NotifRow({ n, onClick }) {
  const Icon = iconFor(n);
  return (
    <button className={"cc-notif-row" + (!n.is_read ? " cc-notif-row-unread" : "")} onClick={onClick}>
      <span className="cc-notif-icon"><Icon size={15} /></span>
      <span className="cc-notif-body">
        <span className="cc-notif-title">{n.title}</span>
        {n.body && <span className="cc-notif-text">{n.body}</span>}
        <span className="cc-notif-time">{timeAgo(n.created_at)} ago</span>
      </span>
      {!n.is_read && <span className="cc-notif-dot" />}
    </button>
  );
}
