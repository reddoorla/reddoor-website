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
- The slice sequence and the `data.json` key shape (`hero`, `services`,
  `framework`, `caseStudy`, `logoGrid`, `testimonial`, `featuredProject`,
  `about`, `faq`, `cta`) are hardcoded in `migrate.mjs`. "A data file and one
  command" holds for a page that uses medtech's twelve-band order; a different
  band order means editing the shared loader, which affects every page.

## Where the medtech assets are

The medtech staging assets are gitignored, so `git mv` moved only the tracked
files (the three hover knockouts) — the other ~68 assets did NOT move with
this branch and stay orphaned at `scripts/medtech/assets/` in the main
checkout after this merges. Once merged, in the main checkout run:

    mv scripts/medtech/assets/* scripts/industry/medtech/assets/ && rmdir scripts/medtech/assets scripts/medtech

(the three tracked knockouts will already be at the new path; `mv`-ing the
rest over them is fine since the knockouts are byte-identical.) A fresh
worktree does not have any of this — copy the folder across before a medtech
dry run, and before `boise/fetch-assets.mjs`, which borrows the three
framework icons and the testimonial headshot from it.
