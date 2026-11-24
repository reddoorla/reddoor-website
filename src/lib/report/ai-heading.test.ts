import { describe, it, expect } from "vitest";
import { ALL_PASS_REPORT } from "./fixtures/all-pass";
import { toReportView, type ProbeAnswer, type ReportView } from "./model";
import { aiSectionHeading } from "./ai-heading";

const OLD = "What AI is saying about you";

const probe = (over: Partial<ProbeAnswer>): ProbeAnswer => ({
  engine: "claude",
  query: "who does branding in los angeles",
  kind: "category",
  domainCited: false,
  brandMentioned: false,
  citedDomains: [],
  snippet: "",
  truncated: false,
  askedAt: "2026-11-06T17:00:00Z",
  ...over,
});

const viewWith = (probes: ProbeAnswer[]): ReportView => {
  const view = toReportView(ALL_PASS_REPORT as Parameters<typeof toReportView>[0]);
  return { ...view, categoryProbes: probes, brandedProbes: [] };
};

describe("aiSectionHeading", () => {
  it("names Claude and the day when every answer is a Claude answer asked that day", () => {
    const view = viewWith([
      probe({ askedAt: "2026-11-06T20:00:00Z" }),
      probe({ askedAt: "2026-11-06T17:00:00Z" }),
    ]);
    expect(aiSectionHeading(view)).toBe("What Claude said about you on November 6");
  });

  it("names the first and last day when the asks fell on different days", () => {
    const view = viewWith([
      probe({ askedAt: "2026-11-08T17:00:00Z" }),
      probe({ askedAt: "2026-11-06T17:00:00Z" }),
    ]);
    expect(aiSectionHeading(view)).toBe(
      "What Claude said about you between November 6 and November 8",
    );
  });

  it("counts the subscription harness as Claude too", () => {
    const view = viewWith([probe({ engine: "claude-code" })]);
    expect(aiSectionHeading(view)).toBe("What Claude said about you on November 6");
  });

  it("keeps the old heading when an answer has no ask date", () => {
    expect(aiSectionHeading(viewWith([probe({ askedAt: "" })]))).toBe(OLD);
  });

  it("keeps the old heading when an answer came from another engine", () => {
    expect(aiSectionHeading(viewWith([probe({}), probe({ engine: "perplexity" })]))).toBe(OLD);
  });

  it("keeps the old heading when there are no answers to name", () => {
    expect(aiSectionHeading(viewWith([]))).toBe(OLD);
  });

  it("prints the Pacific calendar date, not the UTC one, for an ask made at 2am UTC", () => {
    // 2026-11-06 02:00 UTC is 6pm on 5 November in Los Angeles (PST).
    const view = viewWith([probe({ askedAt: "2026-11-06T02:00:00Z" })]);
    expect(aiSectionHeading(view)).toBe("What Claude said about you on November 5");
  });
});
