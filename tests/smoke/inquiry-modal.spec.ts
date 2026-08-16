import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

// The email-capture modal that industry landing-page CTAs open instead of
// navigating to /contact (MED-16 follow-up).
//
// Exercised against /dev/a11y-fixtures rather than /medtech: the published
// document still points its CTAs at /contact until the content migration runs,
// so on the real page there is nothing to click yet. The fixture carries the
// same `#inquire` trigger the migrated content will.
const PATH = "/dev/a11y-fixtures";

// The modal opens on a click, so the page has to be hydrated first — a click
// dispatched before hydration is swallowed and the delegated listener never
// sees it. See the CI compile-storm note in the repo's other specs.
async function gotoHydrated(page: import("@playwright/test").Page) {
  await page.goto(PATH, { waitUntil: "domcontentloaded" });
  await expect(page.locator("html[data-hydrated]")).toBeAttached({ timeout: 30_000 });
}

// Nothing here should ever reach central ingest. Every test stubs the endpoint;
// a test that forgets would surface as a real submission, so the default is a
// hard failure rather than a pass-through.
async function stubInquiry(
  page: import("@playwright/test").Page,
  response: { status: number; body: Record<string, unknown> } = {
    status: 200,
    body: { success: true },
  },
) {
  const calls: Record<string, unknown>[] = [];
  await page.route("**/api/inquiry", async (route) => {
    calls.push(JSON.parse(route.request().postData() ?? "{}"));
    await route.fulfill({
      status: response.status,
      contentType: "application/json",
      body: JSON.stringify(response.body),
    });
  });
  return calls;
}

test("the modal is closed until a CTA is clicked", async ({ page }) => {
  await gotoHydrated(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("an #inquire link opens the modal and focuses the email field", async ({ page }) => {
  await stubInquiry(page);
  await gotoHydrated(page);

  await page.getByRole("link", { name: "Open the inquiry modal" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  // trapFocus sends focus to [data-autofocus] — without it a keyboard user
  // lands at the top of the page behind the overlay.
  await expect(page.locator("#inquiry-email")).toBeFocused();
});

test("the trigger's step is carried into the submission", async ({ page }) => {
  const calls = await stubInquiry(page);
  await gotoHydrated(page);

  await page.getByRole("link", { name: "Open the inquiry modal" }).click();
  await page.locator("#inquiry-email").fill("buyer@example.com");
  await page.getByRole("button", { name: "Inquire Now" }).click();

  await expect(page.getByRole("status")).toContainText("Thanks");
  expect(calls).toHaveLength(1);
  expect(calls[0].email).toBe("buyer@example.com");
  // `data-inquire-step` on the trigger, so a lead can be traced to the section
  // that produced it.
  expect(calls[0].step).toBe("The Diagnosis");
  // Honeypot must go up empty from a real fill, or every genuine submission
  // would be screened out server-side.
  expect(calls[0].botField).toBe("");
});

test("an invalid email is rejected client-side and never reaches the endpoint", async ({
  page,
}) => {
  const calls = await stubInquiry(page);
  await gotoHydrated(page);

  await page.getByRole("link", { name: "Open the inquiry modal" }).click();
  await page.locator("#inquiry-email").fill("not-an-email");
  await page.getByRole("button", { name: "Inquire Now" }).click();

  await expect(page.getByRole("alert")).toContainText("valid email");
  expect(calls).toHaveLength(0);
  // The field is marked invalid and points at the message, so the error is
  // reachable by screen reader rather than colour-only.
  await expect(page.locator("#inquiry-email")).toHaveAttribute("aria-invalid", "true");
});

test("a server error is surfaced rather than reported as success", async ({ page }) => {
  await stubInquiry(page, { status: 502, body: { error: "Ingest is down." } });
  await gotoHydrated(page);

  await page.getByRole("link", { name: "Open the inquiry modal" }).click();
  await page.locator("#inquiry-email").fill("buyer@example.com");
  await page.getByRole("button", { name: "Inquire Now" }).click();

  await expect(page.getByRole("alert")).toContainText("Ingest is down.");
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("Escape closes the modal and returns focus to the trigger", async ({ page }) => {
  await stubInquiry(page);
  await gotoHydrated(page);

  const trigger = page.getByRole("link", { name: "Open the inquiry modal" });
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // WCAG 2.4.3: focus must not be dumped at the top of the document.
  await expect(trigger).toBeFocused();
});

test("the open modal has no axe violations", async ({ page }) => {
  await stubInquiry(page);
  await gotoHydrated(page);
  await page.getByRole("link", { name: "Open the inquiry modal" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  // `toBeVisible` resolves the moment the node is in the DOM and not
  // display:none — which, mid open-transition, is at an opacity near 0. Scanning
  // there measures blended colours (the red label reads #d9393f rather than
  // #D71920) and reports a contrast failure that does not exist once the modal
  // has settled. Wait for the real end state before auditing.
  await expect
    .poll(() =>
      page.locator(".inquiry-wrap").evaluate((el) => Number(getComputedStyle(el).opacity)),
    )
    .toBe(1);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});
