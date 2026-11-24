import { describe, it, expect } from "vitest";
import { attributionLines } from "../ghl/client";
import { reportReference } from "./reference";
import { scheduleHref } from "./schedule-link";

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

  it("reaches the CRM note as the reference, and never the token", () => {
    const ref = reportReference(TOKEN);
    const lines = attributionLines(`https://reddoorla.com${scheduleHref(ref)}`, "");
    expect(lines).toContain(`utm_content: ${ref}`);
    expect(lines.join("\n")).not.toContain(TOKEN);
  });
});
