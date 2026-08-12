#!/usr/bin/env node
/**
 * Pull client photography from Dropbox and derive the crops the landing page
 * needs, into ./assets (gitignored) alongside the Figma exports.
 *
 * Why this exists: Figma is the wrong source for photography. The board's MSOT
 * plate was exported from Figma at 1756x2210 — a downscale of a PORTRAIT
 * mockup, then object-cover'd into a 1018:658 landscape plate, so roughly half
 * the image was cropped away and the remaining crop was under 2x for its
 * 1180px slot. The Dropbox original is 6000x7552; cropping THAT to the plate's
 * aspect gives a correctly framed, genuinely retina asset.
 *
 * Auth: DROPBOX_ACCESS_TOKEN, read from the reddoor-maintenance .env (the
 * fleet's shared credential store) unless it is already in the environment.
 * The token is team-scoped, so every request sends the team root namespace —
 * without it, paths resolve against the personal member folder and the shared
 * "Reddoor Creative Dropbox" tree is invisible.
 *
 *   node scripts/medtech/fetch-dropbox-assets.mjs [--keep-originals]
 *
 * Requires `sips` (macOS). Re-runnable; overwrites its outputs.
 */
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "assets");
const MAINTENANCE_ENV = path.resolve(HERE, "../../../reddoor-maintenance/.env");

/**
 * Each entry: a Dropbox original plus the derivation applied to it.
 * `aspect` is the CSS aspect-ratio of the slot the image fills; the source is
 * centre-cropped to it before downscaling to `width`, which is ~2x the widest
 * CSS width the slot ever reaches (see the `sizes` attribute on the slice).
 */
// The logo-grid rollover band is full-bleed `w-screen`, so its backdrops are
// NOT pre-cropped — `object-cover` in the browser crops them per viewport. They
// are only downscaled, and never upscaled past the source. The board draws these
// as frames `logo soup 4`–`13`, one hover state per brand.
const ROLLOVER_WIDTH = 2560;
// The `-m` crops are a genuinely different framing for portrait, not a resize,
// so they are a second asset rather than a smaller rendition of the first.
// 1280 ≈ 3x a 430px viewport; the Math.min guard below caps at the source.
const ROLLOVER_MOBILE_WIDTH = 1280;

/**
 * Dropbox stem → our slug. One entry per brand; the desktop and mobile crops
 * are derived from it, so the pair can never drift apart.
 *
 * Stems are the file names as Dropbox actually holds them — note `preveta_bg-m`
 * is lower-case where `Preveta_bg` is not. Lookups happen to be case-insensitive,
 * but matching the listing keeps this honest against a future case-sensitive host.
 */
const ROLLOVER_BRANDS = [
  { stem: "Revogen", slug: "revogen", note: "matches the board's logo soup 4" },
  { stem: "Preveta", mobileStem: "preveta", slug: "preveta" },
  { stem: "MSOT", slug: "msot" },
  { stem: "Strategy Advantage", slug: "strategy-advantage" },
  { stem: "Alamo Anatomy", slug: "aati" },
  { stem: "domaru", slug: "domaru", note: "board's 6th logo; see the CHP/domaru note above" },
  { stem: "CalTex", slug: "caltex-medical" },
  { stem: "TOSA", slug: "texas-organ-sharing-alliance" },
  { stem: "SCFAI", slug: "scfai" },
];

const ROLLOVER_DIR =
  "/Marketing/RD_website_design/RD_web_2026/Logo Soup - Sales Funnel/02_project images";

const rolloverAssets = ROLLOVER_BRANDS.flatMap((b) => [
  {
    from: `${ROLLOVER_DIR}/${b.stem}_bg.jpg`,
    to: `rollover-${b.slug}.jpg`,
    aspect: null,
    width: ROLLOVER_WIDTH,
    note: b.note,
  },
  {
    from: `${ROLLOVER_DIR}/${b.mobileStem ?? b.stem}_bg-m.jpg`,
    to: `rollover-${b.slug}-mobile.jpg`,
    aspect: null,
    width: ROLLOVER_MOBILE_WIDTH,
  },
]);

const ASSETS = [
  {
    from: "/Marketing/RD Work Images/MSOT/02_Mockups Images/MSOT_Web_Mockup.jpg",
    to: "msot-web-mockup.jpg",
    aspect: 1018 / 658, // FeaturedProject plate
    width: 2400, // slot maxes at 1180px CSS
    note: "khaki iMac mockup; the board crops this portrait shot to a landscape band",
  },

  // ─── logo-grid rollover backdrops ─────────────────────────────────────────
  // These are the DESIGNER'S OWN crops, from a folder built for this feature:
  // RD_website_design/RD_web_2026/"Logo Soup - Sales Funnel"/02_project images.
  // It holds nine `<brand>_bg.jpg` plus a `-m` mobile crop of each, and they
  // supersede the per-client mockups an earlier pass hand-picked out of
  // /Marketing/RD Work Images — those were guesses at the intent, these are the
  // intent. Two of the guesses were also plain wrong (a stitched 5790x18872
  // page grab centre-cropped to an empty text block).
  //
  // The nine are Revogen, Preveta, MSOT, Strategy Advantage, Alamo Anatomy,
  // domaru, CalTex, TOSA, SCFAI — note domaru, NOT Community Health Partners.
  // The board agrees (logo soup 11 is domaru's hover state); the QA copy doc's
  // client list does not. See data.json _contentGaps.
  //
  // Both crops are fetched. The `-m` set is a portrait re-frame, not a resize —
  // the board carries it as a `Backgrounds-mobile` sheet beside the desktop
  // `Backgrounds` one — so it is a separate asset rather than a rendition.
  ...rolloverAssets,

  // ─── domaru logo pair ─────────────────────────────────────────────────────
  // domaru replaces Community Health Partners as the 6th logo: the board and
  // the prepared rollover set both have domaru and neither has CHP (CHP came
  // from the QA copy doc's client list). Its backdrop is the only dark one in
  // the set, so it is also the only logo that needs a knockout — hence the
  // `_rev` pair. 660 = 3x the 220px grid cell.
  {
    from: "/Marketing/RD Work Images/Domaru/Domaru_logo.png",
    to: "logo-domaru.png",
    aspect: null,
    width: 660,
  },
  {
    from: "/Marketing/RD Work Images/Domaru/Domaru_logo_rev.png",
    to: "logo-domaru-rev.png",
    aspect: null,
    width: 660,
    note: "knockout — domaru is the only dark backdrop in the rollover set",
  },
];

let TOKEN = process.env.DROPBOX_ACCESS_TOKEN;
if (!TOKEN) {
  const env = await readFile(MAINTENANCE_ENV, "utf8").catch(() => "");
  TOKEN = env
    .split("\n")
    .find((l) => l.startsWith("DROPBOX_ACCESS_TOKEN="))
    ?.slice("DROPBOX_ACCESS_TOKEN=".length)
    .trim()
    .replace(/^["']|["']$/g, "");
}
if (!TOKEN) {
  console.error("✗ No DROPBOX_ACCESS_TOKEN in the environment or", MAINTENANCE_ENV);
  console.error("  Dropbox tokens generated in the app console expire after ~4h.");
  process.exit(1);
}
/** Dropbox errors echo the request, which carries the bearer token. */
const redact = (s) => String(s).replaceAll(TOKEN, "<redacted>");

const account = await fetch("https://api.dropboxapi.com/2/users/get_current_account", {
  method: "POST",
  headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
  body: "null",
});
if (!account.ok) {
  console.error(`✗ Dropbox auth failed (HTTP ${account.status}).`);
  console.error(`  ${redact((await account.text()).slice(0, 200))}`);
  process.exit(1);
}
const { root_info: rootInfo, email } = await account.json();
const rootHeader = rootInfo?.root_namespace_id
  ? {
      "Dropbox-API-Path-Root": JSON.stringify({
        ".tag": "root",
        root: rootInfo.root_namespace_id,
      }),
    }
  : {};
console.log(`Dropbox: ${email}`);

await mkdir(OUT, { recursive: true });
let failed = 0;

for (const asset of ASSETS) {
  const original = path.join(OUT, `_original-${path.basename(asset.from)}`);
  const dest = path.join(OUT, asset.to);

  const res = await fetch("https://content.dropboxapi.com/2/files/download", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Dropbox-API-Arg": JSON.stringify({ path: asset.from }),
      ...rootHeader,
    },
  });
  if (!res.ok) {
    console.log(
      `  ✗ ${asset.to} — HTTP ${res.status}: ${redact((await res.text()).slice(0, 160))}`,
    );
    failed++;
    continue;
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  await writeFile(original, bytes);

  const { stdout } = await run("sips", ["-g", "pixelWidth", "-g", "pixelHeight", original]);
  const srcW = Number(stdout.match(/pixelWidth: (\d+)/)?.[1]);
  const srcH = Number(stdout.match(/pixelHeight: (\d+)/)?.[1]);

  // `aspect: null` = do not crop, only downscale. That is right for anything
  // rendered with `object-cover` into a full-bleed band: the browser already
  // crops to whatever the viewport is, and baking one crop in throws away the
  // pixels a taller or narrower viewport would have used. Cropping here is for
  // FIXED-ratio slots only (the featured-project plate).
  if (asset.aspect) {
    const bandH = Math.round(srcW / asset.aspect);
    if (bandH > srcH) {
      console.log(`  ✗ ${asset.to} — source ${srcW}x${srcH} too short for ${asset.aspect}`);
      failed++;
      continue;
    }
    await run("sips", ["-c", String(bandH), String(srcW), original, "--out", dest]);
  } else {
    // Keep the source format: forcing jpeg here would flatten the alpha channel
    // out of the logo PNGs and put a black box behind every knockout mark.
    const fmt = path.extname(asset.to).toLowerCase() === ".png" ? "png" : "jpeg";
    await run("sips", ["-s", "format", fmt, original, "--out", dest]);
  }

  // Never upscale: a source smaller than the target invents no detail and only
  // inflates the file — the prepared rollover art is 1920 wide, under the 2560
  // the band would like at 2x.
  //
  // `--resampleWidth`, NOT `-Z`. `-Z` fits the LARGER dimension, which silently
  // means something different for a portrait source: the `-m` crops are
  // 1080x1920, so `-Z 1080` fits the 1920 HEIGHT and lands at 607px wide — a
  // third of the pixels a phone actually needs for a full-bleed band. Every
  // other asset here is landscape, where the two happen to agree, so this was
  // invisible until the mobile crops arrived. `width` is what the `sizes`
  // attribute reasons about, so width is what we constrain.
  const target = Math.min(asset.width, srcW);
  await run("sips", ["--resampleWidth", String(target), dest, "--out", dest]);

  const after = await run("sips", ["-g", "pixelWidth", "-g", "pixelHeight", dest]);
  const w = after.stdout.match(/pixelWidth: (\d+)/)?.[1];
  const h = after.stdout.match(/pixelHeight: (\d+)/)?.[1];
  const capped = target < asset.width ? `  [capped at source ${srcW}]` : "";
  console.log(
    `  ✓ ${asset.to}  ${srcW}x${srcH} → ${w}x${h}${capped}${asset.note ? `  (${asset.note})` : ""}`,
  );

  if (!process.argv.includes("--keep-originals")) await unlink(original).catch(() => {});
}

console.log(`\n${ASSETS.length - failed}/${ASSETS.length} asset(s) written to ${OUT}`);
if (failed) process.exitCode = 1;
