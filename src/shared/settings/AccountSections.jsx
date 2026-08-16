/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  GENERATED FILE — DO NOT EDIT HERE.                                         │
 * │  Canonical: <workspace>/shared/src/shared/settings/AccountSections.jsx      │
 * │  Edit the canonical copy, then run `npm run sync:shared` (any app).          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * The non-editing Settings sections. Each commits its own actions immediately
 * (there is no shared Save button for these), and each fetches its own data when
 * it mounts — Settings opens on Profiles, so nothing here is loaded until the
 * user actually navigates to it.
 *
 * WHAT IS DELIBERATELY NOT HERE
 * ─────────────────────────────
 * The handoff prototype also showed a two-factor-authentication toggle, a
 * Free/Plus/Pro plan grid, and "Show me in the expert directory". None of the
 * three has a backend: there is no 2FA enrolment flow, no Plan model (course
 * access is bought individually), and no directory-visibility column. A toggle
 * that silently does nothing is worse than an absent one, so they are omitted
 * rather than stubbed. Billing renders the real access windows and payments
 * instead; see accounts/settings_views.py:BillingView.
 */
import { useEffect, useState } from "react";
import {
  RiComputerLine, RiSmartphoneLine, RiTabletLine, RiDownloadLine,
  RiArrowRightLine, RiShieldKeyholeLine, RiBookLine, RiFireLine,
  RiFocus3Line, RiGraduationCapLine, RiFlashlightLine,
} from "react-icons/ri";

import {
  Badge, CardRow, Choice, EmptyCard, Field, GroupLabel, Grid2, Loading,
  Notice, SectionHead, ToggleRow, errText, fmtDate, relTime, rupees,
} from "./primitives";

/* ═══════════════════════════════════════════════════════════════════════════
 * Security & PIN
 * ═══════════════════════════════════════════════════════════════════════════ */
export function SecuritySection({ api, editProfile, onProfilesChanged }) {
  const [pinMode, setPinMode] = useState(null);        // 'set' | 'remove' | null
  const [pin, setPin] = useState("");
  const [pinPw, setPinPw] = useState("");
  const [pinMsg, setPinMsg] = useState(null);
  const [pinBusy, setPinBusy] = useState(false);

  const [pw, setPw] = useState({ old: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState(null);
  const [pwBusy, setPwBusy] = useState(false);

  const hasPin = !!editProfile?.requires_pin;
  const name = editProfile?.display_name || "this profile";

  const savePin = async () => {
    if (pinMode === "set" && !/^\d{4,6}$/.test(pin)) {
      setPinMsg({ kind: "err", text: "PIN must be 4–6 digits." }); return;
    }
    if (!pinPw) {
      setPinMsg({ kind: "err", text: "Enter your account password." }); return;
    }
    setPinBusy(true); setPinMsg(null);
    try {
      await api.post("/accounts/profiles/pin/", {
        profile_id: editProfile.id,
        pin: pinMode === "remove" ? "" : pin,
        password: pinPw,
      });
      setPinMode(null); setPin(""); setPinPw("");
      setPinMsg({ kind: "ok", text: pinMode === "remove" ? "PIN removed." : "PIN updated." });
      await onProfilesChanged?.();
    } catch (e) {
      setPinMsg({ kind: "err", text: errText(e, "Could not update the PIN.") });
    } finally { setPinBusy(false); }
  };

  const savePassword = async () => {
    setPwMsg(null);
    if (!pw.old || !pw.next) {
      setPwMsg({ kind: "err", text: "Fill in your current and new password." }); return;
    }
    if (pw.next.length < 8) {
      setPwMsg({ kind: "err", text: "New password must be at least 8 characters." }); return;
    }
    if (pw.next !== pw.confirm) {
      setPwMsg({ kind: "err", text: "New passwords don’t match." }); return;
    }
    setPwBusy(true);
    try {
      await api.post("/accounts/change-password/",
        { old_password: pw.old, new_password: pw.next });
      setPw({ old: "", next: "", confirm: "" });
      setPwMsg({ kind: "ok", text: "Password changed." });
    } catch (e) {
      setPwMsg({ kind: "err", text: errText(e, "Could not change the password.") });
    } finally { setPwBusy(false); }
  };

  return (
    <>
      <SectionHead title="Security &amp; PIN"
        caption="Protect this profile and your account sign-in." />

      <CardRow title="Profile PIN" sub={`Ask for a PIN when switching into ${name}`}>
        {!pinMode && (
          <>
            <button type="button" className="st-btn"
              onClick={() => { setPinMode("set"); setPin(""); setPinPw(""); setPinMsg(null); }}>
              {hasPin ? "Change PIN" : "Set PIN"}
            </button>
            {hasPin && (
              <button type="button" className="st-btn st-btn--danger"
                onClick={() => { setPinMode("remove"); setPinPw(""); setPinMsg(null); }}>
                Remove
              </button>
            )}
          </>
        )}
      </CardRow>

      {pinMode && (
        <div className="st-inset">
          {pinMode === "set" && (
            <input className="st-input" inputMode="numeric" maxLength={6}
              placeholder="New 4–6 digit PIN" value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
          )}
          <input className="st-input" type="password" autoComplete="current-password"
            placeholder="Account password" value={pinPw}
            onChange={(e) => setPinPw(e.target.value)} />
          <button type="button"
            className={`st-btn ${pinMode === "remove" ? "st-btn--danger-solid" : "st-btn--primary"}`}
            onClick={savePin} disabled={pinBusy}>
            {pinBusy ? "Saving…" : pinMode === "remove" ? "Remove PIN" : "Save PIN"}
          </button>
          <button type="button" className="st-btn" onClick={() => { setPinMode(null); setPinMsg(null); }}>
            Cancel
          </button>
          <p className="st-inset__hint">
            Forgot the current PIN? Your account password resets it — no old PIN needed.
          </p>
        </div>
      )}
      {pinMsg && <Notice kind={pinMsg.kind}>{pinMsg.text}</Notice>}

      <GroupLabel>Account password</GroupLabel>
      <p className="st-caption">
        One password for everything on this account — learner profiles and any
        teaching track alike.
      </p>
      <input className="st-input st-mb" type="password" autoComplete="current-password"
        placeholder="Current password" value={pw.old}
        onChange={(e) => setPw((p) => ({ ...p, old: e.target.value }))} />
      <Grid2>
        <input className="st-input" type="password" autoComplete="new-password"
          placeholder="New password" value={pw.next}
          onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} />
        <input className="st-input" type="password" autoComplete="new-password"
          placeholder="Confirm new password" value={pw.confirm}
          onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} />
      </Grid2>
      <button type="button" className="st-btn st-mt" onClick={savePassword} disabled={pwBusy}>
        {pwBusy ? "Updating…" : "Update password"}
      </button>
      {pwMsg && <Notice kind={pwMsg.kind}>{pwMsg.text}</Notice>}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Sessions & devices
 * ═══════════════════════════════════════════════════════════════════════════ */
const DEVICE_ICON = {
  mobile: RiSmartphoneLine,
  tablet: RiTabletLine,
  desktop: RiComputerLine,
};

export function SessionsSection({ api }) {
  const [state, setState] = useState({ loading: true, rows: [], error: "" });
  const [confirm, setConfirm] = useState(null);   // {kind:'one'|'all', id?}
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const r = await api.get("/accounts/sessions/");
      setState({ loading: false, rows: r.data?.sessions || [], error: "" });
    } catch (e) {
      setState({ loading: false, rows: [], error: errText(e, "Could not load your sessions.") });
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const run = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = confirm.kind === "all"
        ? await api.post("/accounts/sessions/revoke-others/")
        : await api.post(`/accounts/sessions/${confirm.id}/revoke/`);
      setConfirm(null);
      setMsg({ kind: "ok", text: res.data?.detail || "Signed out." });
      await load();
    } catch (e) {
      setMsg({ kind: "err", text: errText(e, "Could not sign that device out.") });
      setConfirm(null);
    } finally { setBusy(false); }
  };

  const others = state.rows.filter((s) => !s.is_current);

  return (
    <>
      <SectionHead title="Sessions &amp; devices"
        caption="Where you’re signed in. Revoke anything you don’t recognise." />

      {state.loading && <Loading label="Loading sessions…" />}
      {state.error && <Notice kind="err">{state.error}</Notice>}

      {!state.loading && !state.error && state.rows.length === 0 && (
        <EmptyCard glyph={<RiComputerLine />} title="No other sessions"
          body="You're only signed in here." />
      )}

      {state.rows.map((s) => {
        const Icon = DEVICE_ICON[s.device_kind] || RiComputerLine;
        return (
          <div key={s.id} className={`st-session ${s.is_current ? "st-session--current" : ""}`}>
            <span className="st-session__icon"><Icon /></span>
            <div className="st-session__txt">
              <div className="st-session__dev">{s.device}</div>
              <div className="st-session__meta">
                {[
                  // No geo-IP lookup exists, so the address is shown as-is
                  // rather than guessing at a city.
                  s.ip_address || "Unknown network",
                  relTime(s.last_active_at),
                ].filter(Boolean).join(" · ")}
              </div>
            </div>
            {s.is_current
              ? <Badge tone="green">This device</Badge>
              : (
                <button type="button" className="st-btn st-btn--danger"
                  onClick={() => setConfirm({ kind: "one", id: s.id })}>
                  Revoke
                </button>
              )}
          </div>
        );
      })}

      {others.length > 0 && (
        <button type="button" className="st-btn st-btn--danger st-mt"
          onClick={() => setConfirm({ kind: "all" })}>
          Log out of all other devices
        </button>
      )}

      {confirm && (
        <div className="st-confirm">
          <p className="st-confirm__txt">
            {confirm.kind === "all"
              ? `Sign out of ${others.length} other device${others.length === 1 ? "" : "s"}? They’ll need to log in again.`
              : "Sign this device out? It will need to log in again."}
          </p>
          <div className="st-confirm__row">
            <button type="button" className="st-btn st-btn--danger-solid" onClick={run} disabled={busy}>
              {busy ? "Signing out…" : "Yes, sign out"}
            </button>
            <button type="button" className="st-btn" onClick={() => setConfirm(null)}>Cancel</button>
          </div>
        </div>
      )}
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Notifications
 * ═══════════════════════════════════════════════════════════════════════════ */
const CATEGORY_LABELS = {
  bookings: "Booking confirmations",
  reminders: "Session reminders",
  classes: "Live classes & invites",
  learning: "Assignments, quizzes & materials",
  social: "Forum replies & messages",
  payments: "Payments & receipts",
  account: "Account & security",
  announcements: "Course announcements",
  support: "Academic support tickets",
};

export function NotificationsSection({ api, email }) {
  const [prefs, setPrefs] = useState(null);
  const [state, setState] = useState({ loading: true, error: "" });
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    let alive = true;
    api.get("/notifications/preferences/")
      .then((r) => { if (alive) { setPrefs(r.data); setState({ loading: false, error: "" }); } })
      .catch((e) => {
        if (alive) setState({ loading: false, error: errText(e, "Could not load your preferences.") });
      });
    return () => { alive = false; };
  }, [api]);

  /* Optimistic: flip locally, then persist. On failure put the old value back
     and say so, rather than leaving the UI claiming a setting that didn't save. */
  const patch = async (partial) => {
    const before = prefs;
    setPrefs((p) => ({ ...p, ...partial }));
    setMsg(null);
    try {
      const r = await api.put("/notifications/preferences/", partial);
      setPrefs(r.data);
    } catch (e) {
      setPrefs(before);
      setMsg({ kind: "err", text: errText(e, "Could not save that.") });
    }
  };

  if (state.loading) return <><SectionHead title="Notifications" /><Loading /></>;
  if (state.error) return <><SectionHead title="Notifications" /><Notice kind="err">{state.error}</Notice></>;

  const muted = prefs.muted_categories || [];
  const toggleCategory = (cat) =>
    patch({
      muted_categories: muted.includes(cat)
        ? muted.filter((c) => c !== cat)
        : [...muted, cat],
    });

  return (
    <>
      <SectionHead title="Notifications" caption="Choose how and what we tell you about." />

      <GroupLabel>Channels</GroupLabel>
      <ToggleRow title="Email" sub={email} on={prefs.email_enabled}
        onChange={(v) => patch({ email_enabled: v })} />
      <ToggleRow title="SMS / WhatsApp" on={prefs.sms_enabled}
        onChange={(v) => patch({ sms_enabled: v })} />
      <ToggleRow title="Push notifications" sub="On this device and the mobile app"
        on={prefs.push_enabled} onChange={(v) => patch({ push_enabled: v })} />

      <GroupLabel>What to notify me about</GroupLabel>
      {(prefs.categories || []).map((c) => (
        <ToggleRow key={c} title={CATEGORY_LABELS[c] || c}
          on={!muted.includes(c)} onChange={() => toggleCategory(c)} />
      ))}
      <p className="st-footnote">
        Confirmations, cancellations and receipts always send — they’re records of
        something you did, not marketing.
      </p>

      <GroupLabel>Language</GroupLabel>
      <div className="st-narrow">
        <Choice value={prefs.language} onChange={(v) => patch({ language: v })}
          options={prefs.languages || []} placeholder="English" />
      </div>
      <p className="st-footnote">Used for emails and SMS we send you.</p>

      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Learning goals
 * ═══════════════════════════════════════════════════════════════════════════ */
const DAYS = [
  { i: 0, l: "M" }, { i: 1, l: "T" }, { i: 2, l: "W" }, { i: 3, l: "Th" },
  { i: 4, l: "F" }, { i: 5, l: "Sa" }, { i: 6, l: "Su" },
];
/* Evening default — matches the handoff's seed and the after-school study slot
   most learners here actually use. */
const DEFAULT_REMINDER = "19:00";

export function GoalsSection({ api, editProfileId }) {
  const [goal, setGoal] = useState(null);
  const [state, setState] = useState({ loading: true, error: "" });
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    let alive = true;
    setState({ loading: true, error: "" });
    const qs = editProfileId ? `?profile_id=${editProfileId}` : "";
    api.get(`/accounts/learning-goals/${qs}`)
      .then((r) => { if (alive) { setGoal(r.data); setState({ loading: false, error: "" }); } })
      .catch((e) => {
        if (alive) setState({ loading: false, error: errText(e, "Could not load your goals.") });
      });
    return () => { alive = false; };
  }, [api, editProfileId]);

  const patch = async (partial) => {
    const before = goal;
    setGoal((g) => ({ ...g, ...partial }));
    setMsg(null);
    try {
      const r = await api.patch("/accounts/learning-goals/",
        { ...partial, profile_id: editProfileId });
      setGoal(r.data);
    } catch (e) {
      setGoal(before);
      setMsg({ kind: "err", text: errText(e, "Could not save that.") });
    }
  };

  if (state.loading) return <><SectionHead title="Learning goals" /><Loading /></>;
  if (state.error) return <><SectionHead title="Learning goals" /><Notice kind="err">{state.error}</Notice></>;

  const active = goal.active_days || [];
  const toggleDay = (i) =>
    patch({ active_days: active.includes(i) ? active.filter((d) => d !== i) : [...active, i] });

  return (
    <>
      <SectionHead title="Learning goals"
        caption={`Build a habit. Set a daily target and a reminder that fits ${goal.profile_name}’s routine.`} />

      <div className="st-stats">
        <div className="st-stat st-stat--streak">
          <span className="st-stat__glyph"><RiFireLine /></span>
          <div>
            <div className="st-stat__value">
              {goal.streak_days} {goal.streak_days === 1 ? "day" : "days"}
            </div>
            {/* Named precisely: the streak counts dated quiz attempts and
                assignment submissions, the only per-profile study records that
                exist. Calling it "current streak" would overclaim. */}
            <div className="st-stat__label">Streak · {goal.streak_basis}</div>
          </div>
        </div>
        <div className="st-stat st-stat--goal">
          <span className="st-stat__glyph"><RiFocus3Line /></span>
          <div>
            <div className="st-stat__value">{goal.daily_minutes} min</div>
            <div className="st-stat__label">Daily goal</div>
          </div>
        </div>
      </div>

      <label className="st-label">
        Daily study goal — <b className="st-accent">{goal.daily_minutes} minutes</b>
      </label>
      <input className="st-range" type="range" min={10} max={120} step={5}
        value={goal.daily_minutes}
        onChange={(e) => setGoal((g) => ({ ...g, daily_minutes: Number(e.target.value) }))}
        // Commit on release, not on every pixel of drag — one PATCH per change.
        onMouseUp={(e) => patch({ daily_minutes: Number(e.target.value) })}
        onTouchEnd={(e) => patch({ daily_minutes: Number(e.target.value) })}
        onKeyUp={(e) => patch({ daily_minutes: Number(e.target.value) })}
      />
      <div className="st-rangelabels"><span>10 min</span><span>2 hrs</span></div>

      <GroupLabel>Active days</GroupLabel>
      <div className="st-days">
        {DAYS.map((d) => (
          <button key={d.i} type="button"
            className={`st-day ${active.includes(d.i) ? "on" : ""}`}
            aria-pressed={active.includes(d.i)}
            onClick={() => toggleDay(d.i)}>
            {d.l}
          </button>
        ))}
      </div>

      <GroupLabel>Daily reminder</GroupLabel>
      <ToggleRow title="Remind me to study"
        sub={goal.reminders_enabled ? "Sent through your notification channels" : "Off"}
        on={goal.reminders_enabled}
        // Send the time along when switching reminders ON. The input below
        // falls back to displaying DEFAULT_REMINDER when nothing is stored, so
        // toggling alone would show "19:00" while the server held no time at
        // all — a reminder the UI promises and the backend never sends.
        onChange={(v) => patch(
          v && !goal.reminder_time
            ? { reminders_enabled: true, reminder_time: DEFAULT_REMINDER }
            : { reminders_enabled: v },
        )} />
      {goal.reminders_enabled && (
        <div className="st-narrow st-mt">
          <input className="st-input" type="time" value={goal.reminder_time || DEFAULT_REMINDER}
            onChange={(e) => patch({ reminder_time: e.target.value })} />
        </div>
      )}

      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Billing
 * ═══════════════════════════════════════════════════════════════════════════ */
export function BillingSection({ api }) {
  const [data, setData] = useState(null);
  const [state, setState] = useState({ loading: true, error: "" });

  useEffect(() => {
    let alive = true;
    api.get("/accounts/billing/")
      .then((r) => { if (alive) { setData(r.data); setState({ loading: false, error: "" }); } })
      .catch((e) => {
        if (alive) setState({ loading: false, error: errText(e, "Could not load your billing.") });
      });
    return () => { alive = false; };
  }, [api]);

  if (state.loading) return <><SectionHead title="Billing &amp; payments" /><Loading /></>;
  if (state.error) return <><SectionHead title="Billing &amp; payments" /><Notice kind="err">{state.error}</Notice></>;

  const live = data.access.filter((a) => a.is_active);
  const past = data.access.filter((a) => !a.is_active);

  return (
    <>
      <SectionHead title="Billing &amp; payments"
        caption="Your course access and everything you’ve paid for." />

      {/* Course access is bought individually here — there is no plan tier to
          show. While the free phase is on, nobody is charged at all, and saying
          so is more useful than a price list. */}
      {data.is_free_phase ? (
        <div className="st-banner st-banner--free">
          <div className="st-banner__eyebrow">Current pricing</div>
          <div className="st-banner__title">Free while we launch</div>
          <div className="st-banner__sub">
            Every course is free right now. We’ll tell you well before that changes.
          </div>
        </div>
      ) : (
        <div className="st-banner">
          <div className="st-banner__eyebrow">Current pricing</div>
          <div className="st-banner__title">Pay per course</div>
          <div className="st-banner__sub">
            You buy access to individual courses — there’s no monthly subscription.
            {data.upi_id ? ` Payments go to ${data.upi_id}.` : ""}
          </div>
        </div>
      )}

      <GroupLabel>Active course access</GroupLabel>
      {live.length === 0 ? (
        <EmptyCard glyph={<RiBookLine />} title="No active course access"
          body="Enrol in a course and it'll show up here with its access dates." />
      ) : live.map((a) => (
        <div key={a.id} className="st-accessrow">
          <div className="st-accessrow__txt">
            <div className="st-accessrow__nm">{a.course}</div>
            <div className="st-accessrow__sub">
              {[a.profile, `until ${fmtDate(a.expires_at)}`].filter(Boolean).join(" · ")}
            </div>
          </div>
          <Badge tone="green">Active</Badge>
        </div>
      ))}

      {past.length > 0 && (
        <>
          <GroupLabel>Expired access</GroupLabel>
          {past.map((a) => (
            <div key={a.id} className="st-accessrow">
              <div className="st-accessrow__txt">
                <div className="st-accessrow__nm">{a.course}</div>
                <div className="st-accessrow__sub">Ended {fmtDate(a.expires_at)}</div>
              </div>
              <Badge tone="gray">{a.status}</Badge>
            </div>
          ))}
        </>
      )}

      <GroupLabel>Payment history</GroupLabel>
      {data.payments.length === 0 ? (
        <p className="st-caption">No payments yet.</p>
      ) : data.payments.map((p) => (
        <div key={p.id} className="st-payrow">
          <div className="st-payrow__txt">
            <div className="st-payrow__nm">{p.course}</div>
            <div className="st-payrow__sub">{fmtDate(p.created_at)} · {p.reference}</div>
          </div>
          <span className="st-payrow__amt">{rupees(p.amount_rupees)}</span>
          <Badge tone={p.status === "PAID" ? "green" : p.status === "FAILED" ? "red" : "gray"}>
            {p.status === "PAID" ? "Paid" : p.status === "FAILED" ? "Failed" : "Pending"}
          </Badge>
        </div>
      ))}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Teacher identity
 * ═══════════════════════════════════════════════════════════════════════════ */
const TRACKS = [
  {
    key: "academy", icon: RiGraduationCapLine, title: "Faculty", suffix: "· Academy",
    sub: "Academic classroom teaching · syllabus courses & live classes",
    accent: "faculty",
  },
  {
    key: "skill", icon: RiFlashlightLine, title: "Expert", suffix: "· Skill-Dev",
    sub: "Skill-development sessions · 1:1 & cohort bookings",
    accent: "expert",
  },
];

const STATUS_META = {
  approved: { tone: "green", label: "Approved" },
  pending: { tone: "amber", label: "Under review" },
  rejected: { tone: "red", label: "Needs changes" },
  locked: { tone: "gray", label: "Not applied" },
};

export function TeacherIdentitySection({
  teacherInfo, applyUrl, onOpenEditor, onSwitchTrack, isTeacherContext, activeTrack,
}) {
  const tracks = teacherInfo?.tracks || {};
  // Asymmetric rule enforced elsewhere in the app: Faculty can be applied for
  // any time it isn't held, but Skill only if Faculty was never held.
  const academyHeld = ["pending", "approved"].includes(tracks.academy);

  return (
    <>
      <SectionHead title="Teacher identity" />
      <p className="st-caption st-caption--wide">
        Your teaching tracks under this one account. <b>Faculty (Academy)</b> is
        academic classroom teaching and needs admin approval; <b>Expert
        (Skill-Dev)</b> runs skill sessions. Open a track to edit the profile
        learners actually see.
      </p>

      {TRACKS.map((t) => {
        const status = tracks[t.key] || "locked";
        const meta = STATUS_META[status] || STATUS_META.locked;
        const approved = status === "approved";
        const isActive = isTeacherContext && activeTrack === t.key;
        const canApply = status === "locked" && (t.key === "academy" || !academyHeld);

        return (
          <div key={t.key} className={`st-track st-track--${status} st-track--${t.accent}`}>
            <div className="st-track__head">
              <span className={`st-track__icon st-track__icon--${t.accent}`}><t.icon /></span>
              <div className="st-track__txt">
                <div className="st-track__title">
                  {t.title} <span className="st-track__suffix">{t.suffix}</span>
                </div>
                <div className="st-track__sub">
                  {status === "locked" && t.key === "skill" && academyHeld
                    ? "Not available on faculty accounts"
                    : t.sub}
                </div>
              </div>
              <Badge tone={meta.tone}>{meta.label}</Badge>
            </div>

            <div className="st-track__actions">
              {approved && (
                <button type="button" className={`st-btn st-btn--${t.accent}`}
                  onClick={() => onOpenEditor(t.key)}>
                  Edit {t.title} profile <RiArrowRightLine />
                </button>
              )}
              {approved && !isActive && (
                <button type="button" className="st-btn"
                  onClick={() => onSwitchTrack(t.key)}>
                  Switch to {t.title}
                </button>
              )}
              {status === "pending" && (
                <a className="st-btn" href={applyUrl(t.key)}>View application</a>
              )}
              {status === "rejected" && (
                <a className="st-btn st-btn--primary" href={applyUrl(t.key)}>
                  Fix &amp; resubmit
                </a>
              )}
              {canApply && (
                <a className="st-btn st-btn--primary" href={applyUrl(t.key)}>
                  Apply now <RiArrowRightLine />
                </a>
              )}
            </div>
          </div>
        );
      })}

      <div className="st-note">
        <RiShieldKeyholeLine />
        <span>
          Entering a teaching track from your learner view re-confirms your
          account password once. Faculty and Expert can’t be held on the same
          account at the same time.
        </span>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Privacy & data
 * ═══════════════════════════════════════════════════════════════════════════ */
export function PrivacySection({ api, email, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [armed, setArmed] = useState(false);
  const [pw, setPw] = useState("");
  const [typed, setTyped] = useState("");

  const exportData = async () => {
    setBusy(true); setMsg(null);
    try {
      // Server returns a JSON attachment, so ask axios for the raw blob and
      // drive the download from an object URL — a plain link can't carry the
      // auth cookie on a cross-origin API host.
      const res = await api.post("/accounts/data-export/", {}, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `shikshacom-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg({ kind: "ok", text: "Your data is downloading." });
    } catch (e) {
      setMsg({ kind: "err", text: errText(e, "Could not export your data.") });
    } finally { setBusy(false); }
  };

  const deleteAccount = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await api.post("/accounts/delete-account/", { password: pw });
      onDeleted?.(res.data);
    } catch (e) {
      setMsg({ kind: "err", text: errText(e, "Could not close your account.") });
    } finally { setBusy(false); }
  };

  return (
    <>
      <SectionHead title="Privacy &amp; data"
        caption="Control what happens to your data." />

      <GroupLabel>Your data</GroupLabel>
      <button type="button" className="st-bigaction" onClick={exportData} disabled={busy}>
        <RiDownloadLine className="st-bigaction__icon" />
        <span className="st-bigaction__txt">
          <span className="st-bigaction__title">
            {busy ? "Preparing…" : "Download my data"}
          </span>
          <span className="st-bigaction__sub">
            A JSON copy of your profiles, enrolments, payments and sessions
          </span>
        </span>
      </button>

      <GroupLabel tone="danger">Danger zone</GroupLabel>
      {!armed ? (
        <button type="button" className="st-btn st-btn--danger" onClick={() => setArmed(true)}>
          Close my account
        </button>
      ) : (
        <div className="st-danger">
          {/* Copy matches what the endpoint actually does: immediate closure,
              permanent deletion after the grace window — not an instant purge. */}
          <p className="st-danger__warn">
            This closes <b>{email}</b> and every profile under it straight away.
            You’ll be signed out and won’t be able to log in. Your data is
            permanently deleted 30 days later, so contact support inside that
            window if it was a mistake.
          </p>
          <Field label="Type DELETE to confirm">
            <input className="st-input st-input--danger" value={typed}
              onChange={(e) => setTyped(e.target.value)} placeholder="DELETE" />
          </Field>
          <Field label="Account password">
            <input className="st-input st-input--danger" type="password"
              autoComplete="current-password" value={pw}
              onChange={(e) => setPw(e.target.value)} />
          </Field>
          <div className="st-confirm__row">
            <button type="button" className="st-btn st-btn--danger-solid"
              onClick={deleteAccount}
              disabled={busy || typed !== "DELETE" || !pw}>
              {busy ? "Closing…" : "Close my account"}
            </button>
            <button type="button" className="st-btn"
              onClick={() => { setArmed(false); setPw(""); setTyped(""); setMsg(null); }}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
    </>
  );
}
