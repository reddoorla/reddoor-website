# Industry logo band: colour and negative SVG pairs

One pair per brand in the `logo_grid` band on /boise and /medtech. `logo-<brand>.svg` is the colour mark and `logo-<brand>-rev.svg` is the negative that fades in over the hover photo. These files are the source for the Prismic assets. The site reads the Prismic copies, not these.

**The rule for a pair:** the two files are the same text except for colour values. The same paths, the same frame, the same transforms. So the negative paints exactly where the colour mark paints, and the hover crossfade reads as the colours changing, not as two logos swapping. Checked for every pair: after colour values are stripped the files are identical, and Chromium renders their alpha masks with zero differing pixels at 2400×840, 900×315 and 220×77.

**Needs #224 on production first.** `LogoGrid` gives an SVG logo a fixed 220px width (`w-55`) only from #224 on. Before it, the SVG takes its size from the `srcset` density and paints 300, 150 or 100px wide on 1×, 2× and 3× screens.

## Frames

Most pairs use a 300×105 frame, the band's box. Three keep the frame of the asset they replace, because that asset is taller than 300×105 and paints at the cell's full 105px height today. A 300×105 SVG can paint at most 77px tall there.

| Brand                        | Frame         | Placement                                                 |
| ---------------------------- | ------------- | --------------------------------------------------------- |
| Revogen                      | 300×105       | on the current PNG's ink, edges within 2px at 900×315     |
| Preveta                      | 300×105       | the same                                                  |
| Medical Solutions of Texas   | 300×105       | the same                                                  |
| Strategy Advantage           | 300×105       | the same                                                  |
| Alamo Anatomy                | 300×105       | the same                                                  |
| dōmaru                       | 300×105       | the same                                                  |
| Caltex Medical               | 300×105       | the same                                                  |
| Texas Organ Sharing Alliance | 300×105       | the same                                                  |
| SCFAI                        | 300×105       | the same                                                  |
| Freedom Youth Foundation     | 300×105       | `fit-logos.mjs` rule, 72% of the width, centred           |
| Composition Hospitality      | 369.23×201.79 | the live `CH_wordmark_w_hospitality_rings.svg`, unchanged |
| Vineyard Custom Homes        | 490×258       | on `VCH_logo.png`'s ink                                   |
| Enzo's                       | 1024×1024     | on `ENZO_logo-primary_1024x1024.png`'s ink                |

Freedom Youth is the one deliberate size change: the old file was a 792×612 letter-size artboard with the logo small in the middle.

## Sources

Nothing was traced. Every pair is built from the brand's own vector art:

- **Revogen, Texas Organ Sharing Alliance, Enzo's:** the homepage logo soup's SVGs in the reddoor-la Prismic library.
- **Preveta, MSOT, Strategy Advantage, dōmaru, SCFAI, Vineyard:** client Illustrator, PDF or SVG masters in Dropbox. Vineyard is its master `VCH_logo.svg` exactly, with the two class fills made inline and no optimiser pass.
- **Alamo Anatomy:** Figma node 4802:655, exported as outlined vector.
- **Caltex Medical:** the header lockup SVG from the caltex-landing Prismic repository.
- **Composition Hospitality:** the rings file already live on /boise. Its colour and negative differed in one path by 0.01 units and in how fills were declared. It is now one geometry with inline fills.
- **Freedom Youth Foundation:** the live SVG, re-framed.

## Negatives

- **Colour logos go all white** unless the brand's existing negative keeps accents. Kept accents:
  - dōmaru keeps the orange tagline and red macron.
  - Texas Organ Sharing Alliance keeps its heart.
  - Vineyard keeps the light blue `#7BA0C4`.
  - Freedom Youth keeps its greens and red heart.
- **Enzo's** is a red badge with white lettering. Its negative is a white badge with `#1A1A1A` lettering, so the letters keep their shape. Cutting the letters out as holes was tried and rejected: the colour file then shows the paper texture through them, and it no longer matches the current logo (shape IoU 0.74).
- **Black is `#010101`** in Composition Hospitality and Enzo's. Chromium paints opaque `#000000` with a slightly different alpha mask than white (2 to 14 pixels at one alpha level), and `#010101` removes that.

## How they were checked

- **Pair checks:** identical geometry, identical alpha masks, frame, no raster or text.
- **Placement against today's asset:**
  - Ink edges within 3px at 900 wide, and ink IoU of at least 0.93.
  - Freedom Youth instead: centred, inside the 72%/62% cap, and a shape IoU of at least 0.90 against the old file.
- **Vineyard's IoU:** 0.932. The brand's own master scores 0.930 against the same PNG, because the PNG export is 5% heavier than the vector.
- **The shape check was proven before it was trusted:**
  - It passes the reference itself, and the reference run through `fit-logos.mjs`'s own steps.
  - It fails a mirrored, stretched, squashed, bolder or other-brand copy, and one with a part missing.
  - The first version sampled a 240-column grid and failed correct thin-line logos. It was replaced.
- **Rendered in `LogoGrid` itself** (#224's version) at 1440 (1× and 2×) and 390 (3×): each pair paints the same rectangle in all 13 rows.
