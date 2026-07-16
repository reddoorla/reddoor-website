import type { RequestHandler } from "./$types";
import { createClient } from "$lib/prismicio";
import { SITE_URL } from "$lib/site";

const STATIC_ROUTES = ["/", "/portfolio", "/about", "/contact", "/twenty-for-twenty"];

export const prerender = true;

export const GET: RequestHandler = async ({ fetch }) => {
  const client = createClient({ fetch });

  const [pages, projects] = await Promise.all([
    client.getAllByType("page"),
    client.getAllByType("project"),
  ]);

  const pagePaths = pages
    .filter((doc) => doc.uid && doc.uid !== "home")
    .map((doc) => ({
      url: `/${doc.uid}`,
      lastmod: doc.last_publication_date,
    }));

  // Every listing surface filters hide-tagged projects — the sitemap must not
  // advertise them to crawlers either.
  const projectPaths = projects
    .filter((doc) => doc.uid && !doc.tags.includes("hide"))
    .map((doc) => ({
      url: `/portfolio/${doc.uid}`,
      lastmod: doc.last_publication_date,
    }));

  const staticPaths = STATIC_ROUTES.map((url) => ({
    url,
    lastmod: null as string | null,
  }));

  const urls = [...staticPaths, ...pagePaths, ...projectPaths];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    ({ url, lastmod }) =>
      `  <url>\n    <loc>${SITE_URL}${url}</loc>${lastmod ? `\n    <lastmod>${lastmod.slice(0, 10)}</lastmod>` : ""}\n  </url>`,
  )
  .join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "max-age=0, s-maxage=3600",
    },
  });
};
