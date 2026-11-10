// Prismic's webhook for video publishes. It checks the secret, finds the
// videos in the published documents, and dispatches `video-encode` for each
// one that is not on R2 yet. The logic is in src/lib/server/video-relay.ts.
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
  return new Response(result.body, {
    status: result.status,
    headers: { "content-type": "application/json" },
  });
};
