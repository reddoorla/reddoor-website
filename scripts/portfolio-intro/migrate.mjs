// Portfolio-intro content migration.
//
// Prepends the portfolio-page intro slices — LeadText ("The Challenge" + serif
// lead) → TextColumns ("Our Solution", 3 columns) → optional Accordion ("About X")
// — onto each mapped Prismic `project` doc, from the frozen ./data.json.
//
// The masthead (title / hero / tagline / Branding-Digital tags) already lives on
// each doc as page-level fields and is left untouched. Everything below the intro
// (the existing project body) flows after it, unchanged.
//
// Behaviour
//   • Idempotent — only the LEADING CONTIGUOUS RUN of intro-type slices is
//     treated as "the intro" and replaced; an editor-added lead_text/
//     text_columns/accordion deeper in the doc is content and is preserved.
//     (Slice planning lives in ./lib.mjs and is unit-tested.)
//   • Per-doc `dropExistingLead` (in data.json) removes the slice after the
//     intro ONLY if it is a rich_text whose copy duplicates the new lead/
//     accordion — an organic editor paragraph never matches and is kept.
//   • Content is staged as an UNPUBLISHED DRAFT — the Prismic Migration API never
//     auto-publishes. Review each doc and Publish to go live.
//
// Usage
//   node --env-file=.env.local scripts/portfolio-intro/migrate.mjs --dry-run
//   node --env-file=.env.local scripts/portfolio-intro/migrate.mjs
//   node --env-file=.env.local scripts/portfolio-intro/migrate.mjs --only=aura,worthe
//
// Needs PRISMIC_WRITE_TOKEN (Prismic → Settings → API & Security → Write APIs).
import * as prismic from "@prismicio/client";
import { readFile } from "node:fs/promises";
import { planSlices } from "./lib.mjs";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const only = args
  .find((a) => a.startsWith("--only="))
  ?.slice(7)
  .split(",")
  .filter(Boolean);

const p = (text) => [{ type: "paragraph", text, spans: [] }];

function buildIntro(intro) {
  const slices = [
    {
      slice_type: "lead_text",
      slice_label: null,
      variation: "default",
      primary: { eyebrow: intro.eyebrow, body: p(intro.lead), isAnimated: true, hide: false },
      items: [],
    },
    {
      slice_type: "text_columns",
      slice_label: null,
      variation: "default",
      primary: {
        eyebrow: intro.solutionEyebrow,
        hasTopRule: true,
        desktopColumns: "3",
        columns: intro.columns.map((c) => ({ title: c.title, body: p(c.body) })),
        isAnimated: true,
        hide: false,
      },
      items: [],
    },
  ];
  if (intro.accordion?.body) {
    slices.push({
      slice_type: "accordion",
      slice_label: null,
      variation: "default",
      primary: {
        defaultOpen: true,
        items: [{ title: intro.accordion.title, body: p(intro.accordion.body) }],
        hide: false,
      },
      items: [],
    });
  }
  return slices;
}

const config = JSON.parse(
  await readFile(new URL("../../slicemachine.config.json", import.meta.url), "utf8"),
);
const { entries } = JSON.parse(await readFile(new URL("./data.json", import.meta.url), "utf8"));

const writeToken = process.env.PRISMIC_WRITE_TOKEN;
if (!writeToken && !DRY_RUN) {
  console.error(
    "Missing PRISMIC_WRITE_TOKEN. Run: node --env-file=.env.local scripts/portfolio-intro/migrate.mjs",
  );
  process.exit(1);
}
const readClient = prismic.createClient(
  config.repositoryName,
  writeToken ? { accessToken: writeToken } : undefined,
);
const writeClient = DRY_RUN
  ? null
  : prismic.createWriteClient(config.repositoryName, { writeToken });

let targets = entries;
if (only) {
  // A typo'd uid must fail loudly, not report a success-shaped "0/0 planned".
  const known = new Set(entries.map((e) => e.uid));
  const unknown = only.filter((u) => !known.has(u));
  if (unknown.length) {
    console.error(
      `Unknown uid(s) in --only: ${unknown.join(", ")}\nKnown: ${[...known].join(", ")}`,
    );
    process.exit(1);
  }
  targets = targets.filter((e) => only.includes(e.uid));
}

let ok = 0;
for (const entry of targets) {
  const intro = buildIntro(entry.intro);
  const types = intro.map((s) => s.slice_type).join("+");
  const accNote =
    entry.intro.accordion && !entry.intro.accordion.body
      ? "  (accordion omitted: no body copy)"
      : "";

  let doc;
  try {
    doc = await readClient.getByUID("project", entry.uid);
  } catch (e) {
    console.log(`✗ ${entry.uid.padEnd(30)} FETCH FAILED: ${e.message}`);
    continue;
  }

  const existing = Array.isArray(doc.data?.slices) ? doc.data.slices : [];
  const {
    slices: newSlices,
    dropped,
    replacedIntroCount,
  } = planSlices({
    existing,
    intro,
    dropExistingLead: entry.dropExistingLead,
    introTexts: [entry.intro.lead, entry.intro.accordion?.body].filter(Boolean),
  });
  const action = dropped ? `drop duplicate "${dropped.slice(0, 40)}…"` : "keep";

  console.log(`\n• ${entry.title}  →  ${entry.uid}  [${types}]${accNote}`);
  console.log(`    replacing leading intro run of ${replacedIntroCount}; old lead: ${action}`);
  console.log(`    slices ${existing.length} → ${newSlices.length}`);

  if (DRY_RUN) {
    ok++;
    continue;
  }
  const migration = prismic.createMigration();
  migration.updateDocument({ ...doc, data: { ...doc.data, slices: newSlices } }, doc.uid ?? doc.id);
  await writeClient.migrate(migration, { reporter: () => {} });
  console.log("    ✓ migrated (draft)");
  ok++;
}

console.log(
  `\n${DRY_RUN ? "DRY-RUN" : "DONE"}: ${ok}/${targets.length} ${DRY_RUN ? "planned" : "migrated as drafts"}.`,
);
if (!DRY_RUN && ok) console.log("Review each doc in Prismic and Publish to go live.");
