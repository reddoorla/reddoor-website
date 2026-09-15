# The `hide` tag makes a document staging-only — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A published Prismic document tagged `hide` renders on staging, in local dev and in a preview session, and is a 404 everywhere else, with no listing, sitemap entry, OG entry or prerender entry.

**Architecture:** `createClient()` returns a client subclass whose `buildQueryURL` appends `filter.not("document.tags", ["hide"])` to every query unless a server-only decision says hidden content is shown. The decision is a pure function of `dev`, the `PRISMIC_HIDDEN_CONTENT` env var and the preview cookie. The four hand-placed `hide` filters go away. `/health` reports the mode.

**Tech Stack:** SvelteKit 2, `@prismicio/client` 7.21, vitest (node env, `$env` hand-mocked), Playwright smoke suite on `vite dev`.

**Spec:** `docs/superpowers/specs/2026-09-14-hide-tag-staging-only-design.md`. Worktree `.worktrees/hide-tag`, branch `feat/hide-tag-staging-only` off `staging`. Every gate chained with `|| exit 1`. Commit trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

### Task 1: The repository name moves to a client-safe module

`src/routes/+layout.svelte` imports `repositoryName` from `$lib/prismicio`, which is about to import `$lib/server/*`. SvelteKit refuses that import from client code at build time.

**Files:** Create `src/lib/prismic-repo.ts`; Modify `src/routes/+layout.svelte:5`, `src/lib/prismicio.ts`.

- [ ] **Step 1:** Create `src/lib/prismic-repo.ts`:

```ts
import config from "../../slicemachine.config.json";

/**
 * The project's Prismic repository name, importable from client code (the
 * preview toolbar in the root layout needs it). `$lib/prismicio` is
 * server-only: it decides which documents a request may see.
 */
export const repositoryName: string = config.repositoryName;
```

- [ ] **Step 2:** In `src/routes/+layout.svelte` change `import { repositoryName } from "$lib/prismicio";` to `import { repositoryName } from "$lib/prismic-repo";`.
- [ ] **Step 3:** In `src/lib/prismicio.ts` replace the `config` import and the `repositoryName` export with `import { repositoryName } from "./prismic-repo"; export { repositoryName };` and keep every use.
- [ ] **Step 4:** `pnpm check` → 0 errors. Commit `refactor(prismic): the repository name has a client-safe home`.

### Task 2: The visibility decision, pure and tested

**Files:** Create `src/lib/server/content-visibility.ts`, `src/lib/server/content-visibility.test.ts`.

- [ ] **Step 1:** Failing test `src/lib/server/content-visibility.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("$app/environment", () => ({ dev: false }));
vi.mock("$env/dynamic/private", () => ({ env: {} }));

const { showsHiddenContent, HIDE_FILTER, HIDE_TAG, SHOW_HIDDEN_ENV } =
  await import("./content-visibility");

describe("showsHiddenContent", () => {
  const base = { dev: false, showHiddenEnv: undefined, previewCookie: undefined };
  it("hides by default: production, deploy previews, any build with the variable unset", () => {
    expect(showsHiddenContent(base)).toBe(false);
    expect(showsHiddenContent({ ...base, showHiddenEnv: "" })).toBe(false);
    expect(showsHiddenContent({ ...base, showHiddenEnv: "yes" })).toBe(false);
  });
  it("shows under vite dev, so the smoke suite sees every published document", () => {
    expect(showsHiddenContent({ ...base, dev: true })).toBe(true);
  });
  it(`shows when ${SHOW_HIDDEN_ENV} is exactly "show" (the staging site)`, () => {
    expect(showsHiddenContent({ ...base, showHiddenEnv: "show" })).toBe(true);
    expect(showsHiddenContent({ ...base, showHiddenEnv: " show " })).toBe(true);
  });
  it("shows inside a Prismic preview session", () => {
    expect(showsHiddenContent({ ...base, previewCookie: "1" })).toBe(true);
  });
});

it("the filter is the array form the API accepts", () => {
  expect(HIDE_TAG).toBe("hide");
  expect(HIDE_FILTER).toBe('[not(document.tags, ["hide"])]');
});
```

Run `pnpm vitest run src/lib/server/content-visibility.test.ts` → FAIL, cannot resolve `./content-visibility`.

- [ ] **Step 2:** Implement `src/lib/server/content-visibility.ts`:

```ts
import * as prismic from "@prismicio/client";
import { dev } from "$app/environment";
import { env } from "$env/dynamic/private";

/**
 * A document tagged `hide` in Prismic exists on staging and nowhere else.
 * This module decides, per process and per request, whether hidden content
 * is shown; `$lib/prismicio` turns the answer into a query filter. It lives
 * under `$lib/server` so the env read can never reach client code.
 */
export const HIDE_TAG = "hide";
/** Set to "show" on the staging site's environment; nothing else sets it. */
export const SHOW_HIDDEN_ENV = "PRISMIC_HIDDEN_CONTENT";
export const PREVIEW_COOKIE = "io.prismic.preview";
/** Appended to every query when hidden content is off. The API needs the array form. */
export const HIDE_FILTER = prismic.filter.not("document.tags", [HIDE_TAG]);

export type VisibilityInput = {
  dev: boolean;
  showHiddenEnv: string | undefined;
  previewCookie: string | undefined;
};

/** Hidden unless something says otherwise: dev, the staging variable, or a preview session. */
export function showsHiddenContent(input: VisibilityInput): boolean {
  if (input.dev) return true;
  if (input.showHiddenEnv?.trim() === "show") return true;
  return Boolean(input.previewCookie);
}

/** The live decision for this process and, given the cookie, this request. */
export function currentlyShowsHidden(previewCookie: string | undefined): boolean {
  return showsHiddenContent({ dev, showHiddenEnv: env[SHOW_HIDDEN_ENV], previewCookie });
}
```

- [ ] **Step 3:** Run the test → 5 pass. Commit `feat(prismic): decide when hidden content is shown`.

### Task 3: The client appends the filter where every query builds its URL

**Files:** Modify `src/lib/prismicio.ts`; Create `src/lib/prismicio.test.ts`.

- [ ] **Step 1:** Failing test `src/lib/prismicio.test.ts`. The repository fetch is stubbed so `buildQueryURL` never touches the network; `enableAutoPreviews` is mocked because the node test env has no SvelteKit runtime.

```ts
import * as prismic from "@prismicio/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const visibility = vi.hoisted(() => ({ show: false }));
vi.mock("@prismicio/svelte/kit", () => ({ enableAutoPreviews: () => {} }));
vi.mock("$app/environment", () => ({ dev: false }));
vi.mock("$env/dynamic/private", () => ({ env: {} }));
vi.mock("$lib/server/content-visibility", async (importOriginal) => {
  const real = await importOriginal<typeof import("$lib/server/content-visibility")>();
  return { ...real, currentlyShowsHidden: () => visibility.show };
});

const { createClient } = await import("./prismicio");

/** A fetch that answers only the repository-metadata call the URL builder makes. */
const repositoryFetch = async () =>
  new Response(JSON.stringify({ refs: [{ id: "master", ref: "test-ref", isMasterRef: true }] }), {
    headers: { "content-type": "application/json" },
  });

const ownFilter = prismic.filter.at("document.type", "project");
const hidden = '[not(document.tags, ["hide"])]';

describe("createClient", () => {
  beforeEach(() => {
    visibility.show = false;
  });

  it("appends the hide filter to a query's own filters when hidden content is off", async () => {
    const client = createClient({ fetch: repositoryFetch as typeof fetch });
    const url = decodeURIComponent(await client.buildQueryURL({ filters: [ownFilter] }));
    expect(url).toContain(ownFilter);
    expect(url).toContain(hidden);
  });

  it("appends it to a query with no filters of its own", async () => {
    const client = createClient({ fetch: repositoryFetch as typeof fetch });
    expect(decodeURIComponent(await client.buildQueryURL())).toContain(hidden);
  });

  it("sends the query untouched when hidden content is shown", async () => {
    visibility.show = true;
    const client = createClient({ fetch: repositoryFetch as typeof fetch });
    const url = decodeURIComponent(await client.buildQueryURL({ filters: [ownFilter] }));
    expect(url).toContain(ownFilter);
    expect(url).not.toContain("document.tags");
  });
});
```

Run → FAIL (the hidden filter is absent).

- [ ] **Step 2:** In `src/lib/prismicio.ts` add the import `import { currentlyShowsHidden, HIDE_FILTER, PREVIEW_COOKIE } from "$lib/server/content-visibility";` and replace `createClient` with:

```ts
/**
 * A client that appends the hide filter to every query it builds.
 *
 * This is the only seam that catches everything: every typed method
 * (`getByUID`, `getByID`, `getAllByType`, `getSingle`, …) adds its own
 * `filters` and ends in `get()`, which calls `this.buildQueryURL(params)`,
 * and `buildQueryURL` spreads the call's params over `defaultParams`, so a
 * filter set as a client default is REPLACED by any method's own. Measured
 * 2026-09-14: with only `defaultParams.filters` set, `getByUID`,
 * `getAllByType` and `getByID` all returned hidden documents.
 */
export class HiddenContentFilteredClient extends prismic.Client {
  override async buildQueryURL(
    params: Parameters<prismic.Client["buildQueryURL"]>[0] = {},
  ): Promise<string> {
    const own =
      params.filters == null
        ? []
        : Array.isArray(params.filters)
          ? params.filters
          : [params.filters];
    return super.buildQueryURL({ ...params, filters: [...own, HIDE_FILTER] });
  }
}

/**
 * Creates a Prismic client for the project's repository. A document tagged
 * `hide` is invisible to it unless this process or request shows hidden
 * content (see `$lib/server/content-visibility`): under `vite dev`, on the
 * staging site, or inside a preview session.
 */
export const createClient = ({ cookies, ...config }: CreateClientConfig = {}) => {
  const options = { routes, ...config };
  const client = currentlyShowsHidden(cookies?.get(PREVIEW_COOKIE))
    ? prismic.createClient(repositoryName, options)
    : new HiddenContentFilteredClient(repositoryName, options);

  enableAutoPreviews({ client, cookies });

  return client;
};
```

If `pnpm check` complains that the subclass loses the `AllDocumentTypes` generic (the generated `prismicio-types.d.ts` gives `prismic.createClient` that return type), declare the class as `extends prismic.Client<AllDocumentTypes>` with `import type { AllDocumentTypes } from "../../prismicio-types";` and give the return a union-free type by `as prismic.Client<AllDocumentTypes>` on the shown branch. Prefer the smallest change that keeps every call site typed as today.

- [ ] **Step 3:** Run the test → 3 pass. `pnpm check` → 0 errors. Commit `feat(prismic): a hide-tagged document is invisible unless hidden content is shown`.

### Task 4: One home for the rule

**Files:** Modify `src/routes/+layout.server.ts:49-56`, `src/routes/[[preview=preview]]/portfolio/+page.server.ts:13-19`, `src/routes/[[preview=preview]]/portfolio/[uid]/+page.server.ts:22-29`, `src/routes/sitemap.xml/+server.ts:26-33`.

- [ ] **Step 1:** Delete the `filters: [filter.not("document.tags", ["hide"])],` line from the three queries, and the now-unused `filter` import in each file (`pnpm lint` reports it). Leave `orderings` and `pageSize` as they are.
- [ ] **Step 2:** In the sitemap, replace the comment and filter above `projectPaths`:

```ts
// Hidden documents never reach here: the client filters them out of every
// query unless this deploy shows hidden content (staging), and staging's
// sitemap is never submitted anywhere.
const projectPaths = projects.filter((doc) => doc.uid);
```

- [ ] **Step 3:** `pnpm vitest run src/routes` → green (the layout test mocks the client and ignores params). `pnpm lint`, `pnpm check`. Commit `refactor: the hide filter has one home`.

### Task 5: `/health` states the mode

**Files:** Modify `src/routes/health/+server.ts`; Create `tests/smoke/health.spec.ts`.

- [ ] **Step 1:** Failing smoke test `tests/smoke/health.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("/health reports whether this deploy shows hidden content", async ({ request }) => {
  const res = await request.get("/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  // `vite dev` shows hidden content so the suite sees every published
  // document. Production answers "hidden"; the staging site answers "shown".
  expect(body.hiddenContent).toBe("shown");
});
```

- [ ] **Step 2:** In `src/routes/health/+server.ts` add `import { currentlyShowsHidden } from "$lib/server/content-visibility";` and in `GET` return `json({ ok, prismic, forms, hiddenContent: currentlyShowsHidden(undefined) ? "shown" : "hidden" })` with the comment: `// Per deploy, not per request: the cookie case is a preview session, not a mode.`
- [ ] **Step 3:** `pnpm exec playwright test tests/smoke/health.spec.ts` → 1 pass. Commit `feat(health): report whether hidden content is shown`.

### Task 6: Document the variable

**Files:** Modify `.env.example`.

- [ ] **Step 1:** Append after the `PROSPECT_EDIT_TOKEN` block:

```
# PRISMIC_HIDDEN_CONTENT
#       "show" makes a deploy render documents tagged `hide` in Prismic. Set on
#       the reddoor-staging site only. Unset (production, deploy previews) such a
#       document is a 404 and is absent from every listing, the sitemap and the
#       OG cards. `vite dev` always shows them, so the smoke suite sees every
#       published document; a Prismic preview session shows them too. A public
#       page that links to a hidden document fails the production build (a
#       prerender 404 is fatal by config), which is the intended guard.
```

- [ ] **Step 2:** Commit `docs(env): PRISMIC_HIDDEN_CONTENT`.

### Task 7: Verify

- [ ] `pnpm vitest run` all green; `pnpm lint`; `pnpm check`.
- [ ] Full smoke `pnpm exec playwright test` on a quiet machine: the `/boise` tests are green now (published, shown in dev); zero failures is the gate.
- [ ] Reproduce the build hazard: `pnpm build` with the variable unset. Expected while the medtech release is unpublished: the prerender fails on `/portfolio/strategy-advantage-website` linked from `/medtech`. Record the exact message. After Tim publishes the release: `pnpm build` green and `build/` has no `boise/index.html` and no `portfolio/strategy-advantage-website/index.html`.
- [ ] Push, PR to `staging` with the body from the spec (§7 rollout, §5 hazard, CI note).

### Task 8: Journal

- [ ] Append the entry to `docs/workJournal.md` (PR number in the heading): the tag's prior half-life as "unlisted"; the defaultParams belief and what replaced it, with the measured counts; the framing-headers coincidence (same evening, separate PR); the build hazard and the medtech link; what remains for humans. Commit `docs(journal): …`, push.
