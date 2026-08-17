// Re-emit src/prismicio-types.d.ts after a hand-edit to a slice model.json.
//
// Neither `vite build` nor a running `start-slicemachine` watcher fires typegen
// on an external file edit, so the generated types silently drift from the
// models on disk. Driving the manager's `updateSlice` fires the adapter's
// `slice:update` hook, which re-emits the FULL types file from every on-disk
// model.
//
// Scoped deliberately to the slices named below: looping the whole library
// rewrites every model.json/mocks.json in the manager's normalized format
// (expanded arrays, injected `select: null`, invented mocks) — pure diff
// collateral. One updateSlice still regenerates complete types.
//
//   node scripts/medtech/regen-types.mjs
import { createRequire } from "node:module";
import { readFile, glob } from "node:fs/promises";
import path from "node:path";

const SLICES = ["TextColumns"];
// Custom types hand-edited on this branch — `updateCustomType` fires the same
// full-types re-emit as `updateSlice`, from the customtypes/<id>/index.json on
// disk. (Push to the Prismic repo is still Slice Machine's interactive job;
// this only keeps the local .d.ts honest.)
const CUSTOM_TYPES = ["industry"];
const LIBRARY_ID = "./src/lib/slices";

// @slicemachine/manager is a transitive dependency of slice-machine-ui, so
// pnpm's strict node_modules layout keeps it out of the project root and a bare
// specifier does not resolve. Reach into the store instead.
//
// Loaded through createRequire rather than `import`: the ESM build throws
// ERR_UNSUPPORTED_DIR_IMPORT on @prismicio/types-internal under Node 24's strict
// ESM resolver, and only the CJS build is usable here.
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

for (const name of SLICES) {
  const model = JSON.parse(
    await readFile(path.resolve(process.cwd(), "src/lib/slices", name, "model.json"), "utf8"),
  );
  const { errors } = await manager.slices.updateSlice({ libraryID: LIBRARY_ID, model });
  if (errors?.length) {
    console.error(`✗ ${name}:`, errors);
    process.exitCode = 1;
  } else {
    console.log(`✓ ${name} — types re-emitted`);
  }
}

for (const id of CUSTOM_TYPES) {
  const model = JSON.parse(
    await readFile(path.resolve(process.cwd(), "customtypes", id, "index.json"), "utf8"),
  );
  const { errors } = await manager.customTypes.updateCustomType({ model });
  if (errors?.length) {
    console.error(`✗ ${id}:`, errors);
    process.exitCode = 1;
  } else {
    console.log(`✓ ${id} — types re-emitted`);
  }
}
