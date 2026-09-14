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
// The 72%/62% caps are not a stylistic choice: 72% of the 900px canvas is
// 648px, which at the 3x export scale is 216 CSS px — inside the 220px
// LogoGrid/index.svelte already declares in its `sizes` attribute for these
// images. Go past 72% and the browser is asked to decode more resolution than
// it requested for nothing.
//
// `.trim()` below is called with no options, on purpose: every logo-*.png here
// is an RGBA PNG whose padding is transparent (alpha 0), so sharp's default
// trim — which matches against the top-left corner pixel — is already
// trimming on alpha, the same mechanism medtech/normalize-logos.mjs spells
// out explicitly as `{ threshold: 1 }`. It stays implicit here because the
// corner pixel IS the transparent one for every asset this script has seen;
// if a future export ever has an opaque corner, .trim() will trim on colour
// instead and this comment is the first place to look.
//
// Re-running this over its own output can move a mark by 1px: the first pass
// trims whatever padding is already there (which can round a pixel
// differently than a fresh export would) and re-pads symmetrically; a second
// pass then converges exactly. A dirty re-run is not a regression — trust
// `--check`, not a byte diff of the files.
//
// A logo whose trimmed ink is close to square paints narrow under the default
// fill rule, because width binds long before height gets anywhere near 62%.
// Measured on Boise: St. James' Episcopal School's ink is 173x195
// (near-square) and lands at 173/900 ≈ 19% of the canvas width, while the
// wordmarks in the same row reach the full 72%. FILL_OVERRIDES below is where
// a human looks at the fitted row and gives one logo a taller fill fraction —
// the default deliberately does not guess at that on its own.
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

// Per-logo override of the fill fraction, keyed by the colour file's basename
// (no extension, e.g. "logo-st-james-episcopal-school"). Empty by default —
// see the header note above; this is an eye decision, not something the
// script should guess at.
const FILL_OVERRIDES = {
  // "logo-st-james-episcopal-school": { w: 0.72, h: 0.8 },
};

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

/**
 * Ink bbox of an already-fitted (CANVAS-sized) colour mark: is it centred and
 * within the fill cap? sharp reports trimOffsetLeft/Top as the negative of
 * the padding it removed, so negate them back into padding amounts before
 * comparing left/right and top/bottom.
 */
async function checkInk(name, fill) {
  const { info } = await sharp(path.join(ASSETS, name))
    .trim()
    .toBuffer({ resolveWithObject: true });
  const left = -(info.trimOffsetLeft ?? 0);
  const top = -(info.trimOffsetTop ?? 0);
  const right = CANVAS.w - left - info.width;
  const bottom = CANVAS.h - top - info.height;
  const dx = Math.abs(left - right);
  const dy = Math.abs(top - bottom);
  let ok = true;
  if (dx > 1 || dy > 1) {
    console.log(`✗ ${name} ink off-centre by (${dx}, ${dy})`);
    ok = false;
  }
  if (info.width > fill.w * CANVAS.w + 1 || info.height > fill.h * CANVAS.h + 1) {
    console.log(`✗ ${name} ink exceeds the fill cap`);
    ok = false;
  }
  return ok;
}

try {
  const files = (await readdir(ASSETS)).filter((f) => /^logo-.*\.png$/.test(f));
  const colour = files.filter((f) => !f.endsWith("-rev.png"));
  const seen = new Set();
  let unfitted = 0;

  for (const file of colour) {
    const twin = file.replace(/\.png$/, "-rev.png");
    const pair = files.includes(twin) ? [file, twin] : [file];
    pair.forEach((n) => seen.add(n));
    const base = path.parse(file).name;
    const fill = FILL_OVERRIDES[base] ?? FILL;

    if (CHECK) {
      for (const name of pair) {
        const meta = await sharp(path.join(ASSETS, name)).metadata();
        if (meta.width !== CANVAS.w || meta.height !== CANVAS.h) {
          unfitted++;
          console.log(`✗ ${name} is ${meta.width}x${meta.height}`);
        }
      }
      if (!(await checkInk(file, fill))) unfitted++;
      continue;
    }

    const trimmed = await sharp(path.join(ASSETS, file))
      .trim()
      .toBuffer({ resolveWithObject: true });
    const { width: w, height: h } = trimmed.info;
    const scale = Math.min((fill.w * CANVAS.w) / w, (fill.h * CANVAS.h) / h);
    const target = {
      w: Math.max(1, Math.round(w * scale)),
      h: Math.max(1, Math.round(h * scale)),
    };
    for (const name of pair) await fit(name, target);
  }

  const orphans = files.filter((f) => !seen.has(f));
  for (const f of orphans) {
    console.log(`✗ ${f} has no colour twin — not measured`);
  }

  if (CHECK) {
    unfitted += orphans.length;
    console.log(unfitted ? `${unfitted} logo(s) not fitted` : `all ${files.length} logos fitted`);
    process.exit(unfitted ? 1 : 0);
  } else if (orphans.length) {
    process.exit(1);
  }
} catch (err) {
  if (err && err.code === "ENOENT") {
    console.error(`✗ No such industry: ${ASSETS} does not exist.`);
  } else {
    console.error(`✗ ${err.message}`);
  }
  process.exit(1);
}
