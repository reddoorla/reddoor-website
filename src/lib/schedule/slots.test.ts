import { describe, it, expect } from "vitest";
import { groupByDay, formatTime, formatZone, formatDayLabel, formatFullSlot } from "./slots";

// The CRM's own shape: 9:00 and 16:30 Mountain on 2026-08-19, which is what
// `free-slots` returns for a Boise-timezone location.
const MT_0900 = "2026-08-19T09:00:00-06:00";
const MT_1630 = "2026-08-19T16:30:00-06:00";
const MT_NEXT_0900 = "2026-08-20T09:00:00-06:00";

describe("groupByDay", () => {
  it("splits one CRM day across two visitor days", () => {
    // The calendar's 09:00-17:00 Mountain window is 15:00-23:00 UTC, which
    // straddles local midnight for every zone from UTC+1 to UTC+8. In Shanghai
    // (UTC+8) the 09:00 slot is 23:00 that evening and the 16:30 slot is 06:30
    // the next morning — one CRM day, two days on the visitor's screen.
    const days = groupByDay([MT_0900, MT_1630], "Asia/Shanghai");
    expect(days).toEqual([
      { key: "2026-08-19", slots: [MT_0900] },
      { key: "2026-08-20", slots: [MT_1630] },
    ]);
  });

  it("shifts a whole CRM day forward for a visitor far enough east", () => {
    // Auckland is UTC+12, so the entire Mountain business day lands on the
    // following local date. The CRM's own day key would be off by one.
    const days = groupByDay([MT_0900, MT_1630], "Pacific/Auckland");
    expect(days).toEqual([{ key: "2026-08-20", slots: [MT_0900, MT_1630] }]);
  });

  it("keeps a Mountain day whole for a Pacific visitor", () => {
    const days = groupByDay([MT_0900, MT_1630], "America/Los_Angeles");
    expect(days).toEqual([{ key: "2026-08-19", slots: [MT_0900, MT_1630] }]);
  });

  it("sorts days and the slots inside them", () => {
    const days = groupByDay([MT_NEXT_0900, MT_1630, MT_0900], "America/Los_Angeles");
    expect(days.map((d) => d.key)).toEqual(["2026-08-19", "2026-08-20"]);
    expect(days[0].slots).toEqual([MT_0900, MT_1630]);
  });

  it("drops unparseable entries rather than rendering Invalid Date", () => {
    const days = groupByDay([MT_0900, "traceId", ""], "America/Los_Angeles");
    expect(days).toEqual([{ key: "2026-08-19", slots: [MT_0900] }]);
  });

  it("returns nothing for an empty list", () => {
    expect(groupByDay([], "America/Los_Angeles")).toEqual([]);
  });
});

describe("formatTime", () => {
  it("converts into the visitor's zone", () => {
    // 09:00 Mountain is 08:00 Pacific — the reason none of this can be skipped.
    expect(formatTime(MT_0900, "America/Los_Angeles")).toBe("8:00 AM");
    expect(formatTime(MT_0900, "America/New_York")).toBe("11:00 AM");
  });
});

describe("formatZone", () => {
  it("names the visitor's zone at that instant", () => {
    expect(formatZone(MT_0900, "America/Los_Angeles")).toBe("PDT");
  });

  it("follows the DST boundary rather than the zone alone", () => {
    // Same zone, one instant either side of the US autumn changeover.
    expect(formatZone("2026-10-15T12:00:00Z", "America/Los_Angeles")).toBe("PDT");
    expect(formatZone("2026-12-15T12:00:00Z", "America/Los_Angeles")).toBe("PST");
  });
});

describe("formatDayLabel", () => {
  it("labels from a real instant, so the day cannot slip", () => {
    // The trap this guards: new Date("2026-08-19") is UTC midnight, which is
    // still the 18th in Los Angeles.
    const [day] = groupByDay([MT_0900], "America/Los_Angeles");
    expect(formatDayLabel(day, "America/Los_Angeles")).toEqual({
      weekday: "Wed",
      date: "Aug 19",
    });
  });
});

describe("formatFullSlot", () => {
  it("reads as a sentence, with the zone named", () => {
    expect(formatFullSlot(MT_0900, "America/Los_Angeles")).toBe(
      "Wednesday, August 19 at 8:00 AM PDT",
    );
  });
});
