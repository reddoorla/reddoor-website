import { json } from "@sveltejs/kit";
import { env as privateEnv } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";
import * as prismicio from "$lib/prismicio";
import type { RequestHandler } from "./$types";

// A live probe — must never be prerendered.
export const prerender = false;

type PrismicHealth = "ok" | "error" | "skipped";

type PrismicClient = { getRepository: () => Promise<unknown> };
type PrismicModule = {
  createClient?: (opts: { fetch: typeof globalThis.fetch }) => PrismicClient;
  isPlaceholderRepo?: boolean;
};

// Server-side Prismic reachability probe. Hits the PUBLIC repository-metadata
// endpoint (getRepository — no token), time-boxed, returning ONLY a status
// string; the repository body is never included (/health is public).
async function probePrismic(fetch: typeof globalThis.fetch): Promise<PrismicHealth> {
  const mod = prismicio as PrismicModule;
  const isPlaceholder = mod.isPlaceholderRepo ?? false;
  if (isPlaceholder || typeof mod.createClient !== "function") return "skipped";
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const client = mod.createClient({ fetch });
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("prismic health probe timed out")), 5000);
    });
    await Promise.race([client.getRepository(), timeout]);
    return "ok";
  } catch {
    return "error";
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const GET: RequestHandler = async ({ fetch }) => {
  const prismic = await probePrismic(fetch);
  const forms = {
    ingestUrl: !!privateEnv.FORMS_INGEST_URL,
    ingestToken: !!privateEnv.FORMS_INGEST_TOKEN,
    turnstile: !!publicEnv.PUBLIC_TURNSTILE_SITE_KEY?.trim(),
    // Declares that this deploy's contact form forwards the `testMode` marker
    // to central ingest (contact +page.server.ts action payload) — the fleet
    // form-e2e probe refuses to submit without this flag. Never copy it to a
    // build whose form does not forward the marker (the probe would land as a
    // real lead).
    testMode: true,
  };
  // We're inside the handler, so the function ran; ok is false only when the
  // Prismic probe actively errored.
  const ok = prismic !== "error";
  return json({ ok, prismic, forms });
};
