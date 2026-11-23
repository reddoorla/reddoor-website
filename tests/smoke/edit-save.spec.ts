import { test, expect } from "@playwright/test";
import { ALL_PASS_REPORT } from "../../src/lib/report/fixtures/all-pass";
import { EDIT_STUB } from "./edit-stub";

// W1 (TEC-02): the report editor saved nothing from a browser. The edit cookie
// was scoped to /audit and the save posts to /api/audit-edit, so the cookie
// never reached the save and every edit answered "Save failed (404)". The unit
// tests stubbed the cookie jar, and the browser tests here needed a live token
// that was set nowhere. This drives a real browser against a local stand-in for
// maintenance (tests/smoke/maintenance-stub.mjs), with an invented report.
const TOKEN = "smokeDraftToken0000001";

test.describe("report editor, end to end", { tag: "@smoke" }, () => {
  test.skip(!EDIT_STUB.enabled, "E2E_AUDIT_TOKEN is set: the live-token specs run instead");

  test.beforeEach(async ({ request }) => {
    const res = await request.post(`${EDIT_STUB.url}/__seed`, {
      data: { token: TOKEN, report: ALL_PASS_REPORT, approved: false },
    });
    expect(res.ok()).toBe(true);
  });

  test("a draft 404s to a reader", async ({ page }) => {
    const res = await page.goto(`/audit/${TOKEN}`);
    expect(res?.status()).toBe(404);
  });

  test("an edit saves from the browser and survives a reload", async ({ page, request }) => {
    await page.goto(`/audit/${TOKEN}/edit?k=${EDIT_STUB.editKey}`);
    await expect(page.locator(".rd-edit-bar")).toContainText("Draft, not approved");

    const line = page.locator("[contenteditable=true]").first();
    await expect(line).toBeVisible();
    const key = await line.getAttribute("data-edit-key");
    const edited = "Edited in the smoke test.";
    await line.click();
    await line.fill(edited);
    const saved = page.waitForResponse((r) => r.url().endsWith("/api/audit-edit"));
    await line.blur();
    expect((await saved).status()).toBe(200);
    await expect(page.locator(".rd-edit-failed")).toHaveCount(0);

    const stored = await (await request.get(`${EDIT_STUB.url}/__state/${TOKEN}`)).json();
    expect(stored.overrides[key!].text).toBe(edited);

    await page.reload();
    await expect(page.locator(`[data-edit-key="${key}"]`)).toHaveText(edited);
  });
});
