import { test, expect } from "@playwright/test";

test.describe("keyboard navigation", () => {
  test("first Tab reveals a skip link that moves focus to main content", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    // The skip link must be the first focusable element on the page (WCAG 2.4.1),
    // hidden until focused.
    await page.keyboard.press("Tab");
    const focused = page.locator(":focus");
    await expect(focused).toHaveAttribute("href", "#main-content");
    await expect(focused, "skip link becomes visible on focus").toBeVisible();
    await expect(focused).toHaveText("Skip to main content");

    // Activating it jumps focus past the nav into <main>.
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });
});
