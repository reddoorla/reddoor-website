# MedTech landing page — content load

One-shot scripts that create the `industry` document with uid `medtech` (served at
`/medtech`) from the Figma board **"Sales Funnel v2"** (node `4791:818` in file
`HRxyQGlQwQDEqOuRlEaZoL`).

The page is built from slices, so this same pipeline produces the next industry
page: copy `data.json`, change the uid/copy/assets, re-run.

## Order of operations

The Migration API validates slices against the **models pushed to the Prismic
repo**, and a write token cannot push models. So:

```bash
# 1. Push the models (interactive — needs a Prismic login in the browser)
pnpm slicemachine        # → Changes → Push

# 2. Export the images from Figma into ./assets (gitignored, ~11MB)
FIGMA_PAT=… node scripts/medtech/export-assets.mjs

# 3. Check the payload against the local models — sends nothing
node scripts/medtech/migrate.mjs --dry-run

# 4. Load the content as an unpublished draft
node --env-file=.env.local scripts/medtech/migrate.mjs
```

Step 4 needs `PRISMIC_WRITE_TOKEN` (Prismic → Settings → API & Security → Write APIs).
Nothing is ever auto-published — review the draft in Prismic and hit Publish.

## Files

| File                | What it is                                                                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `data.json`         | All page copy, transcribed from the board. `_copyEdits` records every deviation from the Figma text; `_contentGaps` records what the design does not supply.                                                             |
| `export-assets.mjs` | Re-exports the board's images by Figma node id into `./assets`. Node ids are the durable reference — Figma render URLs expire.                                                                                           |
| `migrate.mjs`       | Builds the slice payload, validates every field against `src/lib/slices/*/model.json` and `customtypes/industry`, uploads assets, and writes the document. Re-runnable: updates `medtech` in place if it already exists. |

`migrate.mjs` aborts with a field-level diff if a model has drifted from what the
payload writes, so a renamed field fails loudly instead of silently dropping content.

## Before this page can go live

- **Hero image is an unlicensed iStock comp** (`hero-PLACEHOLDER-istock-comp.png`,
  iStock id 2184775810) exported at the board's comp resolution. It must be replaced
  with a licensed hi-res asset.
- **FAQ answers do not exist** anywhere in the design. The 8 questions load with empty
  bodies and need copy.
- **No before-image for the Revogen case study** — per the Figma thread there are no
  usable photos of the old packaging. The slice hides its before/after toggle while the
  field is empty.
- Caltex and AATI imagery / white logo variants are still outstanding per the board comments.
