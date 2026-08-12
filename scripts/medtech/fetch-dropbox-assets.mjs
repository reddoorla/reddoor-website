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
const ASSETS = [
  {
    from: "/Marketing/RD Work Images/MSOT/02_Mockups Images/MSOT_Web_Mockup.jpg",
    to: "msot-web-mockup.jpg",
    aspect: 1018 / 658, // FeaturedProject plate
    width: 2400, // slot maxes at 1180px CSS
    note: "khaki iMac mockup; the board crops this portrait shot to a landscape band",
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

  // Centre-crop to the slot's aspect, then downscale. Cropping first means the
  // downscale target is the delivered pixels, not the discarded ones.
  const bandH = Math.round(srcW / asset.aspect);
  if (bandH > srcH) {
    console.log(`  ✗ ${asset.to} — source ${srcW}x${srcH} is too short to crop to ${asset.aspect}`);
    failed++;
    continue;
  }
  await run("sips", ["-c", String(bandH), String(srcW), original, "--out", dest]);
  await run("sips", ["-Z", String(asset.width), dest, "--out", dest]);

  const after = await run("sips", ["-g", "pixelWidth", "-g", "pixelHeight", dest]);
  const w = after.stdout.match(/pixelWidth: (\d+)/)?.[1];
  const h = after.stdout.match(/pixelHeight: (\d+)/)?.[1];
  console.log(`  ✓ ${asset.to}  ${srcW}x${srcH} → ${w}x${h}  (${asset.note})`);

  if (!process.argv.includes("--keep-originals")) await unlink(original).catch(() => {});
}

console.log(`\n${ASSETS.length - failed}/${ASSETS.length} asset(s) written to ${OUT}`);
if (failed) process.exitCode = 1;
