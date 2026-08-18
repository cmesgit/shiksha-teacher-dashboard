import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import * as privateSession from "../api/privateSessionService";
import "../styles/privateSessions.css";
import { LoadingState } from "../components/StateViews";
import NavIcon from "../components/NavIcon";
import TourHeaderButton from "../tour/TourHeaderButton";

export default function PrivateSessionAvailability() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [availability, setAvailability] = useState({});
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    privateSession.getAvailability().then((data) => {
      setAvailability(data);
      setLoading(false);
    });
  }, []);

  const toggle = (day, slot) => {
    setSaved(false);
    setAvailability((prev) => {
      const current = prev[day] || [];
      const updated = current.includes(slot)
        ? current.filter((s) => s !== slot)
        : [...current, slot];
      return { ...prev, [day]: updated };
    });
  };

  const isSelected = (day, slot) => (availability[day] || []).includes(slot);

  const handleSave = async () => {
    await privateSession.saveAvailability(availability);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const totalSlots = Object.values(availability).reduce((acc, slots) => acc + slots.length, 0);

  if (loading) return <LoadingState label="Loading availability" />;

  return (
    <div className="tps__page">
      <div className="tps__headerBox">
        <button className="tps__backBtn" onClick={() => navigate("/teacher/private-sessions")}>← Back</button>
        <h2 className="tps__title" style={{ marginLeft: 12 }}>Private Session Availability</h2>
        <div style={{ marginLeft: "auto" }}><TourHeaderButton pathname={pathname} /></div>
      </div>

      <div className="tps__bodyBox">
        {/* Info banner */}
        <div className="tps__availBanner">
          <div className="tps__availBannerIcon"><NavIcon name="cal" size={24} color="var(--primary)" /></div>
          <div className="tps__availBannerText">
            <strong>Set your weekly availability</strong>
            <p>Students will only be able to request sessions during the time slots you select below. You can change this anytime.</p>
          </div>
          <div className="tps__availBannerCount">
            <span className="tps__availCountNum">{totalSlots}</span>
            <span className="tps__availCountLabel">slots selected</span>
          </div>
        </div>

        {/* Grid */}
        <div className="tps__availCard">
          <div className="tps__availGrid" data-tour="private-availability.grid">
            {/* Time labels column */}
            <div className="tps__availTimeCol">
              <div className="tps__availColHeader" />
              {privateSession.TIME_SLOTS.map((slot) => (
                <div key={slot.value} className="tps__availTimeLabel">{slot.label}</div>
              ))}
            </div>

            {/* Day columns */}
            {privateSession.SHORT_DAYS.map((day, di) => (
              <div key={day} className="tps__availDayCol">
                <div className="tps__availColHeader">
                  <span className="tps__availDayShort">{day}</span>
                  <span className="tps__availDayFull">{privateSession.DAYS[di]}</span>
                </div>
                {privateSession.TIME_SLOTS.map((slot) => (
                  <div
                    key={slot.value}
                    className={`tps__availSlot ${isSelected(day, slot.value) ? "tps__availSlot--selected" : ""}`}
                    onClick={() => toggle(day, slot.value)}
                    title={`${privateSession.DAYS[di]} ${slot.label}`}
                  >
                    {isSelected(day, slot.value) ? "✓" : ""}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="tps__availLegend">
            <div className="tps__availLegendItem">
              <div className="tps__availDot tps__availDot--selected" /> Available
            </div>
            <div className="tps__availLegendItem">
              <div className="tps__availDot tps__availDot--empty" /> Unavailable
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="tps__availActions">
          {saved && (
            <span className="tps__availSavedMsg">
              <NavIcon name="check" size={14} color="var(--success)" /> Availability saved successfully!
            </span>
          )}
          <button className="tps__availSaveBtn" onClick={handleSave} data-tour="private-availability.save">Save Availability</button>
        </div>
      </div>
    </div>
  );
}