import * as prismic from "@prismicio/client";
import { enableAutoPreviews } from "@prismicio/svelte/kit";
import type { CreateClientConfig } from "@prismicio/svelte/kit";
import config from "../../slicemachine.config.json";

/**
 * The project's Prismic repository name.
 */
export const repositoryName = config.repositoryName;

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
 * Creates a Prismic client for the project's repository. The client is used to
 * query content from the Prismic API.
 */
export const createClient = ({ cookies, ...config }: CreateClientConfig = {}) => {
  const client = prismic.createClient(repositoryName, {
    routes,
    ...config,
  });

  enableAutoPreviews({ client, cookies });

  return client;
};
