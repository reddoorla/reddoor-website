import { describe, expect, it } from "vitest";
import { imgixSrc, imgixSrcset, CARD_WIDTHS } from "./imgix";
import { MAX_IMAGE_W } from "$lib/images";

const URL_WITH_PARAMS = "https://images.prismic.io/reddoor-la/abc_hero.jpg?auto=format,compress";

/**
 * The `src` on a raw <img> is not a formality.
 *
 * These usages already carry a width-stepped `srcset`, so a browser picks a
 * sensible file and nobody noticed the fallback. But `src` is what everything
 * without srcset support reads — and that includes our own audit, which is how
 * this surfaced: it reported 1,760 KB for a hero whose srcset would have handed
 * a browser a fraction of that. An attribute only a machine reads is still an
 * attribute that has to be right.
 */
describe("imgixSrc", () => {
  it("caps the fallback at the same ceiling as every other image", () => {
    const out = imgixSrc(URL_WITH_PARAMS);
    expect(out).toContain(`w=${MAX_IMAGE_W}`);
    expect(out).toContain("fit=max");
  });

  it("keeps the params the URL already carried", () => {
    expect(imgixSrc(URL_WITH_PARAMS)).toContain("auto=format,compress");
  });

  it("starts a query string when the URL has none", () => {
    const out = imgixSrc("https://images.prismic.io/reddoor-la/abc_hero.jpg");
    expect(out).toContain("?fit=max");
    expect(out).not.toContain("??");
  });

  it("returns an empty string for a missing image, so it can be bound directly", () => {
    // These call sites read `field.url || ""` off an optional relationship;
    // an undefined must not become the string "undefined" in a src attribute.
    expect(imgixSrc(null)).toBe("");
    expect(imgixSrc(undefined)).toBe("");
    expect(imgixSrc("")).toBe("");
  });
});

describe("imgixSrcset", () => {
  it("still builds the width ladder", () => {
    const out = imgixSrcset(URL_WITH_PARAMS);
    for (const w of CARD_WIDTHS) expect(out).toContain(`w=${w} ${w}w`);
  });

  it("returns an empty string for a missing image", () => {
    expect(imgixSrcset(null)).toBe("");
  });
});
