import type { Cookies } from "@sveltejs/kit";
import * as env from "$app/env/private";
import { createClient } from "$lib/prismicio";
import { DEFAULT_FUNNEL_COPY, readFunnelCopy, type FunnelCopy } from "$lib/funnel-copy/copy";
import { mediumString } from "$lib/utils/projectServices";

/**
 * The booking funnel's copy for one load, from the `funnel_copy` singleton.
 *
 * Passing `cookies` makes a Prismic preview session see its release; the
 * prerendered pages pass none and read the published document at build time
 * (a publish triggers a rebuild of both sites through the Prismic build hooks).
 * Never throws: see `readFunnelCopy`.
 *
 * The smoke suite sets FUNNEL_COPY_BUILTIN (playwright.config.ts), so the gate
 * asserts the wording the code owns. Without it, Tim's first published edit
 * would turn every funnel smoke test red: the copy is his to change.
 */
export function loadFunnelCopy(event: {
  fetch: typeof fetch;
  cookies?: Cookies;
}): Promise<FunnelCopy> {
  if (env.FUNNEL_COPY_BUILTIN === "1") return Promise.resolve(DEFAULT_FUNNEL_COPY);
  return readFunnelCopy({
    getSingle: (type) =>
      createClient({ fetch: event.fetch, cookies: event.cookies }).getSingle(type),
  });
}

/** What a project card on the booked page needs, and nothing else: the page
 *  prerenders, so this is what rides in its payload. */
export type BookedProject = {
  uid: string;
  title: string;
  heroUrl: string | null;
  services: string;
};

/**
 * The booked page's projects, in the order `uids` names them. A UID with no
 * published project is skipped, and a Prismic failure gives none, so the
 * section is hidden rather than the booking page failing to build.
 */
export async function loadBookedProjects(
  event: { fetch: typeof fetch; cookies?: Cookies },
  uids: string[],
): Promise<BookedProject[]> {
  if (!uids.length) return [];
  try {
    const client = createClient({ fetch: event.fetch, cookies: event.cookies });
    const docs = await client.getByUIDs("project", uids);
    const byUid = new Map(docs.results.map((d) => [d.uid, d]));
    return uids.flatMap((uid) => {
      const doc = byUid.get(uid);
      if (!doc) return [];
      return [
        {
          uid,
          title: doc.data.title ?? "",
          heroUrl: doc.data.hero?.url ?? null,
          services: mediumString(doc),
        },
      ];
    });
  } catch (err) {
    console.error("[funnel-copy] project read failed, hiding the booked page's work:", err);
    return [];
  }
}
