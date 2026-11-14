// AcademyRail — the right-hand rail on the Academy Lists screens.
//
// Spec: design_handoff_dashboards_v2/source/"Academy Lists.dc.html" — the
// `rail` array built per role × screen, rendered by the <aside> at :187.
// The design gives every rail the same two shapes, so this is one component
// driven by data rather than three hand-built rails:
//
//   callout — tone-tinted panel: KICKER / title / paragraph / full-width button
//   card    — white panel: heading, then key→value rows and/or lead-avatar rows
//
// Deliberate departures from the design file, all for the same reason — the
// design invents numbers this product cannot produce:
//
//   • A `kv` entry may pass `unavailable: true`. It then renders the label
//     with an em-dash and a short reason instead of a number. The design's
//     teacher live rail asks for "Average attendance 93%", and attendance is
//     not tracked anywhere in this backend — printing a plausible percentage
//     would be a fabrication, and printing nothing would read as a bug.
//   • A card may pass `empty` copy, used when the card has no rows. The
//     design never draws an empty rail card because its data is fixture data.
//
// The callout button uses var(--on-accent), NOT var(--surface): it sits on a
// filled accent that does not darken under data-theme="dark". See the token's
// comment in shared/tokens.css.

import "../../styles/academyScreens.css";

function RailCallout({ tone = "info", kicker, title, text, btn }) {
  return (
    <section className={`ac-railCard ac-railCard--callout ac-railCard--${tone}`}>
      <div className="ac-railKicker">{kicker}</div>
      <div className="ac-railCalloutTitle">{title}</div>
      <p className="ac-railCalloutText">{text}</p>
      {btn && (
        <button
          type="button"
          className="ac-railCalloutBtn"
          onClick={btn.onClick}
          disabled={btn.disabled}
        >
          {btn.label}
        </button>
      )}
    </section>
  );
}

function RailCard({ title, kv = [], rows = [], empty }) {
  return (
    <section className="ac-railCard">
      <h3 className="ac-railHead">{title}</h3>

      {kv.map((item) => (
        <div className="ac-railKv" key={item.k}>
          <span className="ac-railKvK">{item.k}</span>
          {item.unavailable ? (
            // Not a number we have. Say so, quietly, rather than inventing one.
            <span className="ac-railKvNa" title={item.reason}>—</span>
          ) : (
            <span
              className="ac-railKvV"
              style={item.tone ? { color: `var(--${item.tone})` } : undefined}
            >
              {item.v}
            </span>
          )}
        </div>
      ))}

      {kv.some((i) => i.unavailable) && (
        <p className="ac-railNote">
          {kv.find((i) => i.unavailable).reason}
        </p>
      )}

      {rows.map((r, i) => (
        <div className="ac-railRow" key={r.key ?? i}>
          <div
            className="ac-railLead"
            style={
              r.tone
                ? { background: `var(--${r.tone}-soft)`, color: `var(--${r.tone})` }
                : undefined
            }
          >
            {r.lead}
          </div>
          <div className="ac-railRowBody">
            <div className="ac-railRowTitle">{r.title}</div>
            <div className="ac-railRowSub">{r.sub}</div>
          </div>
          {r.action && (
            <button type="button" className="ac-railRowBtn" onClick={r.action.onClick}>
              {r.action.label}
            </button>
          )}
        </div>
      ))}

      {rows.length === 0 && empty && <p className="ac-railEmpty">{empty}</p>}
    </section>
  );
}

export default function AcademyRail({ items = [] }) {
  const shown = items.filter(Boolean);
  if (shown.length === 0) return null;
  return (
    <aside className="ac-rail">
      {shown.map((item, i) =>
        item.kind === "callout"
          ? <RailCallout key={item.key ?? i} {...item} />
          : <RailCard key={item.key ?? i} {...item} />
      )}
    </aside>
  );
}
