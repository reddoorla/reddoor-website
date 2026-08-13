import { describe, it, expect } from "vitest";
import { slideshowAspect } from "./aspect";
import type { ImageField } from "@prismicio/client";

const slide = (width: number, height: number) =>
  ({ image: { dimensions: { width, height } } }) as unknown as { image: ImageField };

describe("slideshowAspect", () => {
  it("returns null when there is nothing to measure", () => {
    expect(slideshowAspect([])).toBeNull();
    expect(slideshowAspect(null)).toBeNull();
    expect(slideshowAspect([{ image: null }])).toBeNull();
  });

  it("ignores rows with unusable dimensions rather than dividing by zero", () => {
    expect(slideshowAspect([slide(1800, 0), slide(1800, 1200)])).toBe(1.5);
  });

  it("takes a single slide at its own ratio", () => {
    expect(slideshowAspect([slide(1800, 1200)])).toBe(1.5);
  });

  it("follows the majority and ignores the odd slide out", () => {
    // /portfolio/composition-hospitality: eight slides at 1.5, one at 1.3524.
    const images = [...Array(8)].map(() => slide(1800, 1200));
    images.splice(5, 0, slide(1800, 1331));
    expect(slideshowAspect(images)).toBe(1.5);
  });

  it("treats a rounding-level difference as the same shape", () => {
    // /portfolio/toyota ships 1800x1199 alongside 1800x1200 — 0.09% apart. That
    // belongs in the majority cluster, not counted as a second shape.
    expect(slideshowAspect([slide(1800, 1200), slide(1800, 1200), slide(1800, 1199)])).toBe(1.5);
  });

  it("is not fooled by a majority of one when the outliers are numerous", () => {
    // /portfolio/champion: one 1.5 slide against six at ~1.294.
    const images = [slide(1800, 1200), ...[...Array(5)].map(() => slide(1800, 1391))];
    images.push(slide(1650, 1275)); // 1.2941 — same shape as its neighbours
    expect(slideshowAspect(images)).toBeCloseTo(1.294, 3);
  });

  it("picks the middle shape when every slide disagrees", () => {
    // /portfolio/7600-broadway: three slides, three ratios, no majority. The
    // middle one letterboxes the other two least.
    const chosen = slideshowAspect([slide(1479, 1013), slide(1738, 1030), slide(1800, 1088)]);
    expect(chosen).toBeCloseTo(1.6544, 3);
  });

  it("widens the cluster as tolerance grows", () => {
    const images = [slide(1000, 1000), slide(1030, 1000), slide(2000, 1000)];
    // At 1% those first two are separate shapes, so no cluster beats another on
    // count and the median decides. At 5% they merge into a real majority.
    expect(slideshowAspect(images, 0.05)).toBeCloseTo(1.015, 3);
  });
});
