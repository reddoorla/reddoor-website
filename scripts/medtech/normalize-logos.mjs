// Normalise the client logos so a UNIFORM grid box reproduces the board's
// per-logo optical sizing.
//
// The problem
// -----------
// The grid gives every logo the same box and lets object-contain decide, so the
// painted size is a function of the asset's aspect ratio and whatever
// transparent padding the export happened to carry. The board instead sizes
// each mark by eye. Measured against board frame `logo soup 3` (4802:529), five
// of nine were off: AATI drew 25% small, dōmaru 19% large, TOSA 13% large,
// Revogen 9% large, MSOT 10% small.
//
// The fix
// -------
// Give every asset a canvas with the SAME aspect as the grid box, sized so the
// trimmed artwork occupies exactly the fraction of that canvas the board draws:
//
//     painted = (content / canvas) x box        [canvas aspect == box aspect,
//                                                so contain fits it exactly]
//     want painted == board  =>  content / canvas = board / box
//
// so canvas = content x box / board. Padding is then pure arithmetic, and every
// logo lands at its board size with no per-logo CSS.
//
// The box had to grow: the board draws AATI 294px wide and MSOT 103.5px tall,
// both past the old `max-w-[220px]` / `lg:h-24` cap, so no amount of padding
// could have reached them. The box is now 300x105 — see index.svelte, and keep
// BOX below in sync with it.
//
// A knockout (`-rev`) is normalised to the same fractions as its colour mark, so
// the hover swap stays pixel-exact by construction rather than by luck.
//
// Usage: node scripts/medtech/normalize-logos.mjs [--check]
import sharp from "sharp";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), "assets");
const CHECK_ONLY = process.argv.includes("--check");

// Grid box in CSS px. MUST match LogoGrid/index.svelte (`max-w-75`, `lg:h-26.25`).
const BOX = { w: 300, h: 105 };

// Measured off the 2x board render, tight ink bbox, converted to CSS px.
// Regenerate with scratchpad/logo-measure-board.mjs if the board changes.
const BOARD = {
  "logo-revogen": { w: 193.0, h: 40.0 },
  "logo-preveta": { w: 220.0, h: 41.5 },
  "logo-msot": { w: 197.0, h: 103.5 },
  "logo-strategy-advantage": { w: 218.0, h: 56.0 },
  "logo-aati": { w: 294.0, h: 60.5 },
  "logo-domaru": { w: 182.5, h: 79.5 },
  "logo-caltex-medical": { w: 220.0, h: 36.5 },
  "logo-texas-organ-sharing-alliance": { w: 176.5, h: 81.5 },
  "logo-scfai": { w: 220.0, h: 35.5 },
};

const files = (await readdir(ASSETS)).filter((f) => f.startsWith("logo-") && f.endsWith(".png"));

for (const [brand, board] of Object.entries(BOARD)) {
  // Colour mark and its knockout share the treatment.
  for (const suffix of ["", "-rev"]) {
    const file = `${brand}${suffix}.png`;
    if (!files.includes(file)) continue;
    const src = path.join(ASSETS, file);

    // Trim on ALPHA: these are transparent PNGs, so a luminance trim would eat
    // a white knockout entirely.
    const trimmed = await sharp(src).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
    const content = { w: trimmed.info.width, h: trimmed.info.height };

    // Canvas that puts `content` at the board's fraction of the box. Driven by
    // width; the height then follows from the box aspect. If the artwork's own
    // aspect disagrees with the board's, height is what gives — the board's
    // width is the stronger signal (it is what the eye reads across a row).
    const canvasW = Math.round((content.w * BOX.w) / board.w);
    const canvasH = Math.round((canvasW * BOX.h) / BOX.w);

    if (canvasH < content.h) {
      console.log(
        `  ! ${file}: content ${content.w}x${content.h} taller than canvas ${canvasW}x${canvasH} — skipped`,
      );
      continue;
    }

    const paintedW = (content.w / canvasW) * BOX.w;
    const paintedH = (content.h / canvasH) * BOX.h;
    const drift = ((paintedW - board.w) / board.w) * 100;

    console.log(
      `${file.padEnd(40)} content ${String(content.w).padStart(5)}x${String(content.h).padEnd(5)}` +
        ` → canvas ${canvasW}x${canvasH}   paints ${paintedW.toFixed(1)}x${paintedH.toFixed(1)}` +
        ` (board ${board.w}x${board.h}, ${drift >= 0 ? "+" : ""}${drift.toFixed(1)}%)`,
    );

    if (CHECK_ONLY) continue;

    await sharp({
      create: {
        width: canvasW,
        height: canvasH,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: trimmed.data,
          top: Math.round((canvasH - content.h) / 2),
          left: Math.round((canvasW - content.w) / 2),
        },
      ])
      .png()
      .toFile(`${src}.tmp`);
    await sharp(`${src}.tmp`).toFile(src);
  }
}

console.log(CHECK_ONLY ? "\n(--check: nothing written)" : "\nnormalised.");
