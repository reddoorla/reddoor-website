import { describe, expect, it, vi } from "vitest";
import { handlePrismicWebhook, videoKey } from "@reddoorla/maintenance/video-pipeline";
import type { DocLike } from "@reddoorla/maintenance/video-pipeline";
import { buildRelayConfig } from "./video-relay";
import { VIDEO_RULES } from "../video/pipeline";

const SECRET = "webhook-secret";
const TOKEN = "dispatch-token";
const VIDEO_URL = "https://reddoor-la.cdn.prismic.io/reddoor-la/a1_offer-1080.mp4";

const env = {
  PRISMIC_WEBHOOK_SECRET: SECRET,
  VIDEO_DISPATCH_TOKEN: TOKEN,
};

// A published offer page: one offer_hero slice whose video is a Prismic file.
const offerDoc: DocLike = {
  id: "offer-doc",
  last_publication_date: "2026-11-10T10:00:00Z",
  data: {
    body: [
      {
        slice_type: "offer_hero",
        primary: {
          video_mp4: {
            link_type: "Media",
            url: VIDEO_URL,
            name: "offer-1080.mp4",
            kind: "file",
          },
        },
      },
    ],
  },
};

const webhook = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    type: "api-update",
    secret: SECRET,
    documents: ["offer-doc"],
    ...overrides,
  });

/** A fetch that answers 404 for the manifest (nothing on R2) and 204 for the dispatch. */
function fakeFetch() {
  return vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("https://api.github.com/")) return new Response(null, { status: 204 });
    return new Response(null, { status: 404 });
  });
}

describe("buildRelayConfig", () => {
  it("reads the secret and the dispatch token from the environment", () => {
    const cfg = buildRelayConfig(env, { fetch: fakeFetch(), getDocuments: async () => [] });
    expect(cfg.secret).toBe(SECRET);
    expect(cfg.dispatchToken).toBe(TOKEN);
  });

  it("carries the site's own constants: site, repo, media base and rules", () => {
    const cfg = buildRelayConfig(env, { fetch: fakeFetch(), getDocuments: async () => [] });
    expect(cfg.site).toBe("reddoor-website");
    expect(cfg.repo).toBe("reddoorla/reddoor-website");
    expect(cfg.mediaBase).toBe("https://media.reddoorla.com");
    expect(cfg.rules).toBe(VIDEO_RULES);
  });

  it("leaves a missing variable unset, so the relay refuses the request", () => {
    const cfg = buildRelayConfig({}, { fetch: fakeFetch(), getDocuments: async () => [] });
    expect(cfg.secret).toBeUndefined();
    expect(cfg.dispatchToken).toBeUndefined();
  });
});

describe("the relay through buildRelayConfig", () => {
  it("dispatches one encode for a player video that is not on R2", async () => {
    const fetchFn = fakeFetch();
    const getDocuments = vi.fn(async () => [offerDoc]);
    const cfg = buildRelayConfig(env, { fetch: fetchFn as unknown as typeof fetch, getDocuments });

    const result = await handlePrismicWebhook({ method: "POST", body: webhook() }, cfg);

    expect(result.status).toBe(200);
    expect(getDocuments).toHaveBeenCalledWith(["offer-doc"]);
    const dispatches = fetchFn.mock.calls.filter(([input]) =>
      String(input).startsWith("https://api.github.com/"),
    );
    expect(dispatches).toHaveLength(1);
    const [dispatchUrl, init] = dispatches[0]!;
    expect(String(dispatchUrl)).toBe(
      "https://api.github.com/repos/reddoorla/reddoor-website/actions/workflows/video-encode.yml/dispatches",
    );
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      ref: "main",
      inputs: { url: VIDEO_URL, class: "player", key: videoKey("reddoor-website", VIDEO_URL) },
    });
  });

  it("answers 401 and touches nothing when the secret is wrong", async () => {
    const fetchFn = fakeFetch();
    const getDocuments = vi.fn(async () => [offerDoc]);
    const cfg = buildRelayConfig(env, { fetch: fetchFn as unknown as typeof fetch, getDocuments });

    const result = await handlePrismicWebhook(
      { method: "POST", body: webhook({ secret: "not-the-secret" }) },
      cfg,
    );

    expect(result.status).toBe(401);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(getDocuments).not.toHaveBeenCalled();
  });
});
