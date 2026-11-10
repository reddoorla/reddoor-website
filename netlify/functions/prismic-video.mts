// Prismic's webhook for video publishes. It checks the secret, finds the
// videos in the published documents, and dispatches `video-encode` for each
// one that is not on R2 yet, through the workflow-dispatch API for
// video-encode.yml. The logic is in src/lib/server/video-relay.ts.
import * as prismic from "@prismicio/client";
import { handlePrismicWebhook } from "@reddoorla/maintenance/video-pipeline";
import { buildRelayConfig } from "../../src/lib/server/video-relay.ts";
import { repositoryName } from "../../src/lib/prismic-repo.ts";

export default async (req: Request) => {
  const result = await handlePrismicWebhook(
    { method: req.method, body: await req.text() },
    buildRelayConfig(process.env, {
      fetch: globalThis.fetch,
      getDocuments: (ids) => prismic.createClient(repositoryName).getAllByIDs(ids),
    }),
  );
  // The relay's bodies are JSON objects, except for the plain-text refusals.
  const contentType = result.body.startsWith("{")
    ? "application/json"
    : "text/plain; charset=utf-8";
  return new Response(result.body, {
    status: result.status,
    headers: { "content-type": contentType },
  });
};
