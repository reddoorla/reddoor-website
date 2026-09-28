import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { imagetools } from "@zerodevx/svelte-img/vite";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const repo = here("../../");
const lib = here("../../src/lib");

export default defineConfig({
  root: repo,
  configFile: false,
  logLevel: "warn",
  plugins: [
    tailwindcss(),
    svelte({ configFile: here("../../svelte.config.js"), emitCss: true }),
    imagetools(),
  ],
  resolve: {
    alias: [
      { find: /^\$lib(\/|$)/, replacement: `${lib}$1` },
      { find: /^\$components(\/|$)/, replacement: `${lib}/components$1` },
      { find: /^\$utils(\/|$)/, replacement: `${lib}/utils$1` },
      { find: /^\$stores(\/|$)/, replacement: `${lib}/stores$1` },
      { find: /^\$assets(\/|$)/, replacement: `${lib}/assets$1` },
      { find: "$app/state", replacement: here("./stubs/app-state.js") },
      { find: "$app/stores", replacement: here("./stubs/app-state.js") },
      { find: "$app/navigation", replacement: here("./stubs/app-navigation.js") },
      { find: "$app/environment", replacement: here("./stubs/app-environment.js") },
    ],
    conditions: ["svelte", "browser", "import", "module", "default"],
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    "import.meta.env.DEV": "false",
    "import.meta.env.PROD": "true",
    "import.meta.env.SSR": "false",
  },
  build: {
    outDir: process.env.DS_OUT ?? here("./dist"),
    emptyOutDir: true,
    assetsInlineLimit: () => true,
    cssCodeSplit: false,
    minify: true,
    sourcemap: false,
    lib: {
      entry: here("./entry.js"),
      formats: ["iife"],
      name: "ReddoorBundle",
      fileName: () => "bundle.js",
      cssFileName: "bundle",
    },
  },
});
