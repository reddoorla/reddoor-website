import { describe, it, expect } from "vitest";
import { ALL_PASS_REPORT } from "./fixtures/all-pass";
import { toReportView, type ReportView } from "./model";
import { headlineFinding } from "./narrative";

const SENTENCE = "Nothing else in this report can help";

const withCrawlers = (blocked: string[], blockedSearch: string[]): ReportView => {
  const view = toReportView(ALL_PASS_REPORT as Parameters<typeof toReportView>[0]);
  return {
    ...view,
    crawlerReach: { measured: true, blocked, blockedSearch, checked: 1 },
  };
};

describe("headline for blocked crawlers", () => {
  it("training crawlers alone do not earn the crawlers-blocked headline", () => {
    const h = headlineFinding(withCrawlers(["GPTBot"], []));
    expect(h.kind).not.toBe("crawlers-blocked");
    expect(h.text).not.toContain(SENTENCE);
  });

  it("a blocked retrieval crawler is named without the nothing-else sentence", () => {
    const h = headlineFinding(withCrawlers(["OAI-SearchBot"], []));
    expect(h.kind).toBe("crawlers-blocked");
    expect(h.text).toContain("OAI-SearchBot");
    expect(h.text).toContain("which AI assistants use to read your pages when they answer");
    expect(h.text).not.toContain(SENTENCE);
  });

  it("a blocked search crawler keeps the nothing-else sentence", () => {
    const h = headlineFinding(withCrawlers([], ["Googlebot"]));
    expect(h.kind).toBe("crawlers-blocked");
    expect(h.text).toContain("Googlebot");
    expect(h.text).toContain(SENTENCE);
  });
});
