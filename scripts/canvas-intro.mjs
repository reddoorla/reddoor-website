// One-shot content migration: populate the CANVAS Worldwide project's slice zone
// with the new portfolio-intro slices (LeadText / TextColumns / Accordion) from
// the Figma design. Idempotent — re-running replaces the intro slices rather than
// duplicating them, and preserves any other slices already on the document.
//
//   node --env-file=.env.local scripts/canvas-intro.mjs            # write
//   node --env-file=.env.local scripts/canvas-intro.mjs --dry-run  # preview only
//
// Needs PRISMIC_WRITE_TOKEN (Prismic → Settings → API & Security → Write APIs).
import * as prismic from "@prismicio/client";
import { readFile } from "node:fs/promises";

const DRY_RUN = process.argv.includes("--dry-run");
const TARGET_UID = "canvas-worldwide";
const INTRO_TYPES = new Set(["lead_text", "text_columns", "accordion"]);

// Rich text is the Prismic API shape: an array of block nodes.
const p = (text) => [{ type: "paragraph", text, spans: [] }];

const INTRO_SLICES = [
  {
    slice_type: "lead_text",
    slice_label: null,
    variation: "default",
    primary: {
      eyebrow: "The Challenge",
      body: p(
        "As a brand-new global media agency, CANVAS Worldwide wanted to “do business differently”; they needed an identity on a tight timeline to communicate that message from day one. People needed to see the brand as a fresh, creative, innovative new player who they feel intrigued, inspired, and curious to explore.",
      ),
      isAnimated: true,
      hide: false,
    },
    items: [],
  },
  {
    slice_type: "text_columns",
    slice_label: null,
    variation: "default",
    primary: {
      eyebrow: "Our Solution",
      hasTopRule: true,
      desktopColumns: "3",
      columns: [
        {
          title: "Straight A Design",
          body: p(
            "The “implied frame” identity draws from the company’s philosophy: you can use imagination to achieve almost anything on a blank canvas.",
          ),
        },
        {
          title: "Collective Buy-In",
          body: p(
            "The design was met with a standing ovation from leadership and carried the brand through launch and hiring.",
          ),
        },
        {
          title: "Collaborative Effort",
          body: p(
            "On a tight timeline, Canvas Worldwide trusted us to deliver a bold, thought-provoking solution—the launching point for a hiring campaign that made waves across the agency world.",
          ),
        },
      ],
      isAnimated: true,
      hide: false,
    },
    items: [],
  },
  {
    slice_type: "accordion",
    slice_label: null,
    variation: "default",
    primary: {
      defaultOpen: true,
      items: [
        {
          title: "About Canvas Worldwide",
          body: p(
            "We worked with a great team at Innocean Worldwide USA to create a visionary brand identity for CANVAS Worldwide from scratch — a stand-alone global media agency. CANVAS is a joint venture between INNOCEAN Worldwide and Horizon Media, representing the ability to generate custom-designed solutions for the ever-changing advertising landscape while embodying a spirit of creativity and curiosity.",
          ),
        },
      ],
      hide: false,
    },
    items: [],
  },
];

const writeToken = process.env.PRISMIC_WRITE_TOKEN;
if (!writeToken && !DRY_RUN) {
  console.error(
    "Missing PRISMIC_WRITE_TOKEN. Run with:  node --env-file=.env.local scripts/canvas-intro.mjs",
  );
  process.exit(1);
}

const config = JSON.parse(
  await readFile(new URL("../slicemachine.config.json", import.meta.url), "utf8"),
);

const readClient = prismic.createClient(config.repositoryName);
const doc = await readClient.getByUID("project", TARGET_UID);

const existing = Array.isArray(doc.data?.slices) ? doc.data.slices : [];
// Drop any prior intro slices so a re-run replaces rather than duplicates; keep
// everything else, appended after the fresh intro.
const kept = existing.filter((s) => !INTRO_TYPES.has(s.slice_type));
const newSlices = [...INTRO_SLICES, ...kept];

console.log(`Target: ${doc.uid} (${doc.id}) — "${doc.data.title}"`);
console.log(`  before: [${existing.map((s) => s.slice_type).join(", ") || "(empty)"}]`);
console.log(`  after:  [${newSlices.map((s) => s.slice_type).join(", ")}]`);

if (DRY_RUN) {
  console.log("\n--dry-run: no write performed.");
  process.exit(0);
}

const writeClient = prismic.createWriteClient(config.repositoryName, { writeToken });
const migration = prismic.createMigration();
migration.updateDocument({ ...doc, data: { ...doc.data, slices: newSlices } }, doc.uid ?? doc.id);

console.log("\nSending migration…");
await writeClient.migrate(migration, {
  reporter: (event) => console.log(" ", event.type ?? event),
});
console.log("Migration complete. Verify in Prismic and on the deploy preview.");
