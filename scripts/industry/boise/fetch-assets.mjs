// Stage the Boise page's images from what the site already owns.
//
//   logos        the `logo_soup` document (colour mark, knockout, rollover art,
//                project link) — the marks the home and about pages already use
//   case study   the `enzos` project document
//   featured     the `blue-butterfly` project document
//   icons        the three framework SVGs, tracked at scripts/industry/shared/
//                (medtech's Figma exports, copied; see shared/README.md — not
//                rendered today)
//   testimonial  Albert Turgon's headshot, still borrowed from the medtech
//                staging folder (gitignored) — see data.json's _contentGaps
//                for why the MSOT quote stands in for now
//   hero         a labelled placeholder; a licensed Boise photo replaces it
//
// Every file lands in ./assets with the name data.json uses. Rollover art is
// also cut to the 1080x1920 portrait the LogoGrid serves below 768px, so no
// row ever falls back to Prismic's untouched top-left auto-crop.
//
// The manifest records every filename this script wrote (`files`), not just
// the logo rows, so a later step (or a human) can diff what's on disk against
// what the run actually produced. A run that throws partway through leaves
// the PREVIOUS manifest on disk untouched — the manifest is only written after
// every asset succeeds — so a failed run's assets/ can be ahead of what
// assets-manifest.json claims. Re-run to a clean exit before trusting it.
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
const SHARED_ASSETS = path.resolve(HERE, "../shared");
const MEDTECH_ASSETS = path.resolve(HERE, "../medtech/assets");

// Every filename this run writes into ASSETS, in write order; sorted before
// it goes into the manifest. One list, pushed to by every stage below, so the
// manifest can never silently fall behind what actually landed on disk.
const STAGED = [];

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

/**
 * SVG or PNG in → 900px-wide PNG out (fit-logos.mjs pads it afterwards).
 * Returns the source width too, so the caller can warn about a raster source
 * that fit-logos will have to upscale.
 */
async function stageLogo(field, out) {
  const url = original(field);
  const buf = await download(url);
  const svg = url.endsWith(".svg");
  const srcWidth = svg ? undefined : (await sharp(buf).metadata()).width;
  await sharp(buf, svg ? { density: 300 } : {})
    .resize({ width: 900, withoutEnlargement: !svg })
    .png()
    .toFile(path.join(ASSETS, out));
  STAGED.push(out);
  return { out, svg, srcWidth };
}

try {
  const config = JSON.parse(
    await readFile(path.resolve(HERE, "../../../slicemachine.config.json"), "utf8"),
  );
  const client = prismic.createClient(config.repositoryName);
  await mkdir(ASSETS, { recursive: true });

  // ── 1. logos ────────────────────────────────────────────────────────────
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
  // Per-brand override of the mobile rollover crop, keyed by slug. sharp's
  // default `position: "attention"` (the busiest region of the image) cut the
  // Hearts & Minds headline mid-word and clipped titles on CEO of LA County,
  // Progress Lighting, Zero Labs and SummitTrek — "busiest" and "where the
  // headline sits" are not the same region on those four boards. This map is
  // a machine-assisted starting point, not the last word: medtech's own
  // convention was to hand-crop each rollover in Prismic against a reference
  // sheet, and any crop that is still wrong after upload gets re-cropped
  // there, on the `active_background_mobile` field (Tim can do that).
  const MOBILE_CROP = {
    "hearts-and-minds": "centre",
    summittrek: "entropy",
  };
  const soup = await client.getSingle("logo_soup");
  const byName = new Map(soup.data.brands.map((b) => [b.name, b]));
  const manifest = [];
  for (const name of WANT) {
    const b = byName.get(name);
    if (!b) throw new Error(`logo_soup has no brand named ${JSON.stringify(name)}`);
    if (!prismic.isFilled.image(b.logo_color)) {
      throw new Error(`logo_soup brand "${name}" has no colour mark`);
    }
    const s = slug(name);
    const colour = await stageLogo(b.logo_color, `logo-${s}.png`);
    if (!colour.svg && colour.srcWidth < 900) {
      console.log(
        `! ${name} colour mark is ${colour.srcWidth}px wide (raster); it will be upscaled by fit-logos`,
      );
    }
    const entry = { name, file: colour.out };
    if (prismic.isFilled.image(b.logo_negative)) {
      entry.negative = (await stageLogo(b.logo_negative, `logo-${s}-rev.png`)).out;
    }
    if (prismic.isFilled.image(b.active_background)) {
      const art = await download(original(b.active_background));
      const artMeta = await sharp(art).metadata();
      if (artMeta.width < 3840) {
        console.log(
          `! ${name} rollover art is ${artMeta.width}x${artMeta.height}; below the 3840 ladder ceiling`,
        );
      }
      entry.rollover = `rollover-${s}.jpg`;
      await sharp(art)
        .resize({ width: 3840, withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toFile(path.join(ASSETS, entry.rollover));
      STAGED.push(entry.rollover);
      entry.rolloverMobile = `rollover-${s}-mobile.jpg`;
      await sharp(art)
        .resize(1080, 1920, { fit: "cover", position: MOBILE_CROP[s] ?? "attention" })
        .jpeg({ quality: 82 })
        .toFile(path.join(ASSETS, entry.rolloverMobile));
      STAGED.push(entry.rolloverMobile);
    }
    entry.project = prismic.isFilled.contentRelationship(b.project_link)
      ? b.project_link.uid
      : null;
    manifest.push(entry);
    console.log(`✓ ${name} → ${entry.file}${entry.rollover ? " + rollover" : ""}`);
  }

  // ── 2. case study + featured project ─────────────────────────────────────
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
    for (const [want, out] of wants) {
      const byId = want.startsWith("id:");
      const matches = byId
        ? images.filter((i) => original(i).includes("/" + want.slice(3) + "_"))
        : images.filter((i) => original(i).endsWith(want));
      if (matches.length === 0) {
        const found = images.map(original).join("\n  ");
        throw new Error(`${uid}: no image matching ${want}. Images the scan found:\n  ${found}`);
      }
      if (matches.length > 1) {
        throw new Error(
          `${uid}: ${matches.length} images match ${want} — ${matches.map(original).join(", ")}`,
        );
      }
      const buf = await download(original(matches[0]));
      // A source can carry an alpha channel either way — transparent (a
      // knockout or a composite) or fully opaque (a flattened export that
      // kept a channel it never uses, e.g. enzos-after-2-embroidered.png
      // measured isOpaque: true at 3.7 MB). Check before committing to the
      // extension in `wants`: encoding a non-opaque source as .jpg silently
      // flattens transparency onto black, so that's a hard stop, not a
      // warning.
      const { isOpaque } = await sharp(buf).stats();
      if (out.endsWith(".jpg") && !isOpaque) {
        throw new Error(`${uid}: ${out} would flatten transparency onto black — stage it as .png`);
      }
      if (out.endsWith(".png") && isOpaque) {
        console.log(`! ${uid}: ${out} is fully opaque — a .jpg would be smaller`);
      }
      let pipeline = sharp(buf).resize({ width: 2880, withoutEnlargement: true });
      pipeline = out.endsWith(".png") ? pipeline.png() : pipeline.jpeg({ quality: 85 });
      await pipeline.toFile(path.join(ASSETS, out));
      STAGED.push(out);
      console.log(`✓ ${uid}: ${want} → ${out}`);
    }
  }
  await stageFromProject("enzos", [
    ["id:Z1OuMpbqstJ98MRY", "enzos-after-1-brand-board.png"],
    ["id:Z1OurZbqstJ98MRd", "enzos-after-2-van.png"],
    ["id:ZyqXfq8jQArT0PM9", "enzos-after-3-signage.png"],
    ["_Enzo-Branding_Guide61.png", "enzos-after-4-brand-guide.jpg"],
  ]);
  await stageFromProject("blue-butterfly", [["_bb2.jpg", "blue-butterfly-mugs.jpg"]]);

  // ── 3. shared studio art ──────────────────────────────────────────────────
  // The three framework icons are the studio's own process art, tracked at
  // scripts/industry/shared/ (not medtech's) — copy, don't borrow. The
  // testimonial headshot is still a genuine borrow from medtech's gitignored
  // staging folder: it is Albert Turgon's photo, standing in for a Boise
  // testimonial that does not exist yet (see data.json's _contentGaps).
  for (const f of ["icon-diagnosis-audit.svg", "icon-rebuild.svg", "icon-rollout-launch.svg"]) {
    const src = path.join(SHARED_ASSETS, f);
    if (!existsSync(src)) {
      throw new Error(`missing ${src} — scripts/industry/shared/ should be tracked in git`);
    }
    await copyFile(src, path.join(ASSETS, f));
    STAGED.push(f);
  }
  {
    const f = "testimonial-albert-turgon.png";
    const src = path.join(MEDTECH_ASSETS, f);
    if (!existsSync(src)) {
      throw new Error(
        `missing ${src} — copy the medtech assets from the main checkout first (scripts/industry/README.md)`,
      );
    }
    await copyFile(src, path.join(ASSETS, f));
    STAGED.push(f);
  }
  console.log("✓ framework icons (shared/) + testimonial headshot (medtech/, borrowed) copied");

  // ── 4. hero placeholder ────────────────────────────────────────────────────
  const W = 3058;
  const H = 1720;
  const label = Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="100%" height="100%" fill="#e6e6e6"/>` +
      `<text x="50%" y="47%" font-family="Helvetica, Arial, sans-serif" font-size="140" font-weight="700" fill="#8a8a8a" text-anchor="middle">HERO PLACEHOLDER</text>` +
      `<text x="50%" y="58%" font-family="Helvetica, Arial, sans-serif" font-size="72" fill="#8a8a8a" text-anchor="middle">Licensed Boise photo needed before publish</text>` +
      `</svg>`,
  );
  const heroFile = "hero-PLACEHOLDER-licensed-boise-photo-needed.png";
  await sharp(label).png().toFile(path.join(ASSETS, heroFile));
  STAGED.push(heroFile);
  console.log("✓ hero placeholder drawn");

  const files = [...new Set(STAGED)].sort();
  await writeFile(
    path.join(HERE, "assets-manifest.json"),
    JSON.stringify({ logos: manifest, files }, null, 2) + "\n",
  );
  console.log(
    `\nstaged ${manifest.length} logos, ${files.length} files total into ${path.relative(process.cwd(), ASSETS)}`,
  );
} catch (err) {
  console.error(`✗ ${err.message}`);
  process.exit(1);
}
