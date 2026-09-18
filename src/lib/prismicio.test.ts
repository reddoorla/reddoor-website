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

// ---------------------------------------------------------------------------
// Typographic marks (Tim, Discord 2026-09-17). The transform itself is tested
// in $lib/typography/smartQuotes.test.ts; what is tested here is that the
// client is the seam it reaches every document through.
// ---------------------------------------------------------------------------

const RSQ = "\u2019";
const LDQ = "\u201C";
const RDQ = "\u201D";

/**
 * Read a document the client returned as the fixture shape.
 *
 * The client is typed to `AllDocumentTypes` — the repo's real custom types —
 * and this fixture is deliberately none of them, so the cast goes through
 * `unknown`. What is being tested is the transform the client applies, not the
 * generated types.
 */
const asFixture = (document: unknown) => document as ReturnType<typeof straightDocument>;

/** One document with straight marks in `data` and identifiers in the envelope. */
const straightDocument = () => ({
  id: "Z_abc",
  uid: "medtech",
  url: "/medtech",
  type: "industry",
  href: "https://reddoor.cdn.prismic.io/api/v2/documents/search?ref=test-ref",
  tags: [],
  lang: "en-us",
  data: {
    meta_title: "Reddoor's MedTech page",
    body: [
      {
        slice_type: "testimonial",
        primary: {
          quote: `They said we weren't "credible" enough.`,
          rich: [
            {
              type: "paragraph",
              text: `We'll fix it.`,
              spans: [{ start: 3, end: 5, type: "strong" }],
            },
          ],
        },
      },
    ],
  },
});

/** A fetch that answers the repository call and one document query. */
const documentFetch = async (input: RequestInfo | URL) => {
  const url = String(input);
  const body = url.includes("/documents/search")
    ? {
        page: 1,
        results_per_page: 1,
        results_size: 1,
        total_results_size: 1,
        total_pages: 1,
        next_page: null,
        prev_page: null,
        results: [straightDocument()],
      }
    : { refs: [{ id: "master", ref: "test-ref", isMasterRef: true }] };
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
};

describe("typographic marks on the read path", () => {
  beforeEach(() => {
    visibility.show = false;
  });

  // Both branches of createClient, because they are two different classes and
  // dev/staging/preview — where the copy is actually reviewed — take the one
  // that used to be a plain prismic.createClient().
  for (const show of [false, true]) {
    it(`corrects every document ${show ? "with" : "without"} hidden content shown`, async () => {
      visibility.show = show;
      const client = createClient({ fetch: documentFetch as typeof fetch });

      // get(): the path every getAll*/getBy*s method routes through.
      const query = await client.get();
      const viaGet = asFixture(query.results[0]);
      expect(viaGet.data.meta_title).toBe(`Reddoor${RSQ}s MedTech page`);
      expect(viaGet.data.body[0].primary.quote).toBe(
        `They said we weren${RSQ}t ${LDQ}credible${RDQ} enough.`,
      );

      // getFirst(): the path getByID/getByUID/getSingle route through. It does
      // NOT call get(), so it needs its own override.
      const viaFirst = asFixture(await client.getFirst());
      expect(viaFirst.data.meta_title).toBe(`Reddoor${RSQ}s MedTech page`);

      // The envelope is an address book, not copy.
      expect(viaGet.uid).toBe("medtech");
      expect(viaGet.url).toBe("/medtech");
      expect(viaGet.type).toBe("industry");
      expect(viaGet.href).toBe(straightDocument().href);
    });
  }

  it("keeps rich-text spans on the words they were anchored to", async () => {
    const client = createClient({ fetch: documentFetch as typeof fetch });
    const before = straightDocument().data.body[0].primary.rich[0];
    const after = asFixture((await client.get()).results[0]).data.body[0].primary.rich[0];
    expect(after.text).toBe(`We${RSQ}ll fix it.`);
    expect(after.text.length).toBe(before.text.length);
    expect(after.text.slice(3, 5)).toBe(before.text.slice(3, 5));
    expect(after.spans).toEqual(before.spans);
  });
});
