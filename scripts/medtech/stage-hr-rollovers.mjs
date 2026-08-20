// Stage the high-resolution rollover originals over the low-res crops.
//
// Background
// ----------
// The published backdrops are 1920x1440 — the designer's TIGHT CROPS, exported
// at a resolution that tops out well under what a 1440 viewport needs at DPR 2
// (they were serving ~67% of the pixels the band asks for). Nicole then supplied
// "02_project images HR": the same shoots at 4000-6000px, but as the UNCROPPED
// originals — same 4:3 frame, more scene in it, so the subject sits smaller.
//
// So these are not drop-in replacements. Uploading them restores the resolution
// but loses the framing, which is why the crop now lives in Prismic: the
// `active_background` field carries a `mobile` thumbnail and Prismic's own
// crop/zoom editor, so the framing is set once in the CMS and can be adjusted
// later without a new export. Stage these, crop them in Prismic against the
// reference sheet, then publish.
//
// NOTE Preveta: "Demo Day TV.jpg" is a DIFFERENT mockup from the published
// Preveta backdrop (a wall-mounted screen in an open office, where the live one
// is a wood-panelled conference room). It is Preveta artwork — the on-screen
// design is theirs, and it is the only file left once the other eight are
// matched by name — but it is a new shot, not a re-export. Worth a look before
// publishing.
//
// Usage: node scripts/medtech/stage-hr-rollovers.mjs [--dry-run]
import sharp from "sharp";
import { readdir, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(HERE, "assets");
const DRY = process.argv.includes("--dry-run");

// Downloaded from the shared link Nicole posted in #rd-website — a PUBLIC
// share, so `&dl=1` fetches the folder as a zip with no token at all. That is
// worth preferring over the API path: the console tokens this repo has used
// expire in ~4h and had to be re-pasted every session.
//   curl -L -o hr.zip "<share-url>&dl=1"
const SOURCE_DIR =
  process.env.HR_DIR ??
  "/private/tmp/claude-501/-Users-tuckerlemos-Documents-GitHub-reddoor-website/32c72721-961a-42b9-bca3-8fd8ad31a640/scratchpad/hr/unpacked";

// Eight of nine name their brand outright. "Demo Day TV" does not — it is
// Preveta by elimination (nine files, nine brands, the other eight matched) and
// confirmed by the PREVETA artwork on the screen.
const MAP = {
  "Revogen-Packaging-Allograft.jpg": "revogen",
  "Demo Day TV.jpg": "preveta",
  "MSOT_iPad Pro Mockup HR.jpg": "msot",
  "SA_Conference Room-HR.jpg": "strategy-advantage",
  "Alamo Anatomy_Phone_Mockup.jpg": "aati",
  "Domaru.jpg": "domaru",
  "CalTex_iMac_Mockup_1.jpg": "caltex-medical",
  "TOSA_Packing_Procedure_Checklists_Vessel-4 HR.jpg": "texas-organ-sharing-alliance",
  "SCFAI ipad.jpg": "scfai",
};

// 3840 is the pipeline's existing rollover ceiling and covers a 1920 viewport at
// DPR 2 with room to spare; the originals go to 6000, which is upload weight for
// pixels no viewport asks for. Cropping in Prismic happens against the STORED
// asset, so this is the resolution the crop is taken from.
const MAX_WIDTH = 3840;

await mkdir(ASSETS, { recursive: true });
const present = new Set(await readdir(SOURCE_DIR));

let staged = 0;
for (const [file, slug] of Object.entries(MAP)) {
  if (!present.has(file)) {
    console.log(`  ✗ missing: ${file}`);
    continue;
  }
  const src = path.join(SOURCE_DIR, file);
  const dest = path.join(ASSETS, `rollover-${slug}.jpg`);
  const meta = await sharp(src).metadata();
  const target = Math.min(MAX_WIDTH, meta.width);

  console.log(
    `${file.padEnd(50)} → rollover-${slug}.jpg`.padEnd(96) +
      `${meta.width}x${meta.height} → ${target}px wide`,
  );
  if (DRY) continue;

  await sharp(src)
    .resize({ width: target, withoutEnlargement: true })
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(`${dest}.tmp`);
  await sharp(`${dest}.tmp`).toFile(dest);
  staged++;
}

console.log(DRY ? "\n(--dry-run: nothing written)" : `\n${staged} rollover backdrop(s) staged.`);
