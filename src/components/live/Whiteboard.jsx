import { useEffect, useRef, useState } from "react";
import { useRoomContext } from "@livekit/components-react";

const COLORS = ["#1a1a1a", "#e03131", "#1971c2", "#2f9e44", "#f08c00"];
const WIDTHS = [{ label: "S", size: 2 }, { label: "M", size: 5 }, { label: "L", size: 10 }];
const ERASER_SIZE = 28;

/* Shared 1:1-session whiteboard. Strokes are broadcast over LiveKit's data
   channel (same publishData/dataReceived pattern the raise-hand feature
   already uses) — no backend involved. Points are normalized to [0,1] so the
   drawing lines up even when the two sides' canvases differ in pixel size. */
export default function Whiteboard() {
  const room = useRoomContext();
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const strokesRef = useRef([]);       // [{id, color, width, points:[{x,y}]}]
  const currentIdRef = useRef(null);
  const snapshotImgRef = useRef(null); // Image, drawn under strokes if we got one from the peer
  const lastSentRef = useRef(0);
  const counterRef = useRef(0);

  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[1].size);
  const [erasing, setErasing] = useState(false);

  const send = (msg, opts = {}) => {
    try {
      const data = new TextEncoder().encode(JSON.stringify(msg));
      room.localParticipant.publishData(data, { reliable: true, ...opts });
    } catch {
      /* peer may have left mid-stroke — safe to drop */
    }
  };

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (snapshotImgRef.current) {
      ctx.drawImage(snapshotImgRef.current, 0, 0, canvas.width, canvas.height);
    }
    strokesRef.current.forEach((s) => {
      if (s.points.length < 1) return;
      ctx.beginPath();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      s.points.forEach((p, i) => {
        const x = p.x * canvas.width;
        const y = p.y * canvas.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });
  };

  // Resize the canvas' pixel buffer to match its rendered size, then replay
  // every stroke so lines stay put across a resize instead of stretching.
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const applySize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width));
      canvas.height = Math.max(1, Math.round(rect.height));
      redraw();
    };
    applySize();
    const ro = new ResizeObserver(applySize);
    ro.observe(container);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!room) return;

    const handleData = (payload, participant) => {
      let msg;
      try {
        msg = JSON.parse(new TextDecoder().decode(payload));
      } catch {
        return;
      }
      if (!msg || typeof msg !== "object") return;

      switch (msg.type) {
        case "wb-stroke-start":
          strokesRef.current.push({ id: msg.id, color: msg.color, width: msg.width, points: [msg.point] });
          redraw();
          break;
        case "wb-stroke-point": {
          const s = strokesRef.current.find((x) => x.id === msg.id);
          if (s) { s.points.push(msg.point); redraw(); }
          break;
        }
        case "wb-clear":
          strokesRef.current = [];
          snapshotImgRef.current = null;
          redraw();
          break;
        case "wb-request-snapshot": {
          if (strokesRef.current.length === 0) break;
          const canvas = canvasRef.current;
          if (!canvas) break;
          send(
            { type: "wb-snapshot", dataUrl: canvas.toDataURL("image/png") },
            { destinationIdentities: [participant.identity] }
          );
          break;
        }
        case "wb-snapshot": {
          if (!msg.dataUrl) break;
          const img = new Image();
          img.onload = () => { snapshotImgRef.current = img; redraw(); };
          img.src = msg.dataUrl;
          break;
        }
        default:
          break;
      }
    };

    room.on("dataReceived", handleData);
    // Pull in whatever the peer has already drawn (covers both a late joiner
    // and a peer who opened the whiteboard before we did).
    send({ type: "wb-request-snapshot" });
    return () => room.off("dataReceived", handleData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  const pointFromEvent = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  const onPointerDown = (e) => {
    const canvas = canvasRef.current;
    canvas.setPointerCapture(e.pointerId);
    counterRef.current += 1;
    const id = `${room.localParticipant?.identity || "local"}-${Date.now()}-${counterRef.current}`;
    currentIdRef.current = id;
    const strokeColor = erasing ? "#ffffff" : color;
    const strokeWidth = erasing ? ERASER_SIZE : width;
    const point = pointFromEvent(e);
    strokesRef.current.push({ id, color: strokeColor, width: strokeWidth, points: [point] });
    redraw();
    send({ type: "wb-stroke-start", id, color: strokeColor, width: strokeWidth, point });
  };

  const onPointerMove = (e) => {
    if (!currentIdRef.current) return;
    const s = strokesRef.current.find((x) => x.id === currentIdRef.current);
    if (!s) return;
    const point = pointFromEvent(e);
    s.points.push(point);
    redraw();
    const now = performance.now();
    if (now - lastSentRef.current > 30) {
      lastSentRef.current = now;
      send({ type: "wb-stroke-point", id: currentIdRef.current, point });
    }
  };

  const onPointerUp = () => {
    if (!currentIdRef.current) return;
    send({ type: "wb-stroke-end", id: currentIdRef.current });
    currentIdRef.current = null;
  };

  const clearBoard = () => {
    strokesRef.current = [];
    snapshotImgRef.current = null;
    redraw();
    send({ type: "wb-clear" });
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%", background: "#fff" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block", cursor: "crosshair", touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      />
      <div
        style={{
          position: "absolute", top: 10, left: 10, display: "flex", alignItems: "center", gap: 6,
          background: "rgba(255,255,255,.95)", border: "1px solid #e2e8f0", borderRadius: 10,
          padding: "6px 8px", boxShadow: "0 4px 14px rgba(0,0,0,.08)",
        }}
      >
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => { setColor(c); setErasing(false); }}
            title={c}
            style={{
              width: 20, height: 20, borderRadius: "50%", background: c, cursor: "pointer",
              border: !erasing && color === c ? "2px solid #334155" : "1px solid rgba(0,0,0,.15)",
              padding: 0,
            }}
          />
        ))}
        <span style={{ width: 1, height: 20, background: "#e2e8f0", margin: "0 2px" }} />
        {WIDTHS.map((w) => (
          <button
            key={w.label}
            onClick={() => { setWidth(w.size); setErasing(false); }}
            title={`${w.label} pen`}
            style={{
              width: 24, height: 24, borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700,
              background: !erasing && width === w.size ? "#e2e8f0" : "transparent", border: "1px solid #e2e8f0",
            }}
          >
            {w.label}
          </button>
        ))}
        <span style={{ width: 1, height: 20, background: "#e2e8f0", margin: "0 2px" }} />
        <button
          onClick={() => setErasing((v) => !v)}
          title="Eraser"
          style={{
            padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700,
            background: erasing ? "#e2e8f0" : "transparent", border: "1px solid #e2e8f0",
          }}
        >
          Eraser
        </button>
        <button
          onClick={clearBoard}
          title="Clear board"
          style={{ padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700, background: "transparent", border: "1px solid #e2e8f0", color: "#dc2626" }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
