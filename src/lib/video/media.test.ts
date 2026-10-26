import { describe, expect, it } from "vitest";
import type { LinkToMediaField } from "@prismicio/client";
import { captionsUrl, mediaUrl } from "./media";

const media = (over: Record<string, unknown>) =>
  ({ link_type: "Media", ...over }) as unknown as LinkToMediaField;

describe("mediaUrl", () => {
  it("returns the url of a filled video field", () => {
    const url = "https://reddoor-la.cdn.prismic.io/reddoor-la/abc_offer-1080.mp4";
    expect(mediaUrl(media({ url, name: "offer-1080.mp4", kind: "file" }))).toBe(url);
  });

  it("is null for an empty field, so the caller plays Vimeo", () => {
    expect(mediaUrl(media({}))).toBeNull();
    expect(mediaUrl({ link_type: "Any" } as unknown as LinkToMediaField)).toBeNull();
    expect(mediaUrl(null)).toBeNull();
    expect(mediaUrl(undefined)).toBeNull();
  });

  it("is null for a file that is not a video, or a url that is not https", () => {
    expect(
      mediaUrl(
        media({ url: "https://images.prismic.io/reddoor-la/a.png", name: "a.png", kind: "image" }),
      ),
    ).toBeNull();
    expect(
      mediaUrl(media({ url: "https://x.cdn.prismic.io/r/brief.pdf", name: "brief.pdf" })),
    ).toBeNull();
    expect(mediaUrl(media({ url: "http://x.cdn.prismic.io/r/a.mp4", name: "a.mp4" }))).toBeNull();
  });

  it("is null for a webm or mov, which Video would mislabel as video/mp4", () => {
    expect(
      mediaUrl(media({ url: "https://x.cdn.prismic.io/r/a.webm", name: "a.webm" })),
    ).toBeNull();
    expect(mediaUrl(media({ url: "https://x.cdn.prismic.io/r/a.mov", name: "a.mov" }))).toBeNull();
  });

  it("takes an upper-case name", () => {
    const url = "https://x.cdn.prismic.io/r/abc_Offer%20Video.MP4";
    expect(mediaUrl(media({ url, name: "Offer Video.MP4" }))).toBe(url);
  });
});

describe("captionsUrl", () => {
  it("returns a .vtt file's url, and null for anything else", () => {
    const url = "https://reddoor-la.cdn.prismic.io/reddoor-la/abc_offer.en.vtt";
    expect(captionsUrl(media({ url, name: "offer.en.vtt" }))).toBe(url);
    expect(
      captionsUrl(media({ url: "https://x.cdn.prismic.io/r/a.mp4", name: "a.mp4" })),
    ).toBeNull();
    expect(captionsUrl(media({}))).toBeNull();
  });
});
