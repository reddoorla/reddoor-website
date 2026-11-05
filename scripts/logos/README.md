# Logo marks — vector repair

The `logo_soup` document holds two images per brand: `logo_color` (the mark as
drawn) and `logo_negative` (its knockout). The logo pipeline in
`scripts/industry/` rasterises whichever it is given to a 900px-wide PNG, so a
raster source is upscaled to that width and lands soft on the page — the grid
is where a client's mark is most visible, and a blurred mark reads as ours, not
theirs.

Audited 2026-09-17: ten of the twelve brands were SVG in both slots. Two were
not. Re-audited 2026-11-05:

| Brand      | `logo_color`                     | `logo_negative`        | State                                                                                                 |
| ---------- | -------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------- |
| Zero Labs  | **SVG** 235×66 (live 2026-11-04) | **SVG** 235×66         | Done: derived by `recolour-negative.mjs`, published                                                   |
| SummitTrek | PNG 930×100 → SVG staged         | PNG 930×101 (agency's) | Colour mark staged from the agency's vector (below); negative stays raster: no matching vector exists |

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
their assets to pick the new mark up. Check which pages that is before running
anything: as of 2026-11-05 the published `boise` and `medtech` documents point
their `logo_grid` at `logo_soup`'s SVG assets directly (Boise uses
`ZeroLabs-colour.svg` itself), so only a page loaded with the PNG pipeline,
today the unpublished `digital`, carries its own rasterised copy. And
`migrate.mjs` rewrites the whole document from `data.json` into the Migration
API's release, so for a one-logo change stage the fitted PNG on that one field
instead. The full pipeline is:

    node --env-file=.env.local scripts/industry/<uid>/fetch-assets.mjs
    node scripts/industry/fit-logos.mjs --industry <uid>
    node --env-file=.env.local scripts/industry/migrate.mjs --industry <uid>

## SummitTrek

> Superseded in part 2026-11-05: the colour mark is not monochrome, and the
> original artwork was found. The paragraph below is what was believed on
> 2026-09-17.

No vector exists in `logo_soup` or in the `summittrek` project document, and its
colour mark is monochrome black at 930×100 — close enough to the 900px staging
width that the upscale is negligible, which is why it is not urgent. Tracing a
client's logotype is a redraw, not a repair, so the fix is the original `.ai` or
`.eps` from the brand's own files. Ask before tracing.

**2026-11-05.** Both Prismic PNGs are the agency's own exports, byte for byte:
`summit-color.png` is `SMT_Logotype_blk&dk-gray.png` and `summit-neg.png` is
`SMT_Logotype_W&lt-gray.png`, both in Dropbox
`/Clients/SummitTrek/01_Logos/FINAL/Logotype/PNGs/`. The colour mark is two
colours (near-black SUMMIT, gray `#736B69` TREK), so `recolour-negative.mjs`
does not apply. Its vector is `FINAL/Logotype/PDFs/SMT_Logotype_blk&dk-gray.pdf`
(five paths, no embedded image). `pdftocairo -svg` converts it, and only the
viewBox is cropped, to the PNG's 930×100 framing: the path data is unchanged.
Rendered at 930×100 against the PNG, the mean alpha difference is 2.7/255.

The negative has no exact vector. `FINAL/SMT_Logos SQ 5x5_NEW.ai` holds a
white/light-gray logotype (artboard 10), but its letter-spacing differs from
the PNG by 1–3px along the word (mean alpha difference 16.5/255, against 4.9
for the colour artwork's geometry). Artboard 9 has the matching geometry with a
mid-gray TREK (57%, not the PNG's 85%). Shipping either would change the
negative mark, and recolouring artboard 9 is not published artwork, so the
negative stays the agency's PNG. At 930px wide in a 198.7 CSS px slot it is
2.3× a 2x screen's need and is not soft.
