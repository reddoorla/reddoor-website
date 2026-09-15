import * as prismic from "@prismicio/client";
import { enableAutoPreviews } from "@prismicio/svelte/kit";
import type { CreateClientConfig } from "@prismicio/svelte/kit";
import { currentlyShowsHidden, HIDE_FILTER, PREVIEW_COOKIE } from "$lib/server/content-visibility";
import type { AllDocumentTypes } from "../prismicio-types";
import { repositoryName } from "./prismic-repo";

export { repositoryName };

/**
 * A list of Route Resolver objects that define how a document's `url` field is resolved.
 *
 * {@link https://prismic.io/docs/route-resolver#route-resolver}
 */
const routes: prismic.ClientConfig["routes"] = [
  {
    type: "page",
    uid: "home",
    path: "/",
  },
  {
    type: "page",
    path: "/:uid",
  },
  // Industry landing pages (/medtech, ...) share the `/:uid` namespace with
  // `page`. A uid collision resolves to the page — see the page-first lookup in
  // `[[preview=preview]]/[uid]/+page.server.ts`.
  //
  // This entry can only exist while the `industry` type is live in the Prismic
  // repo AND has at least one published document. `routes` is validated
  // server-side on every request, so naming a type the API doesn't know makes it
  // reject EVERY query ("[Link resolver error] Unknown type") and takes the whole
  // build down — not just industry lookups.
  {
    type: "industry",
    path: "/:uid",
  },
  {
    type: "project",
    path: "/portfolio/:uid",
  },
  {
    type: "showcase",
    path: "/showcase/:uid",
  },
];

/**
 * A client that appends the hide filter to every query it builds.
 *
 * This is the only seam that catches everything: every typed method
 * (`getByUID`, `getByID`, `getAllByType`, `getSingle`, …) adds its own
 * `filters` and ends in `get()`, which calls `this.buildQueryURL(params)`,
 * and `buildQueryURL` spreads the call's params over `defaultParams`, so a
 * filter set as a client default is REPLACED by any method's own. Measured
 * 2026-09-14: with only `defaultParams.filters` set, `getByUID`,
 * `getAllByType` and `getByID` all returned hidden documents.
 */
export class HiddenContentFilteredClient extends prismic.Client<AllDocumentTypes> {
  override async buildQueryURL(
    params: Parameters<prismic.Client["buildQueryURL"]>[0] = {},
  ): Promise<string> {
    const own =
      params.filters == null
        ? []
        : Array.isArray(params.filters)
          ? params.filters
          : [params.filters];
    return super.buildQueryURL({ ...params, filters: [...own, HIDE_FILTER] });
  }
}

/**
 * Creates a Prismic client for the project's repository. A document tagged
 * `hide` is invisible to it unless this process or request shows hidden
 * content (see `$lib/server/content-visibility`): under `vite dev`, on the
 * staging site, or inside a preview session.
 */
export const createClient = ({ cookies, ...config }: CreateClientConfig = {}) => {
  const options = { routes, ...config };
  const client: prismic.Client<AllDocumentTypes> = currentlyShowsHidden(
    cookies?.get(PREVIEW_COOKIE),
  )
    ? prismic.createClient(repositoryName, options)
    : new HiddenContentFilteredClient(repositoryName, options);

  enableAutoPreviews({ client, cookies });

  return client;
};
