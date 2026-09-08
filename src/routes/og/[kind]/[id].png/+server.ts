import { error } from "@sveltejs/kit";
import { asText, isFilled } from "@prismicio/client";
import type { EntryGenerator, RequestHandler } from "./$types";
import { createClient } from "$lib/prismicio";
import { renderCard } from "$lib/og/card";
import { SITE_HEADLINES, docHeadline } from "$lib/og/headline";
import { isOgId, isOgKind, type OgKind } from "$lib/og/url";
import { cardAssets } from "$lib/server/og/assets";
import { loadRouteMeta } from "$lib/server/route-meta";

/**
 * /og/{kind}/{id}.png — the typographic share card for one page.
 *
 * Fully prerendered, on purpose. Satori shapes text through harfbuzzjs, which
 * reads its wasm from disk at start-up; Netlify's packager does not ship that
 * file, and on 2026-09-08 the first deploy with this route in the function
 * took every SSR route on staging down with it (502 on /contact, /audit, 404s).
 * `prerender = true` keeps this module out of the function manifest entirely:
 * cards exist as static files, drawn at build time, and every page that can
 * fall back to a card is prerendered by the same build — so a card can never
 * be asked for that the build did not draw. The kind decides where the
 * headline comes from; never the URL itself.
 */
export const prerender = true;

type DocKind = Exclude<OgKind, "site">;

async function headlineFor(kind: OgKind, id: string, fetch: typeof globalThis.fetch) {
  const client = createClient({ fetch });
  if (kind === "site") {
    const line = SITE_HEADLINES[id];
    if (!line) throw error(404, "Not found");
    // An editor can retitle the card from the page's route_meta document.
    const meta = await loadRouteMeta(client, id);
    return meta?.card_headline || line;
  }
  const doc = await client.getByUID(kind as DocKind, id).catch(() => null);
  if (!doc) throw error(404, "Not found");
  // page/industry titles are rich text; showcase/project titles are key text.
  const title = doc.data.title;
  return docHeadline((typeof title === "string" ? title : asText(title)) ?? "");
}

export const GET: RequestHandler = async ({ params, fetch }) => {
  const { kind, id } = params;
  if (!isOgKind(kind) || !isOgId(id)) throw error(404, "Not found");
  const png = await renderCard(await headlineFor(kind, id, fetch), cardAssets());
  return new Response(png, { headers: { "content-type": "image/png" } });
};

/** Every card a page can fall back to: the code-routed registry, every page /
 *  industry / showcase document, and the projects that have neither a meta
 *  image nor a hero (their loader's own fallback order). */
export const entries: EntryGenerator = async () => {
  const client = createClient();
  const [pages, industries, showcases, projects] = await Promise.all([
    client.getAllByType("page"),
    client.getAllByType("industry"),
    client.getAllByType("showcase"),
    client.getAllByType("project"),
  ]);
  const needsCard = projects.filter(
    (d) => !isFilled.image(d.data.meta_image) && !isFilled.image(d.data.hero),
  );
  return [
    ...Object.keys(SITE_HEADLINES).map((id) => ({ kind: "site", id })),
    ...pages.map((d) => ({ kind: "page", id: d.uid! })),
    ...industries.map((d) => ({ kind: "industry", id: d.uid! })),
    ...showcases.map((d) => ({ kind: "showcase", id: d.uid! })),
    ...needsCard.map((d) => ({ kind: "project", id: d.uid! })),
  ];
};
