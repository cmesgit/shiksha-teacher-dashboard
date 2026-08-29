/**
 * src/components/TrimRecordingPanel.jsx
 *
 * The trim-window control inside EditRecordingModal. Controlled: the modal
 * owns `value` ({start, end}) and submits it with the rest of the edit, so a
 * trim is one PATCH alongside the title change rather than its own round trip.
 *
 * THE CONSTRAINT THAT SHAPES THIS WHOLE COMPONENT
 * The player is a cross-origin Bunny iframe. There is no seeking it
 * programmatically and no reading its clock synchronously — `contentWindow`
 * is opaque, and the Player.js channel is one-way-async at best. So the
 * obvious design (scrub the video, hit "mark in") is not available.
 *
 * What IS available is `duration_seconds`, which the server already knows
 * because the Bunny status poll stores it. Everything below is drawn from that
 * number: a dual-handle range plus two timecode fields, both of which work
 * with ZERO cooperation from the player. That is the primary control, not a
 * fallback.
 *
 * "Set from player" is the secondary path, and it is honest about its own
 * limits. It reads the last position the Player.js `timeupdate` listener saw
 * (utils/playerjs.js). On the Recordings grid there is no player at all, and
 * on the player page nothing arrives until playback actually starts — so when
 * no message has ever been seen the buttons are DISABLED with a visible hint
 * rather than being a live-looking control that silently does nothing.
 */

import { useState } from "react";
import { FiCrosshair, FiScissors } from "react-icons/fi";
import {
  clampTrim,
  formatTimecode,
  parseTimecode,
} from "../utils/recordingTrim";
import "../styles/edit-recording-modal.css";

const STATUS_READY = 4;
const STATUS_ERROR = 5;

/** Why the track can't be drawn, or null when it can. */
function unavailableReason(recording) {
  if (!recording) return "There's no recording to trim.";
  if (recording.status === STATUS_ERROR) {
    return "This upload failed, so there's nothing to trim. Delete it and upload again.";
  }
  if (recording.status !== STATUS_READY) {
    return "This recording is still processing. Trim points can be set once it's ready to watch.";
  }
  if (!recording.duration_seconds) {
    // status 4 with no length means the status poll hasn't stored Bunny's
    // `length` yet. There is genuinely no track to draw against.
    return "We don't know how long this recording is yet, so there's no timeline to draw. Try again in a minute.";
  }
  return null;
}

export default function TrimRecordingPanel({
  recording,
  value,
  onChange,
  errors = {},
  playerAvailable = false,
  getPlayerSeconds,
}) {
  // `null` means "show the committed value"; a string means the teacher is
  // mid-type. Holding the raw text this way — instead of syncing an input's
  // state back from the numeric prop in an effect — is what lets "12:" exist
  // on screen while it is still unparseable, without the field fighting back.
  const [startDraft, setStartDraft] = useState(null);
  const [endDraft, setEndDraft] = useState(null);

  const blocked = unavailableReason(recording);
  const duration = recording?.duration_seconds || 0;

  const commit = (patch) => {
    onChange(
      clampTrim({ start: value.start, end: value.end, ...patch, duration })
    );
  };

  // An unset handle sits at the edge of the video: no trim IS the full clip.
  const startPos = value.start ?? 0;
  const endPos = value.end ?? duration;
  const pct = (n) => (duration > 0 ? Math.min(100, Math.max(0, (n / duration) * 100)) : 0);

  // `raw` (not the slider's effective position) is what the text box shows, so
  // an untrimmed side reads as EMPTY rather than "0:00". The two are different
  // claims: "0:00" looks like a trim the teacher set, and it would also make a
  // cleared box silently refill itself on blur — leaving no way to express
  // "no trim" in the field that is supposed to express it.
  const fields = [
    {
      key: "start",
      label: "Clip starts at",
      draft: startDraft,
      setDraft: setStartDraft,
      raw: value.start,
      error: errors.trim_start_seconds,
    },
    {
      key: "end",
      label: "Clip ends at",
      draft: endDraft,
      setDraft: setEndDraft,
      raw: value.end,
      error: errors.trim_end_seconds,
    },
  ];

  const onText = (field, raw) => {
    field.setDraft(raw);
    if (raw.trim() === "") {
      // Emptying the box CLEARS that side of the trim. null and 0 are
      // different things to the API and must stay different here.
      commit({ [field.key]: null });
      return;
    }
    const parsed = parseTimecode(raw);
    if (parsed !== null) commit({ [field.key]: parsed });
  };

  const setFromPlayer = (field) => {
    const seconds = getPlayerSeconds?.();
    if (!Number.isFinite(seconds)) return;
    field.setDraft(null);
    commit({ [field.key]: Math.floor(seconds) });
  };

  const clearTrim = () => {
    setStartDraft(null);
    setEndDraft(null);
    onChange({ start: null, end: null });
  };

  const trimmed = value.start !== null || value.end !== null;
  const clipLength = Math.max(0, endPos - startPos);

  return (
    <section className="erm-trim">
      <div className="erm-trim__head">
        <span className="erm-trim__headIcon" aria-hidden="true">
          <FiScissors />
        </span>
        <div>
          <div className="erm-trim__headTitle">Trim the clip</div>
          <div className="erm-trim__headSub">
            Cut dead air off the front or back without re-uploading.
          </div>
        </div>
      </div>

      {blocked ? (
        <p className="erm-trim__blocked">{blocked}</p>
      ) : (
        <>
          <div className="erm-trim__track">
            <div className="erm-trim__trackBase" aria-hidden="true" />
            <div
              className="erm-trim__trackFill"
              aria-hidden="true"
              style={{
                left: `${pct(startPos)}%`,
                width: `${Math.max(0, pct(endPos) - pct(startPos))}%`,
              }}
            />
            {/* Two stacked ranges rather than a real dual-thumb widget: the
                native control is keyboard-accessible and screen-reader-labelled
                for free, which a div-and-pointer-events reimplementation is
                not. The CSS turns off pointer events on the tracks and back on
                for the thumbs so both handles stay grabbable. */}
            <input
              type="range"
              className="erm-trim__range"
              min={0}
              max={duration}
              step={1}
              value={startPos}
              aria-label="Clip start position"
              onChange={(e) => {
                setStartDraft(null);
                commit({ start: Number(e.target.value) });
              }}
            />
            <input
              type="range"
              className="erm-trim__range"
              min={0}
              max={duration}
              step={1}
              value={endPos}
              aria-label="Clip end position"
              onChange={(e) => {
                setEndDraft(null);
                commit({ end: Number(e.target.value) });
              }}
            />
          </div>

          <div className="erm-trim__scale">
            <span>0:00</span>
            <span>{formatTimecode(duration)}</span>
          </div>

          <div className="erm-trim__fields">
            {fields.map((field) => {
              const text = field.draft ?? formatTimecode(field.raw);
              const malformed =
                field.draft !== null &&
                field.draft.trim() !== "" &&
                parseTimecode(field.draft) === null;

              return (
                <div className="erm-trim__field" key={field.key}>
                  <label
                    className="erm-field__label"
                    htmlFor={`erm-trim-${field.key}`}
                  >
                    {field.label}
                  </label>
                  <div className="erm-trim__inputRow">
                    <input
                      id={`erm-trim-${field.key}`}
                      type="text"
                      inputMode="numeric"
                      className={`erm-input erm-trim__timecode${
                        malformed || field.error ? " erm-input--invalid" : ""
                      }`}
                      placeholder="mm:ss"
                      value={text}
                      onChange={(e) => onText(field, e.target.value)}
                      onBlur={() => field.setDraft(null)}
                    />
                    <button
                      type="button"
                      className="erm-trim__fromPlayer"
                      disabled={!playerAvailable}
                      onClick={() => setFromPlayer(field)}
                      title={
                        playerAvailable
                          ? "Use the video's current position"
                          : "The player hasn't reported a position yet"
                      }
                    >
                      <FiCrosshair aria-hidden="true" /> Set from player
                    </button>
                  </div>
                  {malformed && (
                    <p className="erm-field__error">
                      Use mm:ss or h:mm:ss — for example 12:34.
                    </p>
                  )}
                  {field.error && <p className="erm-field__error">{field.error}</p>}
                </div>
              );
            })}
          </div>

          {!playerAvailable && (
            <p className="erm-trim__playerHint">
              “Set from player” needs the video playing on this screen — type
              the timestamp instead.
            </p>
          )}

          <div className="erm-trim__summary">
            <span>
              {trimmed
                ? `Students will see ${formatTimecode(clipLength)} of ${formatTimecode(duration)}.`
                : `No trim — students see the full ${formatTimecode(duration)}.`}
            </span>
            {trimmed && (
              <button type="button" className="erm-trim__clear" onClick={clearTrim}>
                Remove trim
              </button>
            )}
          </div>

          {/* Load-bearing and deliberately unsoftened. Bunny Stream has no
              server-side trim API, so the full video is always what streams —
              the window is applied at playback time. Describing this as a way
              to remove something that should never have been recorded would be
              a false promise about access control. */}
          <p className="erm-trim__note">
            Students see the clip between these points. The full video still
            exists on the server — a trim tidies playback, it doesn&apos;t
            restrict access.
          </p>
        </>
      )}
    </section>
  );
}
