// Stage the /digital page's images from what the site already owns.
//
//   logos        the `logo_soup` document (colour mark, knockout, rollover art,
//                project link) — the marks the home and about pages already use
//   hero         a Rubrik Zero Labs web mockup from its project document, not a
//                stock comp: the page sells websites, so the hero shows one
//   case study   the `rubrik-zero-labs` project document
//   featured     the `msot` project document (the same iMac homepage mockup
//                /medtech features)
//   icons        the three framework SVGs, tracked at scripts/industry/shared/
//                (medtech's Figma exports, copied; see shared/README.md — not
//                rendered today)
//   testimonial  Albert Turgon's headshot, still borrowed from the medtech
//                staging folder (gitignored) — see data.json's _contentGaps
//                for why the MSOT quote stands in here too
//
// Modelled on boise/fetch-assets.mjs; everything page-specific sits in the
// named blocks below (WANT, MOBILE_CROP, the two stageFromProject calls).
// Unlike Boise this page has NO hero placeholder — there is a real image.
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
// Usage: node scripts/industry/digital/fetch-assets.mjs
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
  // The client's priority order is Zero Labs, MSOT, 1-800-DENTIST, Gallery
  // Sonder. MSOT is NOT in logo_soup (nor are SCFAI or Strategy Advantage,
  // the next names the design spec listed), so the grid leads with the three
  // that exist and MSOT carries the page as the featured project instead —
  // see data.json's _contentGaps. The remaining six are the logo_soup brands
  // whose published project is a real site; Revogen, Texas Organ Sharing
  // Alliance and Champion X are the three left out.
  const WANT = [
    "Zero Labs",
    "1-800-DENTIST",
    "Gallery Sonder",
    "Worthe",
    "Progress Lighting",
    "CEO of LA County",
    "St. James' Episcopal School",
    "SummitTrek",
    "Hearts & Minds",
  ];
  // Per-brand override of the mobile rollover crop, keyed by slug. sharp's
  // default `position: "attention"` (the busiest region of the image) cut the
  // Hearts & Minds headline mid-word and clipped titles on CEO of LA County,
  // Progress Lighting, Zero Labs and SummitTrek — "busiest" and "where the
  // headline sits" are not the same region on those four boards. These two
  // overrides are the ones Boise measured and kept; the other three clip a
  // title and get re-cropped in Prismic on `active_background_mobile`, which
  // is medtech's own convention and something Tim can do.
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

  // ── 2. hero + case study + featured project ──────────────────────────────
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
      // kept a channel it never uses). Check before committing to the
      // extension in `wants`: encoding a non-opaque source as .jpg silently
      // flattens transparency onto black, so that's a hard stop, not a
      // warning. RZL-mockup-report_mac.png is the one non-opaque source here,
      // which is why the case study's lead image is the only .png of the five.
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
  await stageFromProject("rubrik-zero-labs", [
    ["_RZL-mockup-newsroom.png", "hero-rubrik-zero-labs-newsroom.jpg"],
    ["_RZL-mockup-report_mac.png", "rubrik-after-1-report-landing.png"],
    ["_RZL-resources-blogpost-ipad-1.png", "rubrik-after-2-blog-post.jpg"],
    ["_RZL-mockup-homepage-mission1920.jpg", "rubrik-after-3-mission-tablet.jpg"],
    ["_RZL-mockup-about1920.jpg", "rubrik-after-4-article-laptop.jpg"],
  ]);
  await stageFromProject("msot", [["_iMacHomepage.png", "msot-web-mockup.jpg"]]);

  // ── 3. shared studio art ──────────────────────────────────────────────────
  // The three framework icons are the studio's own process art, tracked at
  // scripts/industry/shared/ (not medtech's) — copy, don't borrow. The
  // testimonial headshot is still a genuine borrow from medtech's gitignored
  // staging folder: it is Albert Turgon's photo, and his is the only client
  // quote on file (see data.json's _contentGaps).
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
