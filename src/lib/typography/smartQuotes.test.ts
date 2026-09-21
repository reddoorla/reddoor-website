import { describe, expect, it } from "vitest";
import { isProseKey, smartQuotes, smartQuoteData, smartQuoteDocument } from "./smartQuotes";

// The four marks, named, so a failure message shows which one was wrong rather
// than two glyphs that look identical in a terminal.
const LDQ = "\u201C";
const RDQ = "\u201D";
const LSQ = "\u2018";
const RSQ = "\u2019";

describe("smartQuotes", () => {
  it("curls contractions and possessives", () => {
    expect(smartQuotes("We'll Take Your MedTech Brand")).toBe(`We${RSQ}ll Take Your MedTech Brand`);
    expect(smartQuotes("the dogs' bowls")).toBe(`the dogs${RSQ} bowls`);
    expect(smartQuotes("Let's go")).toBe(`Let${RSQ}s go`);
    expect(smartQuotes("doesn't happen by accident")).toBe(`doesn${RSQ}t happen by accident`);
    expect(smartQuotes("Reddoor's framework")).toBe(`Reddoor${RSQ}s framework`);
  });

  it("curls a leading elision the way a CLOSING mark curls, not an opening one", () => {
    // The case a positional implementation gets backwards: `'til` sits exactly
    // where an opening quotation mark would sit.
    expect(smartQuotes("wait 'til dawn")).toBe(`wait ${RSQ}til dawn`);
    expect(smartQuotes("'til dawn")).toBe(`${RSQ}til dawn`);
    expect(smartQuotes("the '90s")).toBe(`the ${RSQ}90s`);
    expect(smartQuotes("back in '26")).toBe(`back in ${RSQ}26`);
    expect(smartQuotes("rock 'n' roll")).toBe(`rock ${RSQ}n${RSQ} roll`);
    expect(smartQuotes("'twas the night")).toBe(`${RSQ}twas the night`);
    expect(smartQuotes("give 'em the brief")).toBe(`give ${RSQ}em the brief`);
  });

  it("pairs double quotes by context", () => {
    expect(smartQuotes('He said "hello" to me.')).toBe(`He said ${LDQ}hello${RDQ} to me.`);
    expect(smartQuotes('"Opening at the start"')).toBe(`${LDQ}Opening at the start${RDQ}`);
    expect(smartQuotes('("after a paren")')).toBe(`(${LDQ}after a paren${RDQ})`);
    expect(smartQuotes('["after a bracket"]')).toBe(`[${LDQ}after a bracket${RDQ}]`);
    expect(smartQuotes('a dash—"then a quote"')).toBe(`a dash—${LDQ}then a quote${RDQ}`);
    expect(smartQuotes('a line\n"then a quote"')).toBe(`a line\n${LDQ}then a quote${RDQ}`);
    // Closing position is everything else, including straight after punctuation.
    expect(smartQuotes('"Well," he said.')).toBe(`${LDQ}Well,${RDQ} he said.`);
  });

  it("nests single quotes inside a double-quoted phrase", () => {
    expect(smartQuotes(`"He said 'hello' to me"`)).toBe(
      `${LDQ}He said ${LSQ}hello${RSQ} to me${RDQ}`,
    );
    // …and the elision rule still wins inside the nesting.
    expect(smartQuotes(`"'Tis the season"`)).toBe(`${LDQ}${RSQ}Tis the season${RDQ}`);
    expect(smartQuotes(`"Don't call it 'digital'," he said.`)).toBe(
      `${LDQ}Don${RSQ}t call it ${LSQ}digital${RSQ},${RDQ} he said.`,
    );
  });

  it("leaves URLs alone", () => {
    for (const url of [
      "https://reddoorla.com/portfolio?q=a'b",
      "http://example.com/it's",
      "//cdn.example.com/x'y.png",
      "/contact#inquire'x",
      "./local'path",
      "mailto:hello@reddoorla.com?subject=it's",
      "tel:+1555'0100",
      "reddoorla.com/o'brien",
    ]) {
      expect(smartQuotes(url), url).toBe(url);
    }
    // But prose that merely mentions one is still corrected.
    expect(smartQuotes("Tim's site is reddoorla.com")).toBe(`Tim${RSQ}s site is reddoorla.com`);
  });

  it("leaves anything that looks like code or markup alone", () => {
    for (const code of [
      `<p class="quote">Tim's quote</p>`,
      `{ "quote": "Tim's quote" }`,
      `const x = { a: 'b' };`,
      `.quote::before { content: "\\201C" }`,
    ]) {
      expect(smartQuotes(code), code).toBe(code);
    }
  });

  it("never changes the string's LENGTH — rich-text spans are byte offsets", () => {
    const samples = [
      "We'll take your brand from 'screened out' to short list.",
      `"Quote," said Tim, "and it's 'nested' too."`,
      "'til the '90s ended — o'clock, dogs', \"double\"",
      '🎯 Tim\'s emoji copy with "quotes"',
      "6'2\" and rising",
    ];
    for (const sample of samples) {
      expect(smartQuotes(sample).length, sample).toBe(sample.length);
      // Code-unit length is what spans index, so check both views agree.
      expect([...smartQuotes(sample)].length, sample).toBe([...sample].length);
    }
  });

  it("is idempotent", () => {
    const samples = [
      "We'll wait 'til the '90s \"end\"",
      `"He said 'hello'," she wrote.`,
      "Nothing to do here.",
      "Already ‘done’ and “dusted”.",
    ];
    for (const sample of samples) {
      const once = smartQuotes(sample);
      expect(smartQuotes(once), sample).toBe(once);
    }
  });

  it("leaves a string with no straight mark untouched, by reference", () => {
    const clean = "Already ’done’ and “dusted”.";
    expect(smartQuotes(clean)).toBe(clean);
  });
});

describe("isProseKey", () => {
  it("rejects identifiers and addresses", () => {
    for (const key of [
      "url",
      "uid",
      "id",
      "type",
      "link_type",
      "target",
      "lang",
      "key",
      "slug",
      "href",
      "src",
      "slice_type",
      "document_id",
      "image_url",
    ]) {
      expect(isProseKey(key), key).toBe(false);
    }
  });

  it("accepts prose, alt text included", () => {
    for (const key of ["text", "alt", "heading", "quote", "meta_description", "label", "body"]) {
      expect(isProseKey(key), key).toBe(true);
    }
  });
});

describe("smartQuoteData", () => {
  it("corrects rich text without moving a single span offset", () => {
    const block = {
      type: "paragraph",
      text: `We'll take your "brand" from screened out to short list.`,
      spans: [{ start: 8, end: 12, type: "strong" }],
    };
    const out = smartQuoteData({ body: [block] }, "");
    const next = out.body[0];
    expect(next.text).toBe(
      `We${RSQ}ll take your ${LDQ}brand${RDQ} from screened out to short list.`,
    );
    expect(next.text.length).toBe(block.text.length);
    // The span still covers the same word it covered before.
    expect(next.text.slice(8, 12)).toBe(block.text.slice(8, 12));
    expect(next.spans).toEqual(block.spans);
    // `type` is an identifier and is left alone even though it is a string.
    expect(next.type).toBe("paragraph");
  });

  it("corrects alt text and leaves the image's url and id", () => {
    const image = {
      url: "https://images.prismic.io/reddoor/a'b.png?auto=format",
      alt: "Tim's team in the studio",
      dimensions: { width: 1200, height: 800 },
      id: "Z_abc'123",
    };
    const out = smartQuoteData(image, "avatar");
    expect(out.alt).toBe(`Tim${RSQ}s team in the studio`);
    expect(out.url).toBe(image.url);
    expect(out.id).toBe(image.id);
    expect(out.dimensions).toEqual({ width: 1200, height: 800 });
  });

  it("walks nested slices, groups and link fields", () => {
    const data = {
      body: [
        {
          slice_type: "testimonial",
          primary: {
            quote: `We needed to look credible — and "credible" wasn't the word for it.`,
            link: { link_type: "Web", url: "https://x.test/a'b", text: "Tim's site" },
          },
          items: [{ label: "Don't stop" }],
        },
      ],
    };
    const out = smartQuoteData(data, "");
    const slice = out.body[0];
    expect(slice.slice_type).toBe("testimonial");
    expect(slice.primary.quote).toContain(`${LDQ}credible${RDQ}`);
    expect(slice.primary.quote).toContain(`wasn${RSQ}t`);
    expect(slice.primary.link.url).toBe("https://x.test/a'b");
    expect(slice.primary.link.link_type).toBe("Web");
    expect(slice.primary.link.text).toBe(`Tim${RSQ}s site`);
    expect(slice.items[0].label).toBe(`Don${RSQ}t stop`);
  });

  it("leaves non-strings, and returns the input by reference when nothing changed", () => {
    const data = {
      count: 3,
      flag: true,
      empty: null,
      nested: { text: "Already correct." },
      list: ["a", "b"],
    };
    expect(smartQuoteData(data, "")).toBe(data);
  });

  it("is idempotent over a whole document", () => {
    const data = { primary: { heading: `Tim's "big" idea`, items: ["wait 'til later"] } };
    const once = smartQuoteData(data, "");
    expect(smartQuoteData(once, "")).toBe(once);
  });
});

describe("smartQuoteDocument", () => {
  it("corrects data and leaves the envelope exactly as the API sent it", () => {
    const document = {
      id: "Z_abc",
      uid: "medtech",
      url: "/medtech",
      type: "industry",
      href: "https://reddoor.cdn.prismic.io/api/v2/documents/search?ref=x",
      tags: ["hide"],
      lang: "en-us",
      data: { meta_title: `Tim's MedTech page`, quote: `"credible"` },
    };
    const out = smartQuoteDocument(document);
    expect(out.data.meta_title).toBe(`Tim${RSQ}s MedTech page`);
    expect(out.data.quote).toBe(`${LDQ}credible${RDQ}`);
    expect(out.id).toBe(document.id);
    expect(out.uid).toBe(document.uid);
    expect(out.url).toBe(document.url);
    expect(out.type).toBe(document.type);
    expect(out.href).toBe(document.href);
    expect(out.tags).toEqual(["hide"]);
    expect(out.lang).toBe("en-us");
    // The original is not mutated — the walk copies.
    expect(document.data.meta_title).toBe(`Tim's MedTech page`);
  });

  it("returns the same document when there was nothing to correct", () => {
    const document = { id: "Z_abc", data: { heading: "Nothing to do." } };
    expect(smartQuoteDocument(document)).toBe(document);
  });
});
