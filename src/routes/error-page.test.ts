import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";

/**
 * One 404 page, at the root.
 *
 * The site had two: a designed one under the `[uid]` routes (rendered only
 * when one of those routes matched and its loader threw) and the plain root
 * fallback for everything else — so `/nope` got the designed page and
 * `/nope/deeper` got "Error 404 / Back to home". Every nested `+error.svelte`
 * was a copy of the same file. The root boundary catches every 404 the site
 * can produce with the same layout and the same data, so the designed page
 * belongs there and nowhere else.
 */
describe("the 404 page", () => {
  const errorPages = globSync("src/routes/**/+error.svelte");

  it("is the one error page in the tree", () => {
    expect(errorPages).toEqual(["src/routes/+error.svelte"]);
  });

  it("is the designed page, and still has words for a real error", () => {
    const src = readFileSync("src/routes/+error.svelte", "utf8");
    expect(src).toMatch(/Nothing to see here/);
    expect(src).toMatch(/latestFourProjects/);
    expect(src).toMatch(/Something went wrong/);
    expect(src).toMatch(/name="robots" content="noindex"/);
  });
});
