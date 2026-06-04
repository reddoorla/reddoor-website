import * as prismic from "@prismicio/client";
import { readFile } from "node:fs/promises";

const SLICE_DEFAULTS = {
  rich_text: true,
  screen_width_columns: true,
  content_width_image: true,
  screen_width_image: false,
};

const AFFECTED_TYPES = new Set(Object.keys(SLICE_DEFAULTS));

const writeToken = process.env.PRISMIC_WRITE_TOKEN;
if (!writeToken) {
  console.error(
    "Missing PRISMIC_WRITE_TOKEN env var. Generate one in Prismic → Settings → API & Security → Write APIs & Security.",
  );
  process.exit(1);
}

const config = JSON.parse(
  await readFile(new URL("../slicemachine.config.json", import.meta.url), "utf8"),
);

const snapshot = JSON.parse(
  await readFile(new URL("./padding-snapshot.json", import.meta.url), "utf8"),
);

const readClient = prismic.createClient(config.repositoryName);
const writeClient = prismic.createWriteClient(config.repositoryName, {
  writeToken,
});

const byDoc = new Map();
for (const entry of snapshot) {
  const key = `${entry.docId}__${entry.lang}`;
  if (!byDoc.has(key)) byDoc.set(key, []);
  byDoc.get(key).push(entry);
}

const migration = prismic.createMigration();
let touchedDocs = 0;
let touchedSlices = 0;

for (const [key, entries] of byDoc) {
  const [docId, lang] = key.split("__");

  let doc;
  try {
    doc = await readClient.getByID(docId, { lang });
  } catch (err) {
    console.warn(`Skipping ${docId} (${lang}): ${err.message ?? err}`);
    continue;
  }

  const slices = doc.data?.slices;
  if (!Array.isArray(slices)) {
    console.warn(`Skipping ${docId} (${lang}): no slices field on data.`);
    continue;
  }

  const newSlices = slices.map((slice, idx) => {
    if (!AFFECTED_TYPES.has(slice.slice_type)) return slice;

    // Strip the now-removed hasPadding so the write doesn't fail validation.
    const { hasPadding: oldValue, ...primaryRest } = slice.primary ?? {};

    const entry = entries.find((e) => e.sliceIndex === idx && e.sliceType === slice.slice_type);
    const snapshotValue = typeof entry?.hasPadding === "boolean" ? entry.hasPadding : null;
    const value =
      snapshotValue ??
      (typeof oldValue === "boolean" ? oldValue : null) ??
      SLICE_DEFAULTS[slice.slice_type] ??
      false;

    touchedSlices++;
    return {
      ...slice,
      primary: {
        ...primaryRest,
        hasTopPadding: value,
        hasBottomPadding: value,
      },
    };
  });

  migration.updateDocument({ ...doc, data: { ...doc.data, slices: newSlices } }, doc.uid ?? doc.id);
  touchedDocs++;
}

console.log(
  `Queued ${touchedSlices} slice updates across ${touchedDocs} docs. Sending migration...`,
);

await writeClient.migrate(migration, {
  reporter: (event) => console.log(event),
});

console.log("Migration complete.");
