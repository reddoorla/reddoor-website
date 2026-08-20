import { replaceState } from "$app/navigation";

/**
 * Take named params out of the address bar without leaving the page.
 *
 * Two pages need this and for the same reason: the CRM's own links carry a
 * lead's email, name and phone as query params, so `/schedule` and the inquiry
 * modal can greet somebody by name instead of asking twice. An address in a URL
 * is an address in the browser history, in a screenshot, in a pasted "look at
 * this" link, and in anything that later reads `location.href` — gtag.js above
 * all. GA is deferred until the first pointer/key/scroll event (see app.html),
 * so it initialises after this runs and reads a clean URL. That ordering is the
 * only thing keeping a lead's address out of analytics; move GA back to
 * load-time and this stops being sufficient.
 *
 * ── Why the deferral, and why the fallback ────────────────────────────────
 *
 * SvelteKit's `replaceState` throws "Cannot call replaceState(...) before
 * router is initialized" when called during mount — and `afterNavigate` is no
 * escape, because on a first load it runs DURING hydration, before the router
 * is up. Both measured. Deferring by a macrotask puts it after hydration, where
 * the router answers.
 *
 * The native History API works from anywhere, but SvelteKit warns that it
 * "will conflict with the router" — and it is right to: `page.url` keeps the
 * params the address bar no longer shows. So the router's own call is tried
 * first, and the native one is the fallback for the case where it still is not
 * ready. Getting the params out of the URL matters more than which API does it.
 *
 * You will see that warning in `vite dev` and in the smoke run, on the loads
 * where the retries run out. It does not ship: the monkeypatch that produces it
 * is behind `if (DEV && BROWSER)` in SvelteKit's client runtime, so a
 * production build never installs it. Checked rather than assumed — the console
 * is a Lighthouse Best-Practices input, and "it is probably dev-only" would not
 * be good enough.
 */
export function stripQueryParams(keys: readonly string[]): void {
  if (typeof window === "undefined") return;
  const url = new URL(location.href);
  const removed = keys.filter((k) => url.searchParams.has(k));
  if (removed.length === 0) return;
  for (const k of removed) url.searchParams.delete(k);
  const next = url.pathname + url.search + url.hash;

  // How long the router takes to initialise varies with what else is hydrating,
  // so one attempt is a coin flip. Retrying costs nothing and means the common
  // case keeps `page.url` truthful.
  const RETRY_MS = [0, 20, 100, 300];

  const attempt = (i: number) => {
    setTimeout(() => {
      // The URL can have moved on in the meantime — a click, a redirect — and
      // rewriting it then would drag the visitor back to a page they left.
      if (!keys.some((k) => new URL(location.href).searchParams.has(k))) return;
      try {
        replaceState(next, {});
      } catch {
        if (i + 1 < RETRY_MS.length) return attempt(i + 1);
        // Out of patience. The address bar matters more than the router's
        // bookkeeping, and `page.url` holding stale params is survivable here:
        // both callers read them once, at mount, and never consult them again.
        history.replaceState(history.state, "", next);
      }
    }, RETRY_MS[i]);
  };
  attempt(0);
}
