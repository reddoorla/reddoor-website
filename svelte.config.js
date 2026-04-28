import adapter from "@sveltejs/adapter-netlify";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

const silencedWarnings = new Set(["element_invalid_self_closing_tag"]);

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
    prerender: {
      handleHttpError: "warn",
    },
  },
  preprocess: vitePreprocess(),
  compilerOptions: {
    warningFilter: (warning) => !silencedWarnings.has(warning.code),
  },
};

export default config;
