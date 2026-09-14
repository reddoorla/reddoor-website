# Boise Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/boise`, a second `industry` landing page with the medtech funnel behind it, a `/bew` short link that tags Boise Entrepreneur Week leads, and a content pipeline where the next city is a data file and one command.

**Architecture:** No new Prismic models, slices or CRM fields. One new `industry` document (uid `boise`) rendered by the existing `[uid]` route; one new SvelteKit route (`/bew`) that 302s to it with utm tags; the medtech content scripts moved under `scripts/industry/` with a shared `migrate.mjs --industry <uid>`. Spec: `docs/superpowers/specs/2026-09-14-boise-industry-lp-design.md`.

**Tech Stack:** SvelteKit 2 + Svelte 5, Prismic (`@prismicio/client` Migration API), `sharp` for asset staging, vitest for unit tests, Playwright for smoke tests, pnpm 11 via corepack, Node 24.

---

## Before you start

- **Work in the worktree** `/Users/tuckerlemos/Documents/GitHub/reddoor-website/.worktrees/boise-lp` on branch `feat/boise-industry-lp`. Never `cd` to the main checkout to run commands; read from it only where a step names an absolute path there.
- **Secrets live only in the main checkout.** Any command that needs `PRISMIC_WRITE_TOKEN` uses `--env-file=/Users/tuckerlemos/Documents/GitHub/reddoor-website/.env.local`. Dry runs need no token.
- **Gitignored assets live only in the main checkout** at `/Users/tuckerlemos/Documents/GitHub/reddoor-website/scripts/medtech/assets/` (~11 MB, 73 files). Task 1 copies them into the worktree so the medtech dry run can prove the move broke nothing.
- **Verify, then commit.** Chain gates with `|| exit 1`, never `set -e`, and never commit in the same command as an unverified edit. `pnpm lint` and `pnpm check` are the gates besides the tests.
- **Baseline as of 2026-09-14:** `pnpm vitest run` → 46 files, 532 tests, all passing. `pnpm svelte-kit sync` has been run in the worktree.
- The Playwright suite starts its own dev server. If a run hangs or flakes, kill anything on `:5173`/`:9999` first and let it start fresh.
- Smoke tests that visit `/boise` are **red until the document is published** (Task 6). That is sequencing, not a defect; do not "fix" them by skipping.

## File map

| Path | Responsibility |
| --- | --- |
| `scripts/industry/migrate.mjs` | Shared loader (moved from `scripts/medtech/`): validates `<uid>/data.json` against the local models, stages `<uid>/assets/`, writes an unpublished draft. |
| `scripts/industry/fit-logos.mjs` | New shared helper: pads every `logo-*.png` in a city's assets to the LogoGrid box aspect. |
| `scripts/industry/README.md` | The runbook for the next city page. |
| `scripts/industry/medtech/` | Medtech's `data.json`, its four one-off helpers, its trimmed README, its (gitignored) assets. |
| `scripts/industry/boise/fetch-assets.mjs` | Boise's one-off: pulls logos from the `logo_soup` document, case-study/featured images from project docs, icons from the medtech folder, and draws the hero placeholder. |
| `scripts/industry/boise/data.json` | Every field of the Boise page. The copy Tim approves. |
| `src/lib/bew.ts`, `src/lib/bew.test.ts` | Pure redirect-target builder for `/bew` and its unit tests. |
| `src/routes/bew/+server.ts` | The `/bew` route: one call to `bewTarget`, 302. |
| `tests/smoke/bew-redirect.spec.ts` | HTTP-level assertions on the redirect. |
| `tests/smoke/pages.spec.ts`, `tests/smoke/industry-page.spec.ts`, `tests/smoke/inquiry-redirect.spec.ts` | Existing suites extended to cover `/boise`. |
| `.gitignore`, `src/lib/slices/LogoGrid/index.svelte` (comments only) | Paths that named `scripts/medtech/`. |

---

### Task 1: Move the content pipeline to `scripts/industry/` and give `migrate.mjs` an `--industry` flag

**Files:**
- Move: `scripts/medtech/` → `scripts/industry/medtech/` (all tracked files)
- Move: `scripts/industry/medtech/migrate.mjs` → `scripts/industry/migrate.mjs`
- Delete: `scripts/industry/medtech/regen-types.mjs` (superseded by `scripts/prismic/regen-types.mjs`)
- Modify: `scripts/industry/migrate.mjs` (header comment, argument parsing, paths, uid assertion, log line)
- Modify: `.gitignore:27-43`
- Modify: `src/lib/slices/LogoGrid/index.svelte:161` and `:356` (comments)
- Modify: `scripts/industry/medtech/export-assets.mjs`, `fetch-dropbox-assets.mjs`, `normalize-logos.mjs`, `stage-hr-rollovers.mjs` (usage comments only)
- Create: `scripts/industry/README.md`
- Rewrite: `scripts/industry/medtech/README.md`

- [ ] **Step 1: Move the files with git so history follows them**

```bash
cd /Users/tuckerlemos/Documents/GitHub/reddoor-website/.worktrees/boise-lp || exit 1
mkdir -p scripts/industry || exit 1
git mv scripts/medtech scripts/industry/medtech || exit 1
git mv scripts/industry/medtech/migrate.mjs scripts/industry/migrate.mjs || exit 1
git rm -q scripts/industry/medtech/regen-types.mjs || exit 1
git status --short | head -20
```

Expected: a list of `R` (renamed) entries for every tracked file under the old folder including the three `logo-*-rev.png` knockouts, and one `D` for `regen-types.mjs`.

- [ ] **Step 2: Replace the header comment and the argument/path block of `scripts/industry/migrate.mjs`**

Replace lines 1–34 (everything from the first line down to and including `const SLICES_DIR = ...`) with:

```js
// Industry landing page — content migration.
//
// Creates (or updates) one `industry` document from
// scripts/industry/<uid>/data.json, uploading the assets staged in
// scripts/industry/<uid>/assets/ alongside it. Each city or vertical is a
// folder; this script is shared. data.json's _source / _copyEdits /
// _contentGaps keys record where the copy came from and what is still missing.
//
// Behaviour
//   • Every field written is validated against the LOCAL src/lib/slices/*/model.json
//     first. A field the model doesn't declare aborts the run with a diff — model
//     drift becomes a loud failure instead of a silently malformed document.
//   • Content is staged as an UNPUBLISHED DRAFT — the Prismic Migration API never
//     auto-publishes. Review in Prismic and Publish to go live.
//   • Re-runnable: if the uid already exists the script updates it in place
//     rather than creating a duplicate.
//   • `--industry <uid>` must match data.json's `uid`, so a copied folder can
//     never overwrite the wrong document.
//
// PREREQUISITE: the slice + custom-type MODELS must be pushed to the Prismic repo
// first — migrate() validates slices against the repo's pushed models, and a write
// token cannot push models. (Already true for every slice the industry type uses.)
//
// Usage
//   node scripts/industry/migrate.mjs --industry boise --dry-run
//   node --env-file=.env.local scripts/industry/migrate.mjs --industry boise
//
// Needs PRISMIC_WRITE_TOKEN (Prismic → Settings → API & Security → Write APIs)
// for the real run only.
import * as prismic from "@prismicio/client";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ARGS = process.argv.slice(2);
const DRY_RUN = ARGS.includes("--dry-run");
const industryAt = ARGS.indexOf("--industry");
const INDUSTRY = industryAt >= 0 ? ARGS[industryAt + 1] : undefined;
if (!INDUSTRY || !/^[a-z0-9-]+$/.test(INDUSTRY)) {
  console.error("Usage: node scripts/industry/migrate.mjs --industry <uid> [--dry-run]");
  process.exit(1);
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(HERE, INDUSTRY);
const DATA_FILE = path.join(DATA_DIR, "data.json");
const ASSET_DIR = path.join(DATA_DIR, "assets");
const SLICES_DIR = path.resolve(HERE, "../../src/lib/slices");
if (!existsSync(DATA_FILE)) {
  console.error(`No such industry: ${DATA_FILE} does not exist.`);
  process.exit(1);
}
```

`SLICES_DIR`, the `customtypes/industry/index.json` path and the `slicemachine.config.json` path all use `../../` from `HERE`; `scripts/industry/` is the same depth as `scripts/medtech/` was, so those resolve unchanged.

- [ ] **Step 3: Read data.json from the industry folder and assert the uid**

In the `// ─── run ───` block, replace

```js
const d = JSON.parse(await readFile(path.join(HERE, "data.json"), "utf8"));
```

with

```js
const d = JSON.parse(await readFile(DATA_FILE, "utf8"));
if (d.uid !== INDUSTRY) {
  console.error(
    `✗ ${path.relative(process.cwd(), DATA_FILE)} has uid "${d.uid}" but --industry is "${INDUSTRY}". ` +
      "The folder name and the document uid must agree.",
  );
  process.exit(1);
}
```

and replace the log line

```js
console.log(`\nMedTech landing page → ${config.repositoryName}`);
```

with

```js
console.log(`\n${d.title} → ${config.repositoryName}`);
```

- [ ] **Step 4: Update the usage comments in the four medtech helpers**

In each of `scripts/industry/medtech/export-assets.mjs`, `fetch-dropbox-assets.mjs`, `normalize-logos.mjs`, `stage-hr-rollovers.mjs`, replace every occurrence of the string `scripts/medtech/` with `scripts/industry/medtech/`. They compute their asset path relative to their own file, so only comments change:

```bash
cd /Users/tuckerlemos/Documents/GitHub/reddoor-website/.worktrees/boise-lp || exit 1
for f in export-assets fetch-dropbox-assets normalize-logos stage-hr-rollovers; do
  sed -i '' 's#scripts/medtech/#scripts/industry/medtech/#g' "scripts/industry/medtech/$f.mjs" || exit 1
done
grep -rn 'scripts/medtech' scripts/ && echo "STALE PATHS REMAIN" || echo "scripts clean"
```

Expected: `scripts clean`.

- [ ] **Step 5: Update the two LogoGrid comments and `.gitignore`**

In `src/lib/slices/LogoGrid/index.svelte`, change `scripts/medtech/stage-hr-rollovers.mjs` (line 161) to `scripts/industry/medtech/stage-hr-rollovers.mjs` and `scripts/medtech/normalize-logos.mjs` (line 356) to `scripts/industry/medtech/normalize-logos.mjs`.

In `.gitignore`, replace the block from `# Figma-exported staging assets` through `!scripts/medtech/assets/logo-msot-rev.png` with:

```gitignore
# Staging assets for the one-shot industry content migrations — regenerate with
# each city's own fetch/export script (scripts/industry/<uid>/) rather than
# committing ~11MB per page.
# `/*` and not `/`: git cannot re-include a file whose parent DIRECTORY is
# excluded, so ignoring the contents is what makes the exceptions below work.
scripts/industry/*/assets/*

# …except these medtech hover knockouts (56KB total). Every other medtech asset
# is reproducible — export-assets.mjs re-renders the Figma frames and
# fetch-dropbox-assets.mjs re-pulls the photography — but these are not: a Figma
# node render flattens them onto the Logo Library's #404040 board and loses the
# alpha, so they were hand-derived from the raw uploads and vector layers behind
# nodes 4822:974 / 4858:446 / 4836:1261 / 4836:1226. Losing them means redoing
# that by hand. Drop these lines once the reverses exist in Dropbox
# "Logo Soup - Sales Funnel/01_client logos" alongside SA_Logo-REVERSE.png.
!scripts/industry/medtech/assets/logo-aati-rev.png
!scripts/industry/medtech/assets/logo-caltex-medical-rev.png
!scripts/industry/medtech/assets/logo-msot-rev.png
```

Verify the exceptions still bite:

```bash
cd /Users/tuckerlemos/Documents/GitHub/reddoor-website/.worktrees/boise-lp || exit 1
git check-ignore -v scripts/industry/medtech/assets/logo-msot-rev.png; echo "exit $? (1 = NOT ignored, correct)"
git check-ignore -q scripts/industry/boise/assets/anything.png && echo "boise assets ignored (correct)"
```

Expected: first line prints nothing and `exit 1`; second prints `boise assets ignored (correct)`.

- [ ] **Step 6: Write the shared runbook `scripts/industry/README.md`**

```markdown
# Industry landing pages — content load

One folder per page, one shared loader. A page is an `industry` document served
at `/<uid>` by the `[uid]` route; the type and its slices already exist, so a
new city or vertical needs **no models pushed and no code**, only content.

    scripts/industry/
      migrate.mjs          shared: validates + stages + writes an unpublished draft
      fit-logos.mjs        shared: pads logo-*.png to the LogoGrid box aspect
      <uid>/data.json      every field of the page (copy, filenames, links)
      <uid>/assets/        images the data file names (gitignored)
      <uid>/*.mjs          that page's own one-off fetch/export helpers

## Making the next page

1. Copy an existing folder: `cp -R scripts/industry/boise scripts/industry/<uid>`
   and delete its `assets/`. Set `uid`, `title`, `meta_*` and every copy field in
   `data.json`. Record where copy came from in `_source`, deviations in
   `_copyEdits`, and anything missing in `_contentGaps` — the loader prints the
   gaps on every run so they cannot be forgotten.
2. Stage assets into `<uid>/assets/` with a fetch script modelled on
   `boise/fetch-assets.mjs` (from Prismic and the project docs) or
   `medtech/export-assets.mjs` (from a Figma board). Then
   `node scripts/industry/fit-logos.mjs --industry <uid>`.
3. `node scripts/industry/migrate.mjs --industry <uid> --dry-run` — must report
   zero model mismatches and list every slice. Sends nothing.
4. `node --env-file=/path/to/.env.local scripts/industry/migrate.mjs --industry <uid>`
   loads an **unpublished draft**. Needs `PRISMIC_WRITE_TOKEN`.
5. Review the draft in Prismic (Preview works on production — the route and
   slices are already deployed). Re-run step 4 after edits; it updates in place.
6. Publish. Then confirm a production build ran: the page and its OG card
   (`/og/industry/<uid>.png`) are prerendered, so they exist only after a build
   that saw the published document.
7. Add `/<uid>` to `ROUTES` in `tests/smoke/pages.spec.ts` and to `PATHS` in
   `tests/smoke/industry-page.spec.ts`.

## Rules the loader enforces

- `--industry <uid>` must equal `data.json`'s `uid`.
- Every field is checked against `src/lib/slices/*/model.json` and
  `customtypes/industry/index.json` before any network call.
- Linked project uids must be published documents.
- Nothing is ever auto-published.

## Where the medtech assets are

The medtech staging assets are gitignored. On Tucker's machine they live in the
main checkout at `scripts/industry/medtech/assets/` (after this move; before it,
`scripts/medtech/assets/`). A fresh worktree does not have them; copy the folder
across before a medtech dry run, and before `boise/fetch-assets.mjs`, which
borrows the three framework icons and the testimonial headshot from it.
```

- [ ] **Step 7: Rewrite `scripts/industry/medtech/README.md` to the medtech-specific parts only**

```markdown
# MedTech landing page — content source

The `industry` document with uid `medtech` (served at `/medtech`), transcribed
from the Figma board **"Sales Funnel v2"** (node `4791:818` in file
`HRxyQGlQwQDEqOuRlEaZoL`). The shared loader and the runbook are one level up in
`scripts/industry/README.md`; this file covers what is particular to medtech.

## One-off helpers

| File                       | What it is                                                                                                      |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `export-assets.mjs`        | Re-exports the board's images by Figma node id into `./assets`. Node ids are durable; Figma render URLs expire. |
| `fetch-dropbox-assets.mjs` | Pulls client photography from Dropbox and derives the crops the page needs.                                      |
| `normalize-logos.mjs`      | Pads each logo so a uniform grid box reproduces the board's per-logo optical sizing (needs the board's table).  |
| `stage-hr-rollovers.mjs`   | Stages the high-resolution rollover originals over the low-res crops.                                           |

    FIGMA_PAT=… node scripts/industry/medtech/export-assets.mjs
    node scripts/industry/migrate.mjs --industry medtech --dry-run

## Open content gaps (as of 2026-09-14, all still true in production)

- **The live hero is an unlicensed iStock comp** (`hero-PLACEHOLDER-istock-comp.png`,
  iStock id 2184775810). It must be replaced with a licensed asset.
- The 8 FAQ answers did not exist in the design and loaded empty.
- No before-image for the Revogen case study; the slice hides its toggle.
- Caltex and AATI imagery / white logo variants were outstanding per the board comments.
```

- [ ] **Step 8: Copy the medtech assets into the worktree and prove the medtech dry run still passes**

```bash
cd /Users/tuckerlemos/Documents/GitHub/reddoor-website/.worktrees/boise-lp || exit 1
SRC=/Users/tuckerlemos/Documents/GitHub/reddoor-website/scripts/medtech/assets
[ -d "$SRC" ] || SRC=/Users/tuckerlemos/Documents/GitHub/reddoor-website/scripts/industry/medtech/assets
mkdir -p scripts/industry/medtech/assets || exit 1
cp -R "$SRC"/. scripts/industry/medtech/assets/ || exit 1
ls scripts/industry/medtech/assets | wc -l
node scripts/industry/migrate.mjs --industry medtech --dry-run 2>&1 | tail -25
```

Expected: about 73 files listed; the dry run prints `MedTech | Reddoor Creative → reddoor-la`, `uid: medtech`, `slices: 12`, twelve `·` lines, `models validated: OK`, the `!` content gaps, and `DRY-RUN: nothing sent.` Exit code 0. Then prove the guard:

```bash
node scripts/industry/migrate.mjs --industry nope --dry-run; echo "exit $?"
mkdir -p scripts/industry/tmpcheck && cp scripts/industry/medtech/data.json scripts/industry/tmpcheck/ && node scripts/industry/migrate.mjs --industry tmpcheck --dry-run; echo "exit $?"; rm -r scripts/industry/tmpcheck
```

Expected: `No such industry` then `exit 1`; then the uid-mismatch message (`has uid "medtech" but --industry is "tmpcheck"`) then `exit 1`.

- [ ] **Step 9: Lint, check, commit**

```bash
cd /Users/tuckerlemos/Documents/GitHub/reddoor-website/.worktrees/boise-lp || exit 1
pnpm lint || exit 1
pnpm check || exit 1
git add -A scripts .gitignore src/lib/slices/LogoGrid/index.svelte || exit 1
git status --short | grep -v '^R\|^A\|^M\|^D' && echo "UNEXPECTED ENTRIES" || true
git commit -q -F - <<'EOF'
chore(industry): move the medtech content pipeline under scripts/industry/<uid>

One shared migrate.mjs with an --industry flag, one folder per page. The
folder name must equal data.json's uid so a copied folder cannot overwrite
the wrong document. Medtech's one-off helpers move with its data and are
not generalised; regen-types.mjs is dropped because scripts/prismic/ has
its successor. The gitignore keeps the three hand-derived knockouts.

Verified: `migrate.mjs --industry medtech --dry-run` validates all twelve
slices with zero mismatches after the move.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 2: The `/bew` redirect

**Files:**
- Create: `src/lib/bew.ts`
- Create: `src/lib/bew.test.ts`
- Create: `src/routes/bew/+server.ts`
- Create: `tests/smoke/bew-redirect.spec.ts`

- [ ] **Step 1: Write the failing unit tests**

`src/lib/bew.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BEW_LANDING, BEW_UTM, bewTarget } from "./bew";

const target = (query: string) => new URL(bewTarget(new URLSearchParams(query)), "http://x");

describe("bewTarget", () => {
  it("lands on the Boise page with the event's utm set", () => {
    const to = target("");
    expect(to.pathname).toBe("/boise");
    expect(BEW_LANDING).toBe("/boise");
    expect(Object.fromEntries(to.searchParams)).toEqual({
      utm_source: "bew",
      utm_medium: "event",
      utm_campaign: "bew-2026",
    });
    expect(BEW_UTM.utm_campaign).toBe("bew-2026");
  });

  it("lets an incoming utm_* add to or override the defaults", () => {
    // Two QR codes, one route: the booth card and the closing slide differ by
    // utm_content, and a printed card that says utm_source=print wins over bew.
    const to = target("utm_content=booth-card&utm_source=print");
    expect(to.searchParams.get("utm_content")).toBe("booth-card");
    expect(to.searchParams.get("utm_source")).toBe("print");
    expect(to.searchParams.get("utm_medium")).toBe("event");
  });

  it("drops everything that is not a utm parameter", () => {
    const to = target("next=https://evil.example.com&email=pat%40example.com&utm_term=x");
    expect(to.searchParams.has("next")).toBe(false);
    expect(to.searchParams.has("email")).toBe(false);
    expect(to.searchParams.get("utm_term")).toBe("x");
  });

  it("ignores empty utm values and keeps the path fixed", () => {
    const to = target("utm_content=%20&utm_campaign=../../etc");
    expect(to.searchParams.get("utm_content")).toBeNull();
    expect(to.searchParams.get("utm_campaign")).toBe("../../etc");
    expect(to.pathname).toBe("/boise");
  });

  it("caps a utm value so a hostile link cannot bloat the CRM note", () => {
    const to = target(`utm_content=${"a".repeat(500)}`);
    expect(to.searchParams.get("utm_content")).toHaveLength(100);
  });

  it("only accepts lowercase utm_ keys, the shape GA and the CRM read", () => {
    const to = target("UTM_SOURCE=shout&utm_source=quiet&utm_9=nope");
    expect(to.searchParams.get("utm_source")).toBe("quiet");
    expect(to.searchParams.has("UTM_SOURCE")).toBe(false);
    expect(to.searchParams.has("utm_9")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/lib/bew.test.ts`
Expected: FAIL — `Failed to resolve import "./bew"`.

- [ ] **Step 3: Implement `src/lib/bew.ts`**

```ts
/**
 * The `/bew` short link: what Boise Entrepreneur Week collateral points at.
 *
 * The page is `/boise` — a durable city page — and this only decorates the hop
 * with the event's attribution, so the CRM can tell a BEW lead from a Boise
 * lead who arrived by search. The modal posts `location.href` as `sourceUrl`
 * and the server-side sync reads utm_* out of it (src/lib/ghl/client.ts), so
 * nothing here needs to know about the CRM.
 *
 * The destination path is fixed. Only utm_* parameters pass through, so the
 * route cannot be turned into an open redirect or used to carry a lead's
 * details somewhere they were not meant to go.
 */
export const BEW_LANDING = "/boise";

export const BEW_UTM = {
  utm_source: "bew",
  utm_medium: "event",
  utm_campaign: "bew-2026",
} as const;

/** GA's and the CRM's key shape: lowercase, letters only after the prefix. */
const UTM_KEY = /^utm_[a-z]+$/;
const MAX_VALUE = 100;

export function bewTarget(incoming: URLSearchParams): string {
  const params = new URLSearchParams(BEW_UTM);
  for (const [key, raw] of incoming) {
    const value = raw.trim();
    if (UTM_KEY.test(key) && value) params.set(key, value.slice(0, MAX_VALUE));
  }
  return `${BEW_LANDING}?${params.toString()}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/lib/bew.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Write the route `src/routes/bew/+server.ts`**

```ts
import { bewTarget } from "$lib/bew";
import type { RequestHandler } from "./$types";

// A static route beats the `[uid]` catch-all in SvelteKit's routing, so `/bew`
// can never be shadowed by a Prismic document. Not prerendered: the target
// varies with the incoming utm_* query, and a redirect is not a page.
export const prerender = false;

export const GET: RequestHandler = ({ url }) =>
  new Response(null, {
    status: 302,
    headers: {
      location: bewTarget(url.searchParams),
      "cache-control": "no-store",
    },
  });
```

- [ ] **Step 6: Write the smoke test `tests/smoke/bew-redirect.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

// /bew is the short link on Boise Entrepreneur Week collateral. It exists to
// attach the event's utm tags to a visit to /boise; the Location header is the
// whole contract, so these assert it at the HTTP level and never render.

async function locationOf(request: import("@playwright/test").APIRequestContext, path: string) {
  const res = await request.get(path, { maxRedirects: 0 });
  expect(res.status(), `status for ${path}`).toBe(302);
  return new URL(res.headers()["location"], "http://x");
}

test("/bew lands on /boise tagged as the event", async ({ request }) => {
  const to = await locationOf(request, "/bew");
  expect(to.pathname).toBe("/boise");
  expect(to.searchParams.get("utm_source")).toBe("bew");
  expect(to.searchParams.get("utm_medium")).toBe("event");
  expect(to.searchParams.get("utm_campaign")).toBe("bew-2026");
});

test("a collateral-specific utm_content survives the hop", async ({ request }) => {
  const to = await locationOf(request, "/bew?utm_content=booth-card");
  expect(to.searchParams.get("utm_content")).toBe("booth-card");
  expect(to.searchParams.get("utm_source")).toBe("bew");
});

test("nothing but utm parameters passes, and the path never moves", async ({ request }) => {
  const to = await locationOf(request, "/bew?next=https://evil.example.com&email=x%40y.z");
  expect(to.host).toBe("x");
  expect(to.pathname).toBe("/boise");
  expect(to.searchParams.has("next")).toBe(false);
  expect(to.searchParams.has("email")).toBe(false);
});

test("the redirect is not cached", async ({ request }) => {
  const res = await request.get("/bew", { maxRedirects: 0 });
  expect(res.headers()["cache-control"]).toContain("no-store");
});
```

- [ ] **Step 7: Run the smoke test on its own, then the gates**

```bash
cd /Users/tuckerlemos/Documents/GitHub/reddoor-website/.worktrees/boise-lp || exit 1
pnpm exec playwright test tests/smoke/bew-redirect.spec.ts 2>&1 | tail -8
pnpm lint || exit 1
pnpm check || exit 1
pnpm vitest run 2>&1 | grep -E 'Test Files|Tests '
```

Expected: `4 passed`; lint and check clean; vitest `47 passed` files / `538 passed` tests.

- [ ] **Step 8: Commit**

```bash
cd /Users/tuckerlemos/Documents/GitHub/reddoor-website/.worktrees/boise-lp || exit 1
git add src/lib/bew.ts src/lib/bew.test.ts src/routes/bew/+server.ts tests/smoke/bew-redirect.spec.ts || exit 1
git commit -q -F - <<'EOF'
feat(bew): /bew short link that lands on /boise tagged as the event

The page is the durable city page; this only attaches utm_source=bew,
utm_medium=event, utm_campaign=bew-2026 on the way in, so the CRM can tell a
Boise Entrepreneur Week lead from a Boise lead who arrived by search.
Incoming utm_* override the defaults (one route, many QR codes); nothing
else passes and the path is fixed, so it is not an open redirect. A static
route so no Prismic document can ever shadow it.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 3: Stage the Boise assets

**Files:**
- Create: `scripts/industry/fit-logos.mjs`
- Create: `scripts/industry/boise/fetch-assets.mjs`
- Create (generated, gitignored): `scripts/industry/boise/assets/*`
- Create (generated, committed): `scripts/industry/boise/assets-manifest.json`

The logos come from the site's own `logo_soup` document (12 brands, each with a colour mark, a knockout, a rollover background and a project link — the exact shape the LogoGrid slice wants). The case study and featured project images come from the published project documents. The three framework icons and the testimonial headshot exist only in the medtech staging folder. The hero is a labelled placeholder until Tim supplies a licensed photo.

- [ ] **Step 1: Write `scripts/industry/fit-logos.mjs`**

```js
// Pad every logo-*.png in a city's assets to the LogoGrid box aspect so
// object-contain paints them at a consistent optical size.
//
// The grid gives every logo the same box (300x105 CSS px — keep CANVAS in sync
// with LogoGrid/index.svelte) and lets object-contain decide, so the painted
// size is a function of whatever transparent padding the export carried. This
// trims that padding away and re-pads each mark onto a 3x canvas of the box's
// aspect, sized so the mark fills at most 72% of the width or 62% of the
// height, whichever binds. A `-rev` knockout is given the same geometry as its
// colour mark so the hover swap does not jump.
//
// medtech/normalize-logos.mjs does the same job with a per-logo table measured
// off a Figma board; this is the board-less version for pages with no design.
//
// Usage: node scripts/industry/fit-logos.mjs --industry <uid> [--check]
import sharp from "sharp";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ARGS = process.argv.slice(2);
const at = ARGS.indexOf("--industry");
const INDUSTRY = at >= 0 ? ARGS[at + 1] : undefined;
if (!INDUSTRY) {
  console.error("Usage: node scripts/industry/fit-logos.mjs --industry <uid> [--check]");
  process.exit(1);
}
const CHECK = ARGS.includes("--check");
const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), INDUSTRY, "assets");

const CANVAS = { w: 900, h: 315 };
const FILL = { w: 0.72, h: 0.62 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

const files = (await readdir(ASSETS)).filter((f) => /^logo-.*\.png$/.test(f));
const colour = files.filter((f) => !f.endsWith("-rev.png"));
let unfitted = 0;

async function fit(name, target) {
  const mark = await sharp(path.join(ASSETS, name))
    .trim()
    .resize(target.w, target.h, { fit: "inside" })
    .png()
    .toBuffer();
  const m = await sharp(mark).metadata();
  const left = Math.floor((CANVAS.w - m.width) / 2);
  const top = Math.floor((CANVAS.h - m.height) / 2);
  const out = await sharp(mark)
    .extend({
      top,
      bottom: CANVAS.h - m.height - top,
      left,
      right: CANVAS.w - m.width - left,
      background: TRANSPARENT,
    })
    .png()
    .toBuffer();
  await sharp(out).toFile(path.join(ASSETS, name));
  console.log(`✓ ${name} → ${CANVAS.w}x${CANVAS.h} (mark ${m.width}x${m.height})`);
}

for (const file of colour) {
  const twin = file.replace(/\.png$/, "-rev.png");
  const pair = files.includes(twin) ? [file, twin] : [file];

  if (CHECK) {
    for (const name of pair) {
      const meta = await sharp(path.join(ASSETS, name)).metadata();
      if (meta.width !== CANVAS.w || meta.height !== CANVAS.h) {
        unfitted++;
        console.log(`✗ ${name} is ${meta.width}x${meta.height}`);
      }
    }
    continue;
  }

  const trimmed = await sharp(path.join(ASSETS, file)).trim().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = trimmed.info;
  const scale = Math.min((FILL.w * CANVAS.w) / w, (FILL.h * CANVAS.h) / h);
  const target = { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
  for (const name of pair) await fit(name, target);
}

if (CHECK) {
  console.log(unfitted ? `${unfitted} logo(s) not fitted` : `all ${files.length} logos fitted`);
  process.exit(unfitted ? 1 : 0);
}
```

- [ ] **Step 2: Write `scripts/industry/boise/fetch-assets.mjs`**

```js
// Stage the Boise page's images from what the site already owns.
//
//   logos        the `logo_soup` document (colour mark, knockout, rollover art,
//                project link) — the marks the home and about pages already use
//   case study   the `enzos` project document
//   featured     the `blue-butterfly` project document
//   icons        the three framework SVGs, borrowed from the medtech staging
//                folder (gitignored; copy it from the main checkout first)
//   testimonial  Albert Turgon's headshot, same source — see data.json's
//                _contentGaps for why the MSOT quote stands in for now
//   hero         a labelled placeholder; a licensed Boise photo replaces it
//
// Every file lands in ./assets with the name data.json uses. Rollover art is
// also cut to the 1080x1920 portrait the LogoGrid serves below 768px, so no
// row ever falls back to Prismic's untouched top-left auto-crop.
//
// Usage: node scripts/industry/boise/fetch-assets.mjs
import * as prismic from "@prismicio/client";
import sharp from "sharp";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(HERE, "assets");
const MEDTECH_ASSETS = path.resolve(HERE, "../medtech/assets");
const config = JSON.parse(
  await readFile(path.resolve(HERE, "../../../slicemachine.config.json"), "utf8"),
);
const client = prismic.createClient(config.repositoryName);
await mkdir(ASSETS, { recursive: true });

/** imgix params off → the original bytes. */
const original = (field) => field.url.split("?")[0];
const slug = (s) =>
  s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/** SVG or PNG in → 900px-wide PNG out (fit-logos.mjs pads it afterwards). */
async function stageLogo(field, out) {
  const url = original(field);
  const buf = await download(url);
  const svg = url.endsWith(".svg");
  await sharp(buf, svg ? { density: 300 } : {})
    .resize({ width: 900, withoutEnlargement: !svg })
    .png()
    .toFile(path.join(ASSETS, out));
  return out;
}

// ── 1. logos ────────────────────────────────────────────────────────────────
const WANT = [
  "1-800-DENTIST",
  "Progress Lighting",
  "SummitTrek",
  "Worthe",
  "Zero Labs",
  "Gallery Sonder",
  "CEO of LA County",
  "St. James' Episcopal School",
  "Hearts & Minds",
];
const soup = await client.getSingle("logo_soup");
const byName = new Map(soup.data.brands.map((b) => [b.name, b]));
const manifest = [];
for (const name of WANT) {
  const b = byName.get(name);
  if (!b) throw new Error(`logo_soup has no brand named ${JSON.stringify(name)}`);
  const s = slug(name);
  const entry = { name, file: await stageLogo(b.logo_color, `logo-${s}.png`) };
  if (prismic.isFilled.image(b.logo_negative)) {
    entry.negative = await stageLogo(b.logo_negative, `logo-${s}-rev.png`);
  }
  if (prismic.isFilled.image(b.active_background)) {
    const art = await download(original(b.active_background));
    entry.rollover = `rollover-${s}.jpg`;
    await sharp(art)
      .resize({ width: 3840, withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toFile(path.join(ASSETS, entry.rollover));
    entry.rolloverMobile = `rollover-${s}-mobile.jpg`;
    await sharp(art)
      .resize(1080, 1920, { fit: "cover", position: "attention" })
      .jpeg({ quality: 82 })
      .toFile(path.join(ASSETS, entry.rolloverMobile));
  }
  entry.project = prismic.isFilled.contentRelationship(b.project_link) ? b.project_link.uid : null;
  manifest.push(entry);
  console.log(`✓ ${name} → ${entry.file}${entry.rollover ? " + rollover" : ""}`);
}

// ── 2. case study + featured project ────────────────────────────────────────
async function stageFromProject(uid, wants) {
  const doc = await client.getByUID("project", uid);
  const images = [];
  const scan = (o) => {
    if (!o || typeof o !== "object") return;
    if (o.url && o.dimensions) images.push(o);
    else Object.values(o).forEach(scan);
  };
  scan(doc.data.hero);
  for (const s of doc.data.slices) {
    scan(s.primary);
    (s.items ?? []).forEach(scan);
  }
  for (const [suffix, out] of wants) {
    const img = images.find((i) => original(i).endsWith(suffix));
    if (!img) throw new Error(`${uid}: no image ending in ${suffix}`);
    const resized = sharp(await download(original(img))).resize({
      width: 2880,
      withoutEnlargement: true,
    });
    const encoded = out.endsWith(".png") ? resized.png() : resized.jpeg({ quality: 85 });
    await encoded.toFile(path.join(ASSETS, out));
    console.log(`✓ ${uid}: ${suffix} → ${out}`);
  }
}
await stageFromProject("enzos", [
  ["_broncoHero.jpg", "enzos-after-1-hero.jpg"],
  ["_ENZ_mbroideredmockup.png", "enzos-after-2-embroidered.png"],
  ["_Enzo-Branding_Guide61.png", "enzos-after-3-brand-guide.png"],
]);
await stageFromProject("blue-butterfly", [["_bb2.jpg", "blue-butterfly-mugs.jpg"]]);

// ── 3. shared studio art from the medtech staging folder ────────────────────
for (const f of [
  "icon-diagnosis-audit.svg",
  "icon-rebuild.svg",
  "icon-rollout-launch.svg",
  "testimonial-albert-turgon.png",
]) {
  const src = path.join(MEDTECH_ASSETS, f);
  if (!existsSync(src)) {
    throw new Error(`missing ${src} — copy the medtech assets from the main checkout first (scripts/industry/README.md)`);
  }
  await copyFile(src, path.join(ASSETS, f));
}
console.log("✓ framework icons + testimonial headshot copied from medtech/assets");

// ── 4. hero placeholder ─────────────────────────────────────────────────────
const W = 3058;
const H = 1720;
const label = Buffer.from(
  `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` +
    `<rect width="100%" height="100%" fill="#e6e6e6"/>` +
    `<text x="50%" y="47%" font-family="Helvetica, Arial, sans-serif" font-size="140" font-weight="700" fill="#8a8a8a" text-anchor="middle">HERO PLACEHOLDER</text>` +
    `<text x="50%" y="58%" font-family="Helvetica, Arial, sans-serif" font-size="72" fill="#8a8a8a" text-anchor="middle">Licensed Boise photo needed before publish</text>` +
    `</svg>`,
);
await sharp(label).png().toFile(path.join(ASSETS, "hero-PLACEHOLDER-licensed-boise-photo-needed.png"));
console.log("✓ hero placeholder drawn");

await writeFile(path.join(HERE, "assets-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`\nstaged ${manifest.length} logos, 4 project images, 4 shared files and the hero into ${path.relative(process.cwd(), ASSETS)}`);
```

- [ ] **Step 3: Run the fetch, then fit the logos**

```bash
cd /Users/tuckerlemos/Documents/GitHub/reddoor-website/.worktrees/boise-lp || exit 1
node scripts/industry/boise/fetch-assets.mjs || exit 1
node scripts/industry/fit-logos.mjs --industry boise || exit 1
node scripts/industry/fit-logos.mjs --industry boise --check || exit 1
ls scripts/industry/boise/assets | wc -l
sips -g pixelWidth -g pixelHeight scripts/industry/boise/assets/rollover-worthe-mobile.jpg | tail -2
```

Expected: nine `✓ <brand>` lines each with `+ rollover`, four project-image lines, the icons line, the hero line; `fit-logos` prints eighteen `✓ logo-… → 900x315` lines then `all 18 logos fitted`; the asset count is **45** (9 marks + 9 knockouts + 9 rollovers + 9 mobile crops + 4 project images + 3 icons + 1 headshot + 1 hero); the mobile crop reads `pixelWidth: 1080` / `pixelHeight: 1920`.

If a brand name in `WANT` no longer matches the `logo_soup` document, the script names it; fix the name, do not guess a substitute.

- [ ] **Step 4: Eyeball the fitted logos and the placeholder**

Open `scripts/industry/boise/assets/` in Finder (`open scripts/industry/boise/assets`) and check: every `logo-*.png` is a mark centred on a transparent 900x315 canvas; the `-rev` twins are white/knockout marks; `hero-PLACEHOLDER-…png` reads its own label. If a mark trimmed to nothing (a fully opaque background), the `fit-logos` line shows a `mark 900x315`; that brand needs a transparent source and is a content gap, not a code fix.

- [ ] **Step 5: Lint and commit the scripts and the manifest**

```bash
cd /Users/tuckerlemos/Documents/GitHub/reddoor-website/.worktrees/boise-lp || exit 1
pnpm lint || exit 1
git status --short scripts/industry/boise
git add scripts/industry/fit-logos.mjs scripts/industry/boise/fetch-assets.mjs scripts/industry/boise/assets-manifest.json || exit 1
git commit -q -F - <<'EOF'
feat(industry): stage the Boise page assets from what the site already owns

Logos come from the logo_soup document (mark, knockout, rollover art and
project link — the LogoGrid's exact shape), the case study and featured
project from their project documents, the framework icons and headshot
from the medtech staging folder. Rollover art is also cut to the
1080x1920 portrait the grid serves on phones so no row falls back to the
top-left auto-crop the smoke suite forbids.

fit-logos.mjs is the board-less sibling of medtech/normalize-logos.mjs:
trim, then pad onto a 900x315 canvas so object-contain paints every mark
at a consistent size. The hero is a labelled placeholder until a licensed
Boise photo exists.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

`git status` must show nothing under `scripts/industry/boise/assets/` (ignored). If it shows files there, Task 1 Step 5 went wrong; fix `.gitignore` before committing.

---

### Task 4: Write the Boise page — `scripts/industry/boise/data.json`

**Files:**
- Create: `scripts/industry/boise/data.json`

This is the copy Tim approves. It mirrors the medtech file's keys exactly, because `migrate.mjs` reads those keys. The positioning is spec §4.2; the framework step names and the CTA label are shared vocabulary with `/medtech` on purpose.

- [ ] **Step 1: Write the file**

```json
{
  "_source": "No design board. Drafted 2026-09-14 by Claude from the positioning in docs/superpowers/specs/2026-09-14-boise-industry-lp-design.md §4.2, mirroring the /medtech slice sequence and voice. Every field is pending Tim's approval; record his edits in _copyEdits, dated.",
  "_copyEdits": [],
  "_contentGaps": [
    "hero.image is a LABELLED PLACEHOLDER. Tim supplies a licensed, Boise-legible photo (skyline, foothills, a downtown storefront) before publish.",
    "testimonial is Albert Turgon's real MSOT quote, reused from /medtech because no local-scale client quote exists yet. Swap for a Boise-scale client (name, role, headshot) when Tim has one.",
    "caseStudy has no before image, so the slice hides its before/after toggle. If a photo of Enzo's pre-rebrand signage or collateral exists, add it as beforeImage.",
    "faq[1] (pricing) describes a full engagement as 'a five-figure investment'. The modal's fifth question gates at $10,000+. Erik owns the pricing language; confirm or reword.",
    "about.body and faq[4] say a founder is in Boise. Confirm Tim's title and that this is how he wants it said.",
    "logoGrid uses nine marks from the site's logo_soup document. If Tim wants Boise-scale brands in the grid instead of the national tier, they need logo files — the grid has none for Blue Butterfly, Herbst or Enzo's."
  ],
  "uid": "boise",
  "_titleNote": "`title` is the browser/tab title (the layout renders it as <title>) and the text on the generated OG card, with '| Reddoor Creative' stripped. meta_title is what search shows.",
  "title": "Boise | Reddoor Creative",
  "meta_title": "Boise Brand Strategy & Design Studio | Reddoor Creative",
  "meta_description": "Reddoor is a senior brand and web studio with a founder in Boise. Twenty years, 300+ companies, and a process that takes Idaho businesses from overlooked to unmistakable.",
  "hero": {
    "headline": "We'll Take Your \nBoise Business from Overlooked to Unmistakable",
    "cardLabel": "Brand-Credibility Framework",
    "cardBody": "Our framework means customers trust you before they've met you. We diagnose what's holding your brand back, rebuild it, and roll it out across every touchpoint — with a senior team and a founder right here in Boise.",
    "image": "hero-PLACEHOLDER-licensed-boise-photo-needed.png",
    "imageAlt": "Placeholder: a licensed photo of Boise is still to come",
    "buttons": [{ "label": "Get Started", "url": "/contact#inquire" }]
  },
  "services": {
    "eyebrow": "What we do for you:",
    "lead": "Big-League Branding, Built in Boise",
    "subBody": "We handle everything, from diagnosing the problem, to rebuilding the brand system, then designing and deploying every deliverable. You keep running the business while we build a brand your customers trust on sight.",
    "columns": [
      {
        "title": "Brand Identity",
        "items": ["Brand Strategy", "Brand Positioning", "Brand Design", "Copywriting"]
      },
      {
        "title": "Digital Presence",
        "items": [
          "Website Design",
          "Website Development",
          "AEO/SEO Development",
          "AEO/SEO Deployment"
        ]
      },
      {
        "title": "Design System",
        "items": [
          "Signage & Environmental",
          "Print & Collateral",
          "Packaging Design",
          "Social & Campaign Templates"
        ]
      }
    ]
  },
  "framework": {
    "eyebrow": "How We Do It: Brand Credibility Framework",
    "lead": "Instant credibility with customers doesn't happen instantly. It takes a tried and true process — the one we've been running for 20 years.",
    "columns": [
      {
        "icon": "icon-diagnosis-audit.svg",
        "iconAlt": "",
        "title": "The Diagnosis:",
        "subtitle": "Friction Audit",
        "body": "We audit everything a customer sees — your site, your signage, your socials — and stack it against the competition to pinpoint where trust leaks out. You get a prioritized plan to fix it before it costs another customer."
      },
      {
        "icon": "icon-rebuild.svg",
        "iconAlt": "",
        "title": "The Rebuild:",
        "subtitle": "Closing the Trust Gap",
        "body": "We rebuild the brand system from strategy to identity: positioning, messaging, mark, type and color, so every piece says the same thing about you, and says it well."
      },
      {
        "icon": "icon-rollout-launch.svg",
        "iconAlt": "",
        "title": "The Rollout:",
        "subtitle": "Deploy Touch Points",
        "body": "We design and deploy every deliverable — website, signage, print, packaging, templates — so the new brand shows up everywhere at once, not one piece at a time."
      }
    ]
  },
  "caseStudy": {
    "label": "Case Study",
    "projectName": "Enzo's Hand Wash & Detail",
    "services": "Brand, Print, Environmental, Digital",
    "heading": "Giving a hand-wash and detail shop a brand as obsessive as its work.",
    "afterImage": "enzos-after-1-hero.jpg",
    "afterImageAlt": "The new Enzo's Hand Wash & Detail brand on a vehicle at the shop",
    "afterSlides": [
      {
        "file": "enzos-after-2-embroidered.png",
        "alt": "The Enzo's logo embroidered on a work shirt"
      },
      {
        "file": "enzos-after-3-brand-guide.png",
        "alt": "A spread from the Enzo's brand guide"
      }
    ]
  },
  "logoGrid": {
    "label": "Clients: Join these brands in building trust",
    "buttonLabel": "Our Work",
    "buttonUrl": "/portfolio",
    "logos": [
      {
        "name": "Progress Lighting",
        "file": "logo-progress-lighting.png",
        "negative": "logo-progress-lighting-rev.png",
        "project": "progress-lighting",
        "rollover": "rollover-progress-lighting.jpg",
        "rolloverMobile": "rollover-progress-lighting-mobile.jpg"
      },
      {
        "name": "1-800-DENTIST",
        "file": "logo-1-800-dentist.png",
        "negative": "logo-1-800-dentist-rev.png",
        "project": "1-800-dentist",
        "rollover": "rollover-1-800-dentist.jpg",
        "rolloverMobile": "rollover-1-800-dentist-mobile.jpg"
      },
      {
        "name": "Zero Labs",
        "file": "logo-zero-labs.png",
        "negative": "logo-zero-labs-rev.png",
        "project": "rubrik-zero-labs",
        "rollover": "rollover-zero-labs.jpg",
        "rolloverMobile": "rollover-zero-labs-mobile.jpg"
      },
      {
        "name": "Worthe",
        "file": "logo-worthe.png",
        "negative": "logo-worthe-rev.png",
        "project": "worthe",
        "rollover": "rollover-worthe.jpg",
        "rolloverMobile": "rollover-worthe-mobile.jpg"
      },
      {
        "name": "CEO of LA County",
        "file": "logo-ceo-of-la-county.png",
        "negative": "logo-ceo-of-la-county-rev.png",
        "project": "ceo-la",
        "rollover": "rollover-ceo-of-la-county.jpg",
        "rolloverMobile": "rollover-ceo-of-la-county-mobile.jpg"
      },
      {
        "name": "SummitTrek",
        "file": "logo-summittrek.png",
        "negative": "logo-summittrek-rev.png",
        "project": "summittrek",
        "rollover": "rollover-summittrek.jpg",
        "rolloverMobile": "rollover-summittrek-mobile.jpg"
      },
      {
        "name": "Gallery Sonder",
        "file": "logo-gallery-sonder.png",
        "negative": "logo-gallery-sonder-rev.png",
        "project": "gallery-sonder",
        "rollover": "rollover-gallery-sonder.jpg",
        "rolloverMobile": "rollover-gallery-sonder-mobile.jpg"
      },
      {
        "name": "St. James' Episcopal School",
        "file": "logo-st-james-episcopal-school.png",
        "negative": "logo-st-james-episcopal-school-rev.png",
        "project": "st-james-episcopal-school",
        "rollover": "rollover-st-james-episcopal-school.jpg",
        "rolloverMobile": "rollover-st-james-episcopal-school-mobile.jpg"
      },
      {
        "name": "Hearts & Minds",
        "file": "logo-hearts-and-minds.png",
        "negative": "logo-hearts-and-minds-rev.png",
        "project": "hearts-and-minds",
        "rollover": "rollover-hearts-and-minds.jpg",
        "rolloverMobile": "rollover-hearts-and-minds-mobile.jpg"
      }
    ]
  },
  "testimonial": {
    "label": "What clients are saying:",
    "quote": "We needed to look credible against the biggest players in our industry. While I know what I like, I had no idea how to get our brand there. That's where Reddoor came in, their branding and web work took MSOT to the next level, putting us in position to win multi-million government supply contracts.",
    "name": "Albert Turgon",
    "role": "COO of MSOT (Medical Solutions of Texas)",
    "avatar": "testimonial-albert-turgon.png",
    "avatarAlt": "Albert Turgon"
  },
  "featuredProject": {
    "title": "Blue Butterfly",
    "services": "brand, print, environmental",
    "image": "blue-butterfly-mugs.jpg",
    "imageAlt": "Branded Blue Butterfly coffee mugs, upside down on the counter",
    "link": { "type": "project", "uid": "blue-butterfly" },
    "hasTextureBleed": true
  },
  "about": {
    "displayTitle": "On Your Behalf",
    "eyebrow": "About Us",
    "lede": "Reddoor's been at this for 20 years. In that time we've helped more than 300 companies stand out, and we've never gotten comfortable with work that's merely \"fine.\" Clarity beats clever, every time.",
    "body": [
      "We're a nimble senior team with people in Boise, Los Angeles, and San Antonio, and we've stayed that way on purpose. The people you meet in the first conversation are the people building your brand. Nothing gets handed down. In Boise, that first conversation happens across a table, not a screen.",
      "We care about your company and about the people inside it who actually use what we make. That's why every decision ties back to an outcome you can name: more of the right customers, a team that's proud of the sign out front, a website that does the selling when you can't."
    ],
    "readMoreLabel": "Read More +"
  },
  "faq": {
    "label": "Frequently Asked Questions",
    "questions": [
      {
        "q": "We need more customers, not a new logo. How does branding actually help?",
        "a": [
          "A logo by itself won't do much. What brings in the right customers is removing every reason they have to hesitate: a site that looks ten years old, signage that doesn't match the storefront, a pitch that changes depending on who's telling it. Fix those and the people who were already interested stop drifting to a competitor who simply looked more put-together.",
          "That's what the Diagnosis is for. We find the specific places trust leaks out, in priority order, so the money goes where it moves the needle."
        ]
      },
      {
        "q": "How does pricing work?",
        "a": [
          "Every phase is scoped and priced before it starts, so there's no meter running. A full rebrand through all three phases is a five-figure investment. The Diagnosis on its own is a much smaller first step, and it tells you exactly what the Rebuild and Rollout would involve for your business."
        ]
      },
      {
        "q": "We're a small, local business. Are we too small for you?",
        "a": [
          "No. Some of the work we're proudest of is for a neighborhood coffee shop, a veterinary hospital, and a hand-wash and detail shop. What matters is that you're serious about the brand carrying the business, not the size of the team behind it.",
          "The same process we run for national companies scales down cleanly. The phases stay the same; the deliverables get scoped to what you'll actually use."
        ]
      },
      {
        "q": "Do you only work with healthcare and tech companies?",
        "a": [
          "No. Over 20 years we've worked across real estate, hospitality, coffee shops, schools, nonprofits, professional services, consumer products and government. Healthcare and technology are where a lot of our recent work sits, but the framework is about how customers decide to trust you, and that doesn't change by industry."
        ]
      },
      {
        "q": "Can we meet in person in Boise?",
        "a": [
          "Yes. One of our founders is in Boise, and the first conversation is usually across a table. The wider team is in Los Angeles and San Antonio, and everyone you meet at the start is someone who does the work."
        ]
      },
      {
        "q": "Will a rebrand confuse the customers we already have?",
        "a": [
          "Not if it's done in the right order. The Diagnosis tells us which parts of the brand are carrying equity and which are holding you back, so the Rebuild keeps what people recognize and fixes what they don't notice until it's gone. The Rollout then changes everything at once, so there's never a months-long stretch where the old brand and the new one fight each other."
        ]
      },
      {
        "q": "Why not use a local freelancer, or do it in-house?",
        "a": [
          "A freelancer can give you a good logo. What's hard to get piecemeal is one system, strategy through identity, website, signage and print, that all says the same thing, built by people who have done it hundreds of times and will still be here next year. That's what you're paying for.",
          "If you have a strong in-house designer, great. We'll build the system and the guidelines so they can run it."
        ]
      },
      {
        "q": "How do we get started?",
        "a": [
          "Hit Get Started and answer five short questions. If it looks like a fit, you'll book a call with a founder, not a sales rep, and we'll talk through what a Diagnosis would look like for your business."
        ]
      }
    ]
  },
  "cta": {
    "heading": "Ready for your business to go from overlooked to unmistakable, right here in Boise?",
    "buttonLabel": "Talk with a founder",
    "buttonUrl": "/contact#inquire",
    "background": "paper-red"
  }
}
```

- [ ] **Step 2: Dry-run the migration**

```bash
cd /Users/tuckerlemos/Documents/GitHub/reddoor-website/.worktrees/boise-lp || exit 1
node scripts/industry/migrate.mjs --industry boise --dry-run 2>&1 | tail -30
```

Expected: `Boise | Reddoor Creative → reddoor-la`, `uid: boise`, `slices: 12`, the twelve slice lines in the medtech order, `linked projects:` listing the nine grid brands' uids plus `blue-butterfly`, `models validated: OK`, six `!` gap lines, `DRY-RUN: nothing sent.` Exit 0.

If it reports `asset not found`, the filename in `data.json` and the name `fetch-assets.mjs` wrote disagree; fix the one that is wrong (`assets-manifest.json` is the record of what was written). If it reports a model mismatch, a slice model changed since medtech; do not edit the model, read the diff.

- [ ] **Step 3: Check the JSON against the spec's voice rules**

Read every string once more for: no claim the portfolio cannot back (the coffee shop, veterinary hospital and detail shop in faq[2] are Blue Butterfly, Herbst Veterinary and Enzo's, all published projects; every industry in faq[3] has at least one published project); framework step titles exactly `The Diagnosis:`, `The Rebuild:`, `The Rollout:`; CTA label exactly `Talk with a founder`; no sentence that promises a result (leads, revenue, rankings).

- [ ] **Step 4: Format and commit**

```bash
cd /Users/tuckerlemos/Documents/GitHub/reddoor-website/.worktrees/boise-lp || exit 1
pnpm exec prettier --write scripts/industry/boise/data.json || exit 1
node scripts/industry/migrate.mjs --industry boise --dry-run >/dev/null 2>&1 || { echo "dry run broke after format"; exit 1; }
git add scripts/industry/boise/data.json || exit 1
git commit -q -F - <<'EOF'
feat(industry): the Boise landing page copy, drafted for Tim's approval

Same twelve slices as /medtech, same framework vocabulary (the modal's
step attribution and the CTA label are shared), the pitch translated from
procurement to a local market: national-calibre brand work from a senior
team with a founder in Boise, for owners ready to invest in the brand.

Everything unresolved is in _contentGaps and printed on every load: the
hero is a labelled placeholder, the testimonial is MSOT's real quote
standing in, the case study has no before image, the pricing sentence
and the founder-in-Boise phrasing need Tim's and Erik's sign-off.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 5: Load the unpublished draft to Prismic

**Files:** none changed. This task writes to Prismic (an unpublished draft, reversible, visible only in the Prismic UI). Run it only after Task 4's dry run is clean.

- [ ] **Step 1: Confirm nothing is already there**

```bash
cd /Users/tuckerlemos/Documents/GitHub/reddoor-website/.worktrees/boise-lp || exit 1
node -e '
const {createClient}=require("@prismicio/client");
createClient(require("./slicemachine.config.json").repositoryName).getByUID("industry","boise")
  .then(d=>console.log("EXISTS (published):",d.id)).catch(e=>console.log("not published:",e.constructor.name))'
```

Expected: `not published: NotFoundError`. (An unpublished draft is invisible here either way; the loader updates in place if one exists.)

- [ ] **Step 2: Load the draft**

```bash
cd /Users/tuckerlemos/Documents/GitHub/reddoor-website/.worktrees/boise-lp || exit 1
node --env-file=/Users/tuckerlemos/Documents/GitHub/reddoor-website/.env.local scripts/industry/migrate.mjs --industry boise 2>&1 | tail -25
```

Expected: the same summary as the dry run, then `Creating new document…`, `…documents written`, and `✓ Staged as an unpublished draft. Review in Prismic and Publish to go live.` A second run later (after copy edits) prints `Updating existing document…` instead.

If it fails with `Validation failed`, the printed `e.response` names the field path; the fix is in `data.json`, never in a model.

- [ ] **Step 3: Verify in Prismic and hand it to Tim**

In Prismic (repo `reddoor-la`), open Documents → Industry → the `boise` draft. Check: 12 slices in order, the Inquiry tab's five fields empty, the SEO tab's `meta_image` empty. Click **Preview**; the page renders on production through the `[uid]` route with every slice, the hero showing the grey placeholder. Send Tim the preview link plus the six `_contentGaps` lines as his checklist.

Nothing is published in this task.

---

### Task 6: Cover `/boise` in the smoke suites

**Files:**
- Modify: `tests/smoke/pages.spec.ts:39`
- Modify: `tests/smoke/industry-page.spec.ts:1-160`
- Modify: `tests/smoke/inquiry-redirect.spec.ts` (append one test)

These pass only once the `boise` document is **published** (the dev server reads Prismic's published ref). Write them now; they are the PR's proof at launch.

- [ ] **Step 1: `pages.spec.ts` — add the route**

Replace

```ts
// "/medtech" is an `industry` document, not a `page` — it exercises the
// page→industry fallback in the [uid] route.
const ROUTES = ["/", "/about", "/portfolio", "/twenty-for-twenty", "/contact", "/medtech"];
```

with

```ts
// "/medtech" and "/boise" are `industry` documents, not `page`s — they exercise
// the page→industry fallback in the [uid] route, and two of them prove the
// route is not special-casing the first.
const ROUTES = ["/", "/about", "/portfolio", "/twenty-for-twenty", "/contact", "/medtech", "/boise"];
```

- [ ] **Step 2: `industry-page.spec.ts` — run the document-agnostic tests over both pages**

Replace the constant

```ts
const PATH = "/medtech";
```

with

```ts
// Every industry document renders the same twelve slices through the same
// grid, so the composition checks run over each of them. The framework
// numeral checks further down are about the medtech copy and stay on it.
const PATHS = ["/medtech", "/boise"] as const;
const PATH = PATHS[0];
```

Then wrap the six tests that follow (`has no axe violations` for each viewport, `renders every slice in the document, in order`, `has exactly one h1 and no heading-level jumps`, `never serves an untouched auto-crop as the phone backdrop`, `ends on its own CTA slice, not the marketing footer CTA`, `renders the framework as a numbered list, not icons`) in one loop, leaving their bodies byte-for-byte unchanged apart from the shadowed name:

```ts
for (const PATH of PATHS) {
  for (const vp of VIEWPORTS) {
    test(`${PATH} has no axe violations (${vp.name})`, async ({ page }) => {
      // …unchanged body…
    });
  }

  test(`${PATH} renders every slice in the document, in order`, async ({ page }) => {
    // …unchanged body…
  });

  test(`${PATH} has exactly one h1 and no heading-level jumps`, async ({ page }) => {
    // …unchanged body…
  });

  test(`${PATH} never serves an untouched auto-crop as the phone backdrop`, async ({ page }) => {
    // …unchanged body…
  });

  test(`${PATH} ends on its own CTA slice, not the marketing footer CTA`, async ({ page }) => {
    // …unchanged body…
  });

  test(`${PATH} renders the framework as a numbered list, not icons`, async ({ page }) => {
    // …unchanged body…
  });
}
```

Everything after that loop (the `step numerals` describe block and anything else that reads `PATH`) keeps using the module-level `const PATH = PATHS[0]` and is not wrapped. The comment above the slice list inside the loop — "Mirrors the slice zone of the published `medtech` document" — becomes "Mirrors the slice zone every industry document is built with; boise was loaded to the same sequence on purpose."

Run `pnpm check`; the shadowed `PATH` inside the loop is legal and intentional, but if eslint's `no-shadow` is on, rename the loop variable to `path` and the six template strings to `${path}` instead.

- [ ] **Step 3: `inquiry-redirect.spec.ts` — the funnel case that motivated the CRM edit**

Append after the `an explicit funnel is honoured when it names a live industry` test:

```ts
test("a second industry routes on its own funnel, not medtech's", async ({ request }) => {
  // The A-102-1 chase message must send `&funnel={{contact.funnel}}` for this
  // to matter in production; without it every abandoned lead, Boise included,
  // is chased back to /medtech. This is the code half of that fix.
  const to = await locationOf(request, `/inquiry?${LEAD}&funnel=boise`);
  expect(to.pathname).toBe("/boise");
  expect(to.searchParams.get("email")).toBe("pat@example.com");
});
```

- [ ] **Step 4: Run the three suites and read the failures**

```bash
cd /Users/tuckerlemos/Documents/GitHub/reddoor-website/.worktrees/boise-lp || exit 1
pnpm check || exit 1
pnpm lint || exit 1
pnpm exec playwright test tests/smoke/pages.spec.ts tests/smoke/industry-page.spec.ts tests/smoke/inquiry-redirect.spec.ts 2>&1 | tail -30
```

Expected **before publish**: every `/medtech` test passes; every `/boise` test fails with a 404 or an empty slice list; `a second industry routes on its own funnel` fails with `/medtech` (the redirect validates against published documents). Any `/medtech` failure is a real regression from the loop rewrite; fix it before committing.

Expected **after publish**: all green.

- [ ] **Step 5: Commit**

```bash
cd /Users/tuckerlemos/Documents/GitHub/reddoor-website/.worktrees/boise-lp || exit 1
git add tests/smoke/pages.spec.ts tests/smoke/industry-page.spec.ts tests/smoke/inquiry-redirect.spec.ts || exit 1
git commit -q -F - <<'EOF'
test(smoke): cover /boise as the second industry page

The composition checks in industry-page.spec now run over every industry
document, so the route and the grid are proven not to special-case the
first one. pages.spec loads /boise; inquiry-redirect asserts a boise
funnel routes to /boise. These are red until the boise document is
published — the dev server reads the published ref — and go green with
no code change the moment it is.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
git push -u origin feat/boise-industry-lp
```

---

### Task 7: Launch checklist, event kit, journal, PR

**Files:**
- Modify: `docs/superpowers/specs/2026-09-14-boise-industry-lp-design.md` (two amendments)
- Modify: `docs/workJournal.md` (append)
- Create (outside the repo): `~/Desktop/reddoor-bew-qr-booth-card.png`, `~/Desktop/reddoor-bew-qr-slide.png`, `~/Desktop/reddoor-bew-links.txt`

- [ ] **Step 1: Amend the spec for what the plan learned**

In §4.2, replace the shortlist table's first two rows' *Shortlist* cells with the actual picks: Case study → `Enzo's Hand Wash & Detail` (hero + two after slides, no before); Featured project → `Blue Butterfly` (the mugs photo). In §4.4, add after the `.gitignore` bullet:

```markdown
- Two small shared helpers were added rather than generalising medtech's:
  `scripts/industry/fit-logos.mjs` (board-less logo padding to the grid box)
  and the pattern `scripts/industry/<uid>/fetch-assets.mjs` (stage from Prismic
  and the project docs). Boise's logos come from the site's own `logo_soup`
  document, which already holds mark, knockout, rollover art and project link
  for twelve brands.
```

Commit: `docs(spec): record the asset sources and the case-study picks`.

- [ ] **Step 2: The CRM edit (Tucker, by hand or CDP)**

In the GHL workflow builder, A-102-1's chase message: append `&funnel={{contact.funnel}}` to the `{{custom_values.sub_domain_url}}/inquiry?…` link in the message body. Save the action, then the header Save, then reload to verify (see `reference_ghl_builder_automation` in memory for the CDP route). Code needs nothing; Task 6's `funnel=boise` test is the site-side proof.

- [ ] **Step 3: Publish and build (after Tim approves)**

1. Tim or Tucker publishes the `boise` document in Prismic.
2. Confirm a production build ran on Netlify project `reddoorla` (Deploys → the newest deploy's trigger). If none was triggered by the publish, trigger one: Deploys → Trigger deploy → Deploy site.
3. Verify live:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://reddoorla.com/boise
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' https://reddoorla.com/og/industry/boise.png
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://reddoorla.com/bew
```

Expected: `200`; `200 image/png`; `302 https://reddoorla.com/boise?utm_source=bew&utm_medium=event&utm_campaign=bew-2026` — the last only once the PR has reached `main`.

Then the funnel itself: on `staging.reddoorla.com/boise` (it builds from the same Prismic repo), run one inquiry through the modal with a clearly test-labelled email, confirm in GHL that the contact carries `funnel = boise` and the `application started` tag, and delete the test contact.

- [ ] **Step 4: Full suite, PR to staging**

```bash
cd /Users/tuckerlemos/Documents/GitHub/reddoor-website/.worktrees/boise-lp || exit 1
for p in $(lsof -ti :5173 -ti :9999); do kill "$p"; done
pnpm test 2>&1 | tail -12
```

Expected: unit `538 passed`; smoke all passed (the exact count depends on the suite at the time; zero failures is the gate).

```bash
gh pr create --base staging --head feat/boise-industry-lp \
  --title "feat(industry): Boise landing page, /bew short link, per-city content pipeline" \
  --body-file - <<'EOF'
## What

- **`/boise`** — the second `industry` document, twelve slices in the medtech sequence, inherits the A-101 inquiry form/survey. Copy drafted from the spec's positioning and approved by Tim; the document is published in Prismic.
- **`/bew`** — a static route that 302s to `/boise?utm_source=bew&utm_medium=event&utm_campaign=bew-2026`, with incoming `utm_*` overriding the defaults and nothing else passing. `src/lib/bew.ts` is the pure builder with unit tests.
- **`scripts/industry/<uid>/`** — the medtech pipeline moved under a shared `migrate.mjs --industry <uid>`, plus `fit-logos.mjs` and a fetch-from-Prismic pattern, so San Antonio is a data file and one command.
- Smoke: the industry-page composition checks run over every industry document; `/boise` in `pages.spec`; a `funnel=boise` chase-link case.

## Why

Tim is working Boise Entrepreneur Week (28 Sept – 2 Oct) and wants the medtech funnel pointed at Boise businesses. This is also the proof of concept for niches by place. Spec: `docs/superpowers/specs/2026-09-14-boise-industry-lp-design.md`.

## Not in this PR, by design

- The A-102-1 chase message needs `&funnel={{contact.funnel}}` (builder-only) or abandoned Boise leads are chased to /medtech. The site side is in place and tested.
- The live `/medtech` hero is still the unlicensed iStock comp. Found while scoping; separate fix.

## Verification

`pnpm lint`, `pnpm check`, `pnpm test` green locally with the published document; `curl` of `/boise`, `/og/industry/boise.png` on production after the publish build.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

- [ ] **Step 5: Event kit to the Desktop**

```bash
cd /Users/tuckerlemos/Documents/GitHub/reddoor-website/.worktrees/boise-lp || exit 1
npx --yes qrcode@1 -o "$HOME/Desktop/reddoor-bew-qr-booth-card.png" -w 1024 -q 2 -e H "https://reddoorla.com/bew?utm_content=booth-card" || exit 1
npx --yes qrcode@1 -o "$HOME/Desktop/reddoor-bew-qr-slide.png" -w 1024 -q 2 -e H "https://reddoorla.com/bew?utm_content=slide" || exit 1
cat > "$HOME/Desktop/reddoor-bew-links.txt" <<'EOF'
Boise Entrepreneur Week — links for collateral (all land on reddoorla.com/boise, tagged as the event)

Short link (say it out loud):     reddoorla.com/bew
Booth card QR:                     https://reddoorla.com/bew?utm_content=booth-card
Closing slide QR:                  https://reddoorla.com/bew?utm_content=slide
Email signature / follow-ups:      https://reddoorla.com/bew?utm_content=email

In the CRM every lead from these carries funnel = boise, utm_source = bew, utm_medium = event,
utm_campaign = bew-2026, and utm_content = whichever piece they scanned.
EOF
ls -la "$HOME/Desktop"/reddoor-bew-*
```

Scan one QR with a phone and confirm it opens `/boise` with the utm tags before handing them over.

- [ ] **Step 6: Journal entry**

Append to `docs/workJournal.md` (newest at the bottom), dated the day the PR lands, headed like the entries above it: the date, a short title such as "/boise, /bew and the per-city content pipeline", and where it landed (PR number and merge sha). Write it as prose from what actually happened, covering at least: why a city page rather than an event page and why the medtech questions were reused unchanged; that the medtech build's repeatability held (no models, no slices, no CRM work for the second page) and the one place it did not (the chase link sends no `funnel`); the two things scoping found (the unlicensed medtech hero still live; the `logo_soup` document as a ready-made logo source); the fit-logos numbers (900x315 canvas, 72%/62% fill) and the mobile-crop rule the smoke suite enforces; the sequencing fact that `/boise` smoke tests are red until publish; and whatever Tim changed in the copy, with his reasons. Commit as `docs(journal): …` and push.

---

## Self-review against the spec

- §4.1 document, slice zone, blank Inquiry tab, blank `meta_image` → Task 4 (`data.json` has no inquiry or meta_image keys; `migrate.mjs` writes only title/slices/meta_title/meta_description) and Task 5.
- §4.2 positioning, framework names, services columns, FAQ set, `_copyEdits`/`_contentGaps` → Task 4.
- §4.3 `/bew`, pure function + vitest, 302, utm override, nothing else passes → Task 2.
- §4.4 folder layout, `--industry`, uid assertion, dry-run gate, helpers stay medtech-only, `regen-types.mjs` deleted, `.gitignore`, LogoGrid comments → Task 1; the two added helpers → Task 3 and the spec amendment in Task 7.
- §4.5 CRM builder edit + the `funnel=boise` test → Task 7 Step 2, Task 6 Step 3.
- §4.6 event kit → Task 7 Step 5.
- §5 tests table → Tasks 2, 6, and the dry runs in Tasks 1 and 4.
- §8 launch sequence → Task 7 Steps 3–4.
- §9 San Antonio → `scripts/industry/README.md` in Task 1.

Names used consistently: `bewTarget`, `BEW_LANDING`, `BEW_UTM` (Task 2); `--industry` flag, `INDUSTRY`, `DATA_DIR`, `ASSET_DIR` (Task 1); `PATHS`/`PATH` (Task 6); asset filenames in Task 3's script match Task 4's `data.json` one for one (`logo-<slug>.png`, `logo-<slug>-rev.png`, `rollover-<slug>.jpg`, `rollover-<slug>-mobile.jpg`, `enzos-after-1-hero.jpg`, `enzos-after-2-embroidered.png`, `enzos-after-3-brand-guide.png`, `blue-butterfly-mugs.jpg`, the three `icon-*.svg`, `testimonial-albert-turgon.png`, `hero-PLACEHOLDER-licensed-boise-photo-needed.png`).
