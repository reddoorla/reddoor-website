import { describe, expect, it } from "vitest";
import type { ImageField } from "@prismicio/client";
import { heroSlides } from "./slides";

const img = (id: string) =>
  ({
    id,
    url: `https://images.prismic.io/reddoor-la/${id}.jpg`,
    alt: null,
    copyright: null,
    dimensions: { width: 1600, height: 1000 },
    edit: { x: 0, y: 0, zoom: 1, background: "transparent" },
  }) as unknown as ImageField;
const empty = {} as ImageField;

describe("heroSlides", () => {
  it("puts the main image first, then the extras in order", () => {
    const slides = heroSlides({
      image: img("a"),
      images: [{ image: img("b") }, { image: img("c") }],
    });
    expect(slides.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("is just the main image for a document published before the extras field", () => {
    expect(heroSlides({ image: img("a") }).map((s) => s.id)).toEqual(["a"]);
    expect(heroSlides({ image: img("a"), images: null }).map((s) => s.id)).toEqual(["a"]);
  });

  it("drops unfilled rows and an unfilled main image", () => {
    const slides = heroSlides({ image: empty, images: [{ image: empty }, { image: img("b") }] });
    expect(slides.map((s) => s.id)).toEqual(["b"]);
  });

  it("is empty when nothing is filled", () => {
    expect(heroSlides({ image: empty, images: [] })).toEqual([]);
  });
});
