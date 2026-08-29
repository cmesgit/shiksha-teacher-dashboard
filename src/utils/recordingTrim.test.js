/**
 * Tests for the trim timecode + window helpers.
 *
 * These matter more than they look. The trim UI cannot be verified against the
 * player it trims: the Bunny iframe is cross-origin, so there is no way to
 * scrub it to 12:34 and confirm the clip starts there. The arithmetic below is
 * the only thing standing between a teacher typing "12:34" and the API being
 * sent a number that means something else entirely — and a wrong trim is
 * invisible until a student watches the wrong half of a lesson.
 *
 * The `isValidWindow` block deliberately restates the SERVER's rules
 * (courses/serializers_recordings.py::_validate_trim) rather than this
 * module's. If the backend rule changes and these still pass, these tests are
 * the thing that is wrong.
 */
import { describe, it, expect } from "vitest";
import {
  clampTrim,
  formatTimecode,
  isValidWindow,
  parseTimecode,
} from "./recordingTrim";

describe("parseTimecode", () => {
  it("parses mm:ss", () => {
    expect(parseTimecode("12:34")).toBe(754);
    expect(parseTimecode("0:05")).toBe(5);
  });

  it("treats a bare number as SECONDS, not minutes", () => {
    // Every video tool reads "5" as five seconds. Reading it as five minutes
    // would silently trim 300s off a lesson on a single keystroke.
    expect(parseTimecode("5")).toBe(5);
    expect(parseTimecode("90")).toBe(90);
  });

  it("parses h:mm:ss", () => {
    expect(parseTimecode("1:2:3")).toBe(3723);
    expect(parseTimecode("1:02:03")).toBe(3723);
    expect(parseTimecode("2:00:00")).toBe(7200);
  });

  it("returns null for an empty or whitespace-only string", () => {
    // null, not 0: clearing the field CLEARS the trim (the API reads null as
    // "no trim"), whereas 0 would set a real trim at position zero.
    expect(parseTimecode("")).toBeNull();
    expect(parseTimecode("   ")).toBeNull();
    expect(parseTimecode(null)).toBeNull();
    expect(parseTimecode(undefined)).toBeNull();
  });

  it("returns null for a negative timecode", () => {
    expect(parseTimecode("-5")).toBeNull();
    expect(parseTimecode("-1:30")).toBeNull();
    expect(parseTimecode(-5)).toBeNull();
  });

  it("returns null for non-numeric input", () => {
    expect(parseTimecode("abc")).toBeNull();
    expect(parseTimecode("12:ab")).toBeNull();
    expect(parseTimecode("1e3")).toBeNull();
    expect(parseTimecode("12.5")).toBeNull();
    expect(parseTimecode(NaN)).toBeNull();
  });

  it("rejects a non-leading part over 59 rather than guessing", () => {
    // "1:75" is either 135s or a typo for 1:15. Picking one trims the wrong
    // minute of somebody's class, so it is refused instead.
    expect(parseTimecode("1:75")).toBeNull();
    expect(parseTimecode("1:60:00")).toBeNull();
  });

  it("rejects more than three parts", () => {
    expect(parseTimecode("1:2:3:4")).toBeNull();
  });

  it("tolerates padding around the parts", () => {
    expect(parseTimecode("  12:34  ")).toBe(754);
  });

  it("floors a fractional number rather than emitting a non-integer", () => {
    // trim_start_seconds is an integer field; 12.7 must not go out as-is.
    expect(parseTimecode(12.7)).toBe(12);
  });
});

describe("formatTimecode", () => {
  it("renders mm:ss under an hour, with a padded seconds field", () => {
    expect(formatTimecode(754)).toBe("12:34");
    expect(formatTimecode(5)).toBe("0:05");
    expect(formatTimecode(0)).toBe("0:00");
    expect(formatTimecode(59)).toBe("0:59");
    expect(formatTimecode(60)).toBe("1:00");
  });

  it("switches to h:mm:ss past an hour", () => {
    expect(formatTimecode(3600)).toBe("1:00:00");
    expect(formatTimecode(3723)).toBe("1:02:03");
    expect(formatTimecode(7325)).toBe("2:02:05");
  });

  it("renders an unset value as an empty string, not 0:00", () => {
    // These drive text inputs. A "0:00" placeholder for an untrimmed
    // recording is something the teacher has to delete before typing.
    expect(formatTimecode(null)).toBe("");
    expect(formatTimecode(undefined)).toBe("");
    expect(formatTimecode(NaN)).toBe("");
  });

  it("floors fractional seconds and clamps a negative to zero", () => {
    expect(formatTimecode(12.9)).toBe("0:12");
    expect(formatTimecode(-5)).toBe("0:00");
  });

  it("round-trips through parseTimecode", () => {
    [0, 5, 59, 60, 754, 3600, 3723, 7325].forEach((n) => {
      expect(parseTimecode(formatTimecode(n))).toBe(n);
    });
  });
});

describe("clampTrim", () => {
  it("leaves a window that is already valid alone", () => {
    expect(clampTrim({ start: 30, end: 600, duration: 1800 })).toEqual({
      start: 30,
      end: 600,
    });
  });

  it("preserves an unset side as null", () => {
    // A one-sided trim is legal: "skip the first two minutes" needs no end.
    expect(clampTrim({ start: 30, end: null, duration: 1800 })).toEqual({
      start: 30,
      end: null,
    });
    expect(clampTrim({ start: null, end: 600, duration: 1800 })).toEqual({
      start: null,
      end: 600,
    });
    expect(clampTrim({})).toEqual({ start: null, end: null });
  });

  it("clamps a negative position up to zero", () => {
    expect(clampTrim({ start: -10, end: 600, duration: 1800 }).start).toBe(0);
  });

  it("clamps a position past the end of the video down to the duration", () => {
    expect(clampTrim({ start: 30, end: 9999, duration: 1800 }).end).toBe(1800);
  });

  it("pushes the END out when the window is inverted", () => {
    const { start, end } = clampTrim({ start: 600, end: 30, duration: 1800 });
    expect(start).toBe(600);
    expect(end).toBe(601);
  });

  it("treats end === start as inverted — an empty clip is not a trim", () => {
    expect(clampTrim({ start: 600, end: 600, duration: 1800 }).end).toBe(601);
  });

  it("moves the START back when there is no room left at the end", () => {
    const { start, end } = clampTrim({ start: 1800, end: 1800, duration: 1800 });
    expect(start).toBe(1799);
    expect(end).toBe(1800);
  });

  it("still yields a non-empty window when the duration is unknown", () => {
    // duration_seconds is NULL until Bunny transcodes and something polls it.
    const { start, end } = clampTrim({ start: 600, end: 30, duration: null });
    expect(start).toBe(600);
    expect(end).toBe(601);
  });

  it("does not clamp against a sub-second duration", () => {
    // A 0 would otherwise pin every position to 0 and read on screen as "the
    // teacher trimmed the entire lesson away".
    expect(clampTrim({ start: 30, end: 600, duration: 0 })).toEqual({
      start: 30,
      end: 600,
    });
  });

  it("floors fractional input", () => {
    expect(clampTrim({ start: 30.9, end: 600.2, duration: 1800 })).toEqual({
      start: 30,
      end: 600,
    });
  });

  it("never returns an inverted window, whatever it is given", () => {
    const cases = [
      { start: 5, end: 5, duration: 10 },
      { start: 10, end: 0, duration: 10 },
      { start: 99, end: 1, duration: 10 },
      { start: 1, end: 1, duration: 1 },
      { start: -5, end: -5, duration: 10 },
    ];
    cases.forEach((c) => {
      const { start, end } = clampTrim(c);
      expect(isValidWindow({ start, end, duration: c.duration })).toBe(true);
    });
  });
});

describe("isValidWindow — mirrors the server's _validate_trim", () => {
  it("accepts a window inside the video", () => {
    expect(isValidWindow({ start: 30, end: 600, duration: 1800 })).toBe(true);
  });

  it("accepts a one-sided or entirely absent trim", () => {
    expect(isValidWindow({ start: 30, end: null, duration: 1800 })).toBe(true);
    expect(isValidWindow({ start: null, end: 600, duration: 1800 })).toBe(true);
    expect(isValidWindow({ start: null, end: null, duration: 1800 })).toBe(true);
    expect(isValidWindow({})).toBe(true);
  });

  it("rejects end <= start", () => {
    expect(isValidWindow({ start: 600, end: 30, duration: 1800 })).toBe(false);
    expect(isValidWindow({ start: 600, end: 600, duration: 1800 })).toBe(false);
  });

  it("rejects a position past the duration", () => {
    expect(isValidWindow({ start: 30, end: 1801, duration: 1800 })).toBe(false);
    expect(isValidWindow({ start: 1801, end: null, duration: 1800 })).toBe(false);
  });

  it("accepts a position exactly at the duration", () => {
    // The server's check is `> duration`, not `>=`.
    expect(isValidWindow({ start: 30, end: 1800, duration: 1800 })).toBe(true);
  });

  it("skips the range check when the duration is unknown", () => {
    // Matches the server: a still-transcoding upload has no duration_seconds
    // to range-check against, and the edit is accepted rather than blocked.
    expect(isValidWindow({ start: 30, end: 99999, duration: null })).toBe(true);
    expect(isValidWindow({ start: 30, end: 99999, duration: 0 })).toBe(true);
  });

  it("rejects a negative or non-numeric position", () => {
    expect(isValidWindow({ start: -1, end: 600, duration: 1800 })).toBe(false);
    expect(isValidWindow({ start: NaN, end: 600, duration: 1800 })).toBe(false);
    expect(isValidWindow({ start: "abc", end: 600, duration: 1800 })).toBe(false);
  });
});
