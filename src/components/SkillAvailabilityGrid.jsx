/**
 * src/components/SkillAvailabilityGrid.jsx
 *
 * The weekly-availability grid was duplicated near-verbatim between
 * ExpertCourse.jsx (embedded) and ExpertAvailability.jsx (standalone deep
 * link) — same Row/Legend/toggle/save code, copy-pasted. This is the one
 * shared implementation both pages now render; self-contained (owns its own
 * fetch/save calls) so neither caller needs to prop-drill availability state.
 *
 * Adds two things neither old copy had, per design_handoff_skilldev README
 * "6. Availability publishing":
 *   - Per-day "N free"/"Not free" summary + "Free all day"/"Clear day".
 *   - Blackout date ranges (new backend: /skill/teacher/blackouts/).
 */
import { useState, useEffect } from "react";
import { Icon } from "./SkillIcons";
import { DAYS, SLOTS } from "../api/availabilityStore";
import api from "../shared/apiClient";
import { LoadingState } from "./StateViews";
import "../styles/skillAvailabilityGrid.css";

export default function SkillAvailabilityGrid() {
  const [avail, setAvail] = useState({ open: [], booked: [] });
  const [blackouts, setBlackouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [range, setRange] = useState({ from: "", to: "", label: "" });

  useEffect(() => {
    api.get("/skill/teacher/availability/")
      .then((r) => {
        setAvail({ open: r.data.open || [], booked: r.data.booked || [] });
        setBlackouts(r.data.blackouts || []);
      })
      .catch(() => setError("Couldn't load your availability. Please refresh."))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (k) => {
    if (avail.booked.includes(k)) return;
    setAvail((prev) => ({
      ...prev,
      open: prev.open.includes(k) ? prev.open.filter((x) => x !== k) : [...prev.open, k],
    }));
    setSaved(false);
  };

  const freeAllDay = (di) => {
    const dayKeys = SLOTS.map((_, si) => `${di}-${si}`).filter((k) => !avail.booked.includes(k));
    setAvail((prev) => ({ ...prev, open: [...new Set([...prev.open, ...dayKeys])] }));
    setSaved(false);
  };
  const clearDay = (di) => {
    const dayKeys = new Set(SLOTS.map((_, si) => `${di}-${si}`).filter((k) => !avail.booked.includes(k)));
    setAvail((prev) => ({ ...prev, open: prev.open.filter((k) => !dayKeys.has(k)) }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true); setError("");
    try {
      const r = await api.patch("/skill/teacher/availability/", { open: avail.open });
      setAvail({ open: r.data.open || avail.open, booked: r.data.booked || avail.booked });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Couldn't save. Check your connection and try again.");
    } finally { setSaving(false); }
  };

  const addBlackout = async () => {
    if (!range.from) return;
    try {
      const r = await api.post("/skill/teacher/blackouts/", {
        date_from: range.from, date_to: range.to || range.from, label: range.label,
      });
      setBlackouts((b) => [...b, r.data]);
      setRange({ from: "", to: "", label: "" });
    } catch { /* silently ignored — form stays as-is for retry */ }
  };

  const removeBlackout = async (id) => {
    try {
      await api.delete(`/skill/teacher/blackouts/${id}/`);
      setBlackouts((b) => b.filter((x) => x.id !== id));
    } catch { /* leave it listed on failure */ }
  };

  if (loading) return <LoadingState plain label="Loading availability" />;

  return (
    <>
      <div className="rd-card teacher">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 10, flexWrap: "wrap" }}>
          <h4 style={{ margin: 0 }}>Weekly availability</h4>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {saved && <span className="sag-saved"><Icon.check size={13} /> Saved</span>}
            <button className="sk-btn" style={{ padding: "8px 16px", fontSize: 12 }} onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
        <p style={{ fontSize: 12, color: "#6b7c83", margin: "0 0 12px", lineHeight: 1.5 }}>
          Tap a time to mark yourself free or not free. Students can only book the times you leave open.
        </p>

        {error && <div className="sag-error">{error}</div>}

        <div className="sag-legend">
          <span className="sag-legendItem"><span className="sag-swatch sag-swatch--open" /> Open</span>
          <span className="sag-legendItem"><span className="sag-swatch sag-swatch--booked" /> Booked</span>
          <span className="sag-legendItem"><span className="sag-swatch sag-swatch--closed" /> Closed</span>
        </div>

        <div className="sag-grid">
          {DAYS.map((d, di) => {
            const openCount = SLOTS.filter((_, si) => avail.open.includes(`${di}-${si}`) && !avail.booked.includes(`${di}-${si}`)).length;
            return (
              <div className="sag-dayRow" key={d}>
                <div className="sag-dayLabel">{d}</div>
                <div className="sag-slots">
                  {SLOTS.map((sl, si) => {
                    const k = `${di}-${si}`;
                    const st = avail.booked.includes(k) ? "booked" : avail.open.includes(k) ? "open" : "closed";
                    return (
                      <button
                        key={sl}
                        disabled={st === "booked"}
                        onClick={() => toggle(k)}
                        className={`sag-slot sag-slot--${st}`}
                        title={st === "booked" ? "Already booked — cannot be closed" : sl}
                      >
                        {sl}
                      </button>
                    );
                  })}
                </div>
                <div className="sag-dayFooter">
                  <span className={openCount ? "sag-freeCount" : "sag-notFree"}>{openCount ? `${openCount} free` : "Not free"}</span>
                  <button className="sag-dayLink" onClick={() => freeAllDay(di)}>Free all day</button>
                  <button className="sag-dayLink" onClick={() => clearDay(di)}>Clear day</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rd-card teacher">
        <h4 style={{ margin: "0 0 4px" }}>Blackout dates</h4>
        <p style={{ fontSize: 12, color: "#6b7c83", margin: "0 0 12px", lineHeight: 1.5 }}>
          Going on holiday? Block whole date ranges — students can&apos;t book them, and the calendar
          respects it automatically.
        </p>
        {blackouts.length === 0 ? (
          <div className="sk-empty">No blackout dates set.</div>
        ) : blackouts.map((b) => (
          <div className="sag-blackoutRow" key={b.id}>
            <div>
              <div className="sag-blackoutRange">{fmtRange(b.date_from, b.date_to)}</div>
              {b.label && <div className="sag-blackoutLabel">{b.label}</div>}
            </div>
            <button className="sag-removeBtn" onClick={() => removeBlackout(b.id)} aria-label="Remove">×</button>
          </div>
        ))}
        <div className="sag-blackoutForm">
          <input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="sag-dateInput" />
          <span className="sag-arrow">→</span>
          <input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="sag-dateInput" />
          <input placeholder="Label (optional)" value={range.label} onChange={(e) => setRange((r) => ({ ...r, label: e.target.value }))} className="sag-labelInput" />
          <button className="sk-btn" style={{ padding: "8px 16px", fontSize: 12 }} onClick={addBlackout} disabled={!range.from}>Add</button>
        </div>
      </div>
    </>
  );
}

function fmtRange(from, to) {
  const f = new Date(from).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const t = new Date(to).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return from === to ? f : `${f} – ${t}`;
}
