import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

// /medtech is the first `industry` document — a landing page assembled from 12
// slices that all render through the shared RailRow grid.
//
// /dev/a11y-fixtures already audits each of these slices in isolation, but a
// landing page is mostly a *composition* problem: heading order only exists
// across the stack, and a duplicate-key or fallback bug only shows up on the
// real document. These tests audit the assembled page instead.
const PATH = "/medtech";

// The axe gate that runs in CI (and Lighthouse) only ever sees a mobile
// viewport, so desktop-only markup branches have historically slipped through.
// Both viewports are audited here deliberately.
const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 1024 },
];

// Playwright's `reducedMotion: "reduce"` sets the CSS media feature but does
// NOT show up in `window.matchMedia(...).matches`, which is what the animateIn
// action reads. Without this stub animateIn runs its 2400ms opacity fade and
// axe measures text mid-transition: `text-primary` reads as #e04d52 rather than
// #D71920 and fails contrast, purely as an artifact of when the audit ran.
// Stubbing matchMedia makes animateIn a no-op so the audit sees the settled
// page — which is the state the contrast requirement is actually about.
async function stubReducedMotion(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = (query: string) =>
      /prefers-reduced-motion/.test(query)
        ? ({
            matches: true,
            media: query,
            onchange: null,
            addEventListener() {},
            removeEventListener() {},
            addListener() {},
            removeListener() {},
            dispatchEvent: () => false,
          } as unknown as MediaQueryList)
        : real(query);
  });
}

for (const vp of VIEWPORTS) {
  test(`${PATH} has no axe violations (${vp.name})`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await stubReducedMotion(page);
    await page.goto(PATH, { waitUntil: "networkidle" });

    const { violations } = await new AxeBuilder({ page }).analyze();

    expect(violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length} node(s))`)).toEqual([]);
  });
}

test(`${PATH} renders every slice in the document, in order`, async ({ page }) => {
  await page.goto(PATH, { waitUntil: "domcontentloaded" });

  const rendered = await page
    .locator("[data-slice-type]")
    .evaluateAll((els) =>
      els.map(
        (el) => `${el.getAttribute("data-slice-type")}/${el.getAttribute("data-slice-variation")}`,
      ),
    );

  // Mirrors the slice zone of the published `medtech` document. A slice that
  // fails to render drops out of the DOM silently, so this asserts the whole
  // list rather than a count.
  expect(rendered).toEqual([
    "industry_hero/default",
    "lead_text/rail",
    "text_columns/serviceList",
    "lead_text/rail",
    "text_columns/iconColumns",
    "case_study/default",
    "logo_grid/default",
    "testimonial/default",
    "featured_project/default",
    "value_block/expandable",
    "accordion/rail",
    "cta_banner/default",
  ]);
});

test(`${PATH} has exactly one h1 and no heading-level jumps`, async ({ page }) => {
  await page.goto(PATH, { waitUntil: "domcontentloaded" });

  const levels = await page.locator("h1, h2, h3, h4, h5, h6").evaluateAll((els) =>
    els.map((el) => ({
      level: Number(el.tagName[1]),
      text: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60),
    })),
  );

  expect(levels.filter((h) => h.level === 1)).toHaveLength(1);

  const jumps = levels
    .filter((h, i) => i > 0 && h.level > levels[i - 1].level + 1)
    .map((h) => `h${h.level} after h${levels[levels.indexOf(h) - 1].level}: "${h.text}"`);
  expect(jumps).toEqual([]);
});

test(`${PATH} ends on its own CTA slice, not the marketing footer CTA`, async ({ page }) => {
  await page.goto(PATH, { waitUntil: "domcontentloaded" });

  // Industry pages carry their own cta_banner slice, so the [uid] route's
  // built-in marketing CTA is suppressed and the page doesn't end on two CTAs.
  // (The site footer's own "Meet with Us" link is part of the layout and stays.)
  await expect(page.getByRole("heading", { name: /isn.t it time to arm your brand/i })).toHaveCount(
    0,
  );
  await expect(page.locator('[data-slice-type="cta_banner"]')).toBeVisible();
});
