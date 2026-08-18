import { describe, expect, it } from "vitest";
import {
  buildIcs,
  escapeIcsText,
  foldIcsLine,
  googleCalendarUrl,
  outlookCalendarUrl,
  toUtcStamp,
} from "./ics";

// A real appointment, as the CRM returns it: Mountain offset, and a Zoom URL
// whose query string carries the meeting password.
const EVENT = {
  title: "Intro call — Tucker Lemos",
  startTime: "2026-08-21T11:00:00-06:00",
  endTime: "2026-08-21T11:30:00-06:00",
  join: "https://us06web.zoom.us/j/3922707667?pwd=UVRtSE16U0JCakY3Z2s4RUhTUS9Ydz09&omn=86310103538",
};

describe("toUtcStamp", () => {
  it("converts an offset time to the UTC basic format both formats require", () => {
    // 11:00 Mountain is 17:00 UTC. A stamp that echoed the local wall clock
    // would put the call in someone's calendar six hours early.
    expect(toUtcStamp(EVENT.startTime)).toBe("20260821T170000Z");
  });

  it("throws rather than emitting a garbage stamp", () => {
    expect(() => toUtcStamp("not a time")).toThrow(RangeError);
  });
});

describe("escapeIcsText", () => {
  it("escapes the characters that would otherwise end a value", () => {
    expect(escapeIcsText("Smith, Jones; & Co")).toBe("Smith\\, Jones\\; & Co");
    expect(escapeIcsText("line one\nline two")).toBe("line one\\nline two");
  });

  it("escapes the backslash FIRST, so later escapes are not doubled", () => {
    // Escaping the comma before the backslash would yield "a\\\\,b" — the
    // reader then sees a literal backslash followed by a field separator.
    expect(escapeIcsText("a\\,b")).toBe("a\\\\\\,b");
  });
});

describe("foldIcsLine", () => {
  it("leaves a short line alone", () => {
    expect(foldIcsLine("SUMMARY:Intro call")).toBe("SUMMARY:Intro call");
  });

  it("folds a long line with a leading space on each continuation", () => {
    const folded = foldIcsLine(`LOCATION:${EVENT.join}`);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts.slice(1)) expect(p.startsWith(" ")).toBe(true);
    // Unfolding is "drop the CRLF and the one space that follows it".
    expect(parts.map((p, i) => (i === 0 ? p : p.slice(1))).join("")).toBe(`LOCATION:${EVENT.join}`);
  });

  it("counts octets, not characters, and never splits one", () => {
    // Em dashes are 3 bytes each in UTF-8. A character-counted fold puts the
    // break mid-glyph and the file renders as mojibake, or is rejected.
    const line = `SUMMARY:${"—".repeat(60)}`;
    const enc = new TextEncoder();
    for (const part of foldIcsLine(line).split("\r\n")) {
      expect(enc.encode(part).length).toBeLessThanOrEqual(75);
      // A split multi-byte sequence would decode to U+FFFD.
      expect(part).not.toContain("�");
    }
  });
});

describe("buildIcs", () => {
  const ics = buildIcs(EVENT, "yeNIKuJ12o9bnPIUweNV", "20260818T233000Z");

  it("is CRLF-delimited, as RFC 5545 requires", () => {
    expect(ics.includes("\r\n")).toBe(true);
    expect(/[^\r]\n/.test(ics)).toBe(false);
  });

  it("carries the times as UTC stamps and the call as the location", () => {
    expect(ics).toContain("DTSTART:20260821T170000Z");
    expect(ics).toContain("DTEND:20260821T173000Z");
    expect(ics).toContain("UID:yeNIKuJ12o9bnPIUweNV@reddoorla.com");
    // Unfold before asserting on a URL long enough to have been folded.
    expect(ics.replace(/\r\n /g, "")).toContain(`LOCATION:${EVENT.join}`);
  });

  it("falls back to the start when the CRM gave no end time", () => {
    const open = buildIcs({ ...EVENT, endTime: "" }, "x1234567890", "20260818T233000Z");
    expect(open).toContain("DTEND:20260821T170000Z");
  });
});

describe("calendar hand-off URLs", () => {
  it("Google gets a start/end pair of UTC stamps", () => {
    const u = new URL(googleCalendarUrl(EVENT));
    expect(u.origin + u.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(u.searchParams.get("dates")).toBe("20260821T170000Z/20260821T173000Z");
    expect(u.searchParams.get("text")).toBe(EVENT.title);
    expect(u.searchParams.get("location")).toBe(EVENT.join);
  });

  it("Outlook gets plain ISO, which is what its deeplink parses", () => {
    const u = new URL(outlookCalendarUrl(EVENT));
    expect(u.origin + u.pathname).toBe("https://outlook.live.com/calendar/0/deeplink/compose");
    expect(u.searchParams.get("startdt")).toBe("2026-08-21T17:00:00.000Z");
    expect(u.searchParams.get("enddt")).toBe("2026-08-21T17:30:00.000Z");
    expect(u.searchParams.get("subject")).toBe(EVENT.title);
  });

  it("percent-encodes the join URL's own query string rather than merging it", () => {
    // The Zoom URL contains & and =. Concatenated by hand, its `pwd` would
    // become a parameter of the CALENDAR url and the join link would break.
    const raw = googleCalendarUrl(EVENT);
    expect(raw).not.toContain("&pwd=");
    expect(new URL(raw).searchParams.get("location")).toBe(EVENT.join);
  });
});
