import { createSvelteConfig } from "@reddoorla/maintenance/configs/svelte";
import adapter from "@sveltejs/adapter-netlify";

/** @type {import('@sveltejs/kit').Config} */
export default createSvelteConfig({
  kit: {
    adapter: adapter({ edge: false, split: false }),
    // "fail", not "warn": a broken internal link must break the build, not
    // prerender green and 404 in production.
    prerender: { handleHttpError: "fail" },
  },
});
