/**
 * Tests for the intro-clip validator.
 *
 * These matter because the failure they guard against is silent. The old
 * listing uploader accepted anything and reported every rejection as the
 * single word "failed", so a teacher whose clip was refused had no way to
 * learn whether the problem was the format, the size, or the length. Each
 * assertion below is really checking "does the message name the actual
 * problem", not just "was it rejected".
 *
 * The duration branch also encodes a deliberate decision: a file the browser
 * cannot decode resolves to null and must be ALLOWED through, because the
 * server re-checks against Bunny's own reported length. Blocking on a failed
 * local decode would reject valid clips in whatever codec this browser
 * happens to lack.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { MAX_SECONDS, validateIntroVideo } from "./introVideoRules";

/** A File-alike; jsdom's File is fine but this keeps size controllable. */
function fakeFile({ type = "video/mp4", size = 1024 } = {}) {
  return { type, size, name: "clip.mp4" };
}

/**
 * Stub the <video> element the validator uses to read duration.
 * `duration` of undefined simulates a decode failure (fires onerror).
 *
 * This project has no jsdom (every other test here is a pure function), so
 * rather than pull in a DOM just for these, the two globals `readDuration`
 * touches are installed directly and torn down after each test.
 */
function stubVideoDuration(duration) {
  URL.createObjectURL = () => "blob:stub";
  URL.revokeObjectURL = () => {};
  globalThis.document = {
    createElement(tag) {
      if (tag !== "video") return {};
      const el = {
        preload: "", onloadedmetadata: null, onerror: null,
        removeAttribute: () => {},
        set src(_v) {
          // Fire asynchronously, as the real element does.
          queueMicrotask(() => {
            if (duration === undefined) el.onerror?.();
            else { el.duration = duration; el.onloadedmetadata?.(); }
          });
        },
      };
      return el;
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  delete globalThis.document;
  delete URL.createObjectURL;
  delete URL.revokeObjectURL;
});

describe("validateIntroVideo", () => {
  it("names the rejected format rather than just failing", async () => {
    const msg = await validateIntroVideo(fakeFile({ type: "video/x-matroska" }));
    expect(msg).toContain("video/x-matroska");
    expect(msg).toMatch(/MP4/);
  });

  it("copes with a file the OS reported no type for", async () => {
    const msg = await validateIntroVideo(fakeFile({ type: "" }));
    expect(msg).toBeTruthy();
    expect(msg).not.toContain("undefined");
    expect(msg).toMatch(/MP4/);
  });

  it("names the actual size when the file is too large", async () => {
    const msg = await validateIntroVideo(
      fakeFile({ size: 5 * 1024 * 1024 * 1024 })
    );
    expect(msg).toContain("5.0 GB");
    expect(msg).toContain("4 GB");
  });

  it("rejects a clip over the limit and states both numbers", async () => {
    stubVideoDuration(MAX_SECONDS + 35);
    const msg = await validateIntroVideo(fakeFile());
    expect(msg).toContain(String(MAX_SECONDS + 35));
    expect(msg).toContain(String(MAX_SECONDS));
  });

  it("accepts a clip exactly at the limit", async () => {
    stubVideoDuration(MAX_SECONDS);
    expect(await validateIntroVideo(fakeFile())).toBeNull();
  });

  it("accepts a clip a hair over, to absorb rounding", async () => {
    // Browsers report e.g. 60.04 for a clip encoded as exactly 60s.
    stubVideoDuration(MAX_SECONDS + 0.2);
    expect(await validateIntroVideo(fakeFile())).toBeNull();
  });

  it("accepts a clip the browser cannot decode — the server decides", async () => {
    stubVideoDuration(undefined);
    expect(await validateIntroVideo(fakeFile())).toBeNull();
  });

  it("accepts a stream with no knowable length", async () => {
    stubVideoDuration(Infinity);
    expect(await validateIntroVideo(fakeFile())).toBeNull();
  });

  it("rejects nothing at all with a real message", async () => {
    expect(await validateIntroVideo(null)).toBeTruthy();
  });
});
