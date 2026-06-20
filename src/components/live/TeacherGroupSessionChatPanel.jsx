import { useEffect, useRef, useState } from "react";
import { IoSend } from "react-icons/io5";

export default function TeacherGroupSessionChatPanel({
  messages = [],
  onSendMessage,
}) {
  const [input, setInput] = useState("");
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const el = containerRef.current;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (isNearBottom) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const text = input.trim();
    setInput("");

    if (onSendMessage) {
      try {
        await onSendMessage(text);
      } catch (e) {
        console.error("send failed", e);
      }
    }
  };

  const fmt = (ts) =>
    ts
      ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";

  return (
    <div className="tgs-chat">
      <div className="tgs-chat-header">Chat</div>

      <div className="tgs-chat-body">
        <div className="tgs-chat-messages" ref={containerRef}>
          {messages.length === 0 && (
            <p className="tgs-chat-empty">No messages yet. Say hello!</p>
          )}

          {messages.map((msg, i) => {
            const isMe = !!msg.isMe;

            return (
              <div
                key={msg.id || i}
                className={`tgs-chat-row ${isMe ? "tgs-chat-row--me" : "tgs-chat-row--other"}`}
              >
                <div className={`tgs-chat-meta ${isMe ? "tgs-chat-meta--me" : "tgs-chat-meta--other"}`}>
                  {isMe ? (
                    <>
                      <span className="tgs-chat-time">{fmt(msg.time)}</span>
                      <span className="tgs-chat-name">You</span>
                    </>
                  ) : (
                    <>
                      <span className="tgs-chat-name">{msg.sender}</span>
                      <span className="tgs-chat-time">{fmt(msg.time)}</span>
                    </>
                  )}
                </div>

                <div className={`tgs-chat-bubble ${isMe ? "tgs-chat-bubble--me" : "tgs-chat-bubble--other"}`}>
                  <span>{msg.text}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="tgs-chat-input-area">
        <input
          className="tgs-chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />

        <button className="tgs-chat-send-btn" onClick={sendMessage} aria-label="Send">
          <IoSend size={22} />
        </button>
      </div>
    </div>
  );
}
