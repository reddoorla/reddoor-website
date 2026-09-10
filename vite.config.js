import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { imagetools } from "@zerodevx/svelte-img/vite";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

/**
 * `virtual:og-assets` — everything the OG card renderer needs, as base64.
 *
 * The card endpoint runs inside the Netlify function, which adapter-netlify
 * esbuild-bundles from the SSR output; nothing next to the function exists at
 * runtime, so fonts, images and the resvg wasm all have to travel inside the
 * JS. Vite's own `?inline` would do for the fonts, but imagetools claims every
 * image import (it hands satori a `/@imagetools/…` URL) and Vite reserves
 * `.wasm` for `?init` — one plugin that reads the files itself is simpler than
 * three exceptions.
 */
function ogAssets() {
  const id = "virtual:og-assets";
  const resolved = "\0" + id;
  const files = {
    besley: "src/lib/assets/og/fonts/besley-400-latin.ttf",
    inter: "src/lib/assets/og/fonts/inter-300-latin.ttf",
    texture: "src/lib/assets/og/texture.jpg",
    mark: "src/lib/assets/icons/logos/reddoor_logo.png",
  };
  return {
    name: "og-assets-inline",
    /** @param {string} source */
    resolveId(source) {
      return source === id ? resolved : null;
    },
    /** @param {string} source */
    load(source) {
      if (source !== resolved) return null;
      const require = createRequire(import.meta.url);
      /** @param {string | URL} path */
      const b64 = (path) => JSON.stringify(readFileSync(path).toString("base64"));
      const lines = Object.entries(files).map(
        ([name, path]) => `export const ${name} = ${b64(new URL(path, import.meta.url))};`,
      );
      lines.push(`export const wasm = ${b64(require.resolve("@resvg/resvg-wasm/index_bg.wasm"))};`);
      return lines.join("\n");
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), sveltekit(), imagetools(), ogAssets()],
  server: {
    fs: {
      // Allow access to files from the project root.
      allow: [".."],
    },
  },
});
