import { test, expect } from "@playwright/test";

// Tim's MarkUp round on /boise (2026-09-22, pins 4, 6 and 7): the rail label
// and the content beside it share a top edge, which puts their BASELINES out by
// 7–40px because the two cells carry different type. RailRow's `labelBaseline`
// aligns the two baselines instead.
//
// The guard is geometry, not markup, because the defect is geometry: a class
// assertion would pass while the type ramp underneath it changed and pulled the
// baselines apart again.
//
// It also exists because measuring this by hand misleads. The same rows measured
// 13px out in a browser driven without reduced motion, which sent a whole pass
// chasing a baseline-synthesis quirk that was really `animateIn`'s transform
// still on the element. The suite runs reduced-motion, so it measures the
// settled page — the state the alignment is actually about.
//
// Both industry pages are checked. They render the same slices, and the whole
// point of the change is that it is global rather than per page.
//
// The selector matches any RailRow grid, not one column spec: the columns went
// from px to proportional when pins 1-3 were fixed, and a selector naming the
// old `240px` template silently matched nothing and passed the loop below.
//
// Tim's follow-up (2026-09-23): on the baseline is "technically perfect" but
// reads low, so every label sits 1px above it. That is measured apart from the
// alignment: the ±1px rounding tolerance below cannot tell a 1px nudge from
// none, so the grid's baseline alignment is checked with the nudge subtracted,
// and the nudge itself is checked exactly.
type RailRowBaseline = { label: string; delta: number; nudge: number };
type CtaGeometry = { baselineDelta: number; buttonX: number; footerColX: number };

const PATHS = ["/medtech", "/boise"] as const;

// The rail only exists from `lg` (1024). Below it the label stacks above the
// content and there is no row to align to, so these assertions would be
// meaningless. Two desktop widths, because the previous fix held at one width
// and broke at another.
const WIDTHS = [1200, 1512];

// A zero-height inline-block sits on the baseline of the line box it joins, so
// its bottom edge IS that baseline. Measuring the line box's own top/bottom
// would fold in half-leading, which is exactly the quantity that differs
// between the kicker and the text beside it.
const MEASURE = `(() => {
  const baselineOf = (el) => {
    if (!el) return null;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) if (node.textContent.trim()) break;
    if (!node) return null;
    const marker = document.createElement("span");
    marker.style.cssText = "display:inline-block;width:0;height:0;overflow:hidden";
    node.parentNode.insertBefore(marker, node);
    const bottom = marker.getBoundingClientRect().bottom + window.scrollY;
    marker.remove();
    return Math.round(bottom);
  };
  const rows = [];
  document.querySelectorAll('div[class*="lg:grid-cols-["]').forEach((grid) => {
    if (getComputedStyle(grid).alignItems !== "baseline") return;
    const label = grid.querySelector(".type-kicker");
    if (!label) return;
    const content = grid.children[grid.children.length - 1];
    // LogoGrid renders its label inside the content cell; there is no pair.
    if (content.contains(label)) return;
    const a = baselineOf(label);
    const b = baselineOf(content);
    if (a === null || b === null) return;
    // The rect includes \`translate\`, so the optical nudge is read back out of
    // the measured delta rather than hidden inside its tolerance.
    const translate = getComputedStyle(label).translate;
    const nudge = translate === "none" ? 0 : parseFloat(translate.split(" ")[1] ?? "0");
    rows.push({
      label: (label.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 40),
      delta: a - b,
      nudge,
    });
  });
  return rows;
})()`;

for (const path of PATHS) {
  for (const width of WIDTHS) {
    test(`rail labels sit on the content baseline — ${path} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(path);
      await page.waitForSelector('div[class*="lg:grid-cols-["]');

      const rows = await page.evaluate<RailRowBaseline[]>(MEASURE);

      // A pass with nothing measured would be the silent failure this guard
      // exists to prevent: every opted-in row could lose its label and the
      // assertion below would still be green.
      expect(rows.length).toBeGreaterThanOrEqual(3);

      for (const row of rows) {
        // 1px for sub-pixel rounding in the marker's rect. The defect this
        // catches is 7px at its smallest.
        expect(
          Math.abs(row.delta - row.nudge),
          `${row.label} is ${row.delta - row.nudge}px off its content baseline before the nudge`,
        ).toBeLessThanOrEqual(1);
        expect(row.nudge, `${row.label} should sit 1px above the baseline`).toBe(-1);
      }
    });

    // Pin 5, the same round: the CTA banner's button is the last thing above
    // the footer, and Tim asked for two things at once — its label on the
    // headline's baseline, and its left edge where the footer's link column
    // starts. Both are measured because the button carries neither: it is
    // pushed right by `justify-between` and sized by its own text, so it only
    // ever lined up with the footer by coincidence.
    test(`the CTA button meets the headline baseline and the footer column — ${path} at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(path);

      const cta = page.locator(".cta-heading").first();
      await cta.waitFor();

      const measured = await page.evaluate<CtaGeometry>(`(() => {
        const baselineOf = (el) => {
          if (!el) return null;
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          let node;
          while ((node = walker.nextNode())) if (node.textContent.trim()) break;
          if (!node) return null;
          const marker = document.createElement("span");
          marker.style.cssText = "display:inline-block;width:0;height:0;overflow:hidden";
          node.parentNode.insertBefore(marker, node);
          const bottom = marker.getBoundingClientRect().bottom + window.scrollY;
          marker.remove();
          return Math.round(bottom);
        };
        const heading = document.querySelector(".cta-heading");
        const button = heading.parentElement.querySelector("a");
        const footerCol = [...document.querySelectorAll("footer div")].find((d) =>
          /lg:w-1\\/5/.test(d.className),
        );
        return {
          baselineDelta: baselineOf(button) - baselineOf(heading),
          buttonX: Math.round(button.getBoundingClientRect().x),
          footerColX: Math.round(footerCol.getBoundingClientRect().x),
        };
      })()`);

      expect(
        Math.abs(measured.baselineDelta),
        `the button's label is ${measured.baselineDelta}px off the headline's baseline`,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(measured.buttonX - measured.footerColX),
        `the button starts at ${measured.buttonX}, the footer column at ${measured.footerColX}`,
      ).toBeLessThanOrEqual(1);
    });
  }
}
