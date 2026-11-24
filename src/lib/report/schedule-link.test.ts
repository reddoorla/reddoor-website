import { describe, it, expect } from "vitest";
import { reportReference } from "./reference";
import { auditBookingNote, scheduleHref } from "./schedule-link";

const TOKEN = "aB3-_xY9zQ1rS2tU4vW6xY";

describe("reportReference", () => {
  it("is 8 lowercase hex characters, stable for one token, and different for another", () => {
    const ref = reportReference(TOKEN);
    expect(ref).toMatch(/^[0-9a-f]{8}$/);
    expect(reportReference(TOKEN)).toBe(ref);
    expect(reportReference("another-token-000000000")).not.toBe(ref);
  });

  it("does not contain the token", () => {
    expect(reportReference(TOKEN)).not.toContain(TOKEN);
  });
});

describe("scheduleHref", () => {
  it("carries the report reference as utm_content when there is one", () => {
    expect(scheduleHref("0a1b2c3d")).toBe(
      "/schedule?utm_source=audit&utm_medium=report&utm_content=0a1b2c3d",
    );
  });

  it("drops utm_content when there is no reference", () => {
    expect(scheduleHref(null)).toBe("/schedule?utm_source=audit&utm_medium=report");
  });

  it("the booking note names the reference from the scheduler's own address, never the token", () => {
    const ref = reportReference(TOKEN);
    const note = auditBookingNote(`https://reddoorla.com${scheduleHref(ref)}`);
    expect(note).toBe(`Booked from an audit report, reference ${ref}.`);
    expect(note).not.toContain(TOKEN);
  });

  it("echoes only an 8-hex reference, and nothing for a booking from elsewhere", () => {
    expect(
      auditBookingNote("https://reddoorla.com/schedule?utm_source=audit&utm_content=<b>hi</b>"),
    ).toBe("Booked from an audit report.");
    expect(auditBookingNote("https://reddoorla.com/schedule?utm_source=ads")).toBeNull();
    expect(auditBookingNote("not a url")).toBeNull();
  });
});
