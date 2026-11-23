import { test, expect, type APIRequestContext, type TestInfo } from "@playwright/test";
import { ALL_PASS_REPORT } from "../../src/lib/report/fixtures/all-pass";
import { EDIT_STUB } from "./edit-stub";

// W1 (TEC-02): the report editor saved nothing from a browser. The edit cookie
// was scoped to /audit and the save posts to /api/audit-edit, so the cookie
// never reached the save and every edit answered "Save failed (404)". The unit
// tests stubbed the cookie jar, and the browser tests here needed a live token
// that was set nowhere. This drives a real browser against a local stand-in for
// maintenance (tests/smoke/maintenance-stub.mjs), with an invented report.
// One token per test run: under fullyParallel, tests (and repeats of one test)
// run at once, and a shared token let one run's seed wipe another's saved edit
// (review round 1 reproduced it, 2 failures in 40).
function tokenFor(kind: string, info: TestInfo): string {
  return `smoke-${kind}-w${info.workerIndex}-r${info.repeatEachIndex}-t${info.retry}`.padEnd(
    22,
    "x",
  );
}

async function seed(request: APIRequestContext, token: string): Promise<void> {
  const res = await request.post(`${EDIT_STUB.url}/__seed`, {
    data: { token, report: ALL_PASS_REPORT, approved: false },
  });
  expect(res.ok()).toBe(true);
}

test.describe("report editor, end to end", { tag: "@smoke" }, () => {
  test.skip(!EDIT_STUB.enabled, "E2E_AUDIT_TOKEN is set: the live-token specs run instead");

  test("a draft 404s to a reader", async ({ page, request }, info) => {
    const TOKEN = tokenFor("reader", info);
    await seed(request, TOKEN);
    const res = await page.goto(`/audit/${TOKEN}`);
    expect(res?.status()).toBe(404);
  });

  test("an edit saves from the browser and survives a reload", async ({ page, request }, info) => {
    const TOKEN = tokenFor("save", info);
    await seed(request, TOKEN);
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
