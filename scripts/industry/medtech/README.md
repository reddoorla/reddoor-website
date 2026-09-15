# MedTech landing page — content source

The `industry` document with uid `medtech` (served at `/medtech`), transcribed
from the Figma board **"Sales Funnel v2"** (node `4791:818` in file
`HRxyQGlQwQDEqOuRlEaZoL`). The shared loader and the runbook are one level up in
`scripts/industry/README.md`; this file covers what is particular to medtech.

## One-off helpers

| File                       | What it is                                                                                                      |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `export-assets.mjs`        | Re-exports the board's images by Figma node id into `./assets`. Node ids are durable; Figma render URLs expire. |
| `fetch-dropbox-assets.mjs` | Pulls client photography from Dropbox and derives the crops the page needs.                                     |
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
