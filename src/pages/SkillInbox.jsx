/**
 * SkillInbox.jsx — expert teacher's incoming messages from learners.
 * Teacher reads + replies to each conversation.
 */
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import "../styles/skillInbox.css";

const timeAgo = (d) => {
  if (!d) return "";
  const s = Math.floor((Date.now()-new Date(d))/1000);
  if (s<60) return "just now";
  if (s<3600) return `${Math.floor(s/60)}m ago`;
  if (s<86400) return `${Math.floor(s/3600)}h ago`;
  return new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short"});
};

function Thread({ convId, learnerName, api }) {
  const [messages, setMessages] = useState([]);
  const [text, setText]         = useState("");
  const [sending, setSending]   = useState(false);
  const endRef = useRef(null);
  const load = async () => { try { const r = await api.get(`/skill/conversations/${convId}/`); setMessages(r.data.messages||[]); } catch {} };
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [convId]);
  useEffect(() => { endRef.current?.scrollIntoView({behavior:"smooth"}); }, [messages.length]);
  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try { const r = await api.post(`/skill/conversations/${convId}/messages/`, { body:text.trim() }); setMessages(m=>[...m,r.data]); setText(""); }
    catch {} finally { setSending(false); }
  };
  return (
    <div className="si-thread">
      <div className="si-thread__head">
        <div className="si-av">{(learnerName||"S")[0]}</div>
        <div className="si-thread__name">{learnerName}</div>
      </div>
      <div className="si-msgs">
        {messages.length===0 && <div className="si-empty">No messages yet.</div>}
        {messages.map(m => (
          <div key={m.id} className={`si-bubble ${m.from_me?"si-bubble--me":"si-bubble--them"}`}>
            <div className="si-bubble__body">{m.body}</div>
            <div className="si-bubble__time">{timeAgo(m.created_at)}</div>
          </div>
        ))}
        <div ref={endRef}/>
      </div>
      <div className="si-compose">
        <input className="si-compose__input" value={text} onChange={e=>setText(e.target.value)}
          placeholder="Reply…" onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}/>
        <button className="si-compose__btn" onClick={send} disabled={sending||!text.trim()}>
          {sending?"…":"Send"}
        </button>
      </div>
    </div>
  );
}

export default function SkillInbox() {
  const { api }       = useAuth();
  const [convs, setConvs]   = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/skill/teacher/inbox/").then(r=>{ setConvs(r.data||[]); }).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  return (
    <div className="si-page">
      <div className="si-sidebar">
        <div className="si-sidebar__head">Student Messages</div>
        {loading && <div className="si-sidebar__empty">Loading…</div>}
        {!loading && convs.length===0 && <div className="si-sidebar__empty">No messages yet.</div>}
        {convs.map(c => (
          <div key={c.id} className={`si-conv ${active?.id===c.id?"si-conv--active":""} ${c.unread?"si-conv--unread":""}`}
            onClick={()=>setActive(c)} role="button" tabIndex={0}>
            <div className="si-av">{(c.learner.name||"S")[0]}</div>
            <div className="si-conv__body">
              <div className="si-conv__name">{c.learner.name}</div>
              <div className="si-conv__preview">{c.last_message?.body||"…"}</div>
            </div>
            <div className="si-conv__meta">
              <span className="si-conv__time">{timeAgo(c.updated_at)}</span>
              {c.unread>0 && <span className="si-unread">{c.unread}</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="si-main">
        {active
          ? <Thread convId={active.id} learnerName={active.learner.name} api={api}/>
          : <div className="si-main__placeholder"><span style={{fontSize:40}}>💬</span><p>Select a conversation</p></div>}
      </div>
    </div>
  );
}
