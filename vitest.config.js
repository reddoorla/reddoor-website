import { defineConfig } from "vitest/config";

// Dedicated unit-test config, separate from vite.config.js so the SvelteKit /
// Tailwind plugins don't load for plain function tests. Covers the pure utils in
// src/lib/utils (no DOM needed → node environment).
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
