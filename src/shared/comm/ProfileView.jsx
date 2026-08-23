// PLACEMENT: put this file in BOTH apps (identical):
//   student_dashboard/src/shared/comm/ProfileView.jsx
//   teacher_ui/src/shared/comm/ProfileView.jsx
//
// CC-019 User Profile. Reachable from a DM header, Course Hub members, or
// the Directory. Teacher profiles are rich (bio/headline/courses); learner
// profiles are minimal by design — see chat/services.py's build_profile().
import { useEffect, useRef, useState } from "react";
import { FiX, FiMessageCircle, FiBookOpen } from "react-icons/fi";
import { ChatAPI } from "../chatClient";
import { Avatar, Spinner, EmptyState, rolesLabel, parseIdentity, useDismissable } from "./common";

export default function ProfileView({ identity, onClose, onMessage }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(false);
  const closeBtnRef = useRef(null);
  useDismissable(true, { onClose, initialFocusRef: closeBtnRef });

  useEffect(() => {
    const ident = parseIdentity(identity);
    if (!ident) { setError(true); return; }
    ChatAPI.profile(ident.kind, ident.id).then(setProfile).catch(() => setError(true));
  }, [identity]);

  return (
    <div className="cc-modal-backdrop" onClick={onClose}>
      <div className="cc-modal cc-profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cc-modal-head"><span>Profile</span><button ref={closeBtnRef} onClick={onClose}><FiX size={18} /></button></div>
        {error ? (
          <EmptyState title="Couldn't load this profile" />
        ) : !profile ? (
          <Spinner label="Loading profile…" />
        ) : (
          <div className="cc-profile-body">
            <Avatar src={profile.avatar} name={profile.name} identity={identity} size={72} />
            <div className="cc-profile-name">{profile.name}</div>
            <div className="cc-profile-role">{rolesLabel(profile.roles) || profile.role_label}</div>
            {profile.headline && <div className="cc-profile-headline">{profile.headline}</div>}
            {profile.bio && <p className="cc-profile-bio">{profile.bio}</p>}
            {profile.courses?.length > 0 && (
              <div className="cc-profile-courses">
                <div className="cc-field-label"><FiBookOpen size={12} /> Teaches</div>
                <div className="cc-cat-chips">
                  {profile.courses.map((c) => <span key={c} className="cc-chip">{c}</span>)}
                </div>
              </div>
            )}
            {profile.kind === "TEACHER" && (
              <button className="cc-btn-primary cc-profile-msg-btn" onClick={() => onMessage?.(profile)}>
                <FiMessageCircle size={14} /> Message
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
