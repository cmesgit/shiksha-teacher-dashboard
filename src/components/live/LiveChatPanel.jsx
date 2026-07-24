import { useEffect, useRef, useState } from "react";
import { IoSend } from "react-icons/io5";
import "./LiveChatPanel.css";

export default function LiveChatPanel({ messages = [], onSendMessage }) {
  const [input, setInput] = useState("");
  const containerRef = useRef(null);

  /* ── Auto-scroll ── */
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (isNearBottom) el.scrollTop = el.scrollHeight;
  }, [messages]);

  /* ── Send ── */
  const sendMessage = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    if (onSendMessage) {
      try { await onSendMessage(text); }
      catch (e) { console.error("send failed", e); }
    }
  };

  /* ── Time format ── */
  const fmt = (ts) =>
    ts
      ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";

  return (
    <div className="cp-outer">
      <div className="cp-header">Chat</div>

      <div className="cp-wrap">
        <div className="cp-messages" ref={containerRef}>
          {messages.length === 0 && (
            <p className="cp-empty">No messages yet. Say hello!</p>
          )}

          {messages.map((msg, i) => {
            const isMe = !!msg.isMe;

            return (
              <div
                key={msg.id || i}
                className={`cp-row ${isMe ? "cp-row--me" : "cp-row--other"}`}
              >
                <div className={`cp-meta ${isMe ? "cp-meta--me" : "cp-meta--other"}`}>
                  {isMe ? (
                    <>
                      <span className="cp-time">{fmt(msg.time)}</span>
                      <span className="cp-name">You</span>
                    </>
                  ) : (
                    <>
                      <span className="cp-name">{msg.sender}</span>
                      <span className="cp-time">{fmt(msg.time)}</span>
                    </>
                  )}
                </div>

                <div className={`cp-bubble ${isMe ? "cp-bubble--me" : "cp-bubble--other"}`}>
                  <span className="cp-text">{msg.text}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="cp-input-area">
        <input
          className="cp-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />

        <button className="cp-send-btn" onClick={sendMessage} aria-label="Send">
          <IoSend size={20} />
        </button>
      </div>
    </div>
  );
}
