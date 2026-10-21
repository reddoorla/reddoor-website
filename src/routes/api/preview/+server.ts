import { redirectToPreviewURL } from "@prismicio/svelte/kit";
import { createClient } from "$lib/prismicio.js";
import { previewPage } from "$lib/funnel-copy/preview-url";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ fetch, request, cookies }) => {
  const client = createClient({ fetch });

  return await redirectToPreviewURL({
    client: {
      resolvePreviewURL: (args) =>
        client.resolvePreviewURL({
          ...args,
          linkResolver: previewPage,
        }),
    },
    request,
    cookies,
  });
};
