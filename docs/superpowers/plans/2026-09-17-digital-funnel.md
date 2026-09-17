# `/digital` funnel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a catch-all web-first landing page at `/digital` whose inquiry modal asks its own five questions and writes them to their own CRM fields.

**Architecture:** The page is content only — an `industry` document loaded by the existing `scripts/industry/` pipeline. The divergence is the question set: `questionsFor()` becomes a lookup keyed by the document's `inquiry_survey_id`, the digital set resolves under the key `"digital"`, and the server's writable-field allow-list derives from it unchanged. Four new GHL contact fields hold the answers; the medtech budget gate stays keyed to medtech's field id and so can never fire for a digital lead.

**Tech Stack:** SvelteKit 2 / Svelte 5 runes, Vitest, Playwright, Prismic Migration API (`@prismicio/client`), GoHighLevel v2 REST.

**Spec:** [docs/superpowers/specs/2026-09-17-digital-funnel-design.md](../specs/2026-09-17-digital-funnel-design.md)

## Global Constraints

- **Branch:** `feat/digital-funnel`, worktree `.worktrees/digital-funnel`. PR against `staging`, never `main`.
- **CRM before code.** GHL matches submitted values against its picklists byte for byte. A field id or option string goes into the repo only after it has been read back from the CRM by id.
- **Option strings are the CRM's, not ours.** Any later wording change is a rename in GHL first, then the matching code edit.
- **Location id:** `nluRF7uH234gl3PdTBVD`. **Token:** `CRM_CLAUDE_TOKEN` from `.env.local` for field creation (`CRM_FUNNEL_ACTIVE_TOKEN` 401s on `/locations/{loc}/customFields/*`). Headers: `Authorization: Bearer <token>`, `Version: 2021-07-28`.
- **Question-set key:** the literal string `"digital"`, stored in the Prismic document's `inquiry_survey_id`. It is a key this repo owns, not a GHL survey id.
- **Budget ranges and pricing copy are placeholders** pending Tim. They are drafted, listed in `_contentGaps`, and never published without his numbers.
- **Never publish the Prismic document.** The loader stages an unpublished draft; a human publishes.
- **Format then stage:** run `pnpm format` (or `npx prettier --write <file>`) _before_ `git add`, or CI's prettier check fails on a commit that passed locally.
- **Gate every chain on exit codes:** `step || exit 1`. Never commit in the same command as an unverified edit.

---

### Task 1: Create the four CRM fields and record their ids

**Files:**

- Create: `scripts/crm/create-digital-fields.mjs`
- Test: none (a one-off operations script against a live CRM; its guard is idempotency plus read-back)

**Interfaces:**

- Consumes: nothing.
- Produces: four GHL custom-field ids, printed as a paste-ready block. Task 2 hardcodes them as `DIGITAL_FIELDS`.

- [ ] **Step 1: Write the script**

Create `scripts/crm/create-digital-fields.mjs`:

```js
// Creates the four contact fields the /digital question set writes to, and
// prints their ids. Idempotent: a field whose name already exists is reused,
// never duplicated, so a re-run after a partial failure is safe.
//
//   node --env-file=.env.local scripts/crm/create-digital-fields.mjs --dry-run
//   node --env-file=.env.local scripts/crm/create-digital-fields.mjs
//
// Needs CRM_CLAUDE_TOKEN: the site's runtime token is not authorised for
// /locations/{loc}/customFields/*.
const LOCATION = "nluRF7uH234gl3PdTBVD";
const DRY_RUN = process.argv.includes("--dry-run");
const token = process.env.CRM_CLAUDE_TOKEN;
if (!token) {
  console.error("✗ CRM_CLAUDE_TOKEN is not set (use --env-file=.env.local)");
  process.exit(1);
}
const H = {
  Authorization: `Bearer ${token}`,
  Version: "2021-07-28",
  "Content-Type": "application/json",
};

// dataType mirrors the medtech counterpart of each question, read back
// 2026-09-17: multi-select answers are CHECKBOX, single-select are RADIO.
const WANT = [
  {
    key: "needs",
    name: "Digital Inquiry - Needs",
    dataType: "CHECKBOX",
    options: [
      "A new website",
      "Redesigning our current website",
      "Showing up in Google and AI search",
      "Keeping our site updated",
      "Not sure yet",
    ],
  },
  {
    key: "goal",
    name: "Digital Inquiry - Website Goal",
    dataType: "RADIO",
    options: [
      "Bring in leads and calls",
      "Sell online",
      "Make us look credible",
      "Support hiring",
      "Other",
    ],
  },
  {
    key: "stakeholders",
    name: "Digital Inquiry - Stakeholders",
    dataType: "RADIO",
    options: [
      "Just myself",
      "My business partner",
      "My department head",
      "Our board of directors",
      "Other",
    ],
  },
  {
    key: "budget",
    name: "Digital Inquiry - Budget Range",
    dataType: "RADIO",
    // PLACEHOLDER RANGES — Tim sets the real ones. Changing them later is a
    // rename on this field followed by the matching edit in questions.ts.
    options: ["Under $5,000", "$5,000 - $10,000", "$10,000 - $25,000", "$25,000+", "Not sure yet"],
  },
];

const call = async (path, init) => {
  const r = await fetch(`https://services.leadconnectorhq.com${path}`, { headers: H, ...init });
  const body = await r.json().catch(() => ({}));
  if (!r.ok)
    throw new Error(
      `${init?.method ?? "GET"} ${path} → ${r.status} ${JSON.stringify(body).slice(0, 300)}`,
    );
  return body;
};

const existing = await call(`/locations/${LOCATION}/customFields?model=contact`);
const byName = new Map(
  (existing.customFields ?? []).map((f) => [String(f.name).trim().toLowerCase(), f]),
);

const out = {};
for (const want of WANT) {
  const found = byName.get(want.name.toLowerCase());
  if (found) {
    console.log(`= ${want.name} already exists (${found.id})`);
    out[want.key] = found.id;
    continue;
  }
  if (DRY_RUN) {
    console.log(`+ would create ${want.name} (${want.dataType}, ${want.options.length} options)`);
    continue;
  }
  const created = await call(`/locations/${LOCATION}/customFields`, {
    method: "POST",
    body: JSON.stringify({
      name: want.name,
      dataType: want.dataType,
      model: "contact",
      // Undocumented but real — see the 2026-08-24 survey-copy findings. The
      // documented DTO has no options key, and the {key,label} shape 400s.
      options: want.options,
    }),
  });
  const id = created.customField?.id;
  if (!id) throw new Error(`created ${want.name} but no id came back`);
  console.log(`+ created ${want.name} (${id})`);
  out[want.key] = id;
}

// Read each one back BY ID. The list endpoint lags a write by 1-2s and a
// single read of it looks exactly like a silent no-op.
console.log("\nread-back:");
for (const [key, id] of Object.entries(out)) {
  const { customField: f } = await call(`/locations/${LOCATION}/customFields/${id}`);
  console.log(
    `  ${key.padEnd(13)} ${id}  ${f.dataType.padEnd(9)} ${(f.picklistOptions ?? []).length} options  "${f.name}"`,
  );
}
console.log("\nPaste into src/lib/ghl/questions.ts:\n");
console.log(
  `const DIGITAL_FIELDS = {\n${Object.entries(out)
    .map(([k, v]) => `  ${k}: "${v}",`)
    .join("\n")}\n} as const;`,
);
```

- [ ] **Step 2: Dry run — see what it would create, write nothing**

Run: `node --env-file=.env.local scripts/crm/create-digital-fields.mjs --dry-run`
Expected: four `+ would create …` lines and no errors. If a line says `= … already exists`, that field is being reused — fine, and the read-back will confirm its shape.

- [ ] **Step 3: Create the fields**

Run: `node --env-file=.env.local scripts/crm/create-digital-fields.mjs`
Expected: four `+ created` lines, then a `read-back:` block where each row shows the expected `dataType` and option count (`needs` 5 CHECKBOX, `goal` 5 RADIO, `stakeholders` 5 RADIO, `budget` 5 RADIO), then the paste-ready `DIGITAL_FIELDS` block.

**If a create returns 401**, the token lacks the write scope. Do not work around it in code: create the four fields by hand in GHL (Settings → Custom Fields, contact model) with the exact names, types and options above, then re-run the script — it will find them by name and print their ids.

- [ ] **Step 4: Keep the ids**

Copy the printed `DIGITAL_FIELDS` block into the scratchpad; Task 2 pastes it into `questions.ts`.

- [ ] **Step 5: Commit**

```bash
npx prettier --write scripts/crm/create-digital-fields.mjs || exit 1
git add scripts/crm/create-digital-fields.mjs || exit 1
git commit -m "chore(crm): idempotent creator for the /digital inquiry fields"
```

---

### Task 2: The digital question set

**Files:**

- Modify: `src/lib/ghl/questions.ts`
- Modify: `src/lib/ghl/questions.test.ts`

**Interfaces:**

- Consumes: the four ids from Task 1.
- Produces: `DIGITAL_QUESTION_SET_ID = "digital"` and `DIGITAL_QUESTIONS`, both exported from `src/lib/ghl/questions.ts`; `questionsFor("digital")` returns the five-question array. `writableFieldIds()` and `partitionAnswers()` in `client.ts` are unchanged and pick this up through `questionsFor`.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/ghl/questions.test.ts`:

```ts
describe("the digital question set", () => {
  const questions = questionsFor(DIGITAL_QUESTION_SET_ID)!;

  it("resolves under its own key and leaves unknown keys undefined", () => {
    expect(questions).toBeDefined();
    expect(questionsFor("not-a-set")).toBeUndefined();
  });

  it("is five questions in slide order, website second", () => {
    expect(questions).toHaveLength(5);
    expect(questions.map((q) => q.kind)).toEqual(["checkbox", "text", "radio", "radio", "radio"]);
    expect(questions[1].tag).toBe("website");
  });

  it("writes only real CRM field ids", () => {
    // Every tag is either the standard `website` field or a 20-char GHL id.
    for (const q of questions) {
      if (q.tag === "website") continue;
      expect(q.tag).toMatch(/^[A-Za-z0-9]{20}$/);
    }
  });

  it("shares no custom field with the medtech set", () => {
    const a101 = questionsFor(DEFAULT_INQUIRY_SURVEY_ID)!.map((q) => q.tag);
    const shared = questions.map((q) => q.tag).filter((t) => a101.includes(t));
    // `website` is a standard contact field and is deliberately shared; a
    // shared CUSTOM field would mix two funnels' picklists in one column.
    expect(shared).toEqual(["website"]);
  });

  it("carries the budget ranges as offered, and no budget gate", () => {
    const budget = questions[4] as Extract<(typeof questions)[number], { kind: "radio" }>;
    expect(budget.options).toEqual([
      "Under $5,000",
      "$5,000 - $10,000",
      "$10,000 - $25,000",
      "$25,000+",
      "Not sure yet",
    ]);
    // The gate belongs to the medtech set. No digital answer can trip it —
    // not even one that names the gate's own opt-out string.
    expect(questions.some((q) => q.tag === BUDGET_GATE.tag)).toBe(false);
    const answered = Object.fromEntries(
      questions.map((q) => [q.tag, q.kind === "checkbox" ? ["No"] : "No"]),
    );
    expect(isBudgetOptOut(answered)).toBe(false);
  });
});
```

Add `DIGITAL_QUESTION_SET_ID` to the existing import from `./questions` at the top of the file.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/lib/ghl/questions.test.ts`
Expected: FAIL — `DIGITAL_QUESTION_SET_ID` is not exported.

- [ ] **Step 3: Write the question set**

In `src/lib/ghl/questions.ts`, after `A101_QUESTIONS`, paste the ids from Task 1 and add:

```ts
/**
 * The /digital question set.
 *
 * Keyed by a string this repo owns rather than a GHL survey id: no survey
 * exists for these questions and none is needed — nothing has submitted to a
 * GHL survey since the widget path died (2026-08-18), and the answers land as
 * contact custom fields either way.
 *
 * Fields created 2026-09-17 by scripts/crm/create-digital-fields.mjs and read
 * back by id before they were written here. Option strings are the CRM's
 * stored picklist values; a change starts in GHL, never here.
 */
export const DIGITAL_QUESTION_SET_ID = "digital";

const DIGITAL_FIELDS = {
  needs: "<id from Task 1>",
  goal: "<id from Task 1>",
  stakeholders: "<id from Task 1>",
  budget: "<id from Task 1>",
} as const;

const DIGITAL_QUESTIONS: readonly InquiryQuestion[] = [
  {
    kind: "checkbox",
    tag: DIGITAL_FIELDS.needs,
    heading: "What do you need help with?",
    options: [
      "A new website",
      "Redesigning our current website",
      "Showing up in Google and AI search",
      "Keeping our site updated",
      "Not sure yet",
    ],
  },
  {
    kind: "text",
    tag: "website",
    // Every question in the wizard is skippable (nextQuestion advances without
    // validating), which matters most here: a startup asking for its first
    // site has nothing to type, and an empty answer is dropped by
    // partitionAnswers rather than written blank.
    heading: "Where can we see your current website?",
    placeholder: "https://yourwebsite.com",
    inputType: "url",
  },
  {
    kind: "radio",
    tag: DIGITAL_FIELDS.goal,
    heading: "What's the main job your website needs to do?",
    options: [
      "Bring in leads and calls",
      "Sell online",
      "Make us look credible",
      "Support hiring",
      "Other",
    ],
  },
  {
    kind: "radio",
    tag: DIGITAL_FIELDS.stakeholders,
    heading: "Is there anyone else involved in this project?",
    options: [
      "Just myself",
      "My business partner",
      "My department head",
      "Our board of directors",
      "Other",
    ],
  },
  {
    kind: "radio",
    tag: DIGITAL_FIELDS.budget,
    // PLACEHOLDER RANGES pending Tim (see the spec's §2). The page's pricing
    // FAQ carries the same numbers and moves with them.
    heading: "What's your budget for this project?",
    options: ["Under $5,000", "$5,000 - $10,000", "$10,000 - $25,000", "$25,000+", "Not sure yet"],
  },
];
```

Then replace `questionsFor` with the lookup:

```ts
/**
 * Question set for a key, or undefined for a key this build has no
 * transcription of. The caller treats undefined as "no wizard": step one still
 * captures the email, the visitor gets the thank-you, and nothing submits
 * answers a different set would misfile.
 *
 * Keys are whatever an industry document's `inquiry_survey_id` holds — the
 * A-101 GHL survey id for the brand funnel, `digital` for the web funnel.
 */
const QUESTION_SETS: Record<string, readonly InquiryQuestion[]> = {
  [DEFAULT_INQUIRY_SURVEY_ID]: A101_QUESTIONS,
  [DIGITAL_QUESTION_SET_ID]: DIGITAL_QUESTIONS,
};

export function questionsFor(surveyId: string): readonly InquiryQuestion[] | undefined {
  return QUESTION_SETS[surveyId];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/lib/ghl/questions.test.ts`
Expected: PASS, including the pre-existing A-101 suite (the lookup must not have changed medtech's behaviour).

- [ ] **Step 5: Commit**

```bash
npx prettier --write src/lib/ghl/questions.ts src/lib/ghl/questions.test.ts || exit 1
git add src/lib/ghl/questions.ts src/lib/ghl/questions.test.ts || exit 1
git commit -m "feat(inquiry): a second question set, keyed per page"
```

---

### Task 3: Prove the server's allow-list follows the new set

**Files:**

- Modify: `src/lib/ghl/client.test.ts`

**Interfaces:**

- Consumes: `DIGITAL_QUESTION_SET_ID`, `questionsFor` from Task 2.
- Produces: nothing new — this task adds tests only. It exists because the allow-list is the one thing standing between a forged browser payload and a write to an unrelated CRM field, and that guarantee now spans two sets.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/ghl/client.test.ts` (add `DIGITAL_QUESTION_SET_ID` to the existing `./questions` import):

```ts
describe("writableFieldIds across two question sets", () => {
  const digital = writableFieldIds(DIGITAL_QUESTION_SET_ID);
  const a101 = writableFieldIds(DEFAULT_INQUIRY_SURVEY_ID);

  it("covers the digital set's custom fields and excludes `website`", () => {
    const tags = questionsFor(DIGITAL_QUESTION_SET_ID)!.map((q) => q.tag);
    for (const tag of tags.filter((t) => t !== "website")) expect(digital.has(tag)).toBe(true);
    expect(digital.has("website")).toBe(false);
    expect(digital.has(SMS_CONSENT.tag)).toBe(false);
  });

  it("does not let one funnel write the other's fields", () => {
    for (const id of a101) expect(digital.has(id)).toBe(false);
    for (const id of digital) expect(a101.has(id)).toBe(false);
  });

  it("drops a medtech field id forged into a digital submission", () => {
    const { customFields, standard } = partitionAnswers(
      { [BUDGET_GATE.tag]: "No", website: "https://acme.test" },
      digital,
    );
    // The budget gate's field is medtech's. Posted under the digital key it is
    // not written at all — so it cannot reach isBudgetOptOut's answer map on
    // the server, and cannot be used to route a digital lead to /not-a-fit.
    expect(customFields).toEqual([]);
    expect(standard).toEqual({ website: "https://acme.test" });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/lib/ghl/client.test.ts`
Expected: FAIL — `DIGITAL_QUESTION_SET_ID` is not in the import list yet (add it), then PASS once imported, since `writableFieldIds` already derives from `questionsFor`. **If any of these fail after the import is fixed, stop** — the allow-list is not deriving as assumed and the plan's premise is wrong.

- [ ] **Step 3: Run the whole unit suite**

Run: `pnpm test:unit`
Expected: PASS, no regressions.

- [ ] **Step 4: Commit**

```bash
npx prettier --write src/lib/ghl/client.test.ts || exit 1
git add src/lib/ghl/client.test.ts || exit 1
git commit -m "test(ghl): neither funnel can write the other's fields"
```

---

### Task 4: Let the loader write the Inquiry tab

**Files:**

- Modify: `scripts/industry/migrate.mjs` (the `docData` assembly, around line 504)
- Modify: `scripts/industry/lib.mjs`
- Modify: `scripts/industry/lib.test.mjs`

**Interfaces:**

- Consumes: nothing.
- Produces: `inquiryFields(d)` exported from `scripts/industry/lib.mjs` — takes the parsed data file, returns an object of the `inquiry_*` fields to merge into `docData`, or `{}` when the data file has no `inquiry` block.

- [ ] **Step 1: Write the failing test**

Append to `scripts/industry/lib.test.mjs`:

```js
describe("inquiryFields", () => {
  it("is empty when the data file has no inquiry block", () => {
    // medtech's and boise's data files have none — their Inquiry tab was set
    // by hand in Prismic, and a re-run of their load must not blank it.
    expect(inquiryFields({ uid: "medtech" })).toEqual({});
  });

  it("maps only the fields that are present", () => {
    expect(
      inquiryFields({ inquiry: { title: "Let's talk", surveyId: "digital", prompt: "" } }),
    ).toEqual({ inquiry_title: "Let's talk", inquiry_survey_id: "digital" });
  });

  it("maps the full block", () => {
    expect(
      inquiryFields({
        inquiry: {
          title: "T",
          prompt: "P",
          thanks: "TH",
          formId: "F",
          surveyId: "digital",
        },
      }),
    ).toEqual({
      inquiry_title: "T",
      inquiry_prompt: "P",
      inquiry_thanks: "TH",
      inquiry_form_id: "F",
      inquiry_survey_id: "digital",
    });
  });
});
```

Add `inquiryFields` to the existing import from `./lib.mjs` at the top of the test file.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run scripts/industry/lib.test.mjs`
Expected: FAIL with `inquiryFields is not a function`.

- [ ] **Step 3: Implement**

Append to `scripts/industry/lib.mjs`:

```js
/** The document's Inquiry-tab fields, from an optional `inquiry` block in the
 *  data file. Absent keys are omitted rather than written empty: the Migration
 *  API replaces `data` wholesale, so a present-but-empty key would clear a
 *  value an editor set in Prismic. A data file with no block writes nothing,
 *  which is what keeps medtech's and boise's hand-set tabs intact. */
export function inquiryFields(d) {
  const i = d?.inquiry;
  if (!i) return {};
  const map = {
    inquiry_title: i.title,
    inquiry_prompt: i.prompt,
    inquiry_thanks: i.thanks,
    inquiry_form_id: i.formId,
    inquiry_survey_id: i.surveyId,
  };
  return Object.fromEntries(Object.entries(map).filter(([, v]) => typeof v === "string" && v));
}
```

In `scripts/industry/migrate.mjs`, add `inquiryFields` to the import from `./lib.mjs` and extend `docData`:

```js
const docData = {
  title: heading(1, d.title),
  slices,
  meta_title: d.meta_title,
  meta_description: d.meta_description,
  ...inquiryFields(d),
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run scripts/industry/lib.test.mjs`
Expected: PASS.

- [ ] **Step 5: Prove the existing pages are untouched**

Run: `node scripts/industry/migrate.mjs --industry medtech --dry-run`
Expected: completes with zero model mismatches, exactly as before. The printed summary must not mention any `inquiry_*` field.

- [ ] **Step 6: Commit**

```bash
npx prettier --write scripts/industry/lib.mjs scripts/industry/lib.test.mjs scripts/industry/migrate.mjs || exit 1
git add scripts/industry/lib.mjs scripts/industry/lib.test.mjs scripts/industry/migrate.mjs || exit 1
git commit -m "feat(industry): optional Inquiry-tab block in the content loader"
```

---

### Task 5: Smoke — the digital wizard submits digital fields

**Files:**

- Modify: `src/routes/dev/a11y-fixtures/+page.svelte` (the `InquiryModal` mount, around line 577)
- Modify: `tests/smoke/inquiry-modal.spec.ts`

**Interfaces:**

- Consumes: `DIGITAL_QUESTION_SET_ID` from Task 2.
- Produces: a second `InquiryModal` instance on the fixtures page, opened by a trigger the existing modal does not claim, so both sets are exercised in one page.

- [ ] **Step 1: Let two modals share a page**

`InquiryModal` opens on any click matching `'a[href="#inquire"], a[href$="#inquire"], [data-inquire]'` ([InquiryModal.svelte:268](../../../src/lib/components/InquiryModal.svelte#L268)), delegated on `document`. Two instances on one page would therefore both open on every trigger. Add an optional key.

In the component's props, beside `surveyId`:

```ts
/** Which triggers this instance answers. A trigger names its modal with
 *  `data-inquire="<key>"`; an instance with no key owns the unkeyed triggers,
 *  which is every CTA in the site's content today. Only the fixtures route
 *  mounts more than one. */
triggerKey?: string;
```

Default it to `""` in the destructure, and add one line inside the existing click handler, directly after the `if (!trigger) return;`:

```ts
if ((trigger.getAttribute("data-inquire") ?? "") !== triggerKey) return;
```

`data-inquire` has no other use in the codebase — the selector above is its only reference — so no existing trigger changes behaviour.

Then, on the fixtures page below the existing `<InquiryModal …/>` mount:

```svelte
<!-- A second instance on the digital question set, so the smoke suite can
     drive both without a second fixture route. A button, not a link: a
     `/contact#…` href would have to match a real id on /contact or
     SvelteKit's prerender link check fails the build. -->
<button type="button" data-inquire="digital" data-inquire-step="The Diagnosis">
  Open the digital inquiry
</button>
<InquiryModal surveyId="digital" triggerKey="digital" />
```

- [ ] **Step 2: Write the failing test**

Append to `tests/smoke/inquiry-modal.spec.ts`, following the existing helpers in that file (`formDataJson`, the `/api/inquiry` route stub that records calls):

```ts
test("the digital funnel submits its own fields and never the budget gate", async ({ page }) => {
  // stubInquiry is this file's existing helper: it records /api/inquiry posts
  // and stubs Turnstile, /api/slots and /api/book so nothing real is created.
  const { calls } = await stubInquiry(page);
  await page.goto(PATH, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Open the digital inquiry" }).click();

  await page.getByLabel("Email").fill("digital-smoke@example.test");
  await page.getByRole("button", { name: /continue|next/i }).click();

  // Five questions: answer each, then the contact frame.
  await page.getByRole("heading", { name: /What do you need help with\?/ }).waitFor();
  await page.getByText("A new website").click();
  await page.getByRole("button", { name: /next/i }).click();
  await page.getByRole("heading", { name: /Where can we see your current website\?/ }).waitFor();
  // Deliberately skipped — a startup has no site yet, and the flow must allow it.
  await page.getByRole("button", { name: /next/i }).click();
  await page.getByText("Bring in leads and calls").click();
  await page.getByRole("button", { name: /next/i }).click();
  await page.getByText("Just myself").click();
  await page.getByRole("button", { name: /next/i }).click();
  await page.getByText("Under $5,000").click();
  await page.getByRole("button", { name: /next/i }).click();

  await page.getByLabel(/name/i).fill("Smoke Test");
  await page.getByLabel(/phone|cell/i).fill("3105551234");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /submit|send/i }).click();

  const application = calls.find((c) => c.answers?.length);
  expect(application.surveyId).toBe("digital");
  // The skipped website question submits nothing rather than an empty string.
  expect(Object.keys(application.fields)).toHaveLength(4);
  expect(application.fields.website).toBeUndefined();
  // A digital submission never carries medtech's budget-gate field, so it can
  // never be routed to /not-a-fit.
  expect(application.fields["xW6eFrHUFBNQCijp1mOM"]).toBeUndefined();
  await expect(page).not.toHaveURL(/not-a-fit/);
});
```

Match the button and label names to the ones the existing specs in this file already use — read them first rather than guessing; the regexes above are a starting point, not the contract.

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm exec playwright test tests/smoke/inquiry-modal.spec.ts -g "digital funnel"`
Expected: FAIL — the trigger link does not exist yet if Step 1 is incomplete, or the wizard renders the A-101 questions.

- [ ] **Step 4: Make it pass**

Complete Step 1 (including the `triggerHash` prop if it was missing), then re-run.

Run: `pnpm exec playwright test tests/smoke/inquiry-modal.spec.ts`
Expected: PASS — the whole file, so the A-101 specs prove the second instance did not disturb the first.

- [ ] **Step 5: Commit**

```bash
npx prettier --write src/routes/dev/a11y-fixtures/+page.svelte tests/smoke/inquiry-modal.spec.ts src/lib/components/InquiryModal.svelte || exit 1
git add src/routes/dev/a11y-fixtures/+page.svelte tests/smoke/inquiry-modal.spec.ts src/lib/components/InquiryModal.svelte || exit 1
git commit -m "test(inquiry): drive the digital question set end to end"
```

---

### Task 6: The `/digital` content folder

**Files:**

- Create: `scripts/industry/digital/data.json`
- Create: `scripts/industry/digital/fetch-assets.mjs` (modelled on `scripts/industry/boise/fetch-assets.mjs`)
- Create (gitignored): `scripts/industry/digital/assets/`
- Create: `scripts/industry/digital/assets-manifest.json` (written by the fetch script)

**Interfaces:**

- Consumes: `inquiryFields` from Task 4 — the data file's `inquiry` block is what routes the page to the digital question set.
- Produces: an unpublished `industry` document with uid `digital`.

- [ ] **Step 1: Copy the medtech data file as the starting point**

```bash
mkdir -p scripts/industry/digital || exit 1
cp scripts/industry/medtech/data.json scripts/industry/digital/data.json || exit 1
```

- [ ] **Step 2: Rewrite the copy**

Edit every field per the spec's §4.2 table. Specifics that are decided, not open:

- `uid`: `digital`. `_source`: drafted from the published `/medtech` page, 2026-09-17, for the catch-all web funnel. `_copyEdits`: what you changed and why. `_contentGaps`: at minimum the pricing ranges, the service names, the brand-and-web testimonial, the low-resolution Zero Labs mark, and the hero image.
- `services.columns`: drop medtech's "Brand Identity" and "Design System" columns. Keep "Digital Presence" and its four items verbatim (`Website Design`, `Website Development`, `AEO/SEO Development`, `AEO/SEO Deployment`). A second column may only use item names already published on `/medtech`; anything else goes in `_contentGaps` instead.
- `framework`: keep the three `icon-*.svg` filenames and the three-step shape; rewrite title/subtitle/body for a website.
- `caseStudy.projectName`: `Rubrik Zero Labs`, `link.uid`/images from the `rubrik-zero-labs` project. Omit `beforeImage` and `beforeImageAlt` entirely — the slice then hides the toggle, as Boise's does.
- `logoGrid.logos`: Zero Labs, MSOT, 1-800-DENTIST, Gallery Sonder first, then enough of SCFAI, Strategy Advantage, Hearts & Minds, CEO of LA County and St. James' to reach nine. Each entry's `project` must be a **published** uid or `null` — `strategy-advantage-website`, `erp-industrial` and `animation-examples` are `hide`-tagged and a public link to one fails the production build.
- `featuredProject`: MSOT, as medtech has it.
- `testimonial`: Albert Turgon's quote, unchanged, word for word.
- `inquiry`: the new block —

```json
"inquiry": {
  "title": "Let's look at your website",
  "prompt": "Answer five quick questions and book a call.",
  "thanks": "Got it. Pick a time and we'll walk through what we found.",
  "surveyId": "digital"
}
```

(Title, prompt and thanks are drafts for Tim, like the rest of the copy.)

- [ ] **Step 3: Write the asset script**

Copy `scripts/industry/boise/fetch-assets.mjs` to `scripts/industry/digital/fetch-assets.mjs` and change only its named blocks: the `WANT` list of logo brands (the nine above), the `stageFromProject` calls (`rubrik-zero-labs` for the hero and case-study images, `msot` for the featured-project mockup), and any `MOBILE_CROP` overrides. Boise's script throws if a borrowed asset folder is empty — keep that behaviour rather than silently staging nothing.

- [ ] **Step 4: Stage the assets**

```bash
node --env-file=.env.local scripts/industry/digital/fetch-assets.mjs || exit 1
node scripts/industry/fit-logos.mjs --industry digital || exit 1
node scripts/industry/fit-logos.mjs --industry digital --check || exit 1
```

Expected: the check passes in both directions (nothing over the cap, nothing under-reaching it). It will report the Zero Labs mark as upscaled — that is the known gap, not a failure.

- [ ] **Step 5: Dry run the loader**

Run: `node scripts/industry/migrate.mjs --industry digital --dry-run`
Expected: zero model mismatches, twelve slices listed, the `inquiry_*` fields named in the summary, and the `_contentGaps` printed. Sends nothing.

- [ ] **Step 6: Load the draft**

Run: `node --env-file=.env.local scripts/industry/migrate.mjs --industry digital`
Expected: `Creating new document…` then `…documents written`. **The document stays unpublished.** Confirm in Prismic that it exists as a draft and that its Inquiry tab shows `digital` in the survey field.

- [ ] **Step 7: Commit**

```bash
npx prettier --write scripts/industry/digital/data.json scripts/industry/digital/fetch-assets.mjs || exit 1
git add scripts/industry/digital/data.json scripts/industry/digital/fetch-assets.mjs scripts/industry/digital/assets-manifest.json || exit 1
git commit -m "feat(content): /digital — the catch-all web funnel page"
```

---

### Task 7: Gates and the pull request

**Files:** none — verification only.

**Interfaces:**

- Consumes: every preceding task.
- Produces: a PR against `staging`.

- [ ] **Step 1: Run every gate, gated on exit codes**

```bash
pnpm lint || exit 1
pnpm check || exit 1
pnpm test:unit || exit 1
pnpm test:smoke || exit 1
pnpm build || exit 1
```

Expected: all green. `pnpm check` must report 0 errors and 0 warnings. A fresh worktree that fails every vitest file with "Failed to load tsconfig .svelte-kit/tsconfig.json" needs `pnpm exec svelte-kit sync` once — nothing is broken.

- [ ] **Step 2: Verify the committed copies are prettier-clean**

```bash
git diff --name-only staging...HEAD | xargs -I{} sh -c 'git show HEAD:{} | npx prettier --check --stdin-filepath {}' || exit 1
```

Expected: every file reports formatted. This catches the stale-staged-copy trap where local lint passes and CI's prettier fails on the same commit.

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin feat/digital-funnel || exit 1
gh pr create --base staging --title "feat: /digital — a catch-all web-first funnel" --body "<see below>"
```

The body must state: the page is an unpublished draft and needs Tim's copy review and real prices before publishing; the four CRM fields are live; and **the promotion to `main` must land before the document is published**, or the modal degrades to email capture with no wizard.

End the body with:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

### Task 8: After Tim publishes — the smoke route lists

**Files:**

- Modify: `tests/smoke/pages.spec.ts` (`ROUTES`)
- Modify: `tests/smoke/industry-page.spec.ts` (`PATHS`)
- Modify: `tests/smoke/og.spec.ts` (the industry-card list)

**Interfaces:**

- Consumes: a published `digital` document on production.
- Produces: `/digital` under the same smoke coverage `/medtech` has.

**Do not start this task until the document is published** — all three specs are red until it is, which is why it is a separate PR.

- [ ] **Step 1: Confirm the page is live**

Run: `curl -sS -o /dev/null -w '%{http_code}\n' https://reddoorla.com/digital`
Expected: `200`. A `404` means the document is unpublished, or published but not yet rebuilt — the page and its OG card are prerendered, so they exist only after a production build that saw it.

- [ ] **Step 2: Add `/digital` to the three lists**

Add the literal `"/digital"` to `ROUTES` in `tests/smoke/pages.spec.ts` and to `PATHS` in `tests/smoke/industry-page.spec.ts`, and add its card to the industry list in `tests/smoke/og.spec.ts`, matching how `/medtech` appears in each.

- [ ] **Step 3: Run the smoke suite**

Run: `pnpm test:smoke`
Expected: PASS, with the three specs now covering `/digital`.

- [ ] **Step 4: Commit and open the follow-up PR**

```bash
npx prettier --write tests/smoke/pages.spec.ts tests/smoke/industry-page.spec.ts tests/smoke/og.spec.ts || exit 1
git add tests/smoke/pages.spec.ts tests/smoke/industry-page.spec.ts tests/smoke/og.spec.ts || exit 1
git commit -m "test(smoke): cover /digital now that it is published" || exit 1
git push || exit 1
gh pr create --base staging --title "test: smoke coverage for /digital" --body "Adds /digital to the three smoke route lists, now that the document is published.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Sequencing note

Tasks 1–7 can run back to back. Task 8 waits on a human: Tim's copy review, his prices, and the publish. The `/inquiry?funnel=digital` chase link starts working the moment the document is published — no further code is involved.
