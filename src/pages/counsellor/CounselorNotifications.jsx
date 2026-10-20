import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../shared/apiClient";
import { useCounselor } from "../../layout/CounselorContext";
import "../../styles/counsellor.css";

export default function CounselorNotifications() {
  const navigate = useNavigate();
  const { refreshNotifications } = useCounselor() || {};
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/notifications/", {
        params: { role: "COUNSELOR", verb_prefix: "counseling.", page_size: 100 },
      }).then(({ data }) => {
        setError("");
        setItems(data.results || []);
      }).catch(() => {
        setError("Couldn't load notifications. Please try again.");
        setItems([]);
      });
  }, []);

  const open = async (item) => {
    if (!item.is_read) {
      try {
        await api.post(`/notifications/${item.id}/read/`);
        setItems((rows) => rows.map((row) => row.id === item.id ? { ...row, is_read: true } : row));
        refreshNotifications?.();
      } catch { setError("Couldn't mark that notification as read."); }
    }
    const appointmentId = item.payload?.appointment_id;
    if (appointmentId) navigate(`/teacher/counsellor/appointments/${appointmentId}`);
  };

  const markAll = async () => {
    // Mark only the counselling rows shown here; the account may also have
    // Academy and Skill Development notifications.
    const unread = (items || []).filter((item) => !item.is_read);
    try {
      await Promise.all(unread.map((item) => api.post(`/notifications/${item.id}/read/`)));
      setItems((rows) => rows.map((row) => ({ ...row, is_read: true })));
      refreshNotifications?.();
    } catch { setError("Some notifications couldn't be marked as read. Please refresh and try again."); }
  };

  const unread = (items || []).filter((item) => !item.is_read).length;
  return <div className="co-page">
    <div className="co-head"><div><h1 className="co-title">Notifications</h1>
      <p className="co-sub">Counselling updates and booking activity{unread ? ` · ${unread} unread` : ""}.</p></div>
      {unread > 0 && <button className="co-btn co-btn--outline" onClick={markAll}>Mark all read</button>}
    </div>
    {error && <div className="co-error">{error}</div>}
    {items === null ? <div className="co-skel" style={{ height: 140 }} /> : items.length === 0 ?
      <div className="co-empty"><div className="co-empty-title">No counselling notifications</div>Booking and session updates will appear here.</div> :
      <div className="co-list">{items.map((item) => <button key={item.id}
        className={`co-card co-card--row co-notification${item.is_read ? "" : " co-notification--unread"}`}
        onClick={() => open(item)}>
        <span className="co-card-main"><span className="co-card-title">{item.title}</span>
          {item.body && <span className="co-card-sub">{item.body}</span>}
          <span className="co-card-sub">{new Date(item.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
        </span>{!item.is_read && <span className="co-chip co-chip--slate">New</span>}
      </button>)}</div>}
  </div>;
}
