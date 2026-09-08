import { describe, expect, it, vi } from "vitest";
import { loadRouteMeta } from "./route-meta";

type Client = Parameters<typeof loadRouteMeta>[0];

const doc = (data: Record<string, unknown>) => ({ data });

describe("loadRouteMeta", () => {
  it("maps a filled document to plain strings", async () => {
    const client = {
      getByUID: vi.fn().mockResolvedValue(
        doc({
          meta_title: "About | Reddoor Creative",
          meta_description: "Who we are.",
          meta_image: { url: "https://images.prismic.io/reddoor-la/x.jpg" },
          card_headline: "A clear story.",
        }),
      ),
    } as unknown as Client;
    await expect(loadRouteMeta(client, "about")).resolves.toEqual({
      meta_title: "About | Reddoor Creative",
      meta_description: "Who we are.",
      meta_image: "https://images.prismic.io/reddoor-la/x.jpg",
      card_headline: "A clear story.",
    });
    expect(client.getByUID).toHaveBeenCalledWith("route_meta", "about");
  });

  it("turns empty fields into undefined so callers can `||` their defaults", async () => {
    const client = {
      getByUID: vi
        .fn()
        .mockResolvedValue(
          doc({ meta_title: "", meta_description: null, meta_image: {}, card_headline: "  " }),
        ),
    } as unknown as Client;
    await expect(loadRouteMeta(client, "contact")).resolves.toEqual({
      meta_title: undefined,
      meta_description: undefined,
      meta_image: undefined,
      card_headline: undefined,
    });
  });

  it("returns null when the document is missing or the type is not pushed yet", async () => {
    // Prismic rejects a query on an unknown type with a 400, and a missing uid
    // with a NotFoundError; both must read as "no overrides", never as a crash.
    const client = {
      getByUID: vi.fn().mockRejectedValue(new Error("unexpected field 'my.route_meta.uid'")),
    } as unknown as Client;
    await expect(loadRouteMeta(client, "portfolio")).resolves.toBeNull();
  });

  it("refuses a slug the type is not meant for without querying", async () => {
    const client = { getByUID: vi.fn() } as unknown as Client;
    await expect(loadRouteMeta(client, "default")).resolves.toBeNull();
    await expect(loadRouteMeta(client, "../x")).resolves.toBeNull();
    expect(client.getByUID).not.toHaveBeenCalled();
  });
});
