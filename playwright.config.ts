import { defineConfig } from "@playwright/test";
import base from "@reddoorla/maintenance/configs/playwright-a11y";

// Emulate reduced motion in tests: instant scrollIntoView (no long animated
// smooth-scroll that flakes Playwright's actionability checks under parallel
// load) and view transitions fall back to instant. Pairs with the
// prefers-reduced-motion gate on scroll-behavior in src/app.css.
export default defineConfig({
  ...base,
  use: { ...base.use, reducedMotion: "reduce" },
});
