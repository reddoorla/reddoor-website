import { describe, it, expect } from "vitest";
import { mediaImgAttrs } from "./mediaSrcset";

const URL = "https://images.prismic.io/reddoor-la/abc_photo.jpg";

describe("mediaImgAttrs", () => {
  it("builds one srcset entry per width, largest as src", () => {
    const { src, srcset, sizes } = mediaImgAttrs(URL, {
      widths: [400, 800],
      sizes: "50vw",
    });
    const entries = srcset.split(", ");
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatch(/ 400w$/);
    expect(entries[1]).toMatch(/ 800w$/);
    expect(src).toContain("width=800");
    expect(sizes).toBe("50vw");
  });

  it("adds imgix auto-format/compress + fit=max to every url", () => {
    const { srcset } = mediaImgAttrs(URL, { widths: [640] });
    expect(srcset).toMatch(/auto=format%2Ccompress/);
    expect(srcset).toContain("fit=max");
    expect(srcset).toContain("width=640");
  });

  it("falls back to default widths and 100vw sizes", () => {
    const { srcset, sizes } = mediaImgAttrs(URL);
    expect(srcset.split(", ")).toHaveLength(5);
    expect(sizes).toBe("100vw");
  });

  it("returns empty attrs for an empty url", () => {
    expect(mediaImgAttrs("")).toEqual({ src: "", srcset: "", sizes: "100vw" });
  });
});
