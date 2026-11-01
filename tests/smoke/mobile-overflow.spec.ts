import { test, expect, type Page } from "@playwright/test";

// No page may be wider than a phone or a tablet, and no text a visitor can see
// may run past the right edge. Ported from medical-solutions-of-texas
// tests/smoke/mobile-overflow.spec.ts (reddoorla/medical-solutions-of-texas#100)
// for P1-90 (reddoorla/reddoor-maintenance#1876). On 2026-11-01 the footer's
// nowrap copyright line, about 335px, made every page scroll sideways at every
// width from 320 to 1024px (348px at 320, 1130px at 1024).
//
// A plain desktop context at the device width, because Chromium's mobile
// emulation zooms the page out to fit and hides the overflow. Three changes
// from MSOT's check. Only text that straddles the edge counts: text wholly past
// it is a closed menu or a carousel slide parked off-screen, not a cut. Text the
// browser does not paint (hidden, or opacity 0) is skipped. And so is text an
// ancestor clips away entirely, as the sr-only pattern does (a 1px box).
//
// It asserts what a visitor sees, not a design value: no px, class or size of
// the design's appears here, so it sits in the gate.
// Routes global-setup.ts already compiles, so none is cold inside a test.
const ROUTES = [
  "/",
  "/about",
  "/contact",
  "/portfolio",
  "/portfolio/rubrik-zero-labs",
  "/medtech",
  "/twenty-for-twenty",
  "/schedule",
];
const WIDTHS = [320, 390, 768, 820, 1024];

async function gotoLoaded(page: Page, path: string) {
  const res = await page.goto(path, { waitUntil: "load" });
  // An unpublished page would otherwise measure the error page and pass.
  expect(res?.ok(), `${path} answered ${res?.status()}`).toBe(true);
  await page.evaluate(() => document.fonts.ready);
}

function measure(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const cut: string[] = [];
    // True when an ancestor clips the text away entirely on an axis it clips:
    // the sr-only pattern (1px, overflow hidden) or a collapsed panel. An
    // ancestor that clips only x while 0px tall still paints the text, so the
    // axes are checked separately; display: contents boxes have no rect.
    const clippedAway = (el: Element) => {
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.display === "contents") continue;
        const b = a.getBoundingClientRect();
        if (cs.overflowX !== "visible" && b.width <= 1) return true;
        if (cs.overflowY !== "visible" && b.height <= 1) return true;
      }
      return false;
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent?.trim()) continue;
      const el = n.parentElement;
      if (el && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      if (el && clippedAway(el)) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const past = [...range.getClientRects()].filter((r) => r.width > 0 && r.right > vw + 1);
      if (past.some((r) => r.left < vw - 1)) {
        cut.push(`<${el?.tagName.toLowerCase()}> "${n.textContent.trim().slice(0, 60)}"`);
      }
    }
    return { scrollWidth: document.documentElement.scrollWidth, clientWidth: vw, cut };
  });
}

for (const width of WIDTHS) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const path of ROUTES) {
      test(`${path} has no horizontal overflow`, { tag: "@smoke" }, async ({ page }) => {
        await gotoLoaded(page, path);
        const { scrollWidth, clientWidth, cut } = await measure(page);
        expect(scrollWidth, `page is wider than ${clientWidth}px`).toBeLessThanOrEqual(clientWidth);
        expect(cut, `text cut off at the ${clientWidth}px edge`).toEqual([]);
      });
    }
  });
}
