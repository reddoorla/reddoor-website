import { asText } from "@prismicio/client";
import metaImage from "$lib/assets/icons/logos/printedReddoor.png";
import { createClient } from "$lib/prismicio";
import { error } from "@sveltejs/kit";
import type { PageServerLoad, EntryGenerator } from "./$types";

export const load: PageServerLoad = async ({ params, fetch, cookies }) => {
  const client = createClient({ fetch, cookies });

  let page;
  let docType: "page" | "industry" = "page";

  try {
    // fetchLinks resolves each ContentWidthMedia item's `gallery` relationship so a
    // slideshow item can render its gallery's images (one level: gallery.images).
    page = await client.getByUID("page", params.uid, { fetchLinks: ["gallery.images"] });
  } catch {
    // `page` and `industry` share the /:uid namespace; industry landing pages
    // (e.g. /medtech) are looked up second so existing pages always win a
    // uid collision.
    try {
      page = await client.getByUID("industry", params.uid);
      docType = "industry";
    } catch {
      throw error(404, {
        message: "Page Not Found",
      });
    }
  }

  return {
    page,
    docType,
    title: asText(page.data.title),
    meta_description: page.data.meta_description,
    meta_title: page.data.meta_title,
    // Fall back to the site-wide share image like every sibling route does —
    // without it a CMS document that never filled in meta_image ships no
    // og:image at all, and link unfurls come back blank.
    meta_image: page.data.meta_image.url || metaImage,
  };
};

export const entries: EntryGenerator = async () => {
  const client = createClient();
  const pages = await client.getAllByType("page");
  // Not guarded: `routes` in prismicio.ts names `industry`, so if the type ever
  // went missing every query would already be failing. Swallowing the error
  // here would just drop the industry pages out of the prerender silently.
  const industries = await client.getAllByType("industry");

  // "home" is served at `/` — prerendering /home too ships a duplicate page
  // (SEO dup; the sitemap already excludes it). Null uids can't be routed.
  return [...pages, ...industries]
    .filter((doc) => doc.uid && doc.uid !== "home")
    .map((doc) => {
      return { uid: doc.uid };
    });
};
