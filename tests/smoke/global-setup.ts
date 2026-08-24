/**
 * Compile every route the suite uses, once, before any worker starts.
 *
 * The dev server transforms modules on demand. Playwright's readiness probe
 * only requests `/dev/a11y-fixtures`, so the FIRST visit to every other route
 * happens inside a test — and with `fullyParallel: true` several workers hit
 * several cold routes at the same moment. Vite serialises the transform work,
 * lazily-imported chunks (portfolio's Fuse bundle is the documented case) queue
 * behind it, and the page has not hydrated when the assertion looks. The test
 * is not wrong and the feature is not broken: it is starved.
 *
 * That storm is what #105 addressed by raising portfolio-search's poll ceiling
 * to 30s and its test timeout to 60s. Headroom made the failure rarer without
 * removing it — #133 still lost three portfolio-search tests and two schedule
 * tests to it, and the same signature reproduces locally under parallel load
 * while passing serially. Timeouts treat the symptom; this removes the cause,
 * because a route requested here is already transformed and cached by the time
 * a worker asks for it.
 *
 * Deliberately sequential: firing these concurrently would recreate precisely
 * the storm it exists to prevent.
 *
 * Best-effort by design. A route that 404s or 500s is the business of the test
 * that asserts on it — failing the whole run here would turn a warmup into a
 * second, worse gate. Timings are logged so a route that has become genuinely
 * slow stays visible rather than being silently absorbed.
 */

const PORT = process.env.REDDOOR_SMOKE_PORT || "5173";

/**
 * One entry per distinct route the specs load, gathered from their `goto`
 * calls. Parameterised routes appear once with a representative id: the module
 * graph is per-route, not per-id, so `/cancel/AAA` warms `/cancel/anything`.
 *
 * Fixtures are absent because the readiness probe already fetched them, and
 * `/definitely-not-a-real-page-xyz` because warming a 404 warms nothing.
 */
const ROUTES = [
  "/",
  "/about",
  "/contact",
  "/portfolio",
  "/twenty-for-twenty",
  "/schedule",
  "/not-a-fit",
  "/email/unsubscribed",
  "/email/resubscribed",
  "/reschedule/AAAAAAAAAAAA",
  "/cancel/AAAAAAAAAAAA",
  "/calendar/AAAAAAAAAAAA",
];

export default async function globalSetup() {
  const base = `http://localhost:${PORT}`;
  const slow: string[] = [];

  for (const route of ROUTES) {
    const started = Date.now();
    try {
      // The HTML alone is enough: requesting it makes vite transform the
      // route's module graph, which is the work being moved out of the tests.
      const res = await fetch(`${base}${route}`, {
        signal: AbortSignal.timeout(60_000),
      });
      await res.arrayBuffer();
      const ms = Date.now() - started;
      if (ms > 3_000) slow.push(`${route} ${ms}ms`);
    } catch (error) {
      // Warming is not a gate — say so and carry on.
      console.warn(
        `[warmup] ${route} did not compile: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  if (slow.length) console.log(`[warmup] slowest routes — ${slow.join(", ")}`);
}
