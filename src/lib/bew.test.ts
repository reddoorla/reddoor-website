import { describe, expect, it } from "vitest";
import { BEW_LANDING, BEW_UTM, bewTarget } from "./bew";

const target = (query: string) => new URL(bewTarget(new URLSearchParams(query)), "http://x");

describe("bewTarget", () => {
  it("lands on the Boise page with the event's utm set", () => {
    const to = target("");
    expect(to.pathname).toBe("/boise");
    expect(BEW_LANDING).toBe("/boise");
    expect(Object.fromEntries(to.searchParams)).toEqual({
      utm_source: "bew",
      utm_medium: "event",
      utm_campaign: "bew-2026",
    });
    expect(BEW_UTM.utm_campaign).toBe("bew-2026");
  });

  it("lets an incoming utm_* add to or override the defaults", () => {
    // Two QR codes, one route: the booth card and the closing slide differ by
    // utm_content, and a printed card that says utm_source=print wins over bew.
    const to = target("utm_content=booth-card&utm_source=print");
    expect(to.searchParams.get("utm_content")).toBe("booth-card");
    expect(to.searchParams.get("utm_source")).toBe("print");
    expect(to.searchParams.get("utm_medium")).toBe("event");
  });

  it("drops everything that is not a utm parameter", () => {
    const to = target("next=https://evil.example.com&email=pat%40example.com&utm_term=x");
    expect(to.searchParams.has("next")).toBe(false);
    expect(to.searchParams.has("email")).toBe(false);
    expect(to.searchParams.get("utm_term")).toBe("x");
  });

  it("ignores empty utm values and keeps the path fixed", () => {
    const to = target("utm_content=%20&utm_campaign=../../etc");
    expect(to.searchParams.get("utm_content")).toBeNull();
    expect(to.searchParams.get("utm_campaign")).toBe("../../etc");
    expect(to.pathname).toBe("/boise");
  });

  it("caps a utm value so a hostile link cannot bloat the CRM note", () => {
    const to = target(`utm_content=${"a".repeat(500)}`);
    expect(to.searchParams.get("utm_content")).toHaveLength(100);
  });

  it("caps how many utm_ keys survive, since each becomes a note line", () => {
    const many = Array.from({ length: 20 }, (_, i) => `utm_${String.fromCharCode(97 + i)}=v${i}`);
    const to = target(many.join("&"));
    expect(Array.from(to.searchParams).length).toBeLessThanOrEqual(12);
    expect(bewTarget(new URLSearchParams(many.join("&")))).toMatch(/^\/boise\?/);
  });

  it("only accepts lowercase utm_ keys, the shape GA and the CRM read", () => {
    const to = target("UTM_SOURCE=shout&utm_source=quiet&utm_9=nope");
    expect(to.searchParams.get("utm_source")).toBe("quiet");
    expect(to.searchParams.has("UTM_SOURCE")).toBe(false);
    expect(to.searchParams.has("utm_9")).toBe(false);
  });
});
