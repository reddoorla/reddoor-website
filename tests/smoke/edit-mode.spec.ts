import { test, expect } from "@playwright/test";

// Edit mode is exercised against the real page, because the whole mechanism is
// DOM text-matching: a unit test would assert that a function returns a list,
// which is not the thing that can break. What can break is the list failing to
// meet the markup.
//
// Skipped unless a real token is supplied, so the ordinary smoke run is not
// coupled to the state of any one prospect's report.
const TOKEN = process.env.E2E_AUDIT_TOKEN ?? "";
const KEY = process.env.E2E_REPORT_EDIT_KEY ?? "";

test.describe("edit mode", () => {
  test.skip(!TOKEN, "set E2E_AUDIT_TOKEN to run edit-mode tests");

  // The control for the two below: if the report route itself were broken,
  // "nothing is editable" would pass for the wrong reason.
  test("the report itself renders", async ({ page }) => {
    const res = await page.goto(`/audit/${TOKEN}`);
    expect(res?.status()).toBe(200);
    await expect(page.locator("main")).not.toBeEmpty();
  });

  test("the report is not editable without the cookie", async ({ page }) => {
    await page.goto(`/audit/${TOKEN}`);
    await expect(page.locator(".rd-edit-bar")).toHaveCount(0);
    await expect(page.locator("[contenteditable=true]")).toHaveCount(0);
  });

  test("the edit address 404s without a key", async ({ page }) => {
    const res = await page.goto(`/audit/${TOKEN}/edit`);
    expect(res?.status()).toBe(404);
  });

  test("with the key, lines become editable and the count is shown", async ({ page }) => {
    test.skip(!KEY, "set E2E_REPORT_EDIT_KEY");
    await page.goto(`/audit/${TOKEN}/edit?k=${KEY}`);
    // The key is exchanged for a cookie and redirected out of the URL, so the
    // address bar must no longer carry it.
    await expect(page).toHaveURL(new RegExp(`/audit/${TOKEN}/edit$`));
    await expect(page.locator(".rd-edit-bar")).toContainText("lines editable");
    expect(await page.locator("[contenteditable=true]").count()).toBeGreaterThan(0);
  });

  // The design's central property: the address you edit at must not be one
  // paste away from handing a prospect the ability to rewrite their own audit.
  // Asserted in a REAL browser, on the URL a browser actually displays, because
  // the server 303's Location header was measured carrying the key on a Netlify
  // preview and the client-side scrub is what closes that.
  test("the key never remains in the address bar", async ({ page }) => {
    test.skip(!KEY, "set E2E_REPORT_EDIT_KEY");
    await page.goto(`/audit/${TOKEN}/edit?k=${KEY}`);
    expect(page.url()).not.toContain(KEY);
    expect(page.url()).not.toContain("k=");
    // And it must not be recoverable with one Back press either.
    await page.goBack().catch(() => {});
    expect(page.url()).not.toContain(KEY);
  });

  test("a wrong key 404s even though a valid one exists", async ({ page }) => {
    const res = await page.goto(`/audit/${TOKEN}/edit?k=definitely-not-the-key`);
    expect(res?.status()).toBe(404);
  });
});
