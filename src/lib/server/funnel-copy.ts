import type { Cookies } from "@sveltejs/kit";
import * as env from "$app/env/private";
import { createClient } from "$lib/prismicio";
import { DEFAULT_FUNNEL_COPY, readFunnelCopy, type FunnelCopy } from "$lib/funnel-copy/copy";

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
