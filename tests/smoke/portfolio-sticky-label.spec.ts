import { test, expect, type Locator, type Page } from "@playwright/test";

// Tim, Discord #rd-website 2026-09-08: "Each project needs immediate context…
// making it a sticky title on the left column as you scroll down." Each
// featured project's name/services/arrow block pins high in the viewport for
// as long as that project's blocks are on screen, floats above every page
// layer (but under the fixed nav), then hands off to the next project's block without the two ever touching.

// The label's resting position while pinned: pt-10 inside a top-12 sticky box —
// 40px of clear air under the 48px fixed nav (Tim, #rd-website 2026-09-09:
// "Spacing is tighter to the top of the project… 40px", read as 40px from the
// nav rather than hard against it).
const TOP = 88;
// Smallest vertical gap allowed between an outgoing and an incoming pin.
const MIN_GAP = 24;

const yOf = async (el: Locator) => (await el.boundingBox())?.y ?? Number.NaN;

async function scrollTo(page: Page, y: number) {
  await page.evaluate((v) => window.scrollTo(0, v), y);
}

/** Page-absolute top of a group, independent of the current scroll. */
async function pageTopOf(page: Page, selector: string) {
  return page.evaluate(
    (s) => document.querySelector(s)!.getBoundingClientRect().top + window.scrollY,
    selector,
  );
}

test.describe("portfolio featured-project sticky label", () => {
  test.beforeEach(async ({ page }) => {
    // Instant scrollTo: the site's smooth scrolling is gated on reduced motion.
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("pins under the nav while its project scrolls, then hands off", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/portfolio");

    const group = '[data-project-group="rubrik-zero-labs"]';
    const rubrik = page.locator('[data-sticky-label="rubrik-zero-labs"] [data-sticky-chip]');
    const revogen = page.locator('[data-sticky-label="revogen"] [data-sticky-chip]');
    const top = await pageTopOf(page, group);
    const height = (await page.locator(group).boundingBox())!.height;

    // Inside the group: pinned at TOP at two different depths.
    for (const depth of [300, height - 500]) {
      await scrollTo(page, top + depth);
      await expect.poll(() => yOf(rubrik)).toBeGreaterThan(TOP - 2);
      await expect.poll(() => yOf(rubrik)).toBeLessThan(TOP + 2);
    }

    // The chip is the real link, floating over the content.
    const link = rubrik.getByRole("link", { name: "Go to Rubrik Zero Labs project" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/portfolio/rubrik-zero-labs");

    // The categories sit under the name and the arrow under them, all flush
    // left, and the whole
    // thing stays inside the 1/5 gutter the cards leave on the left (Tucker:
    // "whole thing should fit in the 1/5 gutter") — the pin never crosses
    // into the content column.
    const name = rubrik.locator("p").first();
    const categories = rubrik.locator("p").nth(1);
    await expect(categories).toHaveText("Brand, Digital");
    const wrap = page.locator('[data-sticky-label="rubrik-zero-labs"] > *').first();
    const [nameBox, arrowBox, chipBox, wrapBox] = await Promise.all(
      [name, link, rubrik, wrap].map((l) => l.boundingBox()),
    );
    expect(arrowBox!.y).toBeGreaterThanOrEqual(nameBox!.y + nameBox!.height);
    // 35px, Tim's number — and it is the arrow itself, not a padded box.
    expect(arrowBox!.width).toBe(35);
    expect(arrowBox!.height).toBe(35);
    expect(Math.abs(arrowBox!.x - nameBox!.x)).toBeLessThanOrEqual(1);
    expect(chipBox!.x + chipBox!.width).toBeLessThanOrEqual(wrapBox!.x + wrapBox!.width / 5 + 0.5);

    // Flush with the nav's home link. The pin rides directly under the
    // wordmark, so any horizontal inset on the chip reads as a misalignment.
    const wordmark = page.getByRole("link", { name: "Reddoor Creative" }).first();
    const wordmarkBox = await wordmark.boundingBox();
    expect(Math.abs(nameBox!.x - wordmarkBox!.x)).toBeLessThanOrEqual(1);

    // The pin is bare type over the imagery — no paper block, no halo, no pad
    // (Tucker has asked for that three times now), and the arrow is red. The
    // arrow is drawn as a CSS mask over the link's colour, so if the mask
    // fails to parse (an unquoted data: URL did, once) the span renders as a
    // solid red square — check the mask resolved, not just that it is there.
    const glyph = link.locator("span");
    await expect(glyph).toHaveCSS("background-color", "rgb(215, 25, 32)");
    const [maskImage, pad] = await Promise.all([
      glyph.evaluate((el) => getComputedStyle(el).maskImage),
      rubrik.evaluate((el) => getComputedStyle(el).backgroundColor),
    ]);
    expect(maskImage).toMatch(/^url\("data:image\/svg/);
    expect(pad, "the pin carries no backdrop").toBe("rgba(0, 0, 0, 0)");

    // Past the group: Rubrik's chip is pushed out and Revogen's has taken over.
    await scrollTo(page, top + height + 400);
    await expect.poll(() => yOf(rubrik)).toBeLessThan(TOP - 2);
    await expect.poll(() => yOf(revogen)).toBeGreaterThan(TOP - 2);
    await expect.poll(() => yOf(revogen)).toBeLessThan(TOP + 2);
  });

  test("nothing paints over the pin, even the banners", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/portfolio");
    // Rubrik: pinned over the Vimeo banner. Revogen: pinned over the
    // interactive grafts banner — both carry their own stacked layers.
    for (const uid of ["rubrik-zero-labs", "revogen"]) {
      await scrollTo(page, (await pageTopOf(page, `[data-project-group="${uid}"]`)) + 200);
      const chip = page.locator(`[data-sticky-label="${uid}"] [data-sticky-chip]`);
      await expect.poll(() => yOf(chip)).toBeLessThan(TOP + 2);
      const name = chip.locator("p").first();
      const box = (await name.boundingBox())!;
      const topmost = await page.evaluate(
        ([x, y]) =>
          document
            .elementFromPoint(x, y)
            ?.closest("[data-sticky-label]")
            ?.getAttribute("data-sticky-label") ?? null,
        [box.x + box.width / 2, box.y + box.height / 2] as [number, number],
      );
      expect(topmost, `${uid}: the element under the pin's name text`).toBe(uid);
    }
  });

  test("the pin rides to the bottom of its project, not short of it", async ({ page }) => {
    // Tim, #rd-website 2026-09-09: "Can the sticky title stop at the bottom of
    // the image? Right now it stops short," then "I want the title to stop at
    // the end of the content versus the end of the frame". Two halves: the
    // sticky box is exactly as tall as the label, so the label's bottom reaches
    // its group's last pixel (a taller box — h-80 shipped one — strands it
    // ~180px above); and the 96px that separates projects is a margin on the
    // group rather than padding inside it, so the group's last pixel IS its
    // last content, not the empty run up to the next project.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/portfolio");
    const group = '[data-project-group="rubrik-zero-labs"]';
    const chip = page.locator('[data-sticky-label="rubrik-zero-labs"] [data-sticky-chip]');
    const end = (await pageTopOf(page, group)) + (await page.locator(group).boundingBox())!.height;

    // The label is 143px tall including its lead-in, so it is only being pushed
    // out once the group's bottom edge is above that. Park it at 140.
    await scrollTo(page, end - 140);
    await expect.poll(async () => (await chip.boundingBox())?.y ?? -1).toBeLessThan(TOP);
    const [box, groupBottom] = await Promise.all([
      chip.boundingBox(),
      page.evaluate((sel) => document.querySelector(sel)!.getBoundingClientRect().bottom, group),
    ]);
    expect(Math.abs(box!.y + box!.height - groupBottom)).toBeLessThanOrEqual(2);

    // …and that group bottom is real content, not trailing whitespace: the last
    // image inside it ends within a pixel or two of the same line.
    const lastInk = await page.evaluate((sel) => {
      const g = document.querySelector(sel)!;
      const boxes = [...g.querySelectorAll("img, iframe, video, h2")]
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.height > 8 && r.width > 8);
      return Math.max(...boxes.map((r) => r.bottom));
    }, group);
    expect(Math.abs(lastInk - groupBottom)).toBeLessThanOrEqual(2);
  });

  test("spaces content 48px inside a project and 96px between projects", async ({ page }) => {
    // Tim, #rd-website 2026-09-09: "If it's the same project, lets do 48px and
    // then between the projects, 96px. right now there is big space between
    // content from the same project." It was 64/96/128 inside.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/portfolio");
    const measured = await page.evaluate(() => {
      const groups = [...document.querySelectorAll("[data-project-group]")];
      const bandsOf = (g: Element) => {
        const ink = [...g.querySelectorAll("img, iframe, video, h2")]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.height > 8 && r.width > 8 && !el.closest("[data-sticky-label]");
          })
          .map((el) => {
            const r = el.getBoundingClientRect();
            return { top: r.top + window.scrollY, bottom: r.bottom + window.scrollY };
          })
          .sort((a, b) => a.top - b.top);
        const bands: { top: number; bottom: number }[] = [];
        for (const r of ink) {
          const last = bands.at(-1);
          if (last && r.top <= last.bottom + 1) last.bottom = Math.max(last.bottom, r.bottom);
          else bands.push({ ...r });
        }
        return bands;
      };
      const all = groups.map(bandsOf);
      return {
        inside: all.flatMap((b) => b.slice(1).map((x, i) => Math.round(x.top - b[i].bottom))),
        between: all.slice(1).map((b, i) => Math.round(b[0].top - all[i].at(-1)!.bottom)),
      };
    });
    for (const gap of measured.inside) expect(gap, "gap inside a project").toBe(48);
    for (const gap of measured.between) expect(gap, "gap between projects").toBe(96);
    expect(measured.inside.length, "the walk must find gaps to measure").toBeGreaterThan(3);
  });

  test("an outgoing pin and the incoming one never touch", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/portfolio");
    const rubrik = page.locator('[data-sticky-label="rubrik-zero-labs"] [data-sticky-chip]');
    const revogen = page.locator('[data-sticky-label="revogen"] [data-sticky-chip]');
    const group = '[data-project-group="rubrik-zero-labs"]';
    const end = (await pageTopOf(page, group)) + (await page.locator(group).boundingBox())!.height;

    // Walk the hand-off in 40px steps and measure whenever both are on screen.
    let seenBoth = 0;
    for (let y = end - 700; y <= end + 300; y += 40) {
      await scrollTo(page, y);
      const [a, b] = await Promise.all([rubrik.boundingBox(), revogen.boundingBox()]);
      if (!a || !b) continue;
      const bothVisible = a.y + a.height > 0 && b.y < 800;
      if (!bothVisible) continue;
      seenBoth++;
      expect(b.y - (a.y + a.height), `gap at scrollY=${y}`).toBeGreaterThanOrEqual(MIN_GAP);
    }
    expect(seenBoth, "the walk must actually catch both pins on screen").toBeGreaterThan(0);
  });

  test("names each featured project exactly once per breakpoint", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/portfolio");
    // Desktop: the pinned chip is the only "Go to Rubrik" link in the featured
    // area — the in-card copy is hidden so the name never shows twice.
    await expect(page.getByRole("link", { name: "Go to Rubrik Zero Labs project" })).toHaveCount(1);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/portfolio");
    await expect(page.locator('[data-sticky-label="rubrik-zero-labs"]')).toBeHidden();
    await expect(page.getByRole("link", { name: "Go to Rubrik Zero Labs project" })).toHaveCount(1);
  });
});
