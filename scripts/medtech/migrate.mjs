// MedTech industry landing page — content migration.
//
// Creates (or updates) the `industry` document with uid `medtech` from the
// frozen ./data.json, uploading the Figma-exported assets in ./assets alongside
// it. The copy is transcribed from the Figma board "Sales Funnel v2"; see
// data.json's _source / _copyEdits / _contentGaps keys.
//
// Behaviour
//   • Every field written is validated against the LOCAL src/lib/slices/*/model.json
//     first. A field the model doesn't declare aborts the run with a diff — model
//     drift becomes a loud failure instead of a silently malformed document.
//   • Content is staged as an UNPUBLISHED DRAFT — the Prismic Migration API never
//     auto-publishes. Review in Prismic and Publish to go live.
//   • Re-runnable: if `medtech` already exists the script updates it in place
//     rather than creating a duplicate.
//
// PREREQUISITE: the slice + custom-type MODELS must be pushed to the Prismic repo
// first — migrate() validates slices against the repo's pushed models, and a write
// token cannot push models. Run `pnpm slicemachine`, log in, push, then run this.
//
// Usage
//   node --env-file=.env.local scripts/medtech/migrate.mjs --dry-run
//   node --env-file=.env.local scripts/medtech/migrate.mjs
//
// Needs PRISMIC_WRITE_TOKEN (Prismic → Settings → API & Security → Write APIs).
import * as prismic from "@prismicio/client";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DRY_RUN = process.argv.includes("--dry-run");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSET_DIR = path.join(HERE, "assets");
const SLICES_DIR = path.resolve(HERE, "../../src/lib/slices");

// Prismic client errors can embed the request URL — including ?access_token=… —
// in their message. Never print one unredacted.
const redact = (m) => String(m).replace(/([?&]access_token=)[^&\s"']+/gi, "$1[redacted]");

const rt = (text) => [{ type: "paragraph", text, spans: [] }];
const heading = (level, text) => [{ type: `heading${level}`, text, spans: [] }];
const web = (url) => ({ link_type: "Web", url });

// ─── model validation ────────────────────────────────────────────────────────
// Reads every local slice model so the payload below can be checked field by
// field before a single byte is sent.

async function loadModels() {
  const byId = new Map();
  for (const dir of await readdir(SLICES_DIR, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const file = path.join(SLICES_DIR, dir.name, "model.json");
    if (!existsSync(file)) continue;
    const model = JSON.parse(await readFile(file, "utf8"));
    byId.set(model.id, model);
  }
  return byId;
}

function validateSlice(models, slice, where) {
  const errors = [];
  const model = models.get(slice.slice_type);
  if (!model) return [`${where}: no local model for slice_type "${slice.slice_type}"`];

  const variation = model.variations.find((v) => v.id === slice.variation);
  if (!variation) {
    const known = model.variations.map((v) => v.id).join(", ");
    return [
      `${where}: "${slice.slice_type}" has no variation "${slice.variation}" (has: ${known})`,
    ];
  }

  for (const key of Object.keys(slice.primary ?? {})) {
    const field = variation.primary[key];
    if (!field) {
      const known = Object.keys(variation.primary).join(", ");
      errors.push(
        `${where}: ${slice.slice_type}.${slice.variation} has no field "${key}" (has: ${known})`,
      );
      continue;
    }
    // Group items: check each item's keys against the group's declared fields.
    if (field.type === "Group" && Array.isArray(slice.primary[key])) {
      const declared = Object.keys(field.config.fields);
      slice.primary[key].forEach((item, i) => {
        for (const sub of Object.keys(item)) {
          if (!declared.includes(sub)) {
            errors.push(
              `${where}: ${slice.slice_type}.${key}[${i}] has no field "${sub}" (has: ${declared.join(", ")})`,
            );
          }
        }
      });
    }
  }
  return errors;
}

async function validateCustomType(slices) {
  const file = path.resolve(HERE, "../../customtypes/industry/index.json");
  const ct = JSON.parse(await readFile(file, "utf8"));
  const allowed = Object.keys(ct.json.Main.slices.config.choices);
  return [...new Set(slices.map((s) => s.slice_type))]
    .filter((t) => !allowed.includes(t))
    .map(
      (t) => `custom type "industry" does not allow slice "${t}" (allows: ${allowed.join(", ")})`,
    );
}

// ─── asset staging ───────────────────────────────────────────────────────────
// createAsset is called once per file and the returned reference is reused, so a
// logo shared by two slices uploads once.

function makeAssetStager(migration) {
  const cache = new Map();
  return async (filename, alt) => {
    if (!filename) return undefined;
    if (cache.has(filename)) return cache.get(filename);
    const file = path.join(ASSET_DIR, filename);
    if (!existsSync(file)) throw new Error(`asset not found: ${file}`);
    const bytes = await readFile(file);
    const type =
      { ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" }[
        path.extname(filename).toLowerCase()
      ] ?? "image/png";
    const asset = migration.createAsset(new File([bytes], filename, { type }), filename, {
      alt: alt || undefined,
    });
    cache.set(filename, asset);
    return asset;
  };
}

// ─── slice construction ──────────────────────────────────────────────────────

async function buildSlices(d, stage, projects) {
  const project = (uid) => {
    const doc = projects.get(uid);
    if (!doc) throw new Error(`no published project doc with uid "${uid}" to link to`);
    return doc;
  };

  return [
    {
      slice_type: "industry_hero",
      slice_label: null,
      variation: "default",
      primary: {
        image: await stage(d.hero.image, d.hero.imageAlt),
        headline: heading(1, d.hero.headline),
        card_label: d.hero.cardLabel,
        card_body: rt(d.hero.cardBody),
        buttons: d.hero.buttons.map((b) => ({ link: { ...web(b.url), text: b.label } })),
        isAnimated: true,
        hide: false,
      },
      items: [],
    },
    {
      slice_type: "lead_text",
      slice_label: null,
      variation: "rail",
      primary: {
        eyebrow: d.services.eyebrow,
        body: rt(d.services.lead),
        subBody: rt(d.services.subBody),
        isAnimated: true,
        hide: false,
      },
      items: [],
    },
    {
      slice_type: "text_columns",
      slice_label: null,
      variation: "serviceList",
      primary: {
        eyebrow: "",
        hasTopRule: false,
        desktopColumns: "3",
        columns: d.services.columns.map((c) => ({
          title: c.title,
          // One paragraph per service — the serviceList variation renders each
          // paragraph as its own ruled row.
          body: c.items.map((t) => ({ type: "paragraph", text: t, spans: [] })),
        })),
        isAnimated: true,
        hide: false,
      },
      items: [],
    },
    {
      slice_type: "lead_text",
      slice_label: null,
      variation: "rail",
      primary: {
        eyebrow: d.framework.eyebrow,
        body: rt(d.framework.lead),
        isAnimated: true,
        hide: false,
      },
      items: [],
    },
    {
      slice_type: "text_columns",
      slice_label: null,
      variation: "iconColumns",
      primary: {
        eyebrow: "",
        hasTopRule: true,
        desktopColumns: "3",
        // No icon: the board replaced the per-step icons with numbers derived
        // from each column's position, so the field is gone from the model and
        // sending it here would now fail the local model check. `data.json`
        // keeps its `icon` keys as a record of what the first cut used.
        columns: d.framework.columns.map((c) => ({
          title: c.title,
          subtitle: c.subtitle,
          body: rt(c.body),
        })),
        isAnimated: true,
        hide: false,
      },
      items: [],
    },
    {
      slice_type: "case_study",
      slice_label: null,
      variation: "default",
      primary: {
        label: d.caseStudy.label,
        project_name: d.caseStudy.projectName,
        services: d.caseStudy.services,
        heading: d.caseStudy.heading,
        after_image: await stage(d.caseStudy.afterImage, d.caseStudy.afterImageAlt),
        // Extra slides for the after slideshow. `after_image` is slide 1, so
        // this group holds only the rest — see the slice's `afterSlides`.
        after_images: await Promise.all(
          (d.caseStudy.afterSlides ?? []).map(async (s) => ({
            image: await stage(s.file, s.alt),
          })),
        ),
        before_image: await stage(d.caseStudy.beforeImage, d.caseStudy.beforeImageAlt),
        vimeo_id: "",
        // The band's stretched link was removed when the after state became a
        // slideshow — it sat over the slideshow's own pause and prev/next
        // controls. The slice no longer renders one.
        //
        // `{ link_type: "Any" }` is how Prismic represents an EMPTY link field.
        // A bare `{}` is not: the API validates link_type against
        // Web|Document|Media|Any and rejects the whole document without it.
        link: { link_type: "Any" },
        isAnimated: true,
        hide: false,
      },
      items: [],
    },
    {
      slice_type: "logo_grid",
      slice_label: null,
      variation: "default",
      primary: {
        label: d.logoGrid.label,
        link: { ...web(d.logoGrid.buttonUrl), text: d.logoGrid.buttonLabel },
        logos: await Promise.all(
          d.logoGrid.logos.map(async (l) => ({
            logo: await stage(l.file, l.name),
            // Rollover backdrop. Per-logo optional on purpose: Community Health
            // Partners has no photography in Dropbox, and the slice treats a
            // missing backdrop as "this logo does not light up" rather than
            // letting one gap disable the other eight.
            active_background: l.rollover
              ? await stage(l.rollover, `${l.name} — project work`)
              : undefined,
            // Portrait re-frame of the same art, served below 768px. The band
            // is full-bleed, so the landscape crop loses most of its subject on
            // a phone; the slice picks between the two with a <picture> media
            // query and falls back to the landscape one when this is absent.
            active_background_mobile: l.rolloverMobile
              ? await stage(l.rolloverMobile, `${l.name} — project work`)
              : undefined,
            // Knockout logo, only for brands whose backdrop is dark enough that
            // the colour mark disappears against it. Currently just dōmaru.
            logo_negative: l.negative ? await stage(l.negative, l.name) : undefined,
            name: l.name,
            link: l.project ? project(l.project) : undefined,
          })),
        ),
        isAnimated: true,
        hide: false,
      },
      items: [],
    },
    {
      slice_type: "testimonial",
      slice_label: null,
      variation: "default",
      primary: {
        label: d.testimonial.label,
        quote: d.testimonial.quote,
        name: d.testimonial.name,
        role: d.testimonial.role,
        avatar: await stage(d.testimonial.avatar, d.testimonial.avatarAlt),
        isAnimated: true,
        hide: false,
      },
      items: [],
    },
    {
      slice_type: "featured_project",
      slice_label: null,
      variation: "default",
      primary: {
        image: await stage(d.featuredProject.image, d.featuredProject.imageAlt),
        title: d.featuredProject.title,
        services: d.featuredProject.services,
        link: project(d.featuredProject.link.uid),
        // The board runs the testimonial's paper texture 160px into this band
        // (texture→white boundary measured at y=508; this section starts at
        // y=348) with the plate sitting on top of it.
        hasTextureBleed: d.featuredProject.hasTextureBleed ?? false,
        hasTopPadding: false,
        hasBottomPadding: false,
        isAnimated: true,
        hide: false,
      },
      items: [],
    },
    {
      slice_type: "value_block",
      slice_label: null,
      variation: "expandable",
      primary: {
        displayTitle: d.about.displayTitle,
        eyebrow: d.about.eyebrow,
        lede: rt(d.about.lede),
        body: d.about.body.map((t) => ({ type: "paragraph", text: t, spans: [] })),
        readMoreLabel: d.about.readMoreLabel,
        isAnimated: true,
        hide: false,
      },
      items: [],
    },
    {
      slice_type: "accordion",
      slice_label: null,
      variation: "rail",
      primary: {
        label: d.faq.label,
        defaultOpen: false,
        // Answers are NOT in the Figma board — the design only ever drew the
        // collapsed questions. They come from the QA copy doc (Tab 1 → Your
        // FAQ), which is the agreed fallback when the board is silent. One
        // rich-text paragraph per paragraph in the doc, so the disclosure keeps
        // the copy's own breaks rather than running it into one block.
        items: d.faq.questions.map((q) => ({ title: q.q, body: (q.a ?? []).flatMap(rt) })),
        hide: false,
      },
      items: [],
    },
    {
      slice_type: "cta_banner",
      slice_label: null,
      variation: "default",
      primary: {
        heading: heading(2, d.cta.heading),
        buttonLabel: d.cta.buttonLabel,
        buttonLink: web(d.cta.buttonUrl),
        background: d.cta.background,
        hasTopPadding: true,
        hasBottomPadding: true,
        isAnimated: true,
        hide: false,
      },
      items: [],
    },
  ];
}

// ─── run ─────────────────────────────────────────────────────────────────────

const config = JSON.parse(
  await readFile(path.resolve(HERE, "../../slicemachine.config.json"), "utf8"),
);
const d = JSON.parse(await readFile(path.join(HERE, "data.json"), "utf8"));

const writeToken = process.env.PRISMIC_WRITE_TOKEN;
if (!writeToken && !DRY_RUN) {
  console.error("Missing PRISMIC_WRITE_TOKEN. Run with --env-file=.env.local, or pass --dry-run.");
  process.exit(1);
}

const readClient = prismic.createClient(
  config.repositoryName,
  writeToken ? { accessToken: writeToken } : undefined,
);

// Resolve the project docs the page links to, up front — a missing one should
// fail before anything is uploaded.
// `caseStudy` no longer contributes one: its stretched link was removed when
// the after state became a slideshow, so the key is absent from data.json.
const linkedUids = [
  d.caseStudy.link?.uid,
  d.featuredProject.link.uid,
  ...d.logoGrid.logos.map((l) => l.project).filter(Boolean),
].filter(Boolean);
const projects = new Map();
// This loop makes the script's first network call, so it is also where a bad
// repository name, a missing token or a dead connection first surfaces. Report
// those as themselves — a bare catch here would blame data.json for an outage.
for (const uid of [...new Set(linkedUids)]) {
  try {
    projects.set(uid, await readClient.getByUID("project", uid));
  } catch (e) {
    if (e instanceof prismic.NotFoundError) {
      console.error(`✗ no published project with uid "${uid}" — fix data.json or publish it.`);
    } else {
      console.error(`✗ could not reach Prismic while resolving "${uid}": ${redact(e.message)}`);
    }
    process.exit(1);
  }
}

const migration = prismic.createMigration();
const stage = makeAssetStager(migration);
const slices = await buildSlices(d, stage, projects);

// Validate before touching the API.
const models = await loadModels();
const errors = [
  ...(await validateCustomType(slices)),
  ...slices.flatMap((s, i) => validateSlice(models, s, `slice[${i}]`)),
];
if (errors.length) {
  console.error(`\n✗ ${errors.length} model mismatch(es) — nothing was sent:\n`);
  for (const e of errors) console.error(`   ${e}`);
  process.exit(1);
}

console.log(`\nMedTech landing page → ${config.repositoryName}`);
console.log(`  uid:    ${d.uid}`);
console.log(`  slices: ${slices.length}`);
for (const s of slices) console.log(`    · ${s.slice_type} (${s.variation})`);
console.log(`  linked projects: ${[...projects.keys()].join(", ")}`);
console.log(`  models validated: OK`);
for (const gap of d._contentGaps) console.log(`  ! ${gap}`);

if (DRY_RUN) {
  console.log("\nDRY-RUN: nothing sent.");
  process.exit(0);
}

let existing;
try {
  existing = await readClient.getByUID("industry", d.uid);
} catch (e) {
  // Only "no such document" means "create it". Anything else — a bad repository
  // name, a rejected token, DNS, a CDN 5xx — must not be silently rewritten
  // into the create branch: the UID already exists, so the create would be
  // rejected by the API, but only AFTER re-uploading every asset.
  if (e instanceof prismic.NotFoundError) {
    existing = null;
  } else {
    console.error(`\n✗ Could not read the existing "${d.uid}" document: ${redact(e.message)}`);
    process.exit(1);
  }
}

const docData = {
  title: heading(1, d.title),
  slices,
  meta_title: d.meta_title,
  meta_description: d.meta_description,
};

if (existing) {
  // `meta_image` is deliberately absent from docData rather than set to
  // `undefined`: the Migration API replaces `data` wholesale, and a
  // present-but-undefined key wins the spread and then vanishes in
  // JSON.stringify — which would silently clear a share image an editor had
  // set in Prismic. Omitting the key lets `existing.data` carry it through.
  migration.updateDocument({ ...existing, data: { ...existing.data, ...docData } }, d.title);
  console.log(`\nUpdating existing document…`);
} else {
  migration.createDocument(
    { type: "industry", uid: d.uid, lang: "en-us", data: { ...docData, meta_image: undefined } },
    d.title,
  );
  console.log(`\nCreating new document…`);
}

const writeClient = prismic.createWriteClient(config.repositoryName, { writeToken });
try {
  await writeClient.migrate(migration, {
    reporter: (e) => e.type === "documents:created" && console.log("  …documents written"),
  });
} catch (e) {
  console.error(`\n✗ MIGRATE FAILED: ${redact(e.message)}`);
  // `message` is only ever "Validation failed" — the field paths that actually
  // failed live on the error's response body, so surface it or the failure is
  // undiagnosable. Redacted: the client echoes the request URL, which carries
  // ?access_token=.
  if (e.response) console.error(`  ${redact(JSON.stringify(e.response, null, 2)).slice(0, 4000)}`);
  console.error("  If this mentions unknown slices or fields, the models are not pushed yet:");
  console.error("  run `pnpm slicemachine`, log in, push the models, then re-run.");
  process.exitCode = 1;
  process.exit();
}

console.log("\n✓ Staged as an unpublished draft. Review in Prismic and Publish to go live.");
