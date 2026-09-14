// Stage the Boise page's images from what the site already owns.
//
//   logos        the `logo_soup` document (colour mark, knockout, rollover art,
//                project link) — the marks the home and about pages already use
//   case study   the `enzos` project document
//   featured     the `blue-butterfly` project document
//   icons        the three framework SVGs, borrowed from the medtech staging
//                folder (gitignored; copy it from the main checkout first)
//   testimonial  Albert Turgon's headshot, same source — see data.json's
//                _contentGaps for why the MSOT quote stands in for now
//   hero         a labelled placeholder; a licensed Boise photo replaces it
//
// Every file lands in ./assets with the name data.json uses. Rollover art is
// also cut to the 1080x1920 portrait the LogoGrid serves below 768px, so no
// row ever falls back to Prismic's untouched top-left auto-crop.
//
// Usage: node scripts/industry/boise/fetch-assets.mjs
import * as prismic from "@prismicio/client";
import sharp from "sharp";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(HERE, "assets");
const MEDTECH_ASSETS = path.resolve(HERE, "../medtech/assets");
const config = JSON.parse(
  await readFile(path.resolve(HERE, "../../../slicemachine.config.json"), "utf8"),
);
const client = prismic.createClient(config.repositoryName);
await mkdir(ASSETS, { recursive: true });

/** imgix params off → the original bytes. */
const original = (field) => field.url.split("?")[0];
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/** SVG or PNG in → 900px-wide PNG out (fit-logos.mjs pads it afterwards). */
async function stageLogo(field, out) {
  const url = original(field);
  const buf = await download(url);
  const svg = url.endsWith(".svg");
  await sharp(buf, svg ? { density: 300 } : {})
    .resize({ width: 900, withoutEnlargement: !svg })
    .png()
    .toFile(path.join(ASSETS, out));
  return out;
}

// ── 1. logos ────────────────────────────────────────────────────────────────
const WANT = [
  "1-800-DENTIST",
  "Progress Lighting",
  "SummitTrek",
  "Worthe",
  "Zero Labs",
  "Gallery Sonder",
  "CEO of LA County",
  "St. James' Episcopal School",
  "Hearts & Minds",
];
const soup = await client.getSingle("logo_soup");
const byName = new Map(soup.data.brands.map((b) => [b.name, b]));
const manifest = [];
for (const name of WANT) {
  const b = byName.get(name);
  if (!b) throw new Error(`logo_soup has no brand named ${JSON.stringify(name)}`);
  const s = slug(name);
  const entry = { name, file: await stageLogo(b.logo_color, `logo-${s}.png`) };
  if (prismic.isFilled.image(b.logo_negative)) {
    entry.negative = await stageLogo(b.logo_negative, `logo-${s}-rev.png`);
  }
  if (prismic.isFilled.image(b.active_background)) {
    const art = await download(original(b.active_background));
    entry.rollover = `rollover-${s}.jpg`;
    await sharp(art)
      .resize({ width: 3840, withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toFile(path.join(ASSETS, entry.rollover));
    entry.rolloverMobile = `rollover-${s}-mobile.jpg`;
    await sharp(art)
      .resize(1080, 1920, { fit: "cover", position: "attention" })
      .jpeg({ quality: 82 })
      .toFile(path.join(ASSETS, entry.rolloverMobile));
  }
  entry.project = prismic.isFilled.contentRelationship(b.project_link) ? b.project_link.uid : null;
  manifest.push(entry);
  console.log(`✓ ${name} → ${entry.file}${entry.rollover ? " + rollover" : ""}`);
}

// ── 2. case study + featured project ────────────────────────────────────────
async function stageFromProject(uid, wants) {
  const doc = await client.getByUID("project", uid);
  const images = [];
  const scan = (o) => {
    if (!o || typeof o !== "object") return;
    if (o.url && o.dimensions) images.push(o);
    else Object.values(o).forEach(scan);
  };
  scan(doc.data.hero);
  for (const s of doc.data.slices) {
    scan(s.primary);
    (s.items ?? []).forEach(scan);
  }
  for (const [suffix, out] of wants) {
    const img = images.find((i) => original(i).endsWith(suffix));
    if (!img) throw new Error(`${uid}: no image ending in ${suffix}`);
    const resized = sharp(await download(original(img))).resize({
      width: 2880,
      withoutEnlargement: true,
    });
    const encoded = out.endsWith(".png") ? resized.png() : resized.jpeg({ quality: 85 });
    await encoded.toFile(path.join(ASSETS, out));
    console.log(`✓ ${uid}: ${suffix} → ${out}`);
  }
}
await stageFromProject("enzos", [
  ["_broncoHero.jpg", "enzos-after-1-hero.jpg"],
  ["_ENZ_mbroideredmockup.png", "enzos-after-2-embroidered.png"],
  ["_Enzo-Branding_Guide61.png", "enzos-after-3-brand-guide.png"],
]);
await stageFromProject("blue-butterfly", [["_bb2.jpg", "blue-butterfly-mugs.jpg"]]);

// ── 3. shared studio art from the medtech staging folder ────────────────────
for (const f of [
  "icon-diagnosis-audit.svg",
  "icon-rebuild.svg",
  "icon-rollout-launch.svg",
  "testimonial-albert-turgon.png",
]) {
  const src = path.join(MEDTECH_ASSETS, f);
  if (!existsSync(src)) {
    throw new Error(
      `missing ${src} — copy the medtech assets from the main checkout first (scripts/industry/README.md)`,
    );
  }
  await copyFile(src, path.join(ASSETS, f));
}
console.log("✓ framework icons + testimonial headshot copied from medtech/assets");

// ── 4. hero placeholder ─────────────────────────────────────────────────────
const W = 3058;
const H = 1720;
const label = Buffer.from(
  `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` +
    `<rect width="100%" height="100%" fill="#e6e6e6"/>` +
    `<text x="50%" y="47%" font-family="Helvetica, Arial, sans-serif" font-size="140" font-weight="700" fill="#8a8a8a" text-anchor="middle">HERO PLACEHOLDER</text>` +
    `<text x="50%" y="58%" font-family="Helvetica, Arial, sans-serif" font-size="72" fill="#8a8a8a" text-anchor="middle">Licensed Boise photo needed before publish</text>` +
    `</svg>`,
);
await sharp(label)
  .png()
  .toFile(path.join(ASSETS, "hero-PLACEHOLDER-licensed-boise-photo-needed.png"));
console.log("✓ hero placeholder drawn");

await writeFile(path.join(HERE, "assets-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(
  `\nstaged ${manifest.length} logos, 4 project images, 4 shared files and the hero into ${path.relative(process.cwd(), ASSETS)}`,
);
