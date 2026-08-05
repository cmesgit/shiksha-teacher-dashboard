// src/pages/skill/ExpertAvailability.jsx — standalone deep link.
// The grid itself now lives in one place, shared with the embedded copy on
// "My Profile" (ExpertCourse.jsx) — see components/SkillAvailabilityGrid.jsx.
// This page used to carry its own full copy of the Row/Legend/toggle/save
// code, near-duplicated with ExpertCourse's; that duplication is gone.
import SkillAvailabilityGrid from "../../components/SkillAvailabilityGrid";
import "../../styles/skillDev.css";

export default function ExpertAvailability() {
  return (
    <div className="sk-page">
      <div className="sk-head">
        <div>
          <div className="sk-head__title">Availability</div>
          <div className="sk-head__sub">Set the hours learners can book you for 1-on-1 sessions</div>
        </div>
      </div>
      <SkillAvailabilityGrid />
    </div>
  );
}
