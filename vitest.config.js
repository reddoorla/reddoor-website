import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Dedicated unit-test config, separate from vite.config.js so the SvelteKit /
// Tailwind plugins don't load for plain function tests. Covers the pure utils in
// src/lib/utils and the pure planning logic in scripts/ (no DOM needed → node
// environment).
export default defineConfig({
  resolve: {
    alias: {
      // SvelteKit normally supplies this; without its plugin loaded, a server
      // module importing `$lib/...` (e.g. /api/inquiry pulling in the CRM
      // client) would fail to resolve. `$env` stays hand-mocked per test.
      $lib: fileURLToPath(new URL("./src/lib", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"],
  },
});
