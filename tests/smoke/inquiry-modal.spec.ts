import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

// The two-form inquiry flow that industry landing-page CTAs open instead of
// navigating to /contact (MED-16 follow-up): an email-capture frame, then the
// five-question application wizard mirrored from the GHL survey.
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

// Nothing here should ever reach central ingest. /api/inquiry is the modal's
// ONLY network call now — the CRM sync moved server-side behind that endpoint —
// so stubbing it is what keeps a test from producing a real lead. What the CRM
// receives is covered by src/lib/ghl/client.test.ts against a fetch stub; these
// tests own the browser's half of the contract: that the payload the endpoint
// needs actually goes up, in the right shapes.
//
// Turnstile's api.js is still aborted for determinism — the modal itself no
// longer mints CRM tokens, but nothing here should hit Cloudflare either.
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

  await page.route("**/challenges.cloudflare.com/**", (route) => route.abort());

  // A guard, not a fixture: the browser must never call the CRM directly again.
  // If the old widget fire is ever reintroduced, this fails the suite loudly
  // instead of quietly submitting a real lead from CI.
  const strayCrmCalls: string[] = [];
  await page.route("**/*.leadconnectorhq.com/**", async (route) => {
    strayCrmCalls.push(route.request().url());
    await route.abort();
  });

  return { calls, strayCrmCalls };
}

/**
 * Open the modal and submit a valid email, landing on question one. Returns the
 * dialog locator — the fixtures page renders every slice, so bare role queries
 * ("Next", "textbox"…) substring-match controls outside the modal (a
 * slideshow's "Next slide") and must stay scoped to it.
 */
async function throughStepOne(page: import("@playwright/test").Page, email = "buyer@example.com") {
  await page.getByRole("link", { name: "Open the inquiry modal" }).click();
  await page.locator("#inquiry-email").fill(email);
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Inquire Now" }).click();
  await expect(
    dialog.getByRole("heading", { name: /What problems are you experiencing\?/ }),
  ).toBeVisible();
  return dialog;
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

test("submitting the email advances to the questions and posts the lead", async ({ page }) => {
  const { calls, strayCrmCalls } = await stubInquiry(page);
  await gotoHydrated(page);

  await throughStepOne(page);

  // Central ingest got the lead the moment frame one submitted — a visitor who
  // bails on the questions is still captured.
  expect(calls).toHaveLength(1);
  expect(calls[0].email).toBe("buyer@example.com");
  // `data-inquire-step` on the trigger, so a lead can be traced to the section
  // that produced it. Trailing colon trimmed — the CMS title is "The Diagnosis:".
  expect(calls[0].step).toBe("The Diagnosis");
  // Honeypot must go up empty from a real fill, or every genuine submission
  // would be screened out server-side.
  expect(calls[0].botField).toBe("");

  // Everything the server-side CRM sync needs rides on this one POST. The API
  // cannot write real attribution, so the landing URL and referrer are what the
  // CRM's attribution note is composed from — if they stop going up, the note
  // silently becomes useless.
  expect(calls[0].sourceUrl).toContain("/dev/a11y-fixtures");
  expect(typeof calls[0].referrer).toBe("string");
  expect(calls[0].campaign).toBeTruthy();
  // The survey id selects BOTH the question set shown and the custom fields the
  // server is willing to write, so a wrong/missing one silently drops answers.
  expect(calls[0].surveyId).toBe("VfiN5rugWcATPw47P20U");

  // The browser must not talk to the CRM any more.
  expect(strayCrmCalls).toEqual([]);
});

test("an invalid email is rejected client-side and never reaches the server", async ({ page }) => {
  const { calls, strayCrmCalls } = await stubInquiry(page);
  await gotoHydrated(page);

  await page.getByRole("link", { name: "Open the inquiry modal" }).click();
  await page.locator("#inquiry-email").fill("not-an-email");
  await page.getByRole("button", { name: "Inquire Now" }).click();

  await expect(page.getByRole("alert")).toContainText("valid email");
  expect(calls).toHaveLength(0);
  expect(strayCrmCalls).toEqual([]);
  // The field is marked invalid and points at the message, so the error is
  // reachable by screen reader rather than colour-only.
  await expect(page.locator("#inquiry-email")).toHaveAttribute("aria-invalid", "true");
});

test("a server error is surfaced and the visitor is not advanced", async ({ page }) => {
  const { strayCrmCalls } = await stubInquiry(page, {
    status: 502,
    body: { error: "Ingest is down." },
  });
  await gotoHydrated(page);

  await page.getByRole("link", { name: "Open the inquiry modal" }).click();
  await page.locator("#inquiry-email").fill("buyer@example.com");
  await page.getByRole("button", { name: "Inquire Now" }).click();

  await expect(page.getByRole("alert")).toContainText("Ingest is down.");
  await expect(page.getByRole("status")).toHaveCount(0);
  // Ingest is the system of record: when it rejects the lead the endpoint never
  // reaches its CRM sync at all, so nothing is left holding the only copy.
  // The visitor stays on the email frame rather than being marched onward.
  await expect(page.locator("#inquiry-email")).toBeVisible();
  expect(strayCrmCalls).toEqual([]);
});

test("the full application: five questions, contact details, both submissions", async ({
  page,
}) => {
  const { calls, strayCrmCalls } = await stubInquiry(page);
  await gotoHydrated(page);
  const dialog = await throughStepOne(page);

  // Q1 — problems (checkboxes; multiple allowed).
  await dialog.getByRole("checkbox", { name: "Outdated sales and marketing materials" }).check();
  await dialog.getByRole("checkbox", { name: "Use DIY tools with little or no success" }).check();
  await dialog.getByRole("button", { name: "Next" }).click();

  // Q2 — website (free text).
  await expect(dialog.getByRole("heading", { name: /check out your work/ })).toBeVisible();
  await dialog.getByRole("textbox").fill("https://buyer.example.com");
  await dialog.getByRole("button", { name: "Next" }).click();

  // Q3 — goals.
  await expect(dialog.getByRole("heading", { name: /goals for this project/ })).toBeVisible();
  await dialog.getByRole("checkbox", { name: "Confidence to compete in new markets" }).check();
  await dialog.getByRole("button", { name: "Next" }).click();

  // Q4 — stakeholders (radio).
  await expect(dialog.getByRole("heading", { name: /anyone else involved/ })).toBeVisible();
  await dialog.getByRole("radio", { name: "My business partner" }).check();
  await dialog.getByRole("button", { name: "Next" }).click();

  // Q5 — budget (radio).
  await expect(dialog.getByRole("heading", { name: /expect to pay/ })).toBeVisible();
  await dialog.getByRole("radio", { name: "$30,000 - 50,000" }).check();
  await dialog.getByRole("button", { name: "Next" }).click();

  // Contact frame.
  await expect(dialog.getByRole("heading", { name: /how do we reach you/ })).toBeVisible();
  await page.locator("#inquiry-name").fill("Pat Buyer");
  await page.locator("#inquiry-phone").fill("(555) 123-4567");
  await dialog.getByRole("checkbox", { name: /I consent to receiving text messages/ }).check();
  await dialog.getByRole("button", { name: "Submit Application" }).click();

  await expect(page.getByRole("status")).toContainText("application");

  // Two ingest submissions: the step-one capture and the full application.
  expect(calls).toHaveLength(2);
  const application = calls[1];
  expect(application.email).toBe("buyer@example.com");
  expect(application.name).toBe("Pat Buyer");
  expect(application.phone).toBe("(555) 123-4567");
  expect(application.smsConsent).toBe(true);
  const answers = application.answers as { label: string; value: string | string[] }[];
  expect(answers).toHaveLength(5);
  expect(answers[0].value).toEqual([
    "Outdated sales and marketing materials",
    "Use DIY tools with little or no success",
  ]);
  expect(answers[1].value).toBe("https://buyer.example.com");
  expect(answers[4].value).toBe("$30,000 - 50,000");

  // `fields` is the same answers keyed by CRM FIELD ID — the payload the server
  // turns into the contact's custom fields. Asserted by value shape, not by
  // substring: the CRM matches option strings byte-for-byte and stores checkbox
  // answers as arrays, so a checkbox arriving as a bare string would silently
  // unmap the answer from the contact record while any grep still passed.
  const fields = application.fields as Record<string, string | string[]>;
  // Checkboxes as arrays, in the order they were ticked…
  expect(fields["vlLzA6TsJhHkmvmf6ArR"]).toEqual([
    "Outdated sales and marketing materials",
    "Use DIY tools with little or no success",
  ]);
  expect(fields["K0obgvYezsY9MX088GFN"]).toEqual(["Confidence to compete in new markets"]);
  // …radios as a single string, not a one-element array…
  expect(fields["iRpYADswmWvMc0hnWtrT"]).toBe("My business partner");
  expect(fields["xW6eFrHUFBNQCijp1mOM"]).toBe("$30,000 - 50,000");
  // …and free text as a string. `website` names a STANDARD contact field, so the
  // server routes it out of the custom-field write (see ghl/client).
  expect(fields["website"]).toBe("https://buyer.example.com");

  // Consent is NOT carried as a field value. The browser sends the boolean and
  // the server writes the CRM's exact stored sentence itself, so a client can
  // never assert consent on a visitor's behalf.
  expect(fields["K6hRBtIufgEo0ZuJfDPD"]).toBeUndefined();
  expect(application.smsConsent).toBe(true);

  expect(strayCrmCalls).toEqual([]);
});

test("the contact frame enforces name, phone and consent", async ({ page }) => {
  const { calls } = await stubInquiry(page);
  await gotoHydrated(page);
  const dialog = await throughStepOne(page);

  // Skip every question — they are optional, matching the survey.
  for (let i = 0; i < 5; i++) {
    await dialog.getByRole("button", { name: "Next" }).click();
  }
  await expect(dialog.getByRole("heading", { name: /how do we reach you/ })).toBeVisible();

  await dialog.getByRole("button", { name: "Submit Application" }).click();

  // All three messages, each tied to its field for AT.
  await expect(page.locator("#inquiry-name-error")).toContainText("name");
  await expect(page.locator("#inquiry-phone-error")).toContainText("ten-digit");
  await expect(page.locator("#inquiry-consent-error")).toContainText("consent");
  await expect(page.locator("#inquiry-name")).toHaveAttribute("aria-invalid", "true");

  // Nothing was submitted beyond the step-one capture.
  expect(calls).toHaveLength(1);
});

test("Back preserves what was already answered", async ({ page }) => {
  await stubInquiry(page);
  await gotoHydrated(page);
  const dialog = await throughStepOne(page);

  const first = page.getByRole("checkbox", {
    name: "Bigger names win deals you could serve better",
  });
  await first.check();
  await dialog.getByRole("button", { name: "Next" }).click();
  await expect(dialog.getByRole("heading", { name: /check out your work/ })).toBeVisible();

  await dialog.getByRole("button", { name: "Back" }).click();
  await expect(first).toBeChecked();
});

test("closing mid-wizard resumes where the visitor left off", async ({ page }) => {
  await stubInquiry(page);
  await gotoHydrated(page);
  const dialog = await throughStepOne(page);

  await dialog.getByRole("button", { name: "Next" }).click();
  await expect(dialog.getByRole("heading", { name: /check out your work/ })).toBeVisible();

  // Escape closes; the email is already captured, so reopening must not march
  // the visitor back through frame one — that is how applications get abandoned.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("link", { name: "Open the inquiry modal" }).click();
  await expect(dialog.getByRole("heading", { name: /check out your work/ })).toBeVisible();
});

test("moving between frames lands focus on the new frame's heading", async ({ page }) => {
  await stubInquiry(page);
  await gotoHydrated(page);
  const dialog = await throughStepOne(page);

  // Without this, a keyboard or screen-reader user is left on a button that
  // no longer exists after the frame swap.
  await expect(dialog.getByRole("heading", { name: /What problems/ })).toBeFocused();
  await dialog.getByRole("button", { name: "Next" }).click();
  await expect(dialog.getByRole("heading", { name: /check out your work/ })).toBeFocused();
});

// The modal is ONE frame that says "you are at step one". The other two steps
// are drawn to place it in the framework, not to be picked. An earlier pass
// built them as a real tablist, which promised keyboard movement and panel
// switching the design never intended — this locks them back down to scenery.
test("the step row is decorative, not a set of controls", async ({ page }) => {
  await stubInquiry(page);
  await gotoHydrated(page);
  await page.getByRole("link", { name: "Open the inquiry modal" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".inquiry-step")).toHaveCount(3);
  // No tab semantics anywhere, and nothing in the row is reachable by keyboard.
  await expect(page.getByRole("tab")).toHaveCount(0);
  await expect(page.getByRole("tabpanel")).toHaveCount(0);
  await expect(dialog.locator(".inquiry-steps button, .inquiry-steps a")).toHaveCount(0);
  // Nor does it invite a click it cannot answer. The `cursor: pointer` these
  // carried as tabs outlived the tabs themselves, which reads as three broken
  // buttons to anyone who moves a mouse across the row.
  for (const el of await dialog.locator(".inquiry-step").all()) {
    await expect(el).toHaveCSS("cursor", "auto");
  }
  // Hidden from AT: the copy below already names the step, so the run of
  // numbers and labels would only be read out in front of it.
  await expect(dialog.locator(".inquiry-steps")).toHaveAttribute("aria-hidden", "true");

  // Only step one is drawn as current: its subtitle and its chevron.
  await expect(dialog.locator(".inquiry-step.is-active")).toHaveCount(1);
  await expect(dialog.locator(".inquiry-step-arrow")).toHaveCount(1);
  await expect(dialog.locator(".inquiry-step-sub")).toHaveCount(1);

  // And the frame always shows step one's copy.
  await expect(dialog).toContainText("We audit your marketing deliverables");
});

test("opening the modal arrests scroll without shifting the page sideways", async ({ page }) => {
  await stubInquiry(page);
  await gotoHydrated(page);

  // A wide element whose left edge would move if the reserved scrollbar space
  // collapsed when the bar was hidden.
  const probe = page.locator("h1").first();
  const before = await probe.evaluate((el) => el.getBoundingClientRect().left);

  await page.getByRole("link", { name: "Open the inquiry modal" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  const locked = await page.evaluate(() => ({
    overflow: getComputedStyle(document.body).overflow,
    gutter: document.documentElement.style.scrollbarGutter,
  }));
  expect(locked.overflow).toBe("hidden");
  // The gutter is what holds the layout still; on engines without it the
  // component pads the body instead, and the probe assertion below still binds.
  expect(locked.gutter).toBe("stable");

  const after = await probe.evaluate((el) => el.getBoundingClientRect().left);
  expect(after).toBe(before);

  // Scroll really is arrested.
  const y0 = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 600);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(y0);

  // …and everything is put back on close.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
    .not.toBe("hidden");
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

// Axe over each distinct frame of the flow, not just the first one — the
// wizard's fieldsets, option rows and error wiring are exactly the markup a
// regression would land in.
test("no frame of the flow has axe violations", async ({ page }) => {
  await stubInquiry(page);
  await gotoHydrated(page);
  await page.getByRole("link", { name: "Open the inquiry modal" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

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

  const scan = () =>
    new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      // KNOWN, ACCEPTED DEVIATION — not a blanket exemption, and not a bug to
      // "fix" by quietly darkening the pink.
      //
      // The board draws the two steps you are NOT on in a pale pink that measures
      // 2.03:1 on white (axe, 2026-08-16), against the 4.5:1 that WCAG 1.4.3
      // requires. That was raised twice and the design was confirmed both times,
      // so the colour stands and the exclusion is written down here rather than
      // being hidden by nudging the value until the gate went quiet.
      //
      // What makes it defensible rather than merely permitted: the row is
      // decorative. It controls nothing, links nowhere, takes no focus, and is
      // aria-hidden, and the copy directly beneath it names the step in
      // full-strength text. What it is NOT is exempt — a sighted visitor with low
      // contrast sensitivity will not read "02 THE REBUILD".
      //
      // Narrow on purpose: only this row is skipped, so any other contrast
      // regression anywhere in the modal still fails. If these ever become
      // interactive again, delete this line first — the colour has to go with it.
      .exclude(".inquiry-steps")
      .analyze();

  // Frame one (email).
  expect((await scan()).violations).toEqual([]);

  // A question frame, with an error-free selection in place.
  await page.locator("#inquiry-email").fill("buyer@example.com");
  await page.getByRole("button", { name: "Inquire Now" }).click();
  await expect(dialog.getByRole("heading", { name: /What problems/ })).toBeVisible();
  await dialog.getByRole("checkbox", { name: "Outdated sales and marketing materials" }).check();
  expect((await scan()).violations).toEqual([]);

  // The contact frame, including its validation-error state.
  for (let i = 0; i < 5; i++) await dialog.getByRole("button", { name: "Next" }).click();
  await expect(dialog.getByRole("heading", { name: /how do we reach you/ })).toBeVisible();
  await dialog.getByRole("button", { name: "Submit Application" }).click();
  await expect(page.locator("#inquiry-name-error")).toBeVisible();
  expect((await scan()).violations).toEqual([]);
});

// The exclusion above must stay honest: if the row somehow starts passing, the
// colour has drifted off the board and someone should know.
test("the dimmed steps are the board's pink, and still the known contrast gap", async ({
  page,
}) => {
  await stubInquiry(page);
  await gotoHydrated(page);
  await page.getByRole("link", { name: "Open the inquiry modal" }).click();
  await expect
    .poll(() =>
      page.locator(".inquiry-wrap").evaluate((el) => Number(getComputedStyle(el).opacity)),
    )
    .toBe(1);

  const colors = await page
    .locator(".inquiry-step")
    .evaluateAll((els) => els.map((el) => getComputedStyle(el).color));

  // Step one at full red; the other two dimmed to the board's pink.
  expect(colors).toEqual(["rgb(215, 25, 32)", "rgb(235, 163, 166)", "rgb(235, 163, 166)"]);
});

// A CTA can name the section it sits in via data-inquire-step, so a captured
// lead traces back to where it was opened. These two triggers on the fixture —
// one with a step that is deliberately NOT steps[0], one with no step at all —
// pin both halves of that: the attribute is read when present, and there is a
// sane fallback when it isn't.
test("a CTA's data-inquire-step is the step sent to ingest, over the steps[0] fallback", async ({
  page,
}) => {
  const { calls } = await stubInquiry(page);
  await gotoHydrated(page);

  // This trigger carries data-inquire-step="The Rollout" — the LAST framework
  // step, chosen to differ from steps[0] ("The Diagnosis") so a pass proves the
  // attribute was read rather than the fallback happening to match.
  await page.getByRole("link", { name: "Open inquiry from the rollout step" }).click();
  await page.locator("#inquiry-email").fill("buyer@example.com");
  await page.getByRole("dialog").getByRole("button", { name: "Inquire Now" }).click();

  await expect.poll(() => calls.length).toBe(1);
  expect(calls[0].step).toBe("The Rollout");
});

test("a CTA with no data-inquire-step falls back to the first framework step", async ({ page }) => {
  const { calls } = await stubInquiry(page);
  await gotoHydrated(page);

  // The bare trigger names no step; the lead must still trace to the first
  // framework step rather than being attributed to nothing.
  await page.getByRole("link", { name: "Open inquiry with no step attribute" }).click();
  await page.locator("#inquiry-email").fill("buyer@example.com");
  await page.getByRole("dialog").getByRole("button", { name: "Inquire Now" }).click();

  await expect.poll(() => calls.length).toBe(1);
  // steps[0] is the iconColumns first title, "The Diagnosis:", colon trimmed.
  expect(calls[0].step).toBe("The Diagnosis");
});

// The CRM sync lives behind /api/inquiry, so an ingest failure means the whole
// endpoint failed and nothing reached the CRM either — ingest is the system of
// record and the CRM must never hold an application it rejected. Step one
// succeeds (so the visitor reaches the wizard); the application POST fails.
test("an application-step ingest failure surfaces the error and holds the visitor", async ({
  page,
}) => {
  const calls: Record<string, unknown>[] = [];
  await page.route("**/api/inquiry", async (route) => {
    calls.push(JSON.parse(route.request().postData() ?? "{}"));
    const failing = calls.length >= 2; // 1 = email capture (ok), 2 = application (fail)
    await route.fulfill({
      status: failing ? 502 : 200,
      contentType: "application/json",
      body: JSON.stringify(failing ? { error: "Ingest is down." } : { success: true }),
    });
  });
  await page.route("**/challenges.cloudflare.com/**", (route) => route.abort());
  const strayCrmCalls: string[] = [];
  await page.route("**/*.leadconnectorhq.com/**", async (route) => {
    strayCrmCalls.push(route.request().url());
    await route.abort();
  });

  await gotoHydrated(page);
  const dialog = await throughStepOne(page);

  for (let i = 0; i < 5; i++) await dialog.getByRole("button", { name: "Next" }).click();
  await page.locator("#inquiry-name").fill("Pat Buyer");
  await page.locator("#inquiry-phone").fill("(555) 123-4567");
  await dialog.getByRole("checkbox", { name: /I consent to receiving text messages/ }).check();
  await dialog.getByRole("button", { name: "Submit Application" }).click();

  // The failure is surfaced and the visitor is held on the contact frame rather
  // than marched to the thank-you, so the application can be retried.
  await expect(dialog.getByRole("alert")).toContainText("Ingest is down.");
  await expect(dialog.getByRole("heading", { name: /how do we reach you/ })).toBeVisible();
  await expect(dialog.getByRole("status")).toHaveCount(0);
  // Both POSTs were attempted; neither reached the CRM from the browser.
  expect(calls).toHaveLength(2);
  expect(strayCrmCalls).toEqual([]);
});

// The resume path is only for a mid-wizard abandon. A FINISHED application must
// reopen clean — otherwise the next visitor on a shared machine is greeted by
// the last one's thank-you, or worse, their half-filled contact frame.
test("reopening after a completed application starts a fresh email frame", async ({ page }) => {
  await stubInquiry(page);
  await gotoHydrated(page);
  const dialog = await throughStepOne(page);

  // Blow through the optional questions, fill contact, submit.
  for (let i = 0; i < 5; i++) await dialog.getByRole("button", { name: "Next" }).click();
  await page.locator("#inquiry-name").fill("Pat Buyer");
  await page.locator("#inquiry-phone").fill("(555) 123-4567");
  await dialog.getByRole("checkbox", { name: /I consent to receiving text messages/ }).check();
  await dialog.getByRole("button", { name: "Submit Application" }).click();
  await expect(page.getByRole("status")).toContainText("application");

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("link", { name: "Open the inquiry modal" }).click();
  const reopened = page.getByRole("dialog");
  // Back at frame one with an empty field — not the thank-you, not the contact form.
  await expect(reopened.locator("#inquiry-email")).toBeVisible();
  await expect(reopened.locator("#inquiry-email")).toHaveValue("");
  await expect(reopened.getByText("your application is in")).toHaveCount(0);
});
