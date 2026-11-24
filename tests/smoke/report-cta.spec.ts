import { test, expect } from "@playwright/test";

// The report's "Start a conversation" buttons, against the committed fixture
// route the gate already renders. That route has no token, so there is no
// report reference: each button books a call tagged as from the audit report,
// and none of them sends a reader to the contact form, which never reaches the CRM.
test.describe("report talk-to-us buttons", { tag: "@smoke" }, () => {
  test("every 'Start a conversation' button goes to the scheduler, never /contact", async ({
    page,
  }) => {
    await page.goto("/dev/audit-report");
    await page.locator("html[data-hydrated]").waitFor();
    const links = page.getByRole("link", { name: "Start a conversation" });
    await expect(links.first()).toBeAttached();
    const hrefs = await links.evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href).toMatch(/^\/schedule\?utm_source=audit&utm_medium=report$/);
    }
  });
});
