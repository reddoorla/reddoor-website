import { createEslintConfig } from "@reddoorla/maintenance/configs/eslint";
import svelteConfig from "./svelte.config.js";

export default [
  ...createEslintConfig({ svelteConfig }),
  {
    // eslint-plugin-svelte 3.20+ allows only an `error` prop in +error.svelte,
    // but SvelteKit passes merged layout `data` to error pages — our three
    // custom 404s render from it. Mirrors the shared-config fix in
    // reddoor-maintenance#497; remove once the @reddoorla/maintenance release
    // carrying it lands here.
    files: ["**/+error.svelte"],
    rules: {
      "svelte/valid-prop-names-in-kit-pages": "off",
    },
  },
];
