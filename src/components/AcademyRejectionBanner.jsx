// src/components/AcademyRejectionBanner.jsx  (NEW)
//
// Shown to a faculty applicant whose academy application was REJECTED.
// Reads the rejection state from the auth payload (teacherInfo.tracks.academy
// === "rejected" + academy_rejection_reason) and offers a one-click re-apply
// that flips the track back to "pending" for another review.

import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import api from "../api/apiClient";

export default function AcademyRejectionBanner() {
  const { teacherInfo, bootstrap } = useAuth();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const rejected = teacherInfo?.tracks?.academy === "rejected";
  if (!rejected || done) return null;

  const reason = (teacherInfo?.academy_rejection_reason || "").trim();

  const reapply = async () => {
    setBusy(true); setErr("");
    try {
      await api.post("/accounts/teacher/reapply-academy/");
      setDone(true);
      await bootstrap();          // refresh status → banner disappears / becomes pending
    } catch (e) {
      setErr(e?.response?.data?.detail || "Couldn't re-submit. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div style={{
      border: "1px solid #f3c2b8", background: "#fdeeea", borderRadius: 12,
      padding: "18px 20px", margin: "0 0 22px", display: "flex", gap: 16,
      alignItems: "flex-start", flexWrap: "wrap",
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: "#f6d5cc", color: "#a83a24", display: "flex",
        alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700,
      }}>!</div>
      <div style={{ flex: 1, minWidth: 240 }}>
        <div style={{ fontWeight: 700, color: "#8f2f1c", fontSize: 16 }}>
          Your faculty application wasn’t approved
        </div>
        <div style={{ color: "#7a4a41", marginTop: 4, fontSize: 14, lineHeight: 1.5 }}>
          {reason
            ? <>The reviewer noted: <em>“{reason}”</em></>
            : "The reviewer didn’t leave a specific note."}
        </div>
        <div style={{ color: "#7a4a41", marginTop: 8, fontSize: 13 }}>
          You can update your details and re-submit for another review.
        </div>
        {err && <div style={{ color: "#c0392b", marginTop: 8, fontSize: 13 }}>{err}</div>}
      </div>
      <button onClick={reapply} disabled={busy}
        style={{
          padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer",
          background: "#c0492f", color: "#fff", fontWeight: 700, fontSize: 14,
          opacity: busy ? 0.6 : 1, alignSelf: "center",
        }}>
        {busy ? "Submitting…" : "Re-apply"}
      </button>
    </div>
  );
}
