// Re-emit src/prismicio-types.d.ts after a hand-edit to a slice model.json or a
// customtypes/<id>/index.json.
//
// Neither `vite build` nor a running `start-slicemachine` watcher fires typegen
// on an external file edit, so the generated types silently drift from the
// models on disk. Driving the manager's `updateSlice` / `updateCustomType`
// fires the adapter's update hook, which re-emits the FULL types file from
// every on-disk model. Pushing models to the Prismic repository is still Slice
// Machine's interactive job; this only keeps the local .d.ts honest.
//
// Scoped to what you name: looping the whole library rewrites every
// model.json/mocks.json in the manager's normalized format — pure diff
// collateral. One update still regenerates complete types.
//
//   node scripts/prismic/regen-types.mjs --custom-type route_meta
//   node scripts/prismic/regen-types.mjs --slice TextColumns --custom-type industry
import { createRequire } from "node:module";
import { readFile, glob } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    slice: { type: "string", multiple: true, default: [] },
    "custom-type": { type: "string", multiple: true, default: [] },
  },
});
if (!values.slice.length && !values["custom-type"].length) {
  console.error("Name at least one --slice <Name> or --custom-type <id>.");
  process.exit(1);
}
const LIBRARY_ID = "./src/lib/slices";

// @slicemachine/manager is a transitive dependency of slice-machine-ui, so
// pnpm's strict node_modules layout keeps it out of the project root and a bare
// specifier does not resolve. Reach into the store instead. Loaded through
// createRequire: the ESM build throws ERR_UNSUPPORTED_DIR_IMPORT on
// @prismicio/types-internal under Node 24, and only the CJS build works here.
const [managerDir] = await Array.fromAsync(
  glob(
    "node_modules/.pnpm/@slicemachine+manager@*/node_modules/@slicemachine/manager/dist/index.cjs",
  ),
);
if (!managerDir) {
  console.error("Could not find @slicemachine/manager in the pnpm store — run `pnpm install`.");
  process.exit(1);
}
const require = createRequire(import.meta.url);
const { createSliceMachineManager } = require(path.resolve(process.cwd(), managerDir));

const manager = createSliceMachineManager();
await manager.plugins.initPlugins();

const readJson = async (p) => JSON.parse(await readFile(path.resolve(process.cwd(), p), "utf8"));

for (const name of values.slice) {
  const model = await readJson(`src/lib/slices/${name}/model.json`);
  const { errors } = await manager.slices.updateSlice({ libraryID: LIBRARY_ID, model });
  report(`slice ${name}`, errors);
}
for (const id of values["custom-type"]) {
  const model = await readJson(`customtypes/${id}/index.json`);
  const { errors } = await manager.customTypes.updateCustomType({ model });
  report(`custom type ${id}`, errors);
}

function report(label, errors) {
  if (errors?.length) {
    console.error(`✗ ${label}:`, errors);
    process.exitCode = 1;
  } else {
    console.log(`✓ ${label} — types re-emitted`);
  }
}
