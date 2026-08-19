/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  GENERATED FILE — DO NOT EDIT HERE.                                       │
 * │  Canonical source: <workspace>/shared/src/tour/TourProvider.jsx           │
 * │  Edit the canonical copy, then run `npm run sync:shared` (any app) to     │
 * │  propagate. `npm run check:shared` fails if an app's copy has drifted.    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * TourProvider.jsx — context, state machine, trigger (rule) engine,
 * persistence and session bookkeeping (TOUR_SYSTEM_SPEC.md §5, §7).
 *
 * Mount ABOVE the app's routed layout shell (C3 — layouts remount on
 * navigation and would otherwise drop tour state mid-step). `track` is an
 * optional prop the host app passes in (e.g. `activeTrack` from its own
 * CourseContext) — this file stays generic across all three apps and never
 * imports an app-specific context directly.
 *
 * `registry` is the per-app, NOT-synced tourRegistry.js content (§7.1) —
 * defaults to [] so this file works before any registry exists (phase 2).
 *
 * S3 (live session not connected) and S4 (quiz attempt in progress) are
 * deliberately NOT hardcoded here — they're app/content-specific and belong
 * in a registry entry's own `conditions` array (§7.3's schema already
 * reserves this). The generic DOM-observable gates (S1, S2, S5, S6, S7, S8)
 * live here since every app can check them the same way.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import TourOverlay from "./TourOverlay";
import HelpPanel from "./HelpPanel";
import Beacon from "./Beacon";
import {
  computeIdentityKey, readMirror, writeMirror, emptyTourState,
  fetchTourState, patchTourFireAndForget,
  setAutoplay as apiSetAutoplay, resetTours as apiResetTours,
} from "./tourApi";

const TourContext = createContext(null);

const SESSION_FLAG = "shiksha_tour_auto_fired_session"; // R1
const DAY_MS = 24 * 60 * 60 * 1000; // R2
const S1_SELECTOR = '[role="dialog"], .st-overlay, .cd__overlay, .tcd__overlay, .ps-modal-overlay, .confirm-overlay';

/* The steps of `entry` that apply right now.
 *
 * A step may carry an optional `when(ctx)` predicate, evaluated once when
 * the tour starts, with the same ctx shape as an entry's `conditions`
 * ({ ...auth, location }). Steps without one always apply.
 *
 * This exists so a tour's advertised length matches what it can actually
 * show. A step anchored to conditionally-rendered UI (say, an upload
 * dropzone that disappears once you've submitted) used to still count
 * toward "STEP 1 OF 2", and the tour then closed instead of advancing.
 * A throwing predicate drops the step — the safe direction, since a step
 * whose own guard errors is unlikely to render.
 */
function resolveSteps(entry, ctx) {
  return (entry.steps || []).filter((s) => {
    if (typeof s.when !== "function") return true;
    try { return s.when(ctx); } catch { return false; }
  });
}

function matchesRoute(match, pathname) {
  if (!match) return false;
  return match === pathname || (match !== "/" && pathname.startsWith(match));
}

export function TourProvider({ children, registry = [], track }) {
  const auth = useAuth();
  const location = useLocation();
  const { isLearnerContext, isTeacherContext, activeProfile, teacherInfo, user, api } = auth;

  const identityKey = useMemo(
    () => computeIdentityKey({ isLearnerContext, isTeacherContext, activeProfile, teacherInfo, userId: user?.id }),
    [isLearnerContext, isTeacherContext, activeProfile, teacherInfo, user]
  );

  const [state, setState] = useState(() => readMirror(identityKey) || emptyTourState());
  const stateRef = useRef(state);
  stateRef.current = state;
  // Same latest-value-without-a-dep pattern as stateRef: `start` must stay
  // referentially stable, but per-step `when(ctx)` predicates need the
  // current auth + route.
  const authRef = useRef(auth);
  authRef.current = auth;
  const locationRef = useRef(location);
  locationRef.current = location;

  const [active, setActive] = useState(null); // { entry, stepIndex, auto }
  const activeRef = useRef(active);
  activeRef.current = active;

  const [helpOpen, setHelpOpen] = useState(false); // §6.1 Help panel
  const openHelp = useCallback(() => setHelpOpen(true), []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);

  const [mountedAt] = useState(() => (typeof performance !== "undefined" ? performance.now() : 0));

  // ── Boot: reconcile with the server — it always wins (§7.5). ───────────
  useEffect(() => {
    if (!identityKey || !api) return undefined;
    let cancelled = false;
    fetchTourState(api)
      .then((data) => {
        if (cancelled) return;
        setState(data);
        writeMirror(identityKey, data);
      })
      .catch(() => { /* offline/error — keep whatever the mirror seeded */ });
    return () => { cancelled = true; };
  }, [identityKey, api]);

  // ── Persistence ─────────────────────────────────────────────────────────
  const patch = useCallback((body) => {
    if (!api) return;
    const next = patchTourFireAndForget(api, identityKey, stateRef.current, body);
    setState(next);
  }, [api, identityKey]);

  // ── Close / step machine — reads activeRef rather than a setActive
  // updater, deliberately: an updater must be pure, and close() has to fire
  // a PATCH side effect, which would otherwise risk double-firing under
  // React StrictMode's dev-only double-invoke of updater functions. ───────
  const close = useCallback((reason, opts = {}) => {
    const cur = activeRef.current;
    if (!cur) return;
    if (reason === "completed" || reason === "dismissed") {
      patch({
        tour_key: cur.entry.key,
        status: reason,
        version: cur.entry.version ?? 1,
        step: cur.stepIndex + 1,
        auto: !!opts.auto,
      });
    }
    // "interrupted" (S1 mid-tour) — no PATCH. The model has no in-progress
    // status (TOUR_BUILD_GUIDE.md phase 1 report); the step is simply
    // dropped and a later visit starts this tour from step 0 again.
    setActive(null);
  }, [patch]);

  const start = useCallback((keyOrEntry, opts = {}) => {
    const entry = typeof keyOrEntry === "string"
      ? registry.find((e) => e.key === keyOrEntry)
      : keyOrEntry;
    if (!entry || !entry.steps?.length) return false;
    if (!opts.bypassRules && stateRef.current.features?.tours_enabled === false) return false; // R9 — even manual starts respect the kill switch

    // Per-step `when(ctx)` — resolve the step list ONCE, here, so the whole
    // tour (current step, "N of M" counter, next/back, missing-target
    // handling) agrees on how many steps there are.
    //
    // Without this, a step whose anchor only exists in some page states
    // still counted toward the total: the assignment tour advertised
    // "STEP 1 OF 2" on an already-submitted assignment, then vanished on
    // Next, because step 2 targeted the upload dropzone — which isn't
    // rendered once you've submitted. The engine's missing-target handling
    // was right (skip it; it was last, so complete); the step LIST was the
    // lie. Steps with no `when` always run, so existing entries are
    // unaffected.
    const steps = resolveSteps(entry, { ...authRef.current, location: locationRef.current });
    if (!steps.length) return false;

    setActive({ entry, steps, stepIndex: 0, auto: !!opts.auto });
    return true;
  }, [registry]);

  const next = useCallback(() => {
    const cur = activeRef.current;
    if (!cur) return;
    const isLast = cur.stepIndex >= cur.steps.length - 1;
    if (isLast) close("completed", { auto: cur.auto });
    else setActive({ ...cur, stepIndex: cur.stepIndex + 1 });
  }, [close]);

  const back = useCallback(() => {
    const cur = activeRef.current;
    if (cur && cur.stepIndex > 0) setActive({ ...cur, stepIndex: cur.stepIndex - 1 });
  }, []);

  // R6/R7 — a missing target skips that step silently; if it was the FIRST
  // step, the tour never really "started" and must not be marked seen.
  const onTargetMissing = useCallback(() => {
    const cur = activeRef.current;
    if (!cur) return;
    if (cur.stepIndex === 0) { setActive(null); return; }
    const isLast = cur.stepIndex >= cur.steps.length - 1;
    if (isLast) close("completed", { auto: cur.auto });
    else setActive({ ...cur, stepIndex: cur.stepIndex + 1 });
  }, [close]);

  const onInterrupted = useCallback(() => close("interrupted"), [close]);

  // ── T3 beacons (§9.5) — passive, always-on-until-seen, so they skip R1/R2/
  // R3/R10 (those rate-limit *auto-triggered tours*, not a self-serve hint)
  // but still respect R9, R4, S1 (unless insideModal) and S2/S7. Evaluated
  // on every render rather than a live MutationObserver — acceptable here
  // because S1/S2 false-negatives just mean a beacon dot stays visible one
  // render longer next to a freshly-opened dialog, not a spotlight stacking
  // on top of one. ────────────────────────────────────────────────────────
  const visibleBeacons = useMemo(() => {
    const s = stateRef.current;
    if (s.features?.tours_enabled === false) return []; // R9
    if (window.innerWidth < 768) return []; // S7 — no mobile beacon layout designed yet
    return registry.filter((e) => {
      if (e.tier !== "T3") return false;
      if (!matchesRoute(e.trigger?.match, location.pathname)) return false;
      if (e.key in (s.tours || {})) return false; // R4 — seen (dismissed or clicked) is permanent
      if (e.featureFlag && s.features?.[e.featureFlag] === false) return false;
      if (!e.insideModal && document.querySelector(S1_SELECTOR)) return false; // S1
      if (document.querySelector("[data-tour-block]")) return false; // S2
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registry, location.pathname, state]);

  const dismissBeacon = useCallback((entry) => {
    patch({ tour_key: entry.key, status: "completed", version: entry.version ?? 1, step: 1 });
  }, [patch]);

  const replay = useCallback(
    (key) => start(key, { bypassRules: true, force: true }),
    [start]
  );

  const setAutoplay = useCallback(async (enabled) => {
    setState((s) => ({ ...s, autoplay_enabled: enabled }));
    if (!api) return;
    try {
      const data = await apiSetAutoplay(api, enabled);
      setState(data);
      writeMirror(identityKey, data);
    } catch { /* optimistic value stands; next GET reconciles */ }
  }, [api, identityKey]);

  const resetTours = useCallback(async (body) => {
    if (!api) return;
    const data = await apiResetTours(api, body);
    setState(data);
    writeMirror(identityKey, data);
  }, [api, identityKey]);

  const availableForRoute = useCallback(
    (pathname) => registry.filter((e) => matchesRoute(e.trigger?.match, pathname)),
    [registry]
  );

  /* Can this tour actually run against the DOM as it stands right now?
   *
   * Route matching alone is not enough. Tour anchors routinely live inside a
   * "has data" branch, so on an empty page they simply don't exist — the
   * Recordings tour anchors both its steps inside the recordings grid, so a
   * learner with no recordings yet got a "Replay tour" button that resolved
   * step 1 to nothing and silently closed. From the outside that is a button
   * that does nothing, which is worse than no button.
   *
   * Callers use this to decide whether to OFFER a tour at all.
   */
  const canRun = useCallback((keyOrEntry) => {
    const entry = typeof keyOrEntry === "string"
      ? registry.find((e) => e.key === keyOrEntry)
      : keyOrEntry;
    if (!entry) return false;
    const steps = resolveSteps(entry, { ...authRef.current, location: locationRef.current });
    // One resolvable anchor is enough: a later missing step is handled
    // gracefully (skipped), it is only a dead FIRST step that aborts.
    return steps.some((s) => {
      try { return !!document.querySelector(s.target); } catch { return false; }
    });
  }, [registry]);

  // ── Auto-trigger rule engine (§5) ───────────────────────────────────────
  const canAutoStart = useCallback((entry) => {
    const s = stateRef.current;
    if (s.features?.tours_enabled === false) return false;        // R9
    if (entry.featureFlag && s.features?.[entry.featureFlag] === false) return false; // per-entry sub-switch (e.g. "show_tour")
    if (s.autoplay_enabled === false) return false;                // R10
    if (entry.key in (s.tours || {})) return false;                // R4 — permanent once seen
    if (sessionStorage.getItem(SESSION_FLAG)) return false;        // R1
    if (s.last_auto_tour_at
      && Date.now() - new Date(s.last_auto_tour_at).getTime() < DAY_MS) return false; // R2
    if (entry.tier === "T1" && !s.is_first_session) return false;  // R3
    if (entry.tier === "T2" && s.is_first_session) return false;   // R3
    if (window.innerWidth < 768 && !entry.mobile) return false;    // S7
    if (document.fullscreenElement) return false;                 // S6
    if (document.visibilityState !== "visible") return false;      // S8
    if (performance.now() - mountedAt < 800) return false; // S8
    if (!entry.insideModal && document.querySelector(S1_SELECTOR)) return false; // S1
    if (document.querySelector("[data-tour-block]")) return false; // S2
    if (document.querySelector("form[data-dirty]")) return false;  // S5
    if (Array.isArray(entry.conditions)
      && !entry.conditions.every((fn) => {
        try { return fn({ ...auth, location }); } catch { return false; }
      })) return false; // app-specific — S3/S4 and anything else per-entry
    return true;
  }, [auth, location, mountedAt]);

  // Evaluated on every route change; also handles the dev-only ?tour= bypass.
  useEffect(() => {
    if (active || !identityKey) return;

    const forcedKey = import.meta.env?.DEV
      ? new URLSearchParams(location.search).get("tour")
      : null;
    if (forcedKey) {
      start(forcedKey, { bypassRules: true, force: true });
      return;
    }

    const candidate = registry
      .filter((e) => matchesRoute(e.trigger?.match, location.pathname))
      .find((e) => canAutoStart(e));
    if (candidate) {
      sessionStorage.setItem(SESSION_FLAG, "1");
      start(candidate, { auto: true });
    }
  }, [location.pathname, location.search, identityKey, registry, active, canAutoStart, start]);

  // ── `?` opens the Help panel (§6.1, entry point 3) — never while typing in
  // a field, and never while a tour is actively running (its own card owns
  // keyboard input then). ─────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "?") return;
      if (activeRef.current) return;
      const el = document.activeElement;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing) return;
      e.preventDefault();
      setHelpOpen(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // ── QA hooks (§7.6) — dev/staging only. ─────────────────────────────────
  useEffect(() => {
    if (!import.meta.env?.DEV) return undefined;
    window.__tour = {
      start: (key) => start(key, { bypassRules: true, force: true }),
      stop: () => close("dismissed"),
      reset: (key) => resetTours(key ? { tour_key: key } : { all: true }),
      state: () => stateRef.current,
    };
    return () => { delete window.__tour; };
  }, [start, close, resetTours]);

  const value = useMemo(() => ({
    start, stop: close, replay, state, active, setAutoplay, resetTours, availableForRoute, canRun,
    helpOpen, openHelp, closeHelp,
  }), [start, close, replay, state, active, setAutoplay, resetTours, availableForRoute, canRun, helpOpen, openHelp, closeHelp]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {!active && visibleBeacons.map((entry) => (
        <Beacon key={entry.key} entry={entry} onDismiss={() => dismissBeacon(entry)} />
      ))}
      {active && (
        <TourOverlay
          entry={active.entry}
          step={active.steps[active.stepIndex]}
          stepIndex={active.stepIndex}
          totalSteps={active.steps.length}
          track={track}
          onNext={next}
          onBack={back}
          onClose={(reason) => close(reason, { auto: active.auto })}
          onTargetMissing={onTargetMissing}
          onInterrupted={onInterrupted}
        />
      )}
      {helpOpen && (
        <HelpPanel
          registry={registry}
          state={state}
          track={track}
          pathname={location.pathname}
          onClose={closeHelp}
          onStart={(key) => { closeHelp(); start(key, { bypassRules: true, force: true }); }}
          onReplay={(key) => { closeHelp(); replay(key); }}
          onSetAutoplay={setAutoplay}
          onResetAll={() => resetTours({ all: true })}
        />
      )}
    </TourContext.Provider>
  );
}

export function useTourContext() {
  return useContext(TourContext);
}
