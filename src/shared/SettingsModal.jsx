/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  GENERATED FILE — DO NOT EDIT HERE.                                         │
 * │  Canonical source: <workspace>/shared/src/shared/SettingsModal.jsx          │
 * │  Edit the canonical copy, then run `npm run sync:shared` (any app) to        │
 * │  propagate. `npm run check:shared` fails if an app's copy has drifted.       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * SettingsModal — the Settings shell, byte-identical across landing / student /
 * teacher. Sidebar + search + content pane + save strip, per the ShikshaCom
 * "Account Dropdown & Settings Redesign" handoff.
 *
 * Terminology (keep consistent — no "mode" / "context" in labels):
 *   Account · Profile · Track · Faculty (Academy) · Expert (Skill-Dev).
 *
 * LAYOUT
 * ──────
 * A modal, not a route. The handoff preferred routes for deep-linkability, but
 * the three host apps have three unrelated route trees (flat landing routes,
 * StudentLayout children, three TeacherRoutes layout branches) and Settings is
 * opened from a header dropdown present on all of them. One modal in the synced
 * shared/ set stays one implementation; three route trees would be three. Deep
 * links are preserved instead via `?settings=<section>`, which the shell reads
 * on open and keeps in sync as the user navigates — so back/forward and a pasted
 * URL both work without owning a route.
 *
 * SECTIONS
 * ────────
 * Profile   · Profiles, Personal, Academic, Parent/guardian   (editing → save strip)
 * Security  · Security & PIN, Sessions & devices
 * Prefs     · Notifications, Learning goals
 * Account   · Billing & payments, Teacher identity, Privacy & data
 *
 * The four editing sections all edit ONE LearnerProfile through one form state
 * and one PATCH; see settings/ProfileSections.jsx for the edit-scope rule. The
 * rest commit their own actions immediately and have no save strip.
 *
 * ENDPOINTS
 * ─────────
 *   GET|POST   /accounts/profiles/            list / add a profile
 *   GET|PATCH|DELETE /accounts/profiles/{id}/ read / save / remove
 *   POST       /accounts/profiles/pin/        set / clear a profile PIN
 *   POST       /accounts/change-password/
 *   GET        /accounts/choices/             select options (never hardcoded)
 *   GET        /accounts/sessions/ …          Sessions & devices
 *   GET|PATCH  /accounts/learning-goals/      Learning goals + streak
 *   GET        /accounts/billing/             real access & payment history
 *   POST       /accounts/data-export/         download my data
 *   POST       /accounts/delete-account/      close my account
 *   GET|PUT    /notifications/preferences/    channels, categories, language
 *
 * Nothing is stored in localStorage any more. The previous version kept bio and
 * every notification toggle per-device under `shk_prefs_v1` / `shiksha_prefs_*`,
 * so a user's settings silently reverted on any other browser.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  RiSearchLine, RiCloseLine, RiUserLine, RiIdCardLine, RiGraduationCapLine,
  RiParentLine, RiShieldKeyholeLine, RiDeviceLine, RiNotification3Line,
  RiFocus2Line, RiBankCardLine, RiTeamLine, RiLockUnlockLine,
} from "react-icons/ri";

import { useAuth } from "../contexts/AuthContext";
import {
  EditScopeStrip, ProfilesSection, PersonalSection, AcademicSection, GuardianSection,
} from "./settings/ProfileSections";
import {
  SecuritySection, SessionsSection, NotificationsSection, GoalsSection,
  BillingSection, TeacherIdentitySection, PrivacySection,
} from "./settings/AccountSections";
import { Notice, errText, initials } from "./settings/primitives";
import "./SettingsModal.css";

/* ── Section registry ───────────────────────────────────────────────────────
 * Single source of truth for the sidebar, the search index and the save strip.
 * `keywords` reproduces the handoff's search index so synonyms match ("dob"
 * finds Personal, "sign out" finds Sessions). */
const SECTIONS = [
  { key: "profiles", group: "Profile", label: "Profiles", icon: RiUserLine,
    editing: true, hint: "Changes apply to the selected profile",
    keywords: "profile child dependent add learner avatar display name photo bio" },
  { key: "personal", group: "Profile", label: "Personal details", icon: RiIdCardLine,
    editing: true, hint: "Reused by the faculty application",
    keywords: "personal first last name phone address gender date of birth dob birthday pincode state district" },
  { key: "academic", group: "Profile", label: "Academic", icon: RiGraduationCapLine,
    editing: true, hint: "Personalises courses & syllabus",
    keywords: "academic class grade board cbse icse mbse nios stream school syllabus academic year" },
  { key: "guardian", group: "Profile", label: "Parent / guardian", icon: RiParentLine,
    editing: true, hint: "Contact for child profiles",
    keywords: "parent guardian father mother contact family email" },

  { key: "security", group: "Security", label: "Security & PIN", icon: RiShieldKeyholeLine,
    keywords: "security pin password change password login authentication" },
  { key: "sessions", group: "Security", label: "Sessions & devices", icon: RiDeviceLine,
    keywords: "session device logout log out sign out revoke everywhere browser phone" },

  { key: "notifications", group: "Preferences", label: "Notifications", icon: RiNotification3Line,
    keywords: "notification email sms whatsapp push alerts language reminders messages mute" },
  { key: "goals", group: "Preferences", label: "Learning goals", icon: RiFocus2Line,
    keywords: "goal streak reminder daily target habit study minutes days" },

  { key: "billing", group: "Account", label: "Billing & payments", icon: RiBankCardLine,
    keywords: "billing payment invoice receipt upi card pay course access subscription price free" },
  { key: "teacher", group: "Account", label: "Teacher identity", icon: RiTeamLine,
    keywords: "teacher faculty academy expert skill skill-dev track apply teaching identity" },
  { key: "privacy", group: "Account", label: "Privacy & data", icon: RiLockUnlockLine,
    keywords: "privacy data export download delete delete account close account" },
];

const GROUP_ORDER = ["Profile", "Security", "Preferences", "Account"];
const EDITING_KEYS = SECTIONS.filter((s) => s.editing).map((s) => s.key);
const SECTION_KEYS = SECTIONS.map((s) => s.key);

const SUGGESTIONS = [
  { label: "Password", key: "security" },
  { label: "Billing", key: "billing" },
  { label: "Notifications", key: "notifications" },
  { label: "Sign-in devices", key: "sessions" },
];

/** The section named by `?settings=<key>`, or null. Exported so the host header
 *  (ProfileSwitcher) can open Settings on the right section for a pasted deep
 *  link — the modal can't do it alone, since it isn't mounted-open on load. */
export function settingsSectionFromUrl() {
  if (typeof window === "undefined") return null;
  const key = new URLSearchParams(window.location.search).get("settings");
  return key && SECTION_KEYS.includes(key) ? key : null;
}

/* Every field the editing sections own, in the shape the profile PATCH takes.
 * Kept as one flat object so dirty-tracking is a single comparison. */
const BLANK_FORM = {
  display_name: "", bio: "",
  first_name: "", last_name: "", phone: "", gender: "", date_of_birth: "",
  state: "", district: "", city_town: "", pin_code: "",
  currently_studying: "", current_class: "", stream: "", board: "",
  board_other: "", school_name: "", academic_year: "",
  highest_education: "", reason_not_studying: "",
  father_name: "", father_phone: "", mother_name: "", mother_phone: "",
  guardian_name: "", guardian_phone: "", parent_guardian_email: "",
};

const formFrom = (row) => {
  const out = { ...BLANK_FORM };
  for (const k of Object.keys(BLANK_FORM)) out[k] = row?.[k] ?? "";
  return out;
};

/* ══════════════════════════════════════════════════════════════════════════ */
export default function SettingsModal({
  open,
  section: initialSection = "profiles",
  onClose,
  teacherSignupUrl = "/signup?role=teacher",
  teachUrl = "",
  onManageTrack,
}) {
  const { user, profiles, activeProfile, teacherInfo, isTeacherContext, api, bootstrap } = useAuth();

  const [section, setSection] = useState(initialSection);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [editId, setEditId] = useState(null);
  const [choices, setChoices] = useState({});
  const [form, setForm] = useState(BLANK_FORM);
  const [baseline, setBaseline] = useState(BLANK_FORM);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newProfile, setNewProfile] = useState({ name: "", relationship: "DEPENDENT" });
  const [removing, setRemoving] = useState(false);
  const [removePw, setRemovePw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [closed, setClosed] = useState(null);   // account-closed confirmation

  const searchRef = useRef(null);
  const paneRef = useRef(null);

  const email = user?.email || "";
  const editProfile = rows.find((r) => r.id === editId) || null;
  const editName = editProfile?.display_name || "this profile";
  const meta = SECTIONS.find((s) => s.key === section) || SECTIONS[0];
  const isEditing = EDITING_KEYS.includes(section);
  const dirty = useMemo(
    () => !!avatarFile || JSON.stringify(form) !== JSON.stringify(baseline),
    [form, baseline, avatarFile],
  );

  /* ── data loading ── */
  const loadProfiles = useCallback(async (preferId) => {
    try {
      const res = await api.get("/accounts/profiles/");
      const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setRows(list);
      const pick =
        (preferId && list.find((p) => p.id === preferId)) ||
        (editId && list.find((p) => p.id === editId)) ||
        (activeProfile && list.find((p) => p.id === activeProfile.id)) ||
        list[0];
      return pick || null;
    } catch {
      // /profiles/ unreachable — fall back to the copies AuthContext already has
      // so the surface still renders something editable.
      const list = profiles || [];
      setRows(list);
      return activeProfile || list[0] || null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, activeProfile, profiles, editId]);

  /* The list endpoint is lean (no academic / guardian columns), so the detail
     endpoint is fetched for whichever profile is being edited. */
  const selectForEdit = useCallback(async (id, seed) => {
    setEditId(id);
    setAvatarFile(null); setAvatarPreview(null);
    setRemoving(false); setRemovePw("");
    if (seed) { setForm(formFrom(seed)); setBaseline(formFrom(seed)); }
    try {
      const res = await api.get(`/accounts/profiles/${id}/`);
      if (res?.data) {
        const merged = formFrom({ ...(seed || {}), ...res.data });
        setForm(merged); setBaseline(merged);
        setRows((prev) => prev.map((p) => (p.id === id ? { ...p, ...res.data } : p)));
      }
    } catch { /* keep the lean fields already shown */ }
  }, [api]);

  useEffect(() => {
    if (!open) return;
    setSection(SECTION_KEYS.includes(initialSection) ? initialSection : "profiles");
    setQuery(""); setMsg(null); setAdding(false); setClosed(null);
    (async () => {
      const pick = await loadProfiles();
      if (pick) await selectForEdit(pick.id, pick);
    })();
    // Choices come from the server so no dropdown can drift from what the
    // serializers accept.
    api.get("/accounts/choices/").then((r) => setChoices(r.data || {})).catch(() => setChoices({}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* ── deep link: ?settings=<section> ── */
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("settings") === section) return;
    url.searchParams.set("settings", section);
    window.history.replaceState(window.history.state, "", url);
  }, [open, section]);

  useEffect(() => {
    if (open || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("settings")) return;
    url.searchParams.delete("settings");
    window.history.replaceState(window.history.state, "", url);
  }, [open]);

  /* ── Esc to close, focus the search on open, restore focus on close ── */
  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [open, onClose]);

  /* Section changes reset the scroll position — otherwise a short section opens
     scrolled to wherever the previous long one was. */
  useEffect(() => { if (paneRef.current) paneRef.current.scrollTop = 0; }, [section]);

  /* ── search ── */
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.filter(
      (s) => s.label.toLowerCase().includes(q) || s.keywords.includes(q),
    );
  }, [query]);

  const go = (key) => { setSection(key); setQuery(""); setMsg(null); };

  /* ── actions ── */
  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  /* Changing the edit target rebinds all four editing forms, so unsaved edits
     would vanish without a word. Ask first. */
  const pickEditProfile = (id) => {
    if (id === editId) return;
    if (dirty && !window.confirm(
      `Discard unsaved changes to ${editName}?`
    )) return;
    selectForEdit(id, rows.find((r) => r.id === id));
  };

  const onPickAvatar = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setAvatarFile(f);
    setAvatarPreview(URL.createObjectURL(f));
  };

  const save = async () => {
    if (!editId) return;
    setBusy(true); setMsg(null);
    try {
      // multipart because the avatar may ride along; the endpoint accepts both.
      const fd = new FormData();
      for (const [k, v] of Object.entries(form)) fd.append(k, v ?? "");
      if (avatarFile) fd.append("avatar_image", avatarFile);
      const res = await api.patch(`/accounts/profiles/${editId}/`, fd);
      setBaseline(formFrom({ ...form, ...(res?.data || {}) }));
      setAvatarFile(null); setAvatarPreview(null);
      await bootstrap?.();
      await loadProfiles(editId);
      setMsg({ kind: "ok", text: "Saved." });
    } catch (e) {
      setMsg({ kind: "err", text: errText(e, "Could not save your changes.") });
    } finally { setBusy(false); }
  };

  const addProfile = async () => {
    if (!newProfile.name.trim()) {
      setMsg({ kind: "err", text: "Give the profile a name." }); return;
    }
    setBusy(true); setMsg(null);
    try {
      const fd = new FormData();
      fd.append("display_name", newProfile.name.trim());
      fd.append("relationship", newProfile.relationship || "DEPENDENT");
      const res = await api.post("/accounts/profiles/", fd);
      setAdding(false); setNewProfile({ name: "", relationship: "DEPENDENT" });
      await bootstrap?.();
      const pick = await loadProfiles(res?.data?.id);
      if (pick) await selectForEdit(pick.id, pick);
      setMsg({ kind: "ok", text: "Profile added." });
    } catch (e) {
      setMsg({ kind: "err", text: errText(e, "Could not add the profile.") });
    } finally { setBusy(false); }
  };

  const removeProfile = async () => {
    if (!removePw) {
      setMsg({ kind: "err", text: "Enter your account password to remove this profile." });
      return;
    }
    setBusy(true); setMsg(null);
    try {
      await api.delete(`/accounts/profiles/${editId}/`, { data: { password: removePw } });
      setRemoving(false); setRemovePw("");
      await bootstrap?.();
      const pick = await loadProfiles();
      if (pick) await selectForEdit(pick.id, pick);
      setMsg({ kind: "ok", text: "Profile removed." });
    } catch (e) {
      setMsg({ kind: "err", text: errText(e, "Could not remove the profile.") });
    } finally { setBusy(false); }
  };

  /* Teaching-track destinations. The Faculty and Expert public-profile editors
     are real screens in the teacher app; Settings links to them rather than
     shipping a second copy of each form. */
  const homeBase = (teacherSignupUrl || "").split("/signup")[0];
  const applyUrl = (track) =>
    `${homeBase}/signup?role=teacher&add_track=${encodeURIComponent(track)}`;
  // "Edit … profile" goes to that track's public-profile editor; "Switch to …"
  // goes to the track's normal landing page — switching tracks shouldn't dump
  // you into a form you didn't ask for.
  const EDITOR_PATH = {
    academy: "/teacher/profile",
    skill: "/teacher/expert/profile",
  };
  const TRACK_HOME = {
    academy: "/teacher/dashboard",
    skill: "/teacher/expert/profile",
  };
  const openEditor = (track) => {
    const dest = EDITOR_PATH[track];
    // From a learner context the teacher app needs a password unlock first, so
    // route through the switcher's flow rather than a raw link that would bounce
    // to login.
    if (onManageTrack) { onManageTrack(track, dest); return; }
    if (teachUrl) {
      const origin = new URL(teachUrl, window.location.href).origin;
      window.location.href = origin + dest;
    }
  };

  if (!open) return null;

  const grouped = GROUP_ORDER
    .map((g) => ({ group: g, items: visible.filter((s) => s.group === g) }))
    .filter((g) => g.items.length > 0);

  // Portalled to document.body: the header this lives under has
  // backdrop-filter, which makes it the containing block for any position:fixed
  // descendant and would clip the overlay to the header's box.
  return createPortal(
    <div className="st-overlay"
      onClick={(e) => { if (e.target.classList.contains("st-overlay")) onClose?.(); }}>
      <div className="st-card" role="dialog" aria-modal="true" aria-label="Settings">

        {/* ── header ── */}
        <div className="st-head">
          <span className="st-head__av">{initials(activeProfile?.display_name || user?.username)}</span>
          <div className="st-head__txt">
            <div className="st-head__title">Settings</div>
            <div className="st-head__sub">
              {[activeProfile?.display_name, email].filter(Boolean).join(" · ")}
            </div>
          </div>
          <button type="button" className="st-head__x" onClick={onClose} aria-label="Close settings">
            <RiCloseLine />
          </button>
        </div>

        {/* ── search ── */}
        <div className="st-searchbar">
          <RiSearchLine className="st-searchbar__icon" />
          <input
            ref={searchRef}
            className="st-searchbar__input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Search settings — try "password", "devices", "streak"…'
            aria-label="Search settings"
          />
          {query && (
            <button type="button" className="st-searchbar__clear"
              onClick={() => setQuery("")} aria-label="Clear search">
              <RiCloseLine />
            </button>
          )}
        </div>

        {!query && (
          <div className="st-chips">
            {SUGGESTIONS.map((s) => (
              <button key={s.key} type="button" className="st-chip" onClick={() => go(s.key)}>
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* ── body: sidebar + pane ── */}
        <div className="st-body">
          <nav className="st-side st-scroll" aria-label="Settings sections">
            {grouped.length === 0 && (
              <p className="st-side__none">No settings match “{query}”.</p>
            )}
            {grouped.map(({ group, items }) => (
              <div key={group}>
                <div className="st-side__group">{group}</div>
                {items.map((s) => {
                  const Icon = s.icon;
                  return (
                    <button key={s.key} type="button"
                      className={`st-navitem ${section === s.key ? "on" : ""}`}
                      onClick={() => go(s.key)}
                      data-tour={s.key === "sessions" ? "settings.sessions-nav" : undefined}>
                      <Icon className="st-navitem__icon" />
                      <span className="st-navitem__lbl">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="st-pane st-scroll" ref={paneRef}>
            {closed ? (
              <div className="st-closed">
                <div className="st-closed__glyph">👋</div>
                <h2 className="st-h1">Your account is closed</h2>
                <p className="st-caption">
                  You’ve been signed out everywhere. Your data is permanently
                  deleted after {closed.grace_days} days — contact support before
                  then if this was a mistake.
                </p>
                <button type="button" className="st-btn st-btn--primary"
                  onClick={() => window.location.reload()}>
                  Done
                </button>
              </div>
            ) : (
              <>
                {isEditing && rows.length > 0 && (
                  <EditScopeStrip
                    profiles={rows}
                    editId={editId}
                    onPick={pickEditProfile}
                  />
                )}

                {section === "profiles" && (
                  <ProfilesSection
                    profiles={rows} editId={editId}
                    activeProfileId={activeProfile?.id}
                    onPick={pickEditProfile}
                    form={form} setField={setField}
                    avatarPreview={avatarPreview} onPickAvatar={onPickAvatar}
                    adding={adding} setAdding={setAdding}
                    newProfile={newProfile} setNewProfile={setNewProfile}
                    onAddProfile={addProfile}
                    choices={choices} busy={busy}
                    canRemove={rows.length > 1 && !editProfile?.is_default}
                    onRemove={() => setRemoving(true)}
                  />
                )}

                {section === "profiles" && removing && (
                  <div className="st-danger">
                    <p className="st-danger__warn">
                      Removing “{editName}” can’t be undone. Enter your account
                      password to confirm.
                    </p>
                    <input className="st-input st-input--danger" type="password"
                      autoComplete="current-password" placeholder="Account password"
                      value={removePw} onChange={(e) => setRemovePw(e.target.value)} />
                    <div className="st-confirm__row">
                      <button type="button" className="st-btn st-btn--danger-solid"
                        onClick={removeProfile} disabled={busy}>
                        {busy ? "Removing…" : "Remove profile"}
                      </button>
                      <button type="button" className="st-btn"
                        onClick={() => { setRemoving(false); setRemovePw(""); }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {section === "personal" && (
                  <PersonalSection form={form} setField={setField}
                    choices={choices} api={api} editName={editName} />
                )}
                {section === "academic" && (
                  <AcademicSection form={form} setField={setField}
                    choices={choices} editName={editName} />
                )}
                {section === "guardian" && (
                  <GuardianSection form={form} setField={setField} />
                )}
                {section === "security" && (
                  <SecuritySection api={api} editProfile={editProfile}
                    onProfilesChanged={async () => {
                      await bootstrap?.();
                      await loadProfiles(editId);
                    }} />
                )}
                {section === "sessions" && <SessionsSection api={api} />}
                {section === "notifications" && (
                  <NotificationsSection api={api} email={email} />
                )}
                {section === "goals" && (
                  <GoalsSection api={api} editProfileId={editId} />
                )}
                {section === "billing" && <BillingSection api={api} />}
                {section === "teacher" && (
                  <TeacherIdentitySection
                    teacherInfo={teacherInfo}
                    applyUrl={applyUrl}
                    onOpenEditor={openEditor}
                    onSwitchTrack={(t) => onManageTrack?.(t, TRACK_HOME[t])}
                    isTeacherContext={isTeacherContext}
                    activeTrack={teacherInfo?.active_track}
                  />
                )}
                {section === "privacy" && (
                  <PrivacySection api={api} email={email}
                    onDeleted={(data) => setClosed(data)} />
                )}

                {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
              </>
            )}
          </div>
        </div>

        {/* ── footer save strip ── */}
        <div className="st-foot">
          <span className="st-foot__hint">
            {isEditing ? meta.hint : ""}
          </span>
          <div className="st-foot__actions">
            <button type="button" className="st-foot__close" onClick={onClose}>Close</button>
            {isEditing && !closed && (
              <button type="button" className="st-btn st-btn--primary"
                onClick={save} disabled={busy || !dirty}>
                {busy ? "Saving…" : "Save changes"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
