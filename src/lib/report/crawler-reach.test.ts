import { describe, it, expect } from "vitest";
import { ssr, renderText } from "./ssr-test-harness";
import { ALL_PASS_REPORT } from "./fixtures/all-pass";
import { toReportView, type ReportView } from "./model";
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
 * The property that broke is the rendered sentence, so both surfaces are
 * rendered in every state the reach can be in.
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

type Reach = { crawlerAccessMeasured: boolean; crawlerAccess: { blockedAi: string[] } };

const BLOCKED: Reach = { crawlerAccessMeasured: true, crawlerAccess: { blockedAi: ["GPTBot"] } };

const STATES: Array<[string, Reach]> = [
  [
    "robots.txt read, nothing turned away",
    { crawlerAccessMeasured: true, crawlerAccess: { blockedAi: [] } },
  ],
  ["robots.txt read, GPTBot turned away", BLOCKED],
  ["robots.txt fetch failed", { crawlerAccessMeasured: false, crawlerAccess: { blockedAi: [] } }],
];

const scoreBars = await ssr<{ view: ReportView }>("src/lib/report/ScoreBars.svelte");
const printSheet = await ssr<{ data: { report: unknown; overrides: unknown } }>(
  "src/routes/audit/[token]/print/+page.svelte",
);

const sheetWith = (reach: Reach): string => {
  const report = structuredClone(ALL_PASS_REPORT) as typeof ALL_PASS_REPORT & {
    checks: { data: Record<string, unknown> };
  };
  Object.assign(report.checks.data, reach);
  return renderText(printSheet, { data: { report, overrides: {} } });
};

const surfaces: Array<[string, (reach: Reach) => string]> = [
  [
    "the web report",
    (reach) =>
      renderText(scoreBars, { view: toReportView(report({ checks: { ok: true, data: reach } })) }),
  ],
  ["the print sheet", sheetWith],
];

/** The rendered text one block at a time — a paragraph, a heading, a list item
 *  — so a sentence is judged where it is made, not against the rest of the
 *  page's copy. */
const blocksOf = (html: string): string[] =>
  html
    .split(/<\/?(?:p|li|h[1-6]|div|section|header|ul|ol|table|tr|td|th)\b[^>]*>/)
    .map((b) => b.replace(/(<[^>]+>|\s)+/g, " ").trim())
    .filter(Boolean);

/** A block whose subject is the crawlers — where a verdict on them is made. */
const ABOUT_CRAWLERS = /crawler|GPTBot/i;

// The forbidden claim is REACHABILITY, however it is phrased. "Yes", "allowed
// in" and "can reach you" are the same assertion, and robots.txt supports none
// of them — a CDN's bot management enforces its own answer over the file.
const REACHABILITY_CLAIM = /allowed in|can reach|reach you|reach the site/i;

for (const [label, render] of surfaces) {
  describe(`${label} — no claim that robots.txt proves reachability`, () => {
    // A block the reach state decides is one not rendered the same in all three
    // states — however it is worded.
    const byState = STATES.map(([, reach]) => blocksOf(render(reach)));
    const varies = (block: string) => !byState.every((blocks) => blocks.includes(block));

    STATES.forEach(([state], n) => {
      it(`never says the crawlers can reach them: ${state}`, () => {
        const said = byState[n].filter(
          (b) => ABOUT_CRAWLERS.test(b) || b.includes("robots.txt") || varies(b),
        );
        for (const block of said) {
          expect(block).not.toMatch(REACHABILITY_CLAIM);
          expect(block).not.toMatch(/Yes\s*—/);
        }
      });
    });

    // Every verdict on the crawlers is a fact about the file: said in the same
    // block, or in the label above the blocks the reach state decides.
    it("says what it says about the crawlers as a fact about robots.txt", () => {
      STATES.forEach(([state], n) => {
        const blocks = byState[n];
        blocks.forEach((block, i) => {
          if (!ABOUT_CRAWLERS.test(block) || !varies(block)) return;
          let from = i;
          while (from > 0 && varies(blocks[from - 1])) from--;
          expect(blocks.slice(Math.max(from - 1, 0), i + 1).join(" "), state).toContain(
            "robots.txt",
          );
        });
      });
    });

    // POSITIVE CONTROL — a surface that never mentions the crawlers passes
    // both cases above.
    it("names the crawler robots.txt turns away", () => {
      const said = blocksOf(render(BLOCKED)).filter((b) => ABOUT_CRAWLERS.test(b));
      expect(said.join(" ")).toContain("GPTBot");
    });
  });
}
