import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { wasNamed, type ProbeAnswer } from "./model";

/**
 * One question — "did the engine name this business?" — answered in three
 * places, and they did not agree.
 *
 * `toReportView` counts it with the scorer's own verdict (`countedAsVisible`),
 * which only counts an unprompted brand mention when the name could not be a
 * coincidence. `SearchResults.svelte` and the print sheet each re-derived it as
 * the looser `domainCited || brandMentioned`. For a business whose name is not
 * distinctive — the docstring's own example, "Creative Studio" — Standing prints
 * "was not among them, in any of the 5 questions we asked" while the disclosure
 * directly below prints "Creative Studio appeared in this answer." The print
 * sheet does both on one page.
 *
 * A document that contradicts itself about the client's own visibility invites
 * the reader to discount all of it, which is what Standing.svelte spends forty
 * lines of comments guarding against.
 *
 * The source-text assertions follow token-privacy.test.ts: a Svelte template has
 * no seam to import, and the alternative is no coverage at all on the property
 * that actually broke.
 */
const probe = (over: Partial<ProbeAnswer> = {}): ProbeAnswer => ({
  engine: "claude",
  query: "who does branding in los angeles",
  kind: "category",
  domainCited: false,
  brandMentioned: false,
  citedDomains: [],
  snippet: "",
  truncated: false,
  askedAt: "2026-09-02T00:00:00.000Z",
  ...over,
});

describe("wasNamed — the single verdict on whether the engine named them", () => {
  it("does not count a brand mention the scorer rejected as coincidental", () => {
    expect(wasNamed(probe({ brandMentioned: true, countedAsVisible: false }))).toBe(false);
  });

  it("counts a mention the scorer accepted", () => {
    expect(wasNamed(probe({ brandMentioned: true, countedAsVisible: true }))).toBe(true);
  });

  it("counts a cited domain", () => {
    expect(wasNamed(probe({ domainCited: true, countedAsVisible: true }))).toBe(true);
  });

  it("says no when the engine cited nobody", () => {
    expect(wasNamed(probe({ countedAsVisible: false }))).toBe(false);
  });

  // Reports stored before the scorer recorded its verdict have no better
  // answer available, so the loose rule stays their fallback — but ONLY theirs.
  it("falls back to the loose rule when the stored report predates the verdict", () => {
    expect(wasNamed(probe({ brandMentioned: true }))).toBe(true);
    expect(wasNamed(probe())).toBe(false);
  });
});

describe("nothing re-derives the verdict for itself", () => {
  const LOOSE = /domainCited\s*\|\|\s*\w*\.?brandMentioned/;

  /** Comment lines are stripped so these assertions are about the code, not
   *  about prose — the explanation of the old rule has to stay writable. */
  const codeOf = (path: string): string =>
    readFileSync(path, "utf-8")
      .replace(/^\s*(\/\/|\*|\/\*).*$/gm, "")
      .replace(/^\s*<!--[\s\S]*?-->\s*$/gm, "");

  const surfaces: Array<[string, string]> = [
    ["the web report", "src/lib/report/SearchResults.svelte"],
    ["the print sheet", "src/routes/audit/[token]/print/+page.svelte"],
  ];

  for (const [label, path] of surfaces) {
    it(`${label} asks wasNamed rather than re-deriving it`, () => {
      const code = codeOf(path);
      expect(code).toContain("wasNamed");
      expect(code).not.toMatch(LOOSE);
    });
  }

  it("model.ts derives it exactly once, inside wasNamed", () => {
    const code = codeOf("src/lib/report/model.ts");
    expect(code.match(new RegExp(LOOSE.source, "g")) ?? []).toHaveLength(1);
    const fn = code.slice(code.indexOf("export function wasNamed"));
    expect(fn.slice(0, fn.indexOf("\n}"))).toMatch(LOOSE);
  });
});
