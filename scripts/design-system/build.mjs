import { build } from "vite";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const here = fileURLToPath(new URL(".", import.meta.url));
const { values } = parseArgs({
  options: {
    out: { type: "string" },
    textures: { type: "string" },
    namespace: { type: "string", default: "Reddoor" },
  },
});
const outDir = resolve(values.out);
const components = JSON.parse(await readFile(join(here, "components.json"), "utf8"));

const entry = [
  `import "./styles.css";`,
  `import { expose } from "./react.js";`,
  ...components.map((c) => `import ${c.name} from ${JSON.stringify(c.source)};`),
  `import { report } from "./extras.js";`,
  `expose(${JSON.stringify(values.namespace)}, { ${components.map((c) => c.name).join(", ")} }).report = report;`,
  "",
].join("\n");
await writeFile(join(here, "entry.js"), entry);

const tmp = join(here, "dist", "bundle");
process.env.DS_OUT = tmp;
await build({ configFile: join(here, "vite.config.mjs"), logLevel: "warn" });

let js = await readFile(join(tmp, "bundle.js"), "utf8");
js = js.replaceAll("<!--", "\\x3C!--").replaceAll("</script", "<\\/script");
const header = {
  format: 4,
  namespace: values.namespace,
  components: components.map((c) => ({ name: c.name })),
};
js = `/* @ds-bundle: ${JSON.stringify(header)} */\n${js}`;
for (const bad of ["<!--", "</script", "eval(", "new Function("]) {
  if (js.includes(bad)) throw new Error(`bundle.js contains ${bad}`);
}

let css = await readFile(join(tmp, "bundle.css"), "utf8");
if (values.textures && existsSync(values.textures)) {
  const map = JSON.parse(await readFile(values.textures, "utf8"));
  css = css.replace(
    /(?:url\("?\/waterColorBg(?:Red)?\.avif"?\)|"\/waterColorBg(?:Red)?\.avif")\s*(?:1x\s*)?type\("image\/avif"\),?/g,
    "",
  );
  for (const [from, to] of Object.entries(map)) css = css.replaceAll(from, to);
}
if (/<\/style/i.test(css)) throw new Error("bundle.css contains </style");

await mkdir(join(outDir, "components"), { recursive: true });
await writeFile(join(outDir, "components/bundle.js"), js);
await writeFile(join(outDir, "components/bundle.css"), css);
await rm(tmp, { recursive: true, force: true });
console.log(
  `bundle.js ${js.length} bytes, bundle.css ${css.length} bytes, ${components.length} components`,
);
