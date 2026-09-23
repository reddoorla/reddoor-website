import { test, expect, type Page } from "@playwright/test";

// Tim, Discord #rd-website 2026-09-17, with screenshots: "You'll notice that in
// the OG image it has a beautiful apostrophe not a footmark. But our website has
// footprints all over the place but sometimes uses the correct apostrophe. How
// do we correct it so it only uses the beautiful apostrophes?" — and, of the
// testimonial: "but they should be hanging punctuation". He asked the same twice
// in March: "These need to be quote marks not inch marks" and "can you update so
// the quotes are 'hanging' on the left side".
//
// The CMS half of the answer is a transform on the Prismic read path
// ($lib/typography/smartQuotes, wired in $lib/prismicio) with unit tests of its
// own. This file is the check that matters to Tim: what a browser actually
// paints, on the pages he looks at.

/** A straight apostrophe or a straight double quote — a footmark or an inch mark. */
const STRAIGHT = /['"]/;
const TYPOGRAPHIC = /[\u2018\u2019\u201C\u201D]/g;

/**
 * Every rendered text node on the page, with the element that owns it.
 *
 * Deliberately text content only: attributes carry URLs, JSON and CSS selectors
 * where a straight quote is correct, and `<script>` carries SvelteKit's
 * serialised payload — which is the page's own data before it is prose.
 */
async function renderedText(page: Page) {
  return page.evaluate(() => {
    const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"]);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) =>
        node.parentElement && SKIP.has(node.parentElement.tagName)
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT,
    });
    const chunks: { text: string; where: string }[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
      if (!text) continue;
      const el = node.parentElement!;
      chunks.push({
        text,
        where: `<${el.tagName.toLowerCase()} class="${(el.className || "").toString().slice(0, 40)}">`,
      });
    }
    return chunks;
  });
}

// The marketing pages, the industry landing page from Tim's screenshot, and the
// three transactional pages at the end of the funnel — those last three are
// here because they are the ones nobody looks at, and a prerender scan of the
// build found straight marks on all three after the marketing pages were clean.
// Every route below is warmed by tests/smoke/global-setup.ts.
const PAGES = [
  "/",
  "/about",
  "/contact",
  "/portfolio",
  "/medtech",
  "/schedule",
  "/twenty-for-twenty",
  "/not-a-fit",
  "/email/unsubscribed",
  "/email/resubscribed",
  // The audit report, on its all-pass fixture: its prose is generated
  // ($lib/report/narrative.ts), so it is the one page here whose copy nobody
  // reads in a template.
  "/dev/audit-report",
];

test.describe("typographic marks in rendered copy", () => {
  for (const path of PAGES) {
    test(`${path} paints no straight apostrophe or double quote`, async ({ page }) => {
      await page.goto(path);
      const chunks = await renderedText(page);

      const offenders = chunks
        .filter((c) => STRAIGHT.test(c.text))
        .map((c) => `${c.where} ${c.text.slice(0, 120)}`);
      expect(offenders, `${path}: straight marks in rendered prose`).toEqual([]);

      // …and the scrape actually read prose, rather than passing because it
      // found nothing. Both halves are needed: an empty page has no straight
      // marks either. 200 characters is the floor because the two email
      // preference pages are one short paragraph each.
      const all = chunks.map((c) => c.text).join(" ");
      expect(all.length, `${path}: text scraped`).toBeGreaterThan(200);
      expect(
        (all.match(TYPOGRAPHIC) ?? []).length,
        `${path}: typographic marks present`,
      ).toBeGreaterThan(0);
    });
  }
});

test.describe("testimonial quote hangs its opening mark", () => {
  // The mark is CSS chrome on `.quote` (src/lib/slices/Testimonial/index.svelte),
  // so the CMS stores the quote bare and every testimonial is punctuated the
  // same way. Hanging it means the first line of the quote starts on the same
  // vertical as the lines under it and as the rest of the content column,
  // instead of being pushed in by the width of the glyph.
  //
  // `hanging-punctuation: first` is Safari-only, so this is measured rather
  // than declared.
  for (const [label, width] of [
    ["desktop", 1280],
    ["mobile", 390],
  ] as const) {
    test(`first line is flush with the lines below it (${label})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/medtech");
      // The root layout scrolls to top 600ms after a navigation; measuring
      // inside that window measures a page that is about to move.
      await page.waitForTimeout(1200);
      const figure = page.locator("figure").filter({ has: page.locator("blockquote") });
      await figure.scrollIntoViewIfNeeded();

      const geometry = await page.evaluate(() => {
        const quote = document.querySelector("blockquote p")!;
        const box = quote.getBoundingClientRect();
        // One rect per line box of the quote's own text. The ::before mark is a
        // pseudo-element and is not in the range, so these are the positions of
        // the words themselves — which is the alignment Tim is looking at.
        const range = document.createRange();
        range.selectNodeContents(quote);
        const lines = [...range.getClientRects()].map((r) => r.left);
        const mark = getComputedStyle(quote, "::before");
        const column = quote.closest("figure")!.getBoundingClientRect();
        // RailRow's content cell — `min-w-0` is its only stable handle.
        const cell = quote.closest("div.min-w-0")?.getBoundingClientRect();
        return {
          lines,
          left: box.left,
          width: box.width,
          columnLeft: column.left,
          cellWidth: cell ? cell.width : column.width,
          markContent: mark.content,
          markPosition: mark.position,
          markWidth: parseFloat(mark.width),
          markRight: parseFloat(mark.right),
          // What is painted just outside the column, level with the first line?
          // Hit-testing a pseudo-element returns the element that owns it.
          hitsQuote: (() => {
            const first = [...range.getClientRects()][0];
            return (
              document.elementFromPoint(Math.max(1, box.left - 4), first.top + first.height / 2) ===
              quote
            );
          })(),
        };
      });

      // The quote wraps, or "flush with the lines below it" says nothing.
      expect(geometry.lines.length, "the quote wraps to several lines").toBeGreaterThan(1);
      for (const [i, left] of geometry.lines.entries()) {
        expect(
          Math.abs(left - geometry.lines[0]),
          `line ${i + 1} is flush with line 1`,
        ).toBeLessThanOrEqual(0.5);
      }

      // The column did not move to pay for it: the quote's box still starts
      // exactly where the rest of the section's content column does.
      //
      // It used to assert that column was 760px. That number retired when the
      // industry grid went proportional (Tim's MarkUp pins 1-3): the column is
      // now a share of ContentWidth, 922px at this 1280 viewport, and the quote
      // additionally sits on the `.measure` cap. Pinning either number would
      // pin the layout rather than the alignment this test is about, so the
      // assertion is now the relationship: the quote fills its column up to its
      // measure, and is still a real column rather than a collapsed box.
      expect(
        Math.abs(geometry.lines[0] - geometry.left),
        "text starts at the column's left edge",
      ).toBeLessThanOrEqual(0.5);
      expect(
        Math.abs(geometry.left - geometry.columnLeft),
        "the quote's box is flush with the figure",
      ).toBeLessThanOrEqual(0.5);
      if (width === 1280) {
        expect(geometry.width, "the quote fills its column, up to its measure").toBeLessThanOrEqual(
          geometry.cellWidth + 1,
        );
        expect(geometry.width, "the quote is still a real column").toBeGreaterThan(600);
      }

      // The mark is still drawn — outside the column, on the first line.
      expect(geometry.markContent).toContain("\u201C");
      expect(geometry.markPosition, "the mark is out of flow").toBe("absolute");
      expect(geometry.markWidth, "the mark has real width").toBeGreaterThan(2);
      expect(
        Math.abs(geometry.markRight - geometry.width),
        "the mark's right edge sits on the column's left edge",
      ).toBeLessThanOrEqual(0.5);
      expect(geometry.hitsQuote, "the mark is painted in the margin").toBe(true);
    });
  }
});
