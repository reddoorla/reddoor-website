# The `hide` tag makes a document staging-only — design

Decided with Tucker, 2026-09-14. Ships fast: `/boise` is public on production
with unreviewed copy and a placeholder hero, and this is what takes it down.

## 1. Why

Editors already tag documents `hide` in Prismic: 16 published documents carry
it today (the `boise` industry page, 9 projects, 6 showcases). The site honours
the tag in four places as "unlisted": the layout's latest-four projects, both
portfolio queries and the sitemap's project list. The page itself still renders,
so `reddoorla.com/boise` is live and in the sitemap despite the tag.

Tucker's rule: **a document tagged `hide` exists on staging and nowhere else.**
On production it is a 404, absent from every listing, the sitemap, the OG entry
list and the prerender entry list. On `staging.reddoorla.com`, in local dev and
inside a Prismic preview session it is a normal document.

## 2. Decisions taken

- All document types, not only `industry`. The 15 older hidden documents leave
  production with this change; Tucker confirmed that is what the tag meant.
- `/boise` stays public until this ships (no dashboard unpublish).
- A Prismic preview session on production shows hidden documents. Preview
  sessions open only through the dashboard's token flow, so Tim can Preview a
  hidden page on `reddoorla.com` before it exists there.

## 3. Mechanism: one default filter on the shared client

Every Prismic query in the app goes through `createClient()` in
`src/lib/prismicio.ts` (25 call sites, plus the `entries()` generators, the
sitemap and the OG card route). The factory gains one default parameter:

```ts
defaultParams: showHidden ? {} : { filters: [prismic.filter.not("document.tags", ["hide"])] };
```

Verified against the live repository on 2026-09-14: `filter.not("document.tags",
[...])` is accepted (the bare-string form is rejected by the API), the filtered
`dangerouslyGetAll` returns 65 of 81 documents, and `getByUID` on an excluded
document throws `NotFoundError`, which the `[uid]`, portfolio and showcase
routes already turn into a 404. The three routes that fetch linked documents
after their main query (twenty-for-twenty by id, showcase featured and related
by uid) already wrap those fetches in try/catch and skip the row; the portfolio
prev/next list is a list query and is filtered like any other. No per-route
change is needed.

The four existing local `hide` filters are removed so the rule has one home.
On staging that is a visible change: hidden projects appear in the portfolio
grid and the latest-four, which is what "a normal document on staging" means.

## 4. When hidden content is shown

`showsHiddenContent({ dev, env, previewCookie })` is a pure function in
`src/lib/server/content-visibility.ts` (a `$lib/server` module cannot be
imported by client code, so the env read is safe by construction):

| Input                                           | Result | Why                                                                                                  |
| ----------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| `dev` (`vite dev`)                              | shown  | The smoke suite and local work see every published document; CI runs the suite the same way.         |
| `PRISMIC_HIDDEN_CONTENT=show` in the env        | shown  | Set on the `reddoor-staging` Netlify site only, every context. Nothing else sets it.                 |
| request carries the `io.prismic.preview` cookie | shown  | Decision 3 above. The layout already varies the CDN cache on that cookie.                            |
| anything else                                   | hidden | Production, deploy previews of the production site, and any build with the variable unset fail safe. |

`createClient({ cookies })` already receives the request cookies for preview;
it reads the same cookie for this decision. `/health` gains
`hiddenContent: "shown" | "hidden"` so every deploy states which mode it is in.

`src/lib/prismicio.ts` becomes server-only. The root layout imports
`repositoryName` from it today for the preview toolbar; that export moves to
`src/lib/prismic-repo.ts` (read from `slicemachine.config.json`) and
`prismicio.ts` re-exports it.

## 5. The build-time hazard

`svelte.config.js` sets `prerender.handleHttpError = "fail"`, and prerendering
follows every same-origin link in a prerendered page. A public page that links
to a hidden document therefore fails the production build with a 404 for that
link, which is the right outcome (the alternative is a public page shipping a
dead link) but must be known. Measured on 2026-09-14: `/medtech`'s logo grid
links to `project/strategy-advantage-website`, which is hidden; `/boise` and
the `logo_soup` document link to no hidden document. Before promotion someone
either removes the `hide` tag from that project or removes the link from the
medtech logo grid. `scripts/industry/README.md` records the rule for the next
city, and the local `pnpm build` in the plan reproduces the failure before CI
does.

## 6. Tests

| Test                                           | Change                                                                                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/server/content-visibility.test.ts`    | new: the four rows of the table above, and the filter list for each result                                                                       |
| `src/lib/prismicio.test.ts`                    | new: `createClient()` carries the filter when hidden and no filter when shown, read from the client's `defaultParams`                            |
| `src/routes/layout.server.test.ts`             | the mocked query no longer expects a local `hide` filter                                                                                         |
| `tests/smoke/health.spec.ts` (or the existing) | `/health` reports `hiddenContent: "shown"` under `vite dev`                                                                                      |
| existing `/boise` smoke tests                  | go green: the document is published and dev shows hidden content. That is the staging behaviour, proven.                                         |
| production behaviour                           | not testable under `vite dev`; verified after each deploy by `/health` and a `curl` of `/boise` on both hosts, and by a local `pnpm build` (§5). |

## 7. Rollout

1. `netlify env:set PRISMIC_HIDDEN_CONTENT show` on the `reddoor-staging` site
   (id `0c3051ba-7dae-4efa-ae17-04ad94e0280c`), all contexts, before the PR
   merges so the first staging build already shows hidden documents.
2. PR to `staging`. Merge. On `staging.reddoorla.com`: `/health` says shown,
   `/boise` renders, a hidden project renders.
3. Resolve the medtech link (§5). Promote to `main`. On `reddoorla.com`:
   `/health` says hidden, `/boise` and the 15 older pages return 404, the
   sitemap lists none of them.

## 8. Not in scope

Links inside a hidden document, redirects for the 15 pages leaving production
(a 404 is acceptable; Google drops them), and any Prismic-side workflow change.
