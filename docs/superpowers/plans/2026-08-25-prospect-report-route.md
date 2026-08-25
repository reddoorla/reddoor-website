# Prospect Report Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the prospect audit report as a real, branded route on `reddoorla.com/r/{token}`, and produce a separately-designed PDF leave-behind from the same data.

**Architecture:** The audit keeps running in `reddoor-maintenance` and keeps writing `result_json` to Turso. Maintenance gains one new read endpoint that returns that JSON for a valid token; `reddoor-website` fetches it server-side and renders it with the site's own components. Turso credentials never leave the ops repo. The JSON contract is not hand-maintained — the website already depends on `@reddoorla/maintenance`, so the result type is exported from that package as a **dependency-free types-only subpath** and imported directly, giving compile-time safety across the repo boundary.

The PDF is **not** a print of the interactive page. The page carries disclosures and interactive elements; the PDF is its own flat, paper-designed document rendered from the same JSON at a separate print route, which the runner prints with the Chromium it already installs.

**Tech Stack:** SvelteKit 2 / Svelte 5 (runes), `@sveltejs/adapter-netlify`, Tailwind v4, `@reddoorla/maintenance` (npm), Netlify Functions (`.mts`), Turso/libSQL (maintenance only), Playwright Chromium (runner only), vitest.

---

## Decisions already made

These were settled before this plan and are not open questions:

| Decision    | Choice                                    | Why                                                                                              |
| ----------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Data access | Maintenance serves JSON; website fetches  | Matches the existing `FORMS_INGEST_URL` cross-repo pattern; keeps DB credentials in the ops repo |
| Contract    | Types-only package subpath                | The website already depends on the package; a shared type beats a hand-written contract          |
| PDF         | Separate design, separate route           | The page is interactive; a leave-behind is not                                                   |
| Privacy     | 128-bit token remains the only credential | Unchanged from today's `/r/:token`                                                               |

**Design reference for all presentational work:** the approved draft at
`https://claude.ai/code/artifact/b9bb791c-5c21-48b5-a11d-40a0ae01c9ee`
(section order, copy, hierarchy). Build it with site components and tokens, not by copying its inline CSS.

### Cross-repo sequencing — read before starting Task 3

Task 3 imports `@reddoorla/maintenance/audit`. That subpath does not exist
until Task 1 is **released to npm and the website's dependency is bumped** —
merging Task 1 to `main` is not enough. `reddoor-website` currently pins
`@reddoorla/maintenance: ^0.83.0`, and the caret will not pick up a new export
map from a version that has not been published.

So the order is: Task 1 merges → the changeset release PR merges → the package
publishes → bump the website's dependency → then Task 3 can typecheck.

If you need to start the website work before that release lands, declare the
type locally in `src/lib/report/fetch.ts` and leave a `TODO` naming this plan,
then swap to the package import once it is available. Do not copy the full type
body across — a duplicated 200-line type is exactly the drift this export exists
to prevent.

---

## File Structure

**`reddoor-maintenance`**

- Modify: `package.json` — add `./audit` to `exports`
- Modify: `tsup.config.ts` — add `src/prospect/types.ts` as an entry
- Create: `netlify/functions/prospect-report-json.mts` — the read endpoint
- Create: `tests/dashboard/prospect-report-json.test.ts`
- Modify: `netlify/functions/prospect-report.mts` — redirect to the website (final task only)
- Modify: `docs/private-runner/prospect-audit.yml` — PDF step
- Create: `src/prospect/pdf.ts` — print the print-route to a PDF buffer
- Create: `tests/prospect/pdf.test.ts`

**`reddoor-website`**

- Create: `src/lib/report/fetch.ts` — server-only fetch of the report JSON
- Create: `src/lib/report/fetch.test.ts`
- Create: `src/routes/r/[token]/+page.server.ts`
- Create: `src/routes/r/[token]/+page.svelte`
- Create: `src/routes/r/[token]/print/+page.server.ts`
- Create: `src/routes/r/[token]/print/+page.svelte`
- Create: `src/lib/report/` components — `Verdict.svelte`, `ScoreBand.svelte`, `FixList.svelte`, `SearchResults.svelte`, `NamesakeCallout.svelte`, `BuyerQuestions.svelte`, `TechnicalChecks.svelte`, `QuestionSplit.svelte`
- Modify: `static/robots.txt` — `Disallow: /r/`
- Modify: `src/hooks.server.ts` — security headers on SSR responses

---

## Task 1: Export the prospect result type from the package

`src/prospect/types.ts` has exactly one import and it is `import type` — it is runtime-free today, and this task depends on it staying that way. The tsup config's own comment states the rule: consuming fleet sites only ever import dependency-free entries. A runtime import added to this file would drag `@anthropic-ai/sdk` and Playwright into the website's bundle.

**Files:**

- Modify: `reddoor-maintenance/package.json`
- Modify: `reddoor-maintenance/tsup.config.ts`
- Test: `reddoor-maintenance/tests/prospect/types-entry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/prospect/types-entry.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// The website imports this subpath. It must stay dependency-free: a runtime
// import here reaches reddoorla.com's bundle and drags the audit's heavy deps
// (Anthropic SDK, Playwright) with it. tsup.config.ts's own comment states the
// rule — consumers only import dependency-free entries — and nothing enforced it.
describe("the ./audit package entry", () => {
  it("is declared in the export map", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf-8")) as {
      exports: Record<string, { types: string; import: string }>;
    };
    expect(pkg.exports["./audit"]).toEqual({
      types: "./dist/prospect/types.d.ts",
      import: "./dist/prospect/types.js",
    });
  });

  it("is built by tsup", () => {
    const cfg = readFileSync("tsup.config.ts", "utf-8");
    expect(cfg).toContain("src/prospect/types.ts");
  });

  it("has no runtime imports — only `import type`", () => {
    const src = readFileSync("src/prospect/types.ts", "utf-8");
    const runtimeImports = src
      .split("\n")
      .filter((l) => /^\s*import\s/.test(l) && !/^\s*import\s+type\s/.test(l));
    expect(runtimeImports).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm exec vitest run tests/prospect/types-entry.test.ts`
Expected: FAIL — `pkg.exports["./audit"]` is `undefined`.

- [ ] **Step 3: Add the export map entry**

In `package.json`, inside `exports`, after the `"./forms"` block:

```json
    "./audit": {
      "types": "./dist/prospect/types.d.ts",
      "import": "./dist/prospect/types.js"
    },
```

The subpath is `./audit` while the target is `dist/prospect/…`, and that mismatch
is deliberate — do not "correct" it. Inside this repo the domain word is
`prospect`: `src/prospect/`, the `prospect_audits` table, `prospect-report.mts`.
Renaming the source to match the subpath would mean renaming that whole family
for one export. Outward, `audit` is the accurate name for what a consumer
imports — they are importing an audit result, not a prospect. An export map
exists precisely to let the two differ.

- [ ] **Step 4: Add the tsup entry**

In `tsup.config.ts`, add to the `entry` array, after `"src/forms/index.ts"`:

```ts
    "src/prospect/types.ts",
```

- [ ] **Step 5: Verify**

Run: `pnpm exec vitest run tests/prospect/types-entry.test.ts && pnpm build`
Expected: 3 tests pass; `dist/prospect/types.d.ts` and `dist/prospect/types.js` exist.

Confirm the built JS carries no imports:

```bash
node -e 'const s=require("fs").readFileSync("dist/prospect/types.js","utf8"); console.log(/\bimport\b/.test(s) ? "HAS IMPORTS — investigate" : "clean")'
```

Expected: `clean` (a types-only module compiles to an empty or near-empty file).

- [ ] **Step 6: Commit**

```bash
git add package.json tsup.config.ts tests/prospect/types-entry.test.ts
git commit -m "feat(prospect): export the result type as a dependency-free subpath"
```

---

## Task 2: The JSON read endpoint

Mirrors `netlify/functions/prospect-report.mts` exactly on token handling — same validation, same 404-on-anything-odd, same `private` cache directive. It differs only in returning JSON instead of HTML. **There is no operator auth**: the 128-bit token is the credential, as it already is for `/r/:token`.

**Files:**

- Create: `reddoor-maintenance/netlify/functions/prospect-report-json.mts`
- Test: `reddoor-maintenance/tests/dashboard/prospect-report-json.test.ts`

- [ ] **Step 1: Read the route it mirrors**

Read `netlify/functions/prospect-report.mts` in full before writing. Reuse its `isValidToken` and its `getProspectAuditByToken` call rather than re-deriving them; if `isValidToken` is module-local there, lift it into `src/db/prospect-audits.ts` and import it in both places so the two routes cannot drift.

- [ ] **Step 2: Write the failing test**

Create `tests/dashboard/prospect-report-json.test.ts`:

```ts
import { describe, it, expect, afterEach, vi } from "vitest";
import type { Context } from "@netlify/functions";

vi.mock("../../src/reports/airtable/client.js", () => ({ openBase: vi.fn(() => ({})) }));

let sharedDb: unknown = null;
vi.mock("../../src/db/client.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/db/client.js")>();
  return {
    ...actual,
    openDb: vi.fn(async (cfg: Parameters<typeof actual.openDb>[0]) => {
      sharedDb ??= await actual.openDb(cfg);
      return sharedDb;
    }),
  };
});

import { openDb, readDbConfig } from "../../src/db/client.js";
import { createProspectAudit } from "../../src/db/prospect-audits.js";
import handler from "../../netlify/functions/prospect-report-json.mjs";

const ORIGINAL_ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  sharedDb = null;
});

function ctxFor(token: string) {
  return { params: { token } } as unknown as Context;
}
const req = (method = "GET") => new Request("https://ops.test/api/audit-report/x", { method });

describe("prospect-report-json", () => {
  it("returns the stored result_json for a valid token", async () => {
    process.env.TURSO_DATABASE_URL = ":memory:";
    const db = await openDb(readDbConfig());
    const { token } = await createProspectAudit(db, {
      url: "https://acme.example/",
      business: "Acme Roofing",
      resultJson: JSON.stringify({ url: "https://acme.example/", scores: { findability: 91 } }),
      status: "complete",
    });

    const res = await handler(req(), ctxFor(token));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    // The token in the URL means a shared cache must never hold this.
    expect(res.headers.get("cache-control")).toContain("private");
    const body = (await res.json()) as { scores: { findability: number } };
    expect(body.scores.findability).toBe(91);
  });

  it("404s an unknown token", async () => {
    process.env.TURSO_DATABASE_URL = ":memory:";
    await openDb(readDbConfig());
    const res = await handler(req(), ctxFor("a".repeat(22)));
    expect(res.status).toBe(404);
  });

  // A malformed token must not reach the database at all.
  it("404s a malformed token without querying", async () => {
    process.env.TURSO_DATABASE_URL = ":memory:";
    const res = await handler(req(), ctxFor("../../etc/passwd"));
    expect(res.status).toBe(404);
  });

  it("405s a non-GET", async () => {
    process.env.TURSO_DATABASE_URL = ":memory:";
    const res = await handler(req("POST"), ctxFor("a".repeat(22)));
    expect(res.status).toBe(405);
  });

  it("503s when Turso is unconfigured, and says nothing about the token", async () => {
    delete process.env.TURSO_DATABASE_URL;
    const res = await handler(req(), ctxFor("a".repeat(22)));
    expect(res.status).toBe(503);
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `pnpm exec vitest run tests/dashboard/prospect-report-json.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Write the endpoint**

Create `netlify/functions/prospect-report-json.mts`:

```ts
import type { Context, Config } from "@netlify/functions";
import { openDb, readDbConfig } from "../../src/db/client.js";
import { getProspectAuditByToken, isValidToken } from "../../src/db/prospect-audits.js";
import { handlerError } from "../../src/dashboard/handler-helpers.js";

// The JSON behind reddoorla.com/r/{token}. Deliberately NOT operator-gated:
// the 128-bit token IS the credential, exactly as it is for the HTML route in
// prospect-report.mts. Anyone holding the link is the intended audience.
//
// Turso credentials stay in this repo; the website only ever sees this JSON.
export const config: Config = {
  path: ["/api/audit-report/:token"],
  rateLimit: { windowSize: 60, windowLimit: 120, aggregateBy: ["ip"] },
};

function fail(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export default async (req: Request, ctx: Context): Promise<Response> => {
  if (req.method !== "GET") return fail(405, "method-not-allowed");

  const token = ctx.params?.token;
  // Validate BEFORE touching the database: a malformed token is a probe, and a
  // probe should cost us nothing and learn nothing.
  if (!token || !isValidToken(token)) return fail(404, "not-found");

  if (!process.env.TURSO_DATABASE_URL) {
    console.error("[prospect-report-json] TURSO_DATABASE_URL missing");
    return fail(503, "unconfigured");
  }

  try {
    const db = await openDb(readDbConfig());
    const row = await getProspectAuditByToken(db, token);
    if (!row) return fail(404, "not-found");

    // result_json is stored as text and served through untouched — parsing and
    // re-serialising here would only add a failure mode. The website validates
    // the shape against the exported type at its own boundary.
    return new Response(row.result_json, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        // `private`, never `public`: the token in the URL means a shared cache
        // holding this would hand the report to the next caller.
        "cache-control": "private, max-age=300",
      },
    });
  } catch (err) {
    return handlerError("prospect-report-json", err);
  }
};
```

- [ ] **Step 5: Run the tests**

Run: `pnpm exec vitest run tests/dashboard/prospect-report-json.test.ts`
Expected: 5 pass.

- [ ] **Step 6: Full verification and commit**

```bash
pnpm exec tsc --noEmit && pnpm exec vitest run && pnpm lint
git add netlify/functions/prospect-report-json.mts tests/dashboard/prospect-report-json.test.ts src/db/prospect-audits.ts
git commit -m "feat(prospect): serve the report JSON for a valid token"
```

---

## Task 3: The website's fetch layer

Server-only. Never import this into a `.svelte` file — it holds the ops URL and must not reach the browser.

**Files:**

- Create: `reddoor-website/src/lib/report/fetch.ts`
- Test: `reddoor-website/src/lib/report/fetch.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/report/fetch.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { fetchReport, REPORT_TOKEN_PATTERN } from "./fetch";

const OK = { url: "https://acme.example/", businessName: "Acme Roofing", scores: {} };

function fetchReturning(status: number, body: unknown) {
  return vi.fn(
    async () =>
      new Response(typeof body === "string" ? body : JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
  );
}

describe("fetchReport", () => {
  it("returns the parsed report on 200", async () => {
    const f = fetchReturning(200, OK);
    const r = await fetchReport("abc123", { baseUrl: "https://ops.test", fetch: f });
    expect(r).toEqual(OK);
    expect(f.mock.calls[0]![0]).toBe("https://ops.test/api/audit-report/abc123");
  });

  it("returns null on 404 — a bad link is not an error page", async () => {
    const r = await fetchReport("abc123", {
      baseUrl: "https://ops.test",
      fetch: fetchReturning(404, { error: "not-found" }),
    });
    expect(r).toBeNull();
  });

  // A 5xx is OUR outage, not a missing report. It must not render as "not
  // found" — that tells a prospect their report was deleted when it was not.
  it("throws on 5xx rather than pretending the report is missing", async () => {
    await expect(
      fetchReport("abc123", {
        baseUrl: "https://ops.test",
        fetch: fetchReturning(503, { error: "unconfigured" }),
      }),
    ).rejects.toThrow(/upstream/i);
  });

  it("throws when the base URL is unset, rather than fetching a relative path", async () => {
    await expect(
      fetchReport("abc123", { baseUrl: "", fetch: fetchReturning(200, OK) }),
    ).rejects.toThrow(/PROSPECT_REPORT_URL/);
  });

  it("accepts only well-formed tokens", () => {
    expect(REPORT_TOKEN_PATTERN.test("aB3-_xY9zQ1rS2tU4vW6xY")).toBe(true);
    expect(REPORT_TOKEN_PATTERN.test("../../etc/passwd")).toBe(false);
    expect(REPORT_TOKEN_PATTERN.test("short")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm exec vitest run src/lib/report/fetch.test.ts`
Expected: FAIL — cannot resolve `./fetch`.

- [ ] **Step 3: Write the module**

Create `src/lib/report/fetch.ts`:

```ts
import type { ProspectAuditResult } from "@reddoorla/maintenance/audit";

/** Base64url, the shape generateToken() produces in the maintenance repo. The
 *  route param is checked against this BEFORE any fetch, so a probe never
 *  becomes an outbound request carrying attacker-controlled path segments. */
export const REPORT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,64}$/;

export type FetchReportOptions = {
  baseUrl: string;
  fetch: typeof globalThis.fetch;
};

/**
 * Read one report from the maintenance API.
 *
 * Returns `null` ONLY for a genuine 404. Every other failure throws, because
 * the two mean opposite things to the person holding the link: "this report
 * does not exist" is final and correct, while "our ops app is down" is
 * temporary and must not be dressed up as the former.
 */
export async function fetchReport(
  token: string,
  opts: FetchReportOptions,
): Promise<ProspectAuditResult | null> {
  if (!opts.baseUrl) {
    throw new Error("fetchReport: PROSPECT_REPORT_URL is not configured");
  }
  const res = await opts.fetch(`${opts.baseUrl.replace(/\/$/, "")}/api/audit-report/${token}`);

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`fetchReport: upstream responded ${res.status}`);

  return (await res.json()) as ProspectAuditResult;
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm exec vitest run src/lib/report/fetch.test.ts`
Expected: 5 pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/report/fetch.ts src/lib/report/fetch.test.ts
git commit -m "feat(report): server-side fetch of a prospect report"
```

---

## Task 4: The route, its guards, and de-indexing

The single unrecoverable mistake in this project is letting a prospect report reach a search index. Three independent guards, because any one of them can be undone by a later edit that looks unrelated.

**Files:**

- Create: `reddoor-website/src/routes/r/[token]/+page.server.ts`
- Modify: `reddoor-website/static/robots.txt`
- Test: `reddoor-website/src/routes/r/[token]/page.server.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/routes/r/[token]/page.server.test.ts`:

Note the shape: `vitest.config.js` loads no SvelteKit plugin, so `$env` has no
resolver and **must be hand-mocked**, and the module under test is pulled in with
a dynamic `await import` after the mock is registered. This is the convention
already used by `src/routes/api/slots/server.test.ts`; a plain static import of
`./+page.server` fails to resolve `$env/dynamic/private` and the file never runs.

```ts
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("$env/dynamic/private", () => ({
  env: { PROSPECT_REPORT_URL: "https://ops.test" },
}));

const { load, prerender } = await import("./+page.server");

const report = { url: "https://acme.example/", businessName: "Acme Roofing", scores: {} };

function evt(token: string, fetchImpl: typeof globalThis.fetch) {
  return { params: { token }, fetch: fetchImpl, setHeaders: vi.fn() } as never;
}
const ok = vi.fn(async () => new Response(JSON.stringify(report), { status: 200 }));

describe("/r/[token] route guards", () => {
  // The root layout sets prerender = "auto". A per-prospect page must opt out
  // explicitly or the build tries to crawl it.
  it("opts out of prerendering", () => {
    expect(prerender).toBe(false);
  });

  it("404s a malformed token without fetching", async () => {
    const f = vi.fn();
    await expect(load(evt("../../secrets", f as never))).rejects.toMatchObject({ status: 404 });
    expect(f).not.toHaveBeenCalled();
  });

  it("tells robots not to index, on the response itself", async () => {
    const e = evt("aB3-_xY9zQ1rS2tU4vW6xY", ok);
    await load(e);
    const header = (e as unknown as { setHeaders: ReturnType<typeof vi.fn> }).setHeaders.mock
      .calls[0]![0] as Record<string, string>;
    expect(header["x-robots-tag"]).toContain("noindex");
  });
});

describe("robots.txt", () => {
  it("disallows /r/", () => {
    expect(readFileSync("static/robots.txt", "utf-8")).toMatch(/^Disallow: \/r\/$/m);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm exec vitest run src/routes/r/`
Expected: FAIL — no `+page.server.ts`.

- [ ] **Step 3: Write the loader**

Create `src/routes/r/[token]/+page.server.ts`:

```ts
import { error } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { fetchReport, REPORT_TOKEN_PATTERN } from "$lib/report/fetch";
import type { PageServerLoad } from "./$types";

// The root layout prerenders by default. This page is one prospect's private
// report behind an unguessable token — there is nothing to prerender, and a
// build-time crawl of it would be a bug.
export const prerender = false;

export const load: PageServerLoad = async ({ params, fetch, setHeaders }) => {
  // Reject before fetching: an unvalidated param would otherwise be pasted
  // straight into an outbound URL.
  if (!REPORT_TOKEN_PATTERN.test(params.token)) throw error(404, "Not found");

  // Belt and braces with robots.txt and the page's own meta tag. This one
  // travels with the response, so it survives a static-file edit that drops
  // the Disallow line.
  setHeaders({
    "x-robots-tag": "noindex, nofollow, noarchive",
    "cache-control": "private, no-store",
  });

  const report = await fetchReport(params.token, {
    baseUrl: env.PROSPECT_REPORT_URL ?? "",
    fetch,
  });
  if (!report) throw error(404, "Not found");

  return { report };
};
```

- [ ] **Step 4: Add the robots rule**

In `static/robots.txt`, after `Disallow: /dev/`:

```
Disallow: /r/
```

- [ ] **Step 5: Verify**

Run: `pnpm exec vitest run src/routes/r/`
Expected: 4 pass.

- [ ] **Step 6: Confirm the sitemap cannot pick it up**

`src/routes/sitemap.xml/+server.ts` builds from `STATIC_ROUTES` plus Prismic documents. `/r/` is neither. Confirm by reading the file — do not add an exclusion, because there is nothing to exclude; note it in the commit message so a future reader does not re-derive this.

- [ ] **Step 7: Commit**

```bash
git add src/routes/r static/robots.txt
git commit -m "feat(report): the /r/[token] route, de-indexed three ways"
```

---

## Task 5: The page

Build the design at the reference artifact using site components and tokens. No inline styles copied across — that draft was authored standalone; this is the real thing.

**Files:**

- Create: `reddoor-website/src/routes/r/[token]/+page.svelte`
- Create: `reddoor-website/src/lib/report/` components (listed in File Structure)

- [ ] **Step 1: Read the existing patterns first**

Read `src/lib/slices/Accordion/index.svelte` before writing any disclosure. It already handles `aria-expanded`, `aria-controls`, the grid-rows height transition and reduced motion. Reuse that pattern rather than writing `<details>` — the site has a house disclosure and this page should not introduce a second one.

Read `src/lib/components/ContentWidth` for the page gutter. **Do not pass `w-full` into its `class` prop** — it beats ContentWidth's own `w-[92%]` and the content runs edge-to-edge at `xl` with the overflow hidden by `body { overflow-x: clip }`.

- [ ] **Step 2: Section order**

In order, from the approved draft:

1. Verdict — eyebrow (business, URL, date), `h1`, the one-sentence answer
2. Score band — four numbers; the AI Visibility cell shows its denominator ("Named in 0 of 3"), never a bare 0
3. The three fixes, numbered, each with impact/effort badges and a suggested sentence where one exists
4. The searches, each with its own cited-domain list
5. Namesake callout — only rendered when a cited domain closely matches the business name
6. Buyer questions — the 5/3/2 summary, full table inside a disclosure
7. Technical checks — all inside disclosures, including "How we measured this"
8. The question split — quick answers vs. worth talking through
9. CTA

- [ ] **Step 3: Typography and colour**

Use the existing utilities, do not invent: `type-kicker` in `text-primary` for section labels, `type-question` for anything phrased as a question, `type-lede` for the verdict. Red `#D71920` stays scarce — section markers and the one alert number.

`muted` is `#6E6F72` and no lighter. It also lands on `.bg-paper`, where every contrast ratio drops about 0.34, and axe cannot catch it because the texture is a background-image scored as white.

If a heading's level changes for structural reasons, pin its visual size AND `font-family` with a `type-*` class — the global `h2` rule brings Besley with it.

- [ ] **Step 4: Add the meta robots tag**

In `+page.svelte`:

```svelte
<svelte:head>
  <meta name="robots" content="noindex, nofollow, noarchive" />
  <title>Can AI find {data.report.businessName ?? "your business"}?</title>
</svelte:head>
```

- [ ] **Step 5: Verify accessibility before moving on**

Run the site's a11y suite against the new route. Landmark and heading-order rules are `best-practice` tags — a WCAG-only scan reports nothing and proves nothing. Check there is exactly one `<main>` and that heading levels descend without skipping.

- [ ] **Step 6: Commit**

```bash
git add src/routes/r src/lib/report
git commit -m "feat(report): render the prospect report in the site's own language"
```

---

## Task 6: The print route

A separate design, not a stylesheet over the interactive page. Everything flat: no disclosures, no interaction, a real cover, tables laid out for paper.

**Files:**

- Create: `reddoor-website/src/routes/r/[token]/print/+page.server.ts`
- Create: `reddoor-website/src/routes/r/[token]/print/+page.svelte`

- [ ] **Step 1: The loader**

Identical to Task 3's loader — same validation, same `prerender = false`, same `x-robots-tag`. Extract the shared body into `src/lib/report/load.ts` rather than copying it, so the two routes cannot drift on the guards.

- [ ] **Step 2: The page**

Design for A4 and US Letter. Concretely:

```css
@page {
  size: A4;
  margin: 18mm 16mm;
}
```

- Cover: business name, URL, audit date, the four numbers.
- Every disclosure from the interactive page becomes a full section. **Nothing is hidden.** The whole reason the PDF is a separate design is that a leave-behind cannot have things folded away.
- `break-inside: avoid` on each fix and each search block, so none splits across a page.
- Print colours explicitly; do not rely on the browser's background-graphics setting for anything load-bearing. If a red wash carries meaning, give it a border too.
- No dark-theme blocks. This is paper.

- [ ] **Step 3: Verify by eye**

```bash
pnpm build && pnpm preview
```

Then print `/r/{token}/print` to PDF from Chrome at both A4 and Letter. Check no block splits mid-item and nothing is clipped at the right margin.

- [ ] **Step 4: Commit**

```bash
git add src/routes/r/[token]/print src/lib/report/load.ts
git commit -m "feat(report): a print-designed route for the PDF leave-behind"
```

---

## Task 7: Generate and attach the PDF

The runner already installs Playwright Chromium (step 7 of the workflow), so this adds no new toolchain.

**Files:**

- Create: `reddoor-maintenance/src/prospect/pdf.ts`
- Test: `reddoor-maintenance/tests/prospect/pdf.test.ts`
- Modify: the audit's email step to attach the PDF

- [ ] **Step 1: Write the module**

```ts
import { chromium } from "playwright";

export type PdfDeps = { launch?: typeof chromium.launch };

/**
 * Print the website's print route to a PDF buffer.
 *
 * The page must already be live — which it is, because the report route reads
 * from the API at request time rather than from a build artifact. There is no
 * deploy to wait for.
 */
export async function renderReportPdf(printUrl: string, deps: PdfDeps = {}): Promise<Buffer> {
  const launch = deps.launch ?? chromium.launch;
  const browser = await launch({ args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    // `networkidle` rather than `load`: fonts settle before we print, and a
    // fallback face in a client-facing PDF is not recoverable after the fact.
    await page.goto(printUrl, { waitUntil: "networkidle", timeout: 60_000 });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
  } finally {
    await browser.close();
  }
}
```

- [ ] **Step 2: Test with an injected launcher**

Assert: it navigates to the URL it was given; it always closes the browser, including when `goto` throws (use a rejecting stub and check `close` still ran); it passes `printBackground: true`.

- [ ] **Step 3: Wire it into the audit**

After the report persists and before the email sends, build the print URL from the same base the email's link uses and render the PDF. **A PDF failure must not fail the audit** — every other stage degrades rather than throwing, and a missing attachment is not worth losing a delivered report over. Log it, send the email with the link, and say the PDF is unavailable.

- [ ] **Step 4: Verify end to end**

Dispatch a real run and confirm the email arrives with a PDF that opens, shows every section expanded, and carries no clipped content.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(prospect): attach a print-designed PDF to the audit email"
```

---

## Task 8: Cut over

Only after Tasks 1-7 are merged and one real audit has been delivered end to end.

- [ ] **Step 1: Point the email's link at the website**

The email builds its link from `DASHBOARD_BASE_URL`. Introduce a separate `REPORT_BASE_URL` rather than repurposing that one — the dashboard and the public report are different audiences and should not share a variable.

- [ ] **Step 2: Redirect the old route**

`netlify/functions/prospect-report.mts` becomes a 301 to `https://reddoorla.com/r/{token}`. Do not delete it: links already sent must keep working, and that is the whole point of a permanent redirect.

- [ ] **Step 3: Close the SSR header gap**

`/r/[token]` is SSR, and Netlify `[[headers]]` do not apply to SSR responses — the same gap `/contact` and the 404 page already have. Add the security headers in `src/hooks.server.ts` so they cover every SSR response rather than only this route. Ship `Content-Security-Policy-Report-Only` first and read the reports before enforcing.

- [ ] **Step 4: Verify the guards on the live site**

```bash
curl -sI https://reddoorla.com/r/<token> | grep -i "x-robots-tag"
curl -s https://reddoorla.com/robots.txt | grep -i "/r/"
curl -s https://reddoorla.com/sitemap.xml | grep -c "/r/"
```

Expected: the header present; the Disallow present; **zero** matches in the sitemap.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(prospect): cut the report link over to reddoorla.com"
```

---

## Out of scope

Deliberately excluded so they do not expand this plan:

- **Issue #601** (scoring granularity, namesake as a first-class finding). The page renders whatever the JSON holds; changing what the JSON holds is that issue's job. The namesake callout in Task 5 reads the existing `competitorsSeen` data and needs nothing new.
- **Issues #598 / #599** (axe, domain checks). New sections here will need new components later; nothing in this plan blocks them.
- **Perplexity as a second engine.** Affects the copy in the "How we measured" section only.
