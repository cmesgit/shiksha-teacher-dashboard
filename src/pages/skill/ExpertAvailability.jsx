// src/pages/skill/ExpertAvailability.jsx — its own sidebar nav item, matching
// design_handoff_skilldev's flat nav (see SkillDevLayout.jsx). The grid itself
// lives in components/SkillAvailabilityGrid.jsx, shared with the old merged
// "My Profile" page before that was split back apart into this page +
// ExpertSkills.jsx + ExpertProfileEdit.jsx.
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
