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

  test("mobile menu moves focus in, traps Tab, and restores focus on Escape", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    // /about always shows the nav (showNav), so its mobile "Open menu" button is present.
    await page.goto("/about", { waitUntil: "networkidle" });

    const openBtn = page.getByRole("button", { name: "Open menu" });
    await openBtn.click();

    const dialog = page.getByRole("dialog", { name: "Menu" });
    await expect(dialog).toBeVisible();

    // Focus moves into the dialog, onto the close button (data-autofocus).
    await expect(page.getByRole("button", { name: "Close menu" })).toBeFocused();

    // Tab cycles within the dialog — focus never escapes to the inert page behind it.
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      const insideDialog = await dialog.evaluate((node) => node.contains(document.activeElement));
      expect(insideDialog, `focus stayed in dialog after ${i + 1} Tab(s)`).toBe(true);
    }

    // Escape closes the overlay and restores focus to the control that opened it.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(openBtn).toBeFocused();
  });
});
