import { describe, expect, it } from "vitest";
import { isLiveBeat } from "./vimeoBeat";

describe("isLiveBeat", () => {
  it("never reveals on play or ready — both fire before a frame is painted", () => {
    expect(isLiveBeat({ event: "play" })).toBe(false);
    expect(isLiveBeat({ event: "play", data: { seconds: 0 } })).toBe(false);
    expect(isLiveBeat({ event: "ready" })).toBe(false);
  });

  it("ignores progress beats stuck at zero seconds (clock not yet advancing)", () => {
    expect(isLiveBeat({ event: "timeupdate", data: { seconds: 0 } })).toBe(false);
    expect(isLiveBeat({ event: "playProgress", data: { seconds: "0.0" } })).toBe(false);
  });

  it("reveals once the playback clock has advanced", () => {
    expect(isLiveBeat({ event: "timeupdate", data: { seconds: 0.25 } })).toBe(true);
    // Legacy Froogaloop (`?background=1`) reports seconds as strings.
    expect(isLiveBeat({ event: "playProgress", data: { seconds: "1.2" } })).toBe(true);
  });

  it("fails open when a progress beat carries no readable clock", () => {
    // The event class itself only fires during playback, so a protocol
    // variation without `seconds` must still reveal — never strand the poster.
    expect(isLiveBeat({ event: "timeupdate" })).toBe(true);
    expect(isLiveBeat({ event: "playProgress", data: {} })).toBe(true);
    expect(isLiveBeat({ event: "timeupdate", data: { seconds: "abc" } })).toBe(true);
  });

  it("rejects everything that is not a progress beat", () => {
    expect(isLiveBeat({ event: "pause" })).toBe(false);
    expect(isLiveBeat({})).toBe(false);
  });
});
