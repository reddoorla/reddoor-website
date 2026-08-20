import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

// The internal page that records a call's outcome. Replaces
// go.reddoorla.com/update.
//
// It is the only page on the site written for a colleague rather than a lead,
// and the only one that writes onto somebody ELSE's record — so the tests care
// about two things above all: that the key is carried, and that the difference
// between "internal notes" and "text the client reads" is impossible to miss.

const KEY = "test-key-not-a-real-one";
const PATH = `/meeting-outcome?k=${KEY}&first_name=Dana&last_name=Buyer&email=buyer%40example.com`;

type Body = Record<string, unknown>;

async function stub(page: Page, opts: { status?: number; body?: Body } = {}) {
  const posts: Body[] = [];
  await page.route("**/api/meeting-outcome", async (route) => {
    posts.push(JSON.parse(route.request().postData() ?? "{}"));
    const status = opts.status ?? 200;
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(
        opts.body ??
          (status === 200
            ? { success: true, name: "Dana Buyer", sendRecap: false }
            : { error: "no" }),
      ),
    });
  });
  const stray: string[] = [];
  await page.route("**/*.leadconnectorhq.com/**", async (route) => {
    stray.push(route.request().url());
    await route.abort();
  });
  return { posts, stray };
}

async function gotoHydrated(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("html[data-hydrated]")).toBeAttached({ timeout: 30_000 });
}

test("prefills from the trigger link and carries the key", async ({ page }) => {
  const { posts, stray } = await stub(page);
  await gotoHydrated(page, PATH);

  await expect(page.getByText("Dana Buyer")).toBeVisible();
  await expect(page.locator("#mo-email")).toHaveValue("buyer@example.com");

  await page.locator("#mo-outcome").selectOption("Offer Made (pending)");
  await page.getByRole("button", { name: "Save outcome" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Logged");
  expect(posts).toHaveLength(1);
  expect(posts[0].key).toBe(KEY);
  // The exact picklist string, not a re-cased or re-spaced version — GHL
  // matches byte for byte and silently drops anything else.
  expect(posts[0].outcome).toBe("Offer Made (pending)");
  expect(stray).toEqual([]);
});

test("the lead-value field appears only for a sale", async ({ page }) => {
  await stub(page);
  await gotoHydrated(page, PATH);

  await expect(page.locator("#mo-value")).toHaveCount(0);
  await page.locator("#mo-outcome").selectOption("Sold!");
  await expect(page.locator("#mo-value")).toBeVisible();
  await page.locator("#mo-outcome").selectOption("No Show");
  await expect(page.locator("#mo-value")).toHaveCount(0);
});

test("a lead value is not sent for an outcome that is not a sale", async ({ page }) => {
  // The field is hidden, but its value persists in state — sending it would put
  // a deal size on a no-show.
  const { posts } = await stub(page);
  await gotoHydrated(page, PATH);

  await page.locator("#mo-outcome").selectOption("Sold!");
  await page.locator("#mo-value").fill("12000");
  await page.locator("#mo-outcome").selectOption("No Show");
  await page.getByRole("button", { name: "Save outcome" }).click();

  expect(posts[0].leadValue).toBe("");
});

test("says plainly which notes the client reads", async ({ page }) => {
  // The one mistake on this form that cannot be taken back.
  await stub(page);
  await gotoHydrated(page, PATH);

  const internal = page.locator("label[for='mo-internal']");
  await expect(internal).toContainText("not sent to anyone");
  const recap = page.locator("label[for='mo-recap']");
  await expect(recap).toContainText("emailed to the client");
  await expect(page.getByText(/goes to the client verbatim/)).toBeVisible();
});

test("a recap email cannot be requested with nothing to send", async ({ page }) => {
  const { posts } = await stub(page);
  await gotoHydrated(page, PATH);

  await page.locator("#mo-outcome").selectOption("Sold!");
  await page.getByLabel("Send the client a conversation recap").check();
  await page.getByRole("button", { name: "Save outcome" }).click();

  await expect(page.getByRole("alert")).toContainText("needs recap notes");
  expect(posts).toHaveLength(0);
});

test("an outcome is required", async ({ page }) => {
  const { posts } = await stub(page);
  await gotoHydrated(page, PATH);
  await page.getByRole("button", { name: "Save outcome" }).click();
  await expect(page.getByRole("alert")).toContainText("choose an outcome");
  expect(posts).toHaveLength(0);
});

test("an unknown contact is reported, not silently swallowed", async ({ page }) => {
  // Surfaced here, unlike on the public resubscribe form: the user is a
  // colleague who can fix a typo, not a stranger who could enumerate the CRM.
  await stub(page, {
    status: 404,
    body: { error: "No contact in the CRM has that email address." },
  });
  await gotoHydrated(page, PATH);

  await page.locator("#mo-outcome").selectOption("No Show");
  await page.getByRole("button", { name: "Save outcome" }).click();
  await expect(page.getByRole("alert")).toContainText("No contact in the CRM");
});

test("warns that the recap send is not wired yet", async ({ page }) => {
  // The A-102 trigger gap applies here too: the recap is a workflow keyed to a
  // form submission this page cannot fire. Saying so beats a silent no-op.
  await stub(page, { body: { success: true, name: "Dana Buyer", sendRecap: true } });
  await gotoHydrated(page, PATH);

  await page.locator("#mo-outcome").selectOption("Sold!");
  await page.locator("#mo-recap").fill("Agreed scope and next steps.");
  await page.getByLabel("Send the client a conversation recap").check();
  await page.getByRole("button", { name: "Save outcome" }).click();

  await expect(page.getByText(/can't fire yet/)).toBeVisible();
});

test("stays out of search results and out of Referer", async ({ page }) => {
  // The key is in the query string.
  await stub(page);
  await gotoHydrated(page, PATH);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
});

test("has no accessibility violations", async ({ page }) => {
  await stub(page);
  // Set per-test: playwright.config.ts's `use: { reducedMotion }` does not
  // reach the page on 1.62.1 — see schedule.spec.ts for the measurement.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await gotoHydrated(page, PATH);
  await page.locator("#mo-outcome").selectOption("Sold!");
  await expect
    .poll(
      () =>
        page
          .locator("[data-page-transition]")
          .last()
          .evaluate((el) => Number(getComputedStyle(el).opacity)),
      {
        timeout: 15_000,
      },
    )
    .toBe(1);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("says when the calendar was updated too", async ({ page }) => {
  // Erik's report, 2026-08-19: the post-call text fires on a timer, so it
  // reaches people the call never happened with. The tag alone did not stop
  // that — the CRM's no-show handling keys off the APPOINTMENT status.
  await stub(page, {
    body: { success: true, name: "Dana Buyer", sendRecap: false, attendanceSynced: true },
  });
  await gotoHydrated(page, PATH);

  await page.locator("#mo-outcome").selectOption("No Show");
  await page.getByRole("button", { name: "Save outcome" }).click();
  await expect(page.getByText(/marked as a no-show in the calendar/)).toBeVisible();
});

test("a failed calendar write asks for a hand fix, without claiming the log failed", async ({
  page,
}) => {
  await stub(page, {
    body: { success: true, name: "Dana Buyer", sendRecap: false, attendanceSynced: false },
  });
  await gotoHydrated(page, PATH);

  await page.locator("#mo-outcome").selectOption("No Show");
  await page.getByRole("button", { name: "Save outcome" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Logged");
  // Phrases chosen to sit within one source line: getByText normalises
  // whitespace for string matches but NOT for regex ones, so a pattern that
  // spans a line break in the markup never matches.
  await expect(page.getByText(/above did save/)).toBeVisible();
  await expect(page.getByText(/set it by hand/)).toBeVisible();
});

test("a sale is marked attended, not offered a reschedule", async ({ page }) => {
  // The status drives Z-002-2. Marking a won call as a no-show would invite
  // someone to reschedule a conversation they just bought from.
  await stub(page, {
    body: { success: true, name: "Dana Buyer", sendRecap: false, attendanceSynced: true },
  });
  await gotoHydrated(page, PATH);

  await page.locator("#mo-outcome").selectOption("Sold!");
  await page.getByRole("button", { name: "Save outcome" }).click();
  await expect(page.getByText(/marked as attended in the calendar/)).toBeVisible();
  await expect(page.getByText(/no-show/)).toHaveCount(0);
});

test("says nothing about the calendar when there was nothing to settle", async ({ page }) => {
  await stub(page, {
    body: { success: true, name: "Dana Buyer", sendRecap: false, attendanceSynced: null },
  });
  await gotoHydrated(page, PATH);

  await page.locator("#mo-outcome").selectOption("Sold!");
  await page.getByRole("button", { name: "Save outcome" }).click();
  await expect(page.getByText(/calendar/)).toHaveCount(0);
});
