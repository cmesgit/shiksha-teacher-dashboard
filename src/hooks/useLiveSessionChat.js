import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";

const WS_HOST = import.meta.env.VITE_WS_HOST || "api.shikshacom.com";

export default function useLiveSessionChat(sessionId) {
  const [messages, setMessages] = useState([]);
  const [sessionStatus, setSessionStatus] = useState(null);
  const [connected, setConnected] = useState(false);
  const [rawHistory, setRawHistory] = useState([]);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const { user } = useAuth();

  // 🔥 Recalculate isMe when user loads
  useEffect(() => {
    if (user?.id && rawHistory.length > 0) {
      setMessages(rawHistory.map((msg, i) => ({
        id: i,
        sender: msg.sender,
        text: msg.text,
        isMe: String(msg.sender_id) === String(user.id),
        isTeacher: msg.isTeacher,
        time: msg.time,
      })));
    }
  }, [user, rawHistory]);

  const connect = useCallback(() => {
    if (!sessionId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${WS_HOST}/ws/live-session/${sessionId}/`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        if (data.type === "initial_state" || data.type === "session_update") {
          setSessionStatus(data.data.status);
        }

        if (data.type === "chat_message") {
          const msg = data.data;
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now(),
              sender: msg.sender,
              text: msg.text,
              isMe: String(msg.sender_id) === String(user?.id),
              isTeacher: msg.isTeacher,
              time: msg.time,
            },
          ]);
        } else if (data.type === "chat_history") {
          console.log('📜 Chat history received:', data.data.length, 'messages');
          setRawHistory(data.data);
          setMessages(data.data.map((msg, i) => ({
            id: i,
            sender: msg.sender,
            text: msg.text,
            isMe: String(msg.sender_id) === String(user?.id),
            isTeacher: msg.isTeacher,
            time: msg.time,
          })));
        }
      } catch {}
    };

    ws.onclose = () => {
      setConnected(false);
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => ws.close();
  }, [sessionId]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect]);

  const sendMessage = useCallback(async (text) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: "chat_message",
      text,
    }));
  }, []);

  return { messages, connected, sendMessage, sessionStatus };
}
