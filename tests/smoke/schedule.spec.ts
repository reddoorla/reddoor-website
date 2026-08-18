import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

// The booking step. Reached automatically on finishing the questionnaire (that
// hand-off is covered in inquiry-modal.spec.ts) and reachable cold, which is
// what these tests exercise.
//
// The thing worth pinning hardest is the timezone. The CRM's calendar runs on
// MOUNTAIN hours and returns slots carrying a -06:00 offset; almost every
// visitor reads them somewhere else. So the suite fixes the browser's zone and
// asserts the CONVERTED time, not the one the API sent.
const PATH = "/schedule";

// 09:00, 09:30 and 16:30 Mountain on Wed 19 Aug, plus 09:00 on the Thursday —
// the shape `free-slots` returns for this location.
const SLOTS = [
  "2026-08-19T09:00:00-06:00",
  "2026-08-19T09:30:00-06:00",
  "2026-08-19T16:30:00-06:00",
  "2026-08-20T09:00:00-06:00",
];

type BookBody = Record<string, unknown>;

/**
 * Stub both endpoints. /api/book especially: it creates a REAL appointment on a
 * real calendar the moment the dev server has a CRM token in its env, so no
 * test may ever be one forgotten route away from booking Tim a call.
 */
async function stubApi(
  page: Page,
  opts: {
    slots?: string[];
    slotsStatus?: number;
    bookStatus?: number;
    bookBody?: Record<string, unknown>;
  } = {},
) {
  const slotCalls: string[] = [];
  const bookCalls: BookBody[] = [];

  await page.route("**/api/slots**", async (route) => {
    slotCalls.push(route.request().url());
    const status = opts.slotsStatus ?? 200;
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(
        status === 200
          ? { slots: opts.slots ?? SLOTS }
          : { error: "We couldn't load available times." },
      ),
    });
  });

  await page.route("**/api/book", async (route) => {
    bookCalls.push(JSON.parse(route.request().postData() ?? "{}"));
    const status = opts.bookStatus ?? 200;
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(
        opts.bookBody ?? (status === 200 ? { success: true } : { error: "Something went wrong." }),
      ),
    });
  });

  // Same guard as the modal suite: the browser must never talk to the CRM
  // directly. A reintroduced client-side fire fails loudly here.
  const strayCrmCalls: string[] = [];
  await page.route("**/*.leadconnectorhq.com/**", async (route) => {
    strayCrmCalls.push(route.request().url());
    await route.abort();
  });

  return { slotCalls, bookCalls, strayCrmCalls };
}

async function gotoHydrated(page: Page) {
  await page.goto(PATH, { waitUntil: "domcontentloaded" });
  await expect(page.locator("html[data-hydrated]")).toBeAttached({ timeout: 30_000 });
}

/** Seed the sessionStorage a finished questionnaire leaves behind. */
async function seedHandoff(page: Page, value: Record<string, unknown>) {
  await page.addInitScript((v) => {
    sessionStorage.setItem("reddoor:inquiry", JSON.stringify(v));
  }, value);
}

test.describe("in Los Angeles", () => {
  test.use({ timezoneId: "America/Los_Angeles" });

  test("renders Mountain slots as Pacific times, with the zone named", async ({ page }) => {
    const { strayCrmCalls } = await stubApi(page);
    await gotoHydrated(page);

    // The assertion the whole module exists for: 09:00 Mountain is 8:00 AM here.
    // A page that echoed the API would say 9:00 and be an hour wrong.
    await expect(page.getByRole("button", { name: "8:00 AM", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "8:30 AM", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "3:30 PM", exact: true })).toBeVisible();

    // Named, never the raw offset — "-06:00" tells a visitor nothing.
    await expect(page.getByText(/Times shown in your local time \(PDT\)/)).toBeVisible();
    expect(strayCrmCalls).toEqual([]);
  });

  test("switching day swaps the times and drops any selection", async ({ page }) => {
    await stubApi(page);
    await gotoHydrated(page);

    await page.getByRole("button", { name: "8:00 AM", exact: true }).first().click();
    await expect(page.locator("#book-name")).toBeVisible();

    // Thursday has one slot; the form must not survive the switch still holding
    // Wednesday's time.
    await page.getByRole("button", { name: /Thu/ }).click();
    await expect(page.locator("#book-name")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "3:30 PM", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "8:00 AM", exact: true })).toBeVisible();
  });

  test("booking sends the CRM's own ISO string, not a re-rendered local one", async ({ page }) => {
    const { bookCalls } = await stubApi(page);
    await gotoHydrated(page);

    await page.getByRole("button", { name: "8:30 AM", exact: true }).click();
    await page.locator("#book-name").fill("Pat Buyer");
    await page.locator("#book-email").fill("buyer@example.com");
    await page.getByRole("button", { name: "Confirm this time" }).click();

    await expect(page.getByRole("heading", { level: 1 })).toContainText("You're on the calendar");
    // Echoed back to the visitor in THEIR zone…
    await expect(page.getByText("Wednesday, August 19 at 8:30 AM PDT")).toBeVisible();

    // …but sent to the CRM byte-identical to what free-slots returned. Sending a
    // reformatted local time would drift by the offset and book the wrong hour.
    expect(bookCalls).toHaveLength(1);
    expect(bookCalls[0].startTime).toBe("2026-08-19T09:30:00-06:00");
    expect(bookCalls[0].email).toBe("buyer@example.com");
    expect(bookCalls[0].name).toBe("Pat Buyer");
    // No campaign: utm/funnel are written when the application is submitted,
    // where the landing page is actually known. See the note in the page.
    expect(bookCalls[0].campaign).toBeUndefined();
  });

  test("a slot taken mid-flight refetches instead of looping on a stale list", async ({ page }) => {
    // The 409 path: the CRM rejected the time because someone else took it. The
    // page must go back for a fresh list — re-offering the same dead slot is the
    // loop this guards.
    let served = 0;
    await page.route("**/api/slots**", async (route) => {
      served += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ slots: served === 1 ? SLOTS : SLOTS.slice(1) }),
      });
    });
    await page.route("**/api/book", (route) =>
      route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          error: "That time was just taken. Please choose another.",
          refreshSlots: true,
        }),
      }),
    );

    await gotoHydrated(page);
    await page.getByRole("button", { name: "8:00 AM", exact: true }).click();
    await page.locator("#book-name").fill("Pat Buyer");
    await page.locator("#book-email").fill("buyer@example.com");
    await page.getByRole("button", { name: "Confirm this time" }).click();

    await expect(page.getByRole("alert")).toContainText("just taken");
    expect(served).toBe(2);
    // The dead slot is gone and the form is closed, so the only thing they can
    // do is pick a time that still exists.
    await expect(page.getByRole("button", { name: "8:00 AM", exact: true })).toHaveCount(0);
    await expect(page.locator("#book-name")).toHaveCount(0);
  });

  test("the form refuses to submit without a name and a real email", async ({ page }) => {
    const { bookCalls } = await stubApi(page);
    await gotoHydrated(page);

    await page.getByRole("button", { name: "8:00 AM", exact: true }).click();
    await page.locator("#book-email").fill("not-an-email");
    await page.getByRole("button", { name: "Confirm this time" }).click();

    await expect(page.locator("#book-name-error")).toContainText("name");
    expect(bookCalls).toEqual([]);
  });

  test("a finished application is greeted by name and never asked twice", async ({ page }) => {
    const { bookCalls } = await stubApi(page);
    await seedHandoff(page, {
      email: "buyer@example.com",
      name: "Pat Buyer",
      phone: "(555) 123-4567",
      applied: true,
    });
    await gotoHydrated(page);

    await expect(page.getByRole("heading", { level: 1 })).toContainText("your application is in");
    await page.getByRole("button", { name: "8:00 AM", exact: true }).click();

    // "Never asked twice" means no fields at all — a prefilled input still
    // reads as something to check, one screen after they typed it.
    await expect(page.locator("#book-name")).toHaveCount(0);
    await expect(page.locator("#book-email")).toHaveCount(0);
    await expect(page.locator("#book-phone")).toHaveCount(0);

    const form = page.locator("form");
    await expect(form).toContainText("Booking as");
    await expect(form).toContainText("Pat Buyer");
    // The address the invite goes to is the one thing worth showing back.
    await expect(form).toContainText("buyer@example.com");
    await expect(form).toContainText("(555) 123-4567");

    // And the values still reach the server unretyped.
    await page.getByRole("button", { name: "Confirm this time" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("You're on the calendar");
    expect(bookCalls).toHaveLength(1);
    expect(bookCalls[0]).toMatchObject({
      email: "buyer@example.com",
      name: "Pat Buyer",
      phone: "(555) 123-4567",
    });
  });

  test("the summary can be corrected without retyping it", async ({ page }) => {
    const { bookCalls } = await stubApi(page);
    await seedHandoff(page, {
      email: "buyer@example.com",
      name: "Pat Buyer",
      phone: "(555) 123-4567",
      applied: true,
    });
    await gotoHydrated(page);

    await page.getByRole("button", { name: "8:00 AM", exact: true }).click();
    await page.getByRole("button", { name: "Use different details" }).click();

    // Revealed already holding what the summary showed: the escape hatch is for
    // fixing a typo or booking on someone else's behalf, not starting over.
    await expect(page.locator("#book-name")).toHaveValue("Pat Buyer");
    await expect(page.locator("#book-email")).toHaveValue("buyer@example.com");
    await expect(page.locator("#book-phone")).toHaveValue("(555) 123-4567");
    await expect(page.locator("form")).not.toContainText("Booking as");

    await page.locator("#book-email").fill("someone.else@example.com");
    await page.getByRole("button", { name: "Confirm this time" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("You're on the calendar");
    expect(bookCalls[0]).toMatchObject({ email: "someone.else@example.com" });
  });

  test("a handoff without a usable email asks rather than assumes", async ({ page }) => {
    await stubApi(page);
    // readHandoff accepts any non-empty string as an email. The summary may
    // only stand in for a value the submit would also take — otherwise the
    // visitor meets a validation error pointed at an input that is not on
    // screen, which is a dead end with no way to correct it.
    await seedHandoff(page, { email: "not-an-email", name: "Pat Buyer", phone: "", applied: true });
    await gotoHydrated(page);

    await page.getByRole("button", { name: "8:00 AM", exact: true }).click();
    await expect(page.locator("#book-email")).toHaveValue("not-an-email");
    await expect(page.locator("form")).not.toContainText("Booking as");
  });

  test("a cold visitor gets the cold headline", async ({ page }) => {
    await stubApi(page);
    await gotoHydrated(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Let's find a time");
  });

  test("an empty calendar offers a way through rather than a dead end", async ({ page }) => {
    await stubApi(page, { slots: [] });
    await gotoHydrated(page);
    // Scoped to the message: the footer carries the same mailto on every page,
    // so an unscoped query passes whether or not this branch renders anything.
    const message = page.getByText(/nothing open in the next couple of weeks/);
    await expect(message).toBeVisible();
    await expect(message.getByRole("link", { name: "info@reddoorla.com" })).toBeVisible();
  });

  test("a failed slot load can be retried in place", async ({ page }) => {
    let calls = 0;
    await page.route("**/api/slots**", async (route) => {
      calls += 1;
      await route.fulfill({
        status: calls === 1 ? 502 : 200,
        contentType: "application/json",
        body: JSON.stringify(
          calls === 1 ? { error: "We couldn't load available times." } : { slots: SLOTS },
        ),
      });
    });
    await page.route("**/api/book", (route) => route.abort());

    await gotoHydrated(page);
    await expect(page.getByRole("alert")).toContainText("couldn't load");
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("button", { name: "8:00 AM", exact: true })).toBeVisible();
  });

  test("has no accessibility violations, picker open", async ({ page }) => {
    await stubApi(page);
    // Set here rather than relied on from playwright.config.ts, whose
    // `use: { reducedMotion: "reduce" }` is NOT reaching the page — probed
    // 2026-08-18 on Playwright 1.62.1: matchMedia reports false and computed
    // transitionDuration is still 0.3s, while page.emulateMedia flips both. So
    // the selected button is caught mid-interpolation (white-on-red measured as
    // #d9d9d9 on #dd3b41, 3.1:1) unless this test asks for itself.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoHydrated(page);
    await page.getByRole("button", { name: "8:00 AM", exact: true }).click();
    await expect(page.locator("#book-name")).toBeVisible();

    // The layout also fades <main> in over 700ms after a 700ms delay, and that
    // fade is a Svelte JS transition — emulateMedia above cannot reach it, and
    // neither can the stylesheet. Measuring mid-fade blends every colour on the
    // page toward white. Same artifact industry-page.spec.ts documents for
    // animateIn, different mechanism.
    await expect
      .poll(() => page.locator("main").evaluate((el) => Number(getComputedStyle(el).opacity)), {
        timeout: 15_000,
      })
      .toBe(1);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("has no accessibility violations, booking summary shown", async ({ page }) => {
    await stubApi(page);
    await seedHandoff(page, {
      email: "buyer@example.com",
      name: "Pat Buyer",
      phone: "(555) 123-4567",
      applied: true,
    });
    // See the picker-open test above for why this is set per-test.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoHydrated(page);
    await page.getByRole("button", { name: "8:00 AM", exact: true }).click();
    await expect(page.getByRole("button", { name: "Use different details" })).toBeVisible();

    await expect
      .poll(() => page.locator("main").evaluate((el) => Number(getComputedStyle(el).opacity)), {
        timeout: 15_000,
      })
      .toBe(1);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("in New York", () => {
  test.use({ timezoneId: "America/New_York" });

  test("the same slots read three hours later", async ({ page }) => {
    await stubApi(page);
    await gotoHydrated(page);
    // 09:00 Mountain is 11:00 Eastern. Same payload, different page — which is
    // the only proof that nothing is being echoed from the API.
    await expect(page.getByRole("button", { name: "11:00 AM", exact: true })).toBeVisible();
    await expect(page.getByText(/Times shown in your local time \(EDT\)/)).toBeVisible();
  });
});

test.describe("in Shanghai", () => {
  test.use({ timezoneId: "Asia/Shanghai" });

  test("one Mountain day splits across two local days", async ({ page }) => {
    await stubApi(page);
    await gotoHydrated(page);
    // The calendar's 09:00-17:00 Mountain window straddles local midnight here,
    // so the CRM's single "2026-08-19" bucket has to be torn in two. Wednesday
    // keeps only the late-evening pair; the 16:30 Mountain slot belongs to
    // Thursday morning. Grouping on the API's own day key would file all three
    // under Wednesday and label a 6:30 AM slot with the wrong date.
    await expect(page.getByRole("button", { name: /Wed/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "11:00 PM", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "11:30 PM", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "6:30 AM", exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: /Thu/ }).click();
    await expect(page.getByRole("button", { name: "6:30 AM", exact: true })).toBeVisible();
  });
});
