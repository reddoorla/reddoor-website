// Flag slideshows whose slides do not share an aspect ratio.
//
// Why this is worth a script: a slideshow lays every slide into ONE box with
// `object-contain`, so a slide with a different ratio letterboxes — it paints
// shorter (or narrower) than its neighbours and anything running across the
// artwork, a rule or a horizon, steps as the carousel advances. Nothing errors,
// nothing looks wrong in the CMS, and the images all look fine on their own;
// the defect only exists in the relationship BETWEEN them. That is exactly the
// kind of thing a person does not catch by eye and a script catches for free.
//
// Found in the wild on /portfolio/msot: `enduser_deployed` shipped 4320x1860
// against its neighbours' 4320x1950, dropping the shared timeline rule ~14 CSS
// px on slide 1.
//
// Usage
//   node --env-file=.env.local scripts/audit/slideshow-aspect.mjs
//   node --env-file=.env.local scripts/audit/slideshow-aspect.mjs --tolerance 0.005
//
// Read-only: queries the published API and writes nothing.
import * as prismic from "@prismicio/client";
import config from "../../slicemachine.config.json" with { type: "json" };

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? fallback : Number(process.argv[i + 1]);
};

// Ratios within 1% read as identical on screen; below that it is rounding in
// the export, not a design difference.
const TOLERANCE = arg("--tolerance", 0.01);

const client = prismic.createClient(config.repositoryName, {
  accessToken: process.env.PRISMIC_ACCESS_TOKEN || process.env.PRISMIC_WRITE_TOKEN,
  fetchOptions: { cache: "no-store" },
});

// Only slices that lay every image into ONE shared box can suffer this: there
// the odd ratio letterboxes and the artwork steps as the carousel advances. A
// slice that stacks its images (content_width_image) sizes each one to its own
// intrinsic ratio, so variation there is the author's choice, not a defect —
// including those turned the audit into 99 findings of which almost none were
// real. `--all` restores the wide scan.
const BOXED_SLICES = new Set(["slideshow"]);
const SCAN_ALL = process.argv.includes("--all");

// The image group is named differently per slice (`images`, `slides`), so
// collect groups by shape rather than by name.
function imageGroups(slice) {
  const groups = [];
  const scan = (container, label) => {
    for (const [key, value] of Object.entries(container ?? {})) {
      if (!Array.isArray(value) || value.length < 2) continue;
      const images = value
        .map((row) => (row?.image?.dimensions ? row.image : row?.dimensions ? row : null))
        .filter(Boolean);
      if (images.length >= 2) groups.push({ field: label ? `${label}.${key}` : key, images });
    }
  };
  scan(slice.primary, "primary");
  if (Array.isArray(slice.items) && slice.items.length >= 2) {
    const images = slice.items.map((it) => it?.image).filter((i) => i?.dimensions);
    if (images.length >= 2) groups.push({ field: "items.image", images });
  }
  return groups;
}

const docs = await client.dangerouslyGetAll();
console.log(
  `Scanning ${docs.length} documents for mismatched slide ratios (tolerance ${TOLERANCE * 100}%)\n`,
);

let flagged = 0;
let checked = 0;

for (const doc of docs) {
  for (const [i, slice] of (doc.data?.slices ?? []).entries()) {
    if (!SCAN_ALL && !BOXED_SLICES.has(slice.slice_type)) continue;
    for (const group of imageGroups(slice)) {
      checked++;
      const ratios = group.images.map((img) => ({
        name: img.url?.split("/").pop()?.split("?")[0] ?? "(unnamed)",
        w: img.dimensions.width,
        h: img.dimensions.height,
        ratio: img.dimensions.width / img.dimensions.height,
      }));
      const min = Math.min(...ratios.map((r) => r.ratio));
      const max = Math.max(...ratios.map((r) => r.ratio));
      if ((max - min) / min <= TOLERANCE) continue;

      flagged++;
      // The majority ratio is the intended one; the odd slide out is the bug.
      const tally = new Map();
      for (const r of ratios) {
        const key = r.ratio.toFixed(3);
        tally.set(key, (tally.get(key) ?? 0) + 1);
      }
      const [majority] = [...tally.entries()].sort((a, b) => b[1] - a[1]);
      console.log(
        `${doc.type}/${doc.uid ?? doc.id} → slice[${i}] ${slice.slice_type}.${group.field}` +
          `  spread ${(((max - min) / min) * 100).toFixed(1)}%`,
      );
      for (const r of ratios) {
        const odd = r.ratio.toFixed(3) !== majority[0];
        console.log(
          `   ${odd ? "✗" : " "} ${r.name.padEnd(46)} ${String(r.w).padStart(5)}x${String(r.h).padEnd(5)} ratio ${r.ratio.toFixed(4)}` +
            (odd ? `   ← odd one out (majority ${majority[0]})` : ""),
        );
      }
      console.log();
    }
  }
}

console.log(`${checked} image group(s) checked, ${flagged} flagged.`);
process.exit(flagged ? 1 : 0);
