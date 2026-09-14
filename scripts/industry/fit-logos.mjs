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
