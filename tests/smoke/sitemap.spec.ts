import { test, expect } from "@playwright/test";

// What the sitemap must NEVER advertise.
//
// The generator uses an explicit allowlist (STATIC_ROUTES) plus Prismic `page`,
// `industry` and `project` documents, so a new funnel route cannot drift in on
// its own. This suite exists for the case that CAN happen: someone adds a path
// to STATIC_ROUTES, or a Prismic doc is published on a uid that collides with
// one of these.
//
// The pairing matters. `noindex` and "absent from the sitemap" are different
// controls: the sitemap is an invitation, `noindex` is an instruction. A page
// can be found without the sitemap — through a forwarded email, a signature, a
// Referer header — so the pages below need both.

const FUNNEL_PATHS = [
  "/schedule",
  "/meeting-outcome",
  "/email/unsubscribed",
  "/email/resubscribed",
];

/** Reachable only with an appointment id, which is a bearer token in a URL. */
const TOKEN_PATHS = ["/reschedule", "/cancel", "/calendar"];

test("the sitemap advertises no part of the funnel", async ({ request }) => {
  const res = await request.get("/sitemap.xml");
  expect(res.status()).toBe(200);
  const xml = await res.text();
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
    m[1].replace(/^https?:\/\/[^/]+/, ""),
  );

  expect(paths.length).toBeGreaterThan(5);
  for (const p of FUNNEL_PATHS) expect(paths, p).not.toContain(p);
  // Prefix check for the id-bearing routes: no /reschedule/<anything> either.
  for (const prefix of TOKEN_PATHS) {
    const leaked = paths.filter((p) => p === prefix || p.startsWith(`${prefix}/`));
    expect(leaked, prefix).toEqual([]);
  }
});

test("every funnel page tells crawlers to stay out", async ({ request }) => {
  for (const p of FUNNEL_PATHS) {
    const html = await (await request.get(p)).text();
    const robots = html.match(/<meta\s+name="robots"\s+content="([^"]+)"/i)?.[1];
    expect(robots, `${p} has no robots meta`).toBeTruthy();
    expect(robots, p).toContain("noindex");
  }
});

test("the id-bearing pages also refuse to leak the id through Referer", async ({ request }) => {
  // The appointment id IS the credential. `no-referrer` keeps it out of the
  // headers sent to anything the page links to, and `nofollow` keeps a crawler
  // that somehow reached one from walking to the next.
  for (const prefix of TOKEN_PATHS) {
    const html = await (await request.get(`${prefix}/AAAAAAAAAAAA`)).text();
    expect(html, prefix).toContain('name="robots" content="noindex, nofollow"');
    expect(html, prefix).toContain('name="referrer" content="no-referrer"');
  }
});

test("robots.txt does not disallow the pages that carry noindex", async ({ request }) => {
  // Deliberate, and the opposite of the obvious instinct. A crawler must FETCH
  // a page to read its `noindex`; a robots.txt `Disallow` stops the fetch, so
  // the directive is never seen — and a disallowed URL that something links to
  // can still be indexed, URL-only, with no way to remove it. Blocking here
  // would weaken the control above, not reinforce it.
  const txt = await (await request.get("/robots.txt")).text();
  for (const p of [...FUNNEL_PATHS, ...TOKEN_PATHS]) {
    expect(txt, p).not.toContain(`Disallow: ${p}`);
  }
  expect(txt).toContain("Sitemap:");
});
