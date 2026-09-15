import * as prismic from "@prismicio/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const visibility = vi.hoisted(() => ({ show: false }));
vi.mock("@prismicio/svelte/kit", () => ({ enableAutoPreviews: () => {} }));
vi.mock("$app/environment", () => ({ dev: false }));
vi.mock("$env/dynamic/private", () => ({ env: {} }));
vi.mock("$lib/server/content-visibility", async (importOriginal) => {
  const real = await importOriginal<typeof import("$lib/server/content-visibility")>();
  return { ...real, currentlyShowsHidden: () => visibility.show };
});

const { createClient } = await import("./prismicio");

/** A fetch that answers only the repository-metadata call the URL builder makes. */
const repositoryFetch = async () =>
  new Response(JSON.stringify({ refs: [{ id: "master", ref: "test-ref", isMasterRef: true }] }), {
    headers: { "content-type": "application/json" },
  });

const ownFilter = prismic.filter.at("document.type", "project");
const hidden = '[not(document.tags, ["hide"])]';
/** The query's filters, as the API receives them (`q` repeats per filter). */
const filtersIn = (url: string) => new URL(url).searchParams.getAll("q").join(" ");

describe("createClient", () => {
  beforeEach(() => {
    visibility.show = false;
  });

  it("appends the hide filter to a query's own filters when hidden content is off", async () => {
    const client = createClient({ fetch: repositoryFetch as typeof fetch });
    const url = filtersIn(await client.buildQueryURL({ filters: [ownFilter] }));
    expect(url).toContain(ownFilter);
    expect(url).toContain(hidden);
  });

  it("appends it to a query with no filters of its own", async () => {
    const client = createClient({ fetch: repositoryFetch as typeof fetch });
    expect(filtersIn(await client.buildQueryURL())).toContain(hidden);
  });

  it("sends the query untouched when hidden content is shown", async () => {
    visibility.show = true;
    const client = createClient({ fetch: repositoryFetch as typeof fetch });
    const url = filtersIn(await client.buildQueryURL({ filters: [ownFilter] }));
    expect(url).toContain(ownFilter);
    expect(url).not.toContain("document.tags");
  });
});
