// Derive a brand's VECTOR colour mark from its vector negative.
//
// Why this exists: the logo pipeline rasterises whatever `logo_soup` holds to a
// 900px-wide PNG, so a small raster colour mark is upscaled and lands soft in
// the grid — Zero Labs' was 235px wide, a 3.8x upscale. Its negative was already
// an SVG of the same artwork, and the colour mark is monochrome, so the colour
// version is the negative with its fill changed. That is a repair, not a redraw:
// the path data is asserted identical before anything is uploaded.
//
// Usage
//   node --env-file=.env.local scripts/logos/recolour-negative.mjs --brand "Zero Labs" --dry-run
//   node --env-file=.env.local scripts/logos/recolour-negative.mjs --brand "Zero Labs"
//
// Needs PRISMIC_WRITE_TOKEN for the real run. Nothing is ever published.
import * as prismic from "@prismicio/client";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ARGS = process.argv.slice(2);
const DRY_RUN = ARGS.includes("--dry-run");
const at = ARGS.indexOf("--brand");
const BRAND = at >= 0 ? ARGS[at + 1] : undefined;
if (!BRAND || BRAND.startsWith("--")) {
  console.error('Usage: node scripts/logos/recolour-negative.mjs --brand "<name>" [--dry-run]');
  process.exit(1);
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(
  await readFile(path.resolve(HERE, "../../slicemachine.config.json"), "utf8"),
);
const redact = (m) => String(m).replace(/([?&]access_token=)[^&\s"']+/gi, "$1[redacted]");

const readClient = prismic.createClient(config.repositoryName, { fetch });
const doc = await readClient.getSingle("logo_soup");
const index = doc.data.brands.findIndex((b) => b.name === BRAND);
if (index < 0) {
  console.error(`✗ no brand named ${JSON.stringify(BRAND)} in logo_soup.`);
  console.error(`  have: ${doc.data.brands.map((b) => b.name).join(", ")}`);
  process.exit(1);
}
const brand = doc.data.brands[index];
const ext = (u) => (u ? new URL(u).pathname.split(".").pop().toLowerCase() : "none");

console.log(
  `${BRAND}: colour=${ext(brand.logo_color?.url)} negative=${ext(brand.logo_negative?.url)}`,
);
if (ext(brand.logo_color?.url) === "svg") {
  console.log("Colour mark is already vector — nothing to do.");
  process.exit(0);
}
if (ext(brand.logo_negative?.url) !== "svg") {
  console.error("✗ the negative is not an SVG either, so there is nothing to derive from.");
  console.error("  This brand needs its original artwork; tracing is a redraw, not a repair.");
  process.exit(1);
}

// The colour mark must be monochrome, or a single fill cannot reproduce it.
// Asked, not assumed: imgix returns the PNG's palette, and anti-aliasing of a
// black mark shows up as greys — anything with saturation means real colour.
const palette = await (await fetch(`${brand.logo_color.url}&palette=json&colors=8`)).json();
const hexes = (palette.colors ?? []).map((c) => c.hex);
const saturated = hexes.filter((h) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  return Math.max(r, g, b) - Math.min(r, g, b) > 12;
});
if (saturated.length) {
  console.error(`✗ the colour mark is not monochrome (${saturated.join(", ")}).`);
  console.error("  A single fill cannot reproduce it — this one needs the original artwork.");
  process.exit(1);
}
// The darkest sampled colour is the ink; the rest are anti-aliasing towards the
// transparent background.
const ink = hexes.reduce((a, b) => (parseInt(a.slice(1), 16) <= parseInt(b.slice(1), 16) ? a : b));
console.log(`Palette ${hexes.join(" ")} → monochrome, ink ${ink}`);

const negative = await (await fetch(brand.logo_negative.url)).text();
const fills = [...negative.matchAll(/fill="([^"]*)"/g)].map((m) => m[1]);
const unexpected = fills.filter(
  (f) => f !== "white" && f !== "none" && f !== "#FFFFFF" && f !== "#ffffff",
);
if (unexpected.length) {
  console.error(`✗ the negative has fills other than white: ${JSON.stringify(unexpected)}`);
  console.error("  Recolouring it would flatten artwork this script cannot see.");
  process.exit(1);
}
const svg = negative.replace(/fill="(white|#FFFFFF|#ffffff)"/g, `fill="${ink}"`);

// Geometry is what makes this a repair rather than a redraw. Assert it.
const geometry = (s) => (s.match(/ d="([^"]+)"/g) || []).join("");
if (geometry(svg) !== geometry(negative)) {
  console.error("✗ path data changed — refusing to upload");
  process.exit(1);
}
const filename = `${BRAND.replace(/[^A-Za-z0-9]+/g, "")}-colour.svg`;
console.log(
  `Derived ${filename}: ${svg.length} bytes, ${(svg.match(/<path/g) || []).length} path(s), geometry identical.`,
);

if (DRY_RUN) {
  console.log("\nDRY-RUN: nothing uploaded, nothing staged.");
  process.exit(0);
}

const writeToken = process.env.PRISMIC_WRITE_TOKEN;
if (!writeToken) {
  console.error("✗ PRISMIC_WRITE_TOKEN is not set (use --env-file=.env.local)");
  process.exit(1);
}

const migration = prismic.createMigration();
const asset = migration.createAsset(
  new File([svg], filename, { type: "image/svg+xml" }),
  filename,
  {
    alt: brand.logo_color?.alt ?? `${BRAND} logo`,
  },
);
// Only this brand's colour mark moves. The whole brands array is re-sent because
// the Migration API replaces `data` wholesale, so every other item is passed
// through exactly as it was read.
const brands = doc.data.brands.map((b, i) => (i === index ? { ...b, logo_color: asset } : b));
migration.updateDocument({ ...doc, data: { ...doc.data, brands } }, doc.uid ?? "logo_soup");

const writeClient = prismic.createWriteClient(config.repositoryName, { writeToken });
try {
  await writeClient.migrate(migration, {
    reporter: (e) => e.type === "documents:created" && console.log("  …staged"),
  });
} catch (e) {
  console.error(`\n✗ MIGRATE FAILED: ${redact(e.message)}`);
  if (e.response?.details) console.error(redact(JSON.stringify(e.response.details, null, 2)));
  process.exit(1);
}
console.log(`\nStaged an UNPUBLISHED update to logo_soup — ${BRAND}'s colour mark is now vector.`);
console.log("Review it in Prismic and publish. Then re-stage the pages that show this brand");
console.log("(see scripts/logos/README.md).");
