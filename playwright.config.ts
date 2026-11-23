import { defineConfig } from "@playwright/test";
import base from "@reddoorla/maintenance/configs/playwright-a11y";
import { EDIT_STUB } from "./tests/smoke/edit-stub";

// Emulate reduced motion in tests: instant scrollIntoView (no long animated
// smooth-scroll that flakes Playwright's actionability checks under parallel
// load) and view transitions fall back to instant. Pairs with the
// prefers-reduced-motion gate on scroll-behavior in src/app.css.
//
// R1.1 (health-gate): the central `smoke` audit (reddoor-maintenance
// src/audits/smoke.ts) allocates a free port and passes it as
// REDDOOR_SMOKE_PORT so a zombie vite already squatting the default 5173 can't
// silently hijack the run and green a stale build. When it's set, bind vite to
// exactly that port with --strictPort (forwarded through `npm run vite:dev` so
// it stays portable across pnpm/npm) and aim Playwright's baseURL + readiness
// probe at it. Unset (local `pnpm test:smoke`) → the shared base's fixed 5173.
const smokePort = process.env.REDDOOR_SMOKE_PORT;

// The dev server encodes vite-imagetools variants (AVIF included) on every
// request, with no cache, on libuv's thread pool, and DNS lookups and file
// reads queue behind them on the same four threads. A GET /portfolio issued
// during a burst of 16 encodes waited 10.6s and came back a 500 (Prismic
// ConnectTimeoutError at 10000ms); with 64 threads the same request returned
// 200 in 1.6s. The webServer inherits this process's environment, so setting it
// here gives the server the test suite boots its own pool.
process.env.UV_THREADPOOL_SIZE ??= "64";

// The booking funnel's words are Tim's to change in Prismic (`funnel_copy`).
// The smoke server renders the built-in copy instead, so the specs that read
// /schedule, /cancel and /reschedule assert what the code owns, and a published
// edit never turns the gate red. Inherited by the webServer like the line above.
process.env.FUNNEL_COPY_BUILTIN ??= "1";

// W1 (TEC-02): the report editor is driven end to end against a local stand-in
// for maintenance's report API (tests/smoke/maintenance-stub.mjs), so the dev
// server is pointed at it with throwaway keys. Set unconditionally rather than
// `??=`: a smoke run must never reach a real report store. Inherited by the
// webServer like the two lines above. Skipped when E2E_AUDIT_TOKEN is set,
// which is a run deliberately aimed at a real deploy.
if (EDIT_STUB.enabled) {
  process.env.PROSPECT_REPORT_URL = EDIT_STUB.url;
  process.env.REPORT_EDIT_KEY = EDIT_STUB.editKey;
  process.env.PROSPECT_EDIT_TOKEN = EDIT_STUB.editToken;
}
const stubServer = {
  command: `node tests/smoke/maintenance-stub.mjs`,
  url: `${EDIT_STUB.url}/health`,
  reuseExistingServer: !process.env.CI,
  timeout: 10_000,
};

const siteServer = smokePort
  ? {
      command: `npm run vite:dev -- --port ${smokePort} --strictPort`,
      url: `http://localhost:${smokePort}/dev/a11y-fixtures`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    }
  : base.webServer;

export default defineConfig({
  ...base,
  // Compiles every route the suite uses before any worker starts, so the first
  // visit to a cold route does not happen inside a test. See the file for why
  // this replaces raising timeouts. Runs after webServer is up.
  globalSetup: "./tests/smoke/global-setup.ts",
  use: {
    ...base.use,
    // NOTE: `reducedMotion` is not set here because the shared base now sets
    // it — `contextOptions: { reducedMotion: "reduce" }`, suite-wide.
    //
    // This NOTE used to say the config-level value "reaches neither matchMedia
    // nor the CSS cascade". That measurement was real but it was measuring the
    // wrong placement: `reducedMotion` is a BrowserContextOptions member, so at
    // the top level of `use` Playwright drops it as an unknown key. Under
    // `contextOptions` it works, and reaches both. It arrived here with
    // @reddoorla/maintenance 0.95.1 (#193).
    //
    // Consequence: the default is now `reduce`. Tests asserting that something
    // MOVES must opt out with page.emulateMedia({ reducedMotion:
    // "no-preference" }) — see twenty-video.spec.ts. Per-test emulateMedia
    // overrides the context value in both directions.
    ...(smokePort ? { baseURL: `http://localhost:${smokePort}` } : {}),
  },
  // Playwright starts every entry and waits for each; the stub is a few lines
  // of node and is up long before the dev server.
  webServer: [
    ...(EDIT_STUB.enabled ? [stubServer] : []),
    ...(Array.isArray(siteServer) ? siteServer : siteServer ? [siteServer] : []),
  ],
});
