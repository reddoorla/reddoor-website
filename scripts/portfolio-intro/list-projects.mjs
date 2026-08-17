// Read-only helper: list every `project` doc with uid, title, and slice types.
// Handy for finding a migration target or auditing which docs carry the intro.
//   node --env-file=.env.local scripts/portfolio-intro/list-projects.mjs
import * as prismic from "@prismicio/client";
import { readFile } from "node:fs/promises";

const config = JSON.parse(
  await readFile(new URL("../../slicemachine.config.json", import.meta.url), "utf8"),
);
const token = process.env.PRISMIC_WRITE_TOKEN;
const client = prismic.createClient(
  config.repositoryName,
  token ? { accessToken: token } : undefined,
);

const docs = await client.getAllByType("project", { lang: "*" });
console.log(`repo=${config.repositoryName}  project docs=${docs.length}\n`);
for (const d of docs.sort((a, b) => (a.uid > b.uid ? 1 : -1))) {
  const slices = Array.isArray(d.data?.slices) ? d.data.slices : [];
  const hasIntro = slices[0]?.slice_type === "lead_text";
  console.log(
    `- ${hasIntro ? "✓intro " : "       "}uid=${d.uid}  title=${JSON.stringify(d.data?.title)}`,
  );
  console.log(`    [${slices.map((s) => s.slice_type).join(", ") || "(empty)"}]`);
}
