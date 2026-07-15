import { test, expect, type Page } from "@playwright/test";

// The Accordion slice is a disclosure: an h2 > button[aria-expanded] toggles a
// panel that is `inert` (out of tab order + a11y tree) while collapsed. Two
// fixtures live on /dev/a11y-fixtures — one authored defaultOpen, one collapsed —
// so we can assert both the initial state and the toggle in each direction.
const FIXTURE = "/dev/a11y-fixtures";

// Interacting before SvelteKit hydration races the first click away (Playwright's
// actionability checks don't wait for framework hydration). The fixture page sets
// html[data-hydrated] in onMount, which only runs post-hydration — a deterministic
// "now interactive" gate.
async function gotoHydrated(page: Page) {
  await page.goto(FIXTURE, { waitUntil: "load" });
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
}

test.describe("Accordion disclosure", () => {
  test("open-by-default item starts expanded and collapses on click", async ({ page }) => {
    await gotoHydrated(page);

    const button = page.getByRole("button", { name: "About Canvas Worldwide" });
    await expect(button).toHaveAttribute("aria-expanded", "true");

    // The panel it controls is reachable and not inert while open.
    const panelId = await button.getAttribute("aria-controls");
    const panel = page.locator(`#${panelId}`);
    await expect(panel).not.toHaveAttribute("inert", /.*/);
    await expect(panel.getByText("INNOCEAN Worldwide")).toBeVisible();

    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "false");
    // Collapsed → inert (removed from tab order + a11y tree).
    await expect(panel).toHaveAttribute("inert", /.*/);
  });

  test("collapsed item starts inert and expands on click", async ({ page }) => {
    await gotoHydrated(page);

    const button = page.getByRole("button", { name: "About (collapsed)" });
    await expect(button).toHaveAttribute("aria-expanded", "false");

    const panelId = await button.getAttribute("aria-controls");
    const panel = page.locator(`#${panelId}`);
    await expect(panel).toHaveAttribute("inert", /.*/);

    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(panel).not.toHaveAttribute("inert", /.*/);
    await expect(panel.getByText("inert until expanded")).toBeVisible();
  });

  test("toggle is keyboard operable (Enter) and exposes a real button", async ({ page }) => {
    await gotoHydrated(page);

    const button = page.getByRole("button", { name: "About (collapsed)" });
    await button.focus();
    await expect(button).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-expanded", "false");
  });
});
