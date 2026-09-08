import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { imagetools } from "@zerodevx/svelte-img/vite";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

/**
 * Exposes @resvg/resvg-wasm's binary as `virtual:resvg-wasm`, a base64 string.
 * The OG card endpoint runs inside the Netlify function, which adapter-netlify
 * esbuild-bundles from the SSR output — nothing next to the function exists at
 * runtime, so the wasm has to travel inside the JS. Vite refuses a plain
 * `.wasm?inline` import (it reserves .wasm for `?init`), hence the plugin.
 */
function resvgWasm() {
  const id = "virtual:resvg-wasm";
  const resolved = "\0" + id;
  return {
    name: "resvg-wasm-inline",
    resolveId(source) {
      return source === id ? resolved : null;
    },
    load(source) {
      if (source !== resolved) return null;
      const require = createRequire(import.meta.url);
      const path = require.resolve("@resvg/resvg-wasm/index_bg.wasm");
      return `export default ${JSON.stringify(readFileSync(path).toString("base64"))};`;
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), sveltekit(), imagetools(), resvgWasm()],
  server: {
    fs: {
      // Allow access to files from the project root.
      allow: [".."],
    },
  },
});
