/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  GENERATED FILE — DO NOT EDIT HERE.                                         │
 * │  Canonical: <workspace>/shared/src/shared/settings/ProfileSections.jsx      │
 * │  Edit the canonical copy, then run `npm run sync:shared` (any app).          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * The four *editing* sections of Settings — Profiles, Personal, Academic and
 * Parent/guardian. They all edit ONE LearnerProfile, share one form state, and
 * commit through the shell's single Save button
 * (PATCH /accounts/profiles/{id}/), which is why they live in one file.
 *
 * THE TWO-PROFILE-ID RULE
 * ───────────────────────
 * `editId` (which profile these forms edit) is deliberately separate from the
 * auth context's ACTIVE profile (who you are signed in as). Editing your
 * child's academic details must not switch you into their account. The account
 * dropdown owns switching (POST /accounts/profiles/select/); this surface only
 * edits. The "Editing this profile" strip exists to make that distinction
 * visible, since the two would otherwise be indistinguishable.
 */
import { useEffect, useRef, useState } from "react";
import { RiArrowRightSLine, RiPencilLine, RiLockLine, RiAddLine } from "react-icons/ri";

import {
  Choice, EmptyCard, Field, Grid2, GroupLabel, SectionHead, initials,
} from "./primitives";

/* ═══════════════════════════════════════════════════════════════════════════
 * "Editing this profile" strip — rendered above all four sections
 * ═══════════════════════════════════════════════════════════════════════════ */
export function EditScopeStrip({ profiles, editId, onPick }) {
  const current = profiles.find((p) => p.id === editId);
  if (!current || profiles.length === 0) return null;
  return (
    <div className="st-scope">
      <span className="st-scope__av">{initials(current.display_name)}</span>
      <div className="st-scope__txt">
        <div className="st-scope__eyebrow">Editing this profile</div>
        <div className="st-scope__name">{current.display_name}</div>
      </div>
      {profiles.length > 1 && (
        <select
          className="st-scope__select"
          value={editId}
          onChange={(e) => onPick(e.target.value)}
          aria-label="Switch profile to edit"
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.display_name}</option>
          ))}
        </select>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Profiles
 * ═══════════════════════════════════════════════════════════════════════════ */
export function ProfilesSection({
  profiles, editId, activeProfileId, onPick, form, setField,
  avatarPreview, onPickAvatar, onAddProfile, adding, setAdding,
  newProfile, setNewProfile, choices, busy, canRemove, onRemove,
}) {
  const fileRef = useRef(null);
  const current = profiles.find((p) => p.id === editId);

  return (
    <>
      <SectionHead
        title="Profiles"
        caption="Everyone under this email. Add children or dependents; each keeps its own progress."
      />

      {profiles.map((p) => {
        const editing = p.id === editId;
        const inUse = p.id === activeProfileId;
        return (
          <button
            key={p.id}
            type="button"
            className={`st-profcard ${editing ? "st-profcard--editing" : ""}`}
            onClick={() => onPick(p.id)}
          >
            {p.avatar_type === "image" && p.avatar
              ? <img className="st-profcard__av" src={p.avatar} alt="" />
              : <span className="st-profcard__av st-profcard__av--txt">{initials(p.display_name)}</span>}
            <div className="st-profcard__txt">
              <div className="st-profcard__nm">{p.display_name}</div>
              <div className="st-profcard__sub">
                {[
                  p.relationship === "DEPENDENT" ? "Child" : "Primary",
                  p.current_class ? `Class ${p.current_class}` : "",
                ].filter(Boolean).join(" · ")}
              </div>
            </div>
            {p.requires_pin && (
              <span className="st-pill st-pill--grey"><RiLockLine /> PIN</span>
            )}
            {inUse && <span className="st-pill st-pill--green">In use</span>}
            {editing && (
              <span className="st-pill st-pill--teal"><RiPencilLine /> Editing</span>
            )}
            <RiArrowRightSLine className="st-profcard__chev" />
          </button>
        );
      })}

      {!adding ? (
        <button type="button" className="st-adddash" onClick={() => setAdding(true)}>
          <RiAddLine /> Add a profile
        </button>
      ) : (
        <div className="st-addform">
          <input
            className="st-input"
            placeholder="Profile name"
            value={newProfile.name}
            onChange={(e) => setNewProfile((n) => ({ ...n, name: e.target.value }))}
          />
          <Choice
            value={newProfile.relationship}
            onChange={(v) => setNewProfile((n) => ({ ...n, relationship: v }))}
            options={choices.relationship || []}
            placeholder="Relationship"
          />
          <button type="button" className="st-btn st-btn--primary"
            onClick={onAddProfile} disabled={busy}>
            {busy ? "Creating…" : "Create"}
          </button>
          <button type="button" className="st-btn" onClick={() => setAdding(false)}>
            Cancel
          </button>
        </div>
      )}

      <GroupLabel>
        Profile photo &amp; name{current ? ` · ${current.display_name}` : ""}
      </GroupLabel>

      <div className="st-photorow">
        {avatarPreview
          ? <img className="st-bigav" src={avatarPreview} alt="" />
          : current?.avatar_type === "image" && current?.avatar
            ? <img className="st-bigav" src={current.avatar} alt="" />
            : <span className="st-bigav st-bigav--txt">{initials(current?.display_name)}</span>}
        <button type="button" className="st-btn" onClick={() => fileRef.current?.click()}>
          Change photo
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickAvatar} />
      </div>

      <Field label="Display name">
        <input className="st-input" value={form.display_name}
          onChange={(e) => setField("display_name", e.target.value)} />
      </Field>

      <Field label="Bio" hint={`${(form.bio || "").length}/280`}>
        <textarea className="st-input st-textarea" rows={2} maxLength={280}
          placeholder="A short line about you" value={form.bio}
          onChange={(e) => setField("bio", e.target.value)} />
      </Field>

      {/* Removing the default profile would leave the account with no identity
          to sign in as, so the shell only passes canRemove for the others. */}
      {canRemove && (
        <>
          <GroupLabel tone="danger">Remove this profile</GroupLabel>
          <p className="st-caption">
            Deletes “{current?.display_name}” and all of its progress. Needs your
            account password.
          </p>
          <button type="button" className="st-btn st-btn--danger" onClick={onRemove}>
            Remove profile
          </button>
        </>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Personal details
 * ═══════════════════════════════════════════════════════════════════════════ */
export function PersonalSection({ form, setField, choices, api, editName }) {
  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);

  useEffect(() => {
    let alive = true;
    api.get("/accounts/states/")
      .then((r) => {
        if (!alive) return;
        const list = Array.isArray(r.data) ? r.data : [];
        setStates(list.map((s) => (typeof s === "string" ? s : s.name)).filter(Boolean));
      })
      .catch(() => setStates([]));
    return () => { alive = false; };
  }, [api]);

  // District options depend on the chosen state. Reloaded on every state change
  // including the initial one, so an already-saved state shows its districts.
  useEffect(() => {
    let alive = true;
    if (!form.state) { setDistricts([]); return undefined; }
    api.get(`/accounts/states/${encodeURIComponent(form.state)}/districts/`)
      .then((r) => { if (alive) setDistricts(Array.isArray(r.data) ? r.data : []); })
      .catch(() => { if (alive) setDistricts([]); });
    return () => { alive = false; };
  }, [api, form.state]);

  const asOptions = (list) => list.map((v) => ({ value: v, label: v }));

  return (
    <>
      <SectionHead
        title="Personal details"
        caption="Optional. These details are reused by the faculty application, so you never type them twice."
      />
      <Grid2>
        <Field label="First name">
          <input className="st-input" value={form.first_name}
            onChange={(e) => setField("first_name", e.target.value)} />
        </Field>
        <Field label="Last name">
          <input className="st-input" value={form.last_name}
            onChange={(e) => setField("last_name", e.target.value)} />
        </Field>
        <Field label="Phone">
          <input className="st-input" inputMode="tel" maxLength={20} value={form.phone}
            onChange={(e) => setField("phone", e.target.value)} />
        </Field>
        <Field label="Date of birth">
          <input className="st-input" type="date" value={form.date_of_birth}
            onChange={(e) => setField("date_of_birth", e.target.value)} />
        </Field>
      </Grid2>

      <Field label="Gender">
        <Choice value={form.gender} onChange={(v) => setField("gender", v)}
          options={choices.gender || []} placeholder="Prefer not to say" />
      </Field>

      <GroupLabel>Address</GroupLabel>
      <Grid2>
        <Field label="State">
          {/* Dependent selects, not free text: the backend publishes both lists,
              and a typo'd state would silently break district lookups. */}
          <Choice
            value={form.state}
            onChange={(v) => { setField("state", v); setField("district", ""); }}
            options={asOptions(states)}
            placeholder="Select state"
          />
        </Field>
        <Field label="District">
          <Choice value={form.district} onChange={(v) => setField("district", v)}
            options={asOptions(districts)}
            placeholder={form.state ? "Select district" : "Pick a state first"}
            disabled={!form.state} />
        </Field>
        <Field label="City / town">
          <input className="st-input" value={form.city_town}
            onChange={(e) => setField("city_town", e.target.value)} />
        </Field>
        <Field label="Pincode">
          <input className="st-input" inputMode="numeric" maxLength={10} value={form.pin_code}
            onChange={(e) => setField("pin_code", e.target.value.replace(/\D/g, ""))} />
        </Field>
      </Grid2>
      <p className="st-footnote">Saved to {editName}’s profile.</p>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Academic details
 * ═══════════════════════════════════════════════════════════════════════════ */
export function AcademicSection({ form, setField, choices, editName }) {
  const studying = form.currently_studying;
  return (
    <>
      <SectionHead
        title="Academic details"
        caption={`Used to personalise courses, boards and syllabus for ${editName}.`}
      />
      <Field label="Currently studying?">
        <Choice value={studying} onChange={(v) => setField("currently_studying", v)}
          options={choices.currently_studying || []} placeholder="—" />
      </Field>

      {/* Conditional branches mirror the server's validation, so the form can't
          submit a combination FormFillupView would reject. */}
      {studying === "yes" && (
        <>
          <Grid2>
            <Field label="Class">
              <Choice value={form.current_class} onChange={(v) => setField("current_class", v)}
                options={choices.current_class || []} />
            </Field>
            <Field label="Stream">
              <Choice value={form.stream} onChange={(v) => setField("stream", v)}
                options={choices.stream || []} />
            </Field>
            <Field label="Board">
              <Choice value={form.board} onChange={(v) => setField("board", v)}
                options={choices.board || []} />
            </Field>
            {form.board === "other" && (
              <Field label="Board name">
                <input className="st-input" value={form.board_other}
                  onChange={(e) => setField("board_other", e.target.value)} />
              </Field>
            )}
            <Field label="School / institution">
              <input className="st-input" maxLength={250} value={form.school_name}
                onChange={(e) => setField("school_name", e.target.value)} />
            </Field>
            <Field label="Academic year">
              <input className="st-input" maxLength={20} placeholder="e.g. 2025–26"
                value={form.academic_year}
                onChange={(e) => setField("academic_year", e.target.value)} />
            </Field>
          </Grid2>
        </>
      )}

      {studying === "no" && (
        <Grid2>
          <Field label="Highest education">
            <Choice value={form.highest_education}
              onChange={(v) => setField("highest_education", v)}
              options={choices.highest_education || []} />
          </Field>
          <Field label="Reason for not studying">
            <input className="st-input" maxLength={200} value={form.reason_not_studying}
              onChange={(e) => setField("reason_not_studying", e.target.value)} />
          </Field>
        </Grid2>
      )}

      {!studying && (
        <EmptyCard
          glyph="🎓"
          body="Pick whether this learner is currently studying to see the relevant fields."
        />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Parent / guardian
 * ═══════════════════════════════════════════════════════════════════════════ */
export function GuardianSection({ form, setField }) {
  // The server requires at least one complete name+phone pair. Mirrored here so
  // the user sees why before a round trip, not after.
  const anyComplete =
    (form.father_name && form.father_phone) ||
    (form.mother_name && form.mother_phone) ||
    (form.guardian_name && form.guardian_phone);
  const anyTyped = [
    form.father_name, form.father_phone, form.mother_name,
    form.mother_phone, form.guardian_name, form.guardian_phone,
  ].some(Boolean);

  return (
    <>
      <SectionHead
        title="Parent / guardian"
        caption="Contact for updates, results and fee reminders on child profiles."
      />
      <Grid2>
        <Field label="Father’s name">
          <input className="st-input" maxLength={150} value={form.father_name}
            onChange={(e) => setField("father_name", e.target.value)} />
        </Field>
        <Field label="Father’s phone">
          <input className="st-input" inputMode="tel" maxLength={15} value={form.father_phone}
            onChange={(e) => setField("father_phone", e.target.value)} />
        </Field>
        <Field label="Mother’s name">
          <input className="st-input" maxLength={150} value={form.mother_name}
            onChange={(e) => setField("mother_name", e.target.value)} />
        </Field>
        <Field label="Mother’s phone">
          <input className="st-input" inputMode="tel" maxLength={15} value={form.mother_phone}
            onChange={(e) => setField("mother_phone", e.target.value)} />
        </Field>
        <Field label="Guardian’s name">
          <input className="st-input" maxLength={150} value={form.guardian_name}
            onChange={(e) => setField("guardian_name", e.target.value)} />
        </Field>
        <Field label="Guardian’s phone">
          <input className="st-input" inputMode="tel" maxLength={15} value={form.guardian_phone}
            onChange={(e) => setField("guardian_phone", e.target.value)} />
        </Field>
      </Grid2>

      <Field label="Parent / guardian email">
        <input className="st-input" type="email" placeholder="guardian@email.com"
          value={form.parent_guardian_email}
          onChange={(e) => setField("parent_guardian_email", e.target.value)} />
      </Field>

      {anyTyped && !anyComplete && (
        <p className="st-fielderr">
          Give at least one complete contact — a name and a phone number for the
          same person.
        </p>
      )}
    </>
  );
}
