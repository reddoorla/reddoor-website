import { describe, expect, it } from "vitest";
import { normalizeVimeoId, resolveCaseStudyMedia } from "./media";

describe("resolveCaseStudyMedia", () => {
  it("renders the designed state: both images, after first, toggle shown", () => {
    expect(resolveCaseStudyMedia({ hasAfter: true, hasBefore: true, hasVideo: false })).toEqual({
      mode: "toggle",
      showToggle: true,
      base: "after",
    });
  });

  it("drops the toggle when there is no before image", () => {
    expect(resolveCaseStudyMedia({ hasAfter: true, hasBefore: false, hasVideo: false })).toEqual({
      mode: "image",
      showToggle: false,
      base: "after",
    });
  });

  it("falls back to the before image when only it is authored", () => {
    expect(resolveCaseStudyMedia({ hasAfter: false, hasBefore: true, hasVideo: false })).toEqual({
      mode: "image",
      showToggle: false,
      base: "before",
    });
  });

  it("lets a vimeo id win over both images and hide the toggle", () => {
    expect(resolveCaseStudyMedia({ hasAfter: true, hasBefore: true, hasVideo: true })).toEqual({
      mode: "video",
      showToggle: false,
      base: "after",
    });
  });

  it("uses the before image as the video poster when there is no after image", () => {
    expect(resolveCaseStudyMedia({ hasAfter: false, hasBefore: true, hasVideo: true })).toEqual({
      mode: "video",
      showToggle: false,
      base: "before",
    });
  });

  it("allows a posterless video", () => {
    expect(resolveCaseStudyMedia({ hasAfter: false, hasBefore: false, hasVideo: true })).toEqual({
      mode: "video",
      showToggle: false,
      base: "none",
    });
  });

  it("reports empty when nothing is authored", () => {
    expect(resolveCaseStudyMedia({ hasAfter: false, hasBefore: false, hasVideo: false })).toEqual({
      mode: "empty",
      showToggle: false,
      base: "none",
    });
  });
});

describe("normalizeVimeoId", () => {
  it("treats null, undefined and whitespace as no video", () => {
    expect(normalizeVimeoId(null)).toBe("");
    expect(normalizeVimeoId(undefined)).toBe("");
    expect(normalizeVimeoId("   ")).toBe("");
  });

  it("trims a real id", () => {
    expect(normalizeVimeoId(" 76979871 ")).toBe("76979871");
  });
});
