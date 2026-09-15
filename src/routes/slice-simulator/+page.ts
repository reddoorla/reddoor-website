// Server-rendered on every host so hooks.server.ts, not netlify.toml's static
// [[headers]] block, decides this page's framing policy. It is the one route
// the CMS loads in an iframe from another origin: Slice Machine at
// localhost:9999 and the Page Builder at prismic.io — see CMS_FRAMED_ROUTES in
// $lib/security/headers.ts.
export const prerender = false;
