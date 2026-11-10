import { describe, it, expect, beforeEach } from "vitest";
import { takeLeadSlot, resetLeadLimit, LEAD_LIMIT, LEAD_WINDOW_MS } from "./leadLimit";

const IP = "203.0.113.7";
const t0 = 1_800_000_000_000;

describe("takeLeadSlot", () => {
  beforeEach(() => resetLeadLimit());

  it("grants LEAD_LIMIT slots to one IP, then refuses", () => {
    for (let i = 0; i < LEAD_LIMIT; i++) expect(takeLeadSlot(IP, t0)).toBe(true);
    expect(takeLeadSlot(IP, t0)).toBe(false);
  });

  it("limits each IP separately", () => {
    for (let i = 0; i < LEAD_LIMIT; i++) takeLeadSlot(IP, t0);
    expect(takeLeadSlot(IP, t0)).toBe(false);
    expect(takeLeadSlot("198.51.100.9", t0)).toBe(true);
  });

  it("grants the IP a slot again once the window has passed", () => {
    for (let i = 0; i < LEAD_LIMIT; i++) takeLeadSlot(IP, t0);
    expect(takeLeadSlot(IP, t0 + LEAD_WINDOW_MS - 1)).toBe(false);
    expect(takeLeadSlot(IP, t0 + LEAD_WINDOW_MS + 1)).toBe(true);
  });

  it("does not extend the window with a refused call", () => {
    for (let i = 0; i < LEAD_LIMIT; i++) takeLeadSlot(IP, t0);
    // Refused five minutes in: must not count as a new hit.
    expect(takeLeadSlot(IP, t0 + 5 * 60 * 1000)).toBe(false);
    // At ten minutes plus a millisecond the original three have all expired.
    expect(takeLeadSlot(IP, t0 + LEAD_WINDOW_MS + 1)).toBe(true);
  });
});
