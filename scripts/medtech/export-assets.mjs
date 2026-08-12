// Re-export the MedTech landing page's images from Figma into ./assets.
//
// The assets are staging inputs for ./migrate.mjs, not site assets — they are
// gitignored and regenerated on demand, so the repo doesn't carry ~11MB of
// binaries for a one-shot content load. Figma render URLs expire, so node ids
// are the durable reference; they are recorded here.
//
// Usage
//   node --env-file=../reddoor-maintenance/.env scripts/medtech/export-assets.mjs
//   FIGMA_PAT=… node scripts/medtech/export-assets.mjs
//
// Board: "Sales Funnel v2" (4791:818) in file HRxyQGlQwQDEqOuRlEaZoL.
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const FILE_KEY = "HRxyQGlQwQDEqOuRlEaZoL";
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "assets");

// name → Figma node id.
const PNG = {
  // Unlicensed iStock comp (id 2184775810) exported at the board's comp
  // resolution. Placeholder only — replace with a licensed hi-res before launch.
  "hero-PLACEHOLDER-istock-comp": "4799:479",
  "revogen-packaging-after": "4793:1421",
  "testimonial-albert-turgon": "4803:848",
  "msot-web-mockup": "4803:855",
  "logo-revogen": "4802:534",
  "logo-preveta": "4802:535",
  "logo-msot": "4802:536",
  "logo-strategy-advantage": "4802:538",
  // The AATI cell is a lockup of two vectors; exporting the parent frame
  // flattens them into the single asset the logo grid expects.
  "logo-aati": "4802:655",
  "logo-community-health-partners": "4802:539",
  "logo-caltex-medical": "4802:542",
  "logo-texas-organ-sharing-alliance": "4802:653",
  "logo-scfai": "4802:585",
};
const SVG = {
  "icon-diagnosis-audit": "4793:1225",
  "icon-rebuild": "4793:1228",
  "icon-rollout-launch": "4793:1234",
  "icon-arrow-circle": "4821:448",
};

const PAT = process.env.FIGMA_PAT;
if (!PAT) {
  console.error("Missing FIGMA_PAT (Figma → Settings → Personal access tokens).");
  process.exit(1);
}

async function exportBatch(map, format, scale) {
  const qs = new URLSearchParams({ ids: Object.values(map).join(","), format });
  if (scale) qs.set("scale", String(scale));
  const res = await fetch(`https://api.figma.com/v1/images/${FILE_KEY}?${qs}`, {
    headers: { "X-Figma-Token": PAT },
  });
  const json = await res.json();
  if (json.err) throw new Error(`Figma ${format} export failed: ${json.err}`);

  let failed = 0;
  for (const [name, id] of Object.entries(map)) {
    const url = json.images[id];
    if (!url) {
      console.log(`  ✗ ${name} (${id}) — no render URL`);
      failed++;
      continue;
    }
    // Check the status: without it a 403/5xx body gets written to disk under
    // the asset's name, reported with a ✓, and skipped by the `failed` counter
    // that drives the summary and the exit code — so a broken export looks like
    // a clean run until the corrupt file reaches Prismic.
    const dl = await fetch(url);
    if (!dl.ok) {
      console.log(`  ✗ ${name} (${id}) — download failed: HTTP ${dl.status} ${dl.statusText}`);
      failed++;
      continue;
    }
    const bytes = Buffer.from(await dl.arrayBuffer());
    await writeFile(path.join(OUT, `${name}.${format}`), bytes);
    console.log(`  ✓ ${name}.${format}  ${(bytes.length / 1024).toFixed(0)}KB`);
  }
  return failed;
}

await mkdir(OUT, { recursive: true });
console.log("PNG @2x:");
const a = await exportBatch(PNG, "png", 2);
console.log("SVG:");
const b = await exportBatch(SVG, "svg");
console.log(
  `\n${Object.keys(PNG).length + Object.keys(SVG).length - a - b} asset(s) written to ${OUT}`,
);
if (a + b) process.exitCode = 1;
