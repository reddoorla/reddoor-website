import { error } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { asText } from "@prismicio/client";
import type { EntryGenerator, RequestHandler } from "./$types";
import { createClient } from "$lib/prismicio";
import { fetchReport, REPORT_TOKEN_PATTERN } from "$lib/report/fetch";
import { renderCard } from "$lib/og/card";
import { SITE_HEADLINES, auditHeadline, docHeadline } from "$lib/og/headline";
import { isOgId, isOgKind, type OgKind } from "$lib/og/url";
import { cardAssets } from "$lib/server/og/assets";
import { loadRouteMeta } from "$lib/server/route-meta";

/**
 * /og/{kind}/{id}.png — the typographic share card for one page.
 *
 * "auto": every card `entries()` can name is rendered at build time and served
 * as a static file; anything else (an audit report, a document published after
 * the last build) renders here in the function. The kind decides where the
 * headline comes from — never the URL itself.
 */
export const prerender = "auto";

type DocKind = Exclude<OgKind, "site" | "audit">;

async function headlineFor(kind: OgKind, id: string, fetch: typeof globalThis.fetch) {
  if (kind === "site") {
    const line = SITE_HEADLINES[id];
    if (!line) throw error(404, "Not found");
    // An editor can retitle the card from the page's route_meta document.
    const meta = await loadRouteMeta(createClient({ fetch }), id);
    return meta?.card_headline || line;
  }
  if (kind === "audit") {
    if (!REPORT_TOKEN_PATTERN.test(id)) throw error(404, "Not found");
    const report = await fetchReport(id, { baseUrl: env.PROSPECT_REPORT_URL ?? "", fetch });
    if (!report) throw error(404, "Not found");
    return auditHeadline(report.businessName as string | null);
  }
  const client = createClient({ fetch });
  const doc = await client.getByUID(kind as DocKind, id).catch(() => null);
  if (!doc) throw error(404, "Not found");
  // page/industry titles are rich text; showcase/project titles are key text.
  const title = doc.data.title;
  return docHeadline((typeof title === "string" ? title : asText(title)) ?? "");
}

export const GET: RequestHandler = async ({ params, fetch, setHeaders }) => {
  const { kind, id } = params;
  if (!isOgKind(kind) || !isOgId(id)) throw error(404, "Not found");

  const headline = await headlineFor(kind, id, fetch);
  const png = await renderCard(headline, cardAssets());

  if (kind === "audit") {
    // Same policy as the report it belongs to: the token is the credential.
    setHeaders({
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex, nofollow, noarchive",
    });
  } else {
    setHeaders({ "cache-control": "public, max-age=300, s-maxage=86400" });
  }
  return new Response(png, { headers: { "content-type": "image/png" } });
};

/** Everything a build can know about: the code-routed pages and every CMS
 *  document whose page might fall back to a generated card. Projects almost
 *  always have a hero and are many; they render on demand instead. */
export const entries: EntryGenerator = async () => {
  const client = createClient();
  const [pages, industries, showcases] = await Promise.all([
    client.getAllByType("page"),
    client.getAllByType("industry"),
    client.getAllByType("showcase"),
  ]);
  return [
    ...Object.keys(SITE_HEADLINES).map((id) => ({ kind: "site", id })),
    ...pages.map((d) => ({ kind: "page", id: d.uid! })),
    ...industries.map((d) => ({ kind: "industry", id: d.uid! })),
    ...showcases.map((d) => ({ kind: "showcase", id: d.uid! })),
  ];
};
