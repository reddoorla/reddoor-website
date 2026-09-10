import { createClient } from "$lib/prismicio";
import { ogCardPath } from "$lib/og/url";
import { loadRouteMeta } from "$lib/server/route-meta";
import type { PageServerLoad } from "./$types";

// The index has no document of its own; a `route_meta` document keyed
// "showcase" can override its meta, and the generated card is the fallback.
export const load: PageServerLoad = async ({ fetch, cookies }) => {
  const meta = await loadRouteMeta(createClient({ fetch, cookies }), "showcase");
  return {
    meta_title: meta?.meta_title,
    meta_description: meta?.meta_description,
    meta_image: meta?.meta_image || ogCardPath("site", "showcase"),
  };
};
