import * as prismic from "@prismicio/client";
import { readFile, writeFile } from "node:fs/promises";

const AFFECTED_TYPES = new Set([
  "rich_text",
  "screen_width_columns",
  "content_width_image",
  "screen_width_image",
]);

const config = JSON.parse(
  await readFile(new URL("../slicemachine.config.json", import.meta.url), "utf8"),
);

const client = prismic.createClient(config.repositoryName);
const docs = await client.dangerouslyGetAll({ lang: "*" });

const snapshot = [];
for (const doc of docs) {
  const slices = doc.data?.slices;
  if (!Array.isArray(slices)) continue;
  slices.forEach((slice, sliceIndex) => {
    if (!AFFECTED_TYPES.has(slice?.slice_type)) return;
    snapshot.push({
      docId: doc.id,
      uid: doc.uid,
      lang: doc.lang,
      type: doc.type,
      sliceIndex,
      sliceType: slice.slice_type,
      hasPadding: typeof slice.primary?.hasPadding === "boolean" ? slice.primary.hasPadding : null,
    });
  });
}

const outPath = new URL("./padding-snapshot.json", import.meta.url);
await writeFile(outPath, JSON.stringify(snapshot, null, 2));

const docCount = new Set(snapshot.map((s) => `${s.docId}:${s.lang}`)).size;
console.log(
  `Snapshot complete: ${snapshot.length} affected slices across ${docCount} doc/locale pairs.`,
);
console.log(`Written to scripts/padding-snapshot.json`);
