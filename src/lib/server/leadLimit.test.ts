import { describe, it, expect, beforeEach } from "vitest";
import { takeLeadSlot, resetLeadLimit, limitKey, LEAD_LIMIT, LEAD_WINDOW_MS } from "./leadLimit";

const IP = "203.0.113.7";
const t0 = 1_800_000_000_000;

describe("limitKey", () => {
  it.each([
    ["203.0.113.7", "203.0.113.7"],
    ["::ffff:1.2.3.4", "1.2.3.4"],
    ["::FFFF:1.2.3.4", "1.2.3.4"],
    ["2001:db8::1", "2001:db8:0:0::/64"],
    ["2001:DB8:0:0:1::7", "2001:db8:0:0::/64"],
    ["2001:0db8:0000:0000:0001:0000:0000:0007", "2001:db8:0:0::/64"],
    ["::1", "0:0:0:0::/64"],
    ["2001:db8:0:1::1", "2001:db8:0:1::/64"],
    ["fe80::1%eth0", "fe80:0:0:0::/64"],
  ])("maps %s to %s", (ip, key) => {
    expect(limitKey(ip)).toBe(key);
  });

  it("returns garbage unchanged, and never throws", () => {
    for (const ip of ["", "not-an-ip", "2001:::1", "gggg::1"]) {
      expect(() => limitKey(ip)).not.toThrow();
      expect(limitKey(ip)).toBe(ip);
    }
  });
});

describe("takeLeadSlot", () => {
  beforeEach(() => resetLeadLimit());

  it("counts the four addresses of one IPv6 /64 against one limit", () => {
    expect(takeLeadSlot("2001:db8::1", t0)).toBe(true);
    expect(takeLeadSlot("2001:db8::2", t0)).toBe(true);
    expect(takeLeadSlot("2001:db8::3", t0)).toBe(true);
    expect(takeLeadSlot("2001:db8::4", t0)).toBe(false);
    expect(takeLeadSlot("2001:db8:0:1::1", t0)).toBe(true);
  });

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
