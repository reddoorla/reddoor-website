import { test, expect } from "@playwright/test";

/**
 * Nothing on the red band may be drawn in the brand red.
 *
 * This exists because axe cannot see the problem. `.bg-paper-red` sets only
 * `background-image` — a watercolour tile — and never `background-color`, so
 * colour-contrast resolves the element's background as transparent, walks up to
 * `body { background-color: white }`, and scores the text against WHITE. Red on
 * white passes comfortably. Red on red is invisible and reports clean.
 *
 * That is how it shipped: `RailRow` hardcoded `text-primary` on its rail label,
 * the report's closing band is `.bg-paper-red`, and the label rendered #D71920
 * on #D71920 with every automated check green. Caught by eye, not by CI.
 *
 * The same blind spot applies to `.bg-paper`, where the miss is a contrast drop
 * rather than a disappearance — see the note in the repo's colour tokens.
 *
 * A cascade rule cannot enforce this: `text-primary` is a Tailwind utility and
 * beats anything declared in `@layer base` or `@layer components`, so the colour
 * has to be correct at the call site and this test is what holds it there.
 */

/** Pages that render a `.bg-paper-red` band.
 *
 *  `/dev/a11y-fixtures` carries a RailRow on the band — the exact component
 *  combination that shipped invisible — because the page it actually broke on,
 *  the prospect report, needs a token and cannot be reached from a smoke run. */
const RED_BAND_PAGES = [
  "/dev/a11y-fixtures",
  "/",
  "/about",
  "/portfolio",
  "/contact",
  "/twenty-for-twenty",
];

/** #D71920, and anything close enough to it to vanish against the tile. */
function isBrandRed([r, g, b]: number[]): boolean {
  return r > 150 && g < 90 && b < 90;
}

function parseRgb(color: string): number[] {
  const parts = color.match(/\d+(\.\d+)?/g);
  return parts ? parts.slice(0, 3).map(Number) : [0, 0, 0];
}

for (const path of RED_BAND_PAGES) {
  test(`no brand-red text on the red band at ${path}`, async ({ page }) => {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    test.skip(response?.status() === 404, `${path} is not present on this site`);

    const bands = page.locator(".bg-paper-red");
    const count = await bands.count();
    test.skip(count === 0, `${path} renders no .bg-paper-red band`);

    // Read every leaf node's computed colour inside the band. Leaves only:
    // a wrapper's `color` is inherited by children that may override it, so
    // flagging containers would report the same text twice and miss the case
    // where only a child is wrong.
    const offenders = await bands.evaluateAll((els) => {
      const out: { text: string; cls: string; color: string }[] = [];
      for (const band of els) {
        for (const el of Array.from(band.querySelectorAll<HTMLElement>("*"))) {
          if (el.children.length > 0) continue;
          const text = (el.innerText || "").trim();
          if (!text) continue;
          out.push({
            text: text.slice(0, 40),
            cls: String(el.className).slice(0, 60),
            color: getComputedStyle(el).color,
          });
        }
      }
      return out;
    });

    const invisible = offenders
      .filter((o) => isBrandRed(parseRgb(o.color)))
      .map((o) => `"${o.text}" [${o.cls}] is ${o.color}`);

    expect(invisible).toEqual([]);
  });
}
