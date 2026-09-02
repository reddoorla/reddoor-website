import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { toReportView } from "./model";
import type { AuditReport } from "./fetch";

/**
 * Two defects in one line, both introduced by the same commit.
 *
 * 1. `checked` was read off the CHECKS stage. `agentAccess` lives on CRAWL —
 *    one entry per agent in crawl.ts's ALL_AGENTS. The optional field on the
 *    checks type was invented here, so the compiler had nothing to object to and
 *    every report printed "all 0 of the crawlers we checked are allowed in".
 *
 * 2. "Yes" is a claim robots.txt cannot support. render.ts removed that exact
 *    sentence upstream and recorded why: a live prospect whose robots.txt
 *    blocked nothing relevant, whose CDN returned 403 to one named AI crawler on
 *    every request while serving a browser and two other crawlers normally. The
 *    report said they were fine. This section restored the claim and promoted it
 *    to a headline.
 *
 * The source-text assertions follow token-privacy.test.ts: a Svelte template has
 * no seam to import, and the property that broke is the rendered sentence.
 */
const asReport = (o: unknown): AuditReport => o as AuditReport;

const SIX_AGENTS = [
  { agent: "GPTBot" },
  { agent: "ClaudeBot" },
  { agent: "PerplexityBot" },
  { agent: "Google-Extended" },
  { agent: "Googlebot" },
  { agent: "Bingbot" },
];

const report = (over: Record<string, unknown> = {}) =>
  asReport({
    url: "https://acme.example/",
    scores: {},
    crawl: { ok: true, data: { agentAccess: SIX_AGENTS } },
    checks: {
      ok: true,
      data: { crawlerAccessMeasured: true, crawlerAccess: { blockedAi: [], blockedClassical: [] } },
    },
    ...over,
  });

describe("crawlerReach.checked — how many crawlers we actually looked at", () => {
  it("counts the agents the crawl stage checked", () => {
    expect(toReportView(report()).crawlerReach?.checked).toBe(6);
  });

  it("is 0 only when the crawl stage really has no agents", () => {
    const v = toReportView(report({ crawl: { ok: true, data: { agentAccess: [] } } }));
    expect(v.crawlerReach?.checked).toBe(0);
  });

  it("survives a report stored before agentAccess existed", () => {
    const v = toReportView(report({ crawl: { ok: true, data: {} } }));
    expect(v.crawlerReach?.checked).toBe(0);
    expect(v.crawlerReach?.measured).toBe(true);
  });

  // A failed crawl must not turn into "we checked nobody and they are fine".
  it("still reports the robots.txt measurement when the crawl stage failed", () => {
    const v = toReportView(report({ crawl: { ok: false, error: "boom" } }));
    expect(v.crawlerReach).toEqual({ measured: true, blocked: [], checked: 0 });
  });
});

describe("no surface claims robots.txt proves reachability", () => {
  const codeOf = (path: string): string =>
    readFileSync(path, "utf-8").replace(/^\s*(\/\/|\*|\/\*).*$/gm, "");

  const surfaces: Array<[string, string]> = [
    ["the web report", "src/lib/report/ScoreBars.svelte"],
    ["the print sheet", "src/routes/audit/[token]/print/+page.svelte"],
  ];

  // The forbidden claim is REACHABILITY, however it is phrased. "Yes", "allowed
  // in" and "can reach you" are the same assertion, and robots.txt supports none
  // of them — a CDN's bot management enforces its own answer over the file.
  const REACHABILITY_CLAIM = /allowed in|can reach|reach you|reach the site/i;

  for (const [label, path] of surfaces) {
    it(`${label} never says the crawlers can reach them`, () => {
      const code = codeOf(path);
      expect(code).not.toMatch(REACHABILITY_CLAIM);
      expect(code).not.toMatch(/Yes\s*&mdash;|Yes\s*—/);
    });

    it(`${label} scopes the clean verdict to robots.txt`, () => {
      // Every branch of the block is about the file, so the word has to appear
      // at least as often as the branches that make a claim.
      const hits = codeOf(path).match(/robots\.txt/g) ?? [];
      expect(hits.length).toBeGreaterThanOrEqual(2);
    });
  }
});
