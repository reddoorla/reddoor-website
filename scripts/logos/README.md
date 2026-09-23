# Logo marks — vector repair

The `logo_soup` document holds two images per brand: `logo_color` (the mark as
drawn) and `logo_negative` (its knockout). The logo pipeline in
`scripts/industry/` rasterises whichever it is given to a 900px-wide PNG, so a
raster source is upscaled to that width and lands soft on the page — the grid
is where a client's mark is most visible, and a blurred mark reads as ours, not
theirs.

Audited 2026-09-17: ten of the twelve brands are SVG in both slots. Two are not.

| Brand      | `logo_color` | `logo_negative` | State                                           |
| ---------- | ------------ | --------------- | ----------------------------------------------- |
| Zero Labs  | PNG 235×66   | **SVG** 235×66  | Repaired by `recolour-negative.mjs` (see below) |
| SummitTrek | PNG 930×100  | PNG 930×101     | **Still raster** — needs the original artwork   |

## `recolour-negative.mjs`

Fixes the case where the knockout is vector and the colour mark is not. The two
are the same artwork, so the colour mark can be derived from the negative by
changing the fill, with no tracing and no redrawing: the path data is asserted
byte-identical before anything is written.

It only applies when the colour mark is **monochrome** — checked, not assumed,
by asking imgix for the PNG's palette. Zero Labs' returned only greys (black
plus anti-aliasing), so black is the whole of it. A two-colour mark cannot be
recovered this way and the script refuses.

    node --env-file=.env.local scripts/logos/recolour-negative.mjs --brand "Zero Labs" --dry-run
    node --env-file=.env.local scripts/logos/recolour-negative.mjs --brand "Zero Labs"

The real run uploads the derived SVG and stages an **unpublished** update to
`logo_soup` — a human publishes, as with every other content script here.

**After it is published**, the industry pages that show that brand re-stage
their assets to pick the new mark up:

    node --env-file=.env.local scripts/industry/<uid>/fetch-assets.mjs
    node scripts/industry/fit-logos.mjs --industry <uid>
    node --env-file=.env.local scripts/industry/migrate.mjs --industry <uid>

## SummitTrek

No vector exists in `logo_soup` or in the `summittrek` project document, and its
colour mark is monochrome black at 930×100 — close enough to the 900px staging
width that the upscale is negligible, which is why it is not urgent. Tracing a
client's logotype is a redraw, not a repair, so the fix is the original `.ai` or
`.eps` from the brand's own files. Ask before tracing.
