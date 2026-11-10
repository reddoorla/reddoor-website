import { describe, expect, it } from "vitest";
import type { LinkToMediaField } from "@prismicio/client";
import { captionsUrl, mediaUrl, videoFor } from "./media";

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

describe("videoFor", () => {
  const PRISMIC = "https://reddoor-la.cdn.prismic.io/reddoor-la/abc_offer-1080.mp4";
  const PRISMIC_MOBILE = "https://reddoor-la.cdn.prismic.io/reddoor-la/abc_offer-720.mp4";
  const EDITOR_VTT = "https://reddoor-la.cdn.prismic.io/reddoor-la/abc_offer.en.vtt";
  const R2_VTT = "https://media.reddoorla.com/reddoor-website/offer/offer.vtt";
  const field = media({ url: PRISMIC, name: "offer-1080.mp4" });
  const mobile = media({ url: PRISMIC_MOBILE, name: "offer-720.mp4" });
  const captions = media({ url: EDITOR_VTT, name: "offer.en.vtt" });
  const rendition = {
    mp4: "https://media.reddoorla.com/reddoor-website/offer/offer-1080.mp4",
    mobileMp4: "https://media.reddoorla.com/reddoor-website/offer/offer-720.mp4",
    webm: null,
    poster: "https://media.reddoorla.com/reddoor-website/offer/offer-poster.jpg",
    captions: R2_VTT,
    onR2: true,
  };

  it("plays the R2 files, with the R2 poster, when the build found the video on R2", () => {
    const out = videoFor(field, mobile, null, { [PRISMIC]: rendition });
    expect(out).toEqual({
      mp4: rendition.mp4,
      mobileMp4: rendition.mobileMp4,
      poster: rendition.poster,
      captions: R2_VTT,
    });
  });

  it("lets an editor's captions file win over the R2 captions", () => {
    const out = videoFor(field, mobile, captions, { [PRISMIC]: rendition });
    expect(out.captions).toBe(EDITOR_VTT);
  });

  it("falls back to the Prismic mobile file when R2 has no phone rendition", () => {
    const out = videoFor(field, mobile, null, {
      [PRISMIC]: { ...rendition, mobileMp4: null },
    });
    expect(out.mobileMp4).toBe(PRISMIC_MOBILE);
  });

  it("is today's behaviour when the build has no entry for the video", () => {
    expect(videoFor(field, mobile, captions, {})).toEqual({
      mp4: PRISMIC,
      mobileMp4: PRISMIC_MOBILE,
      poster: null,
      captions: EDITOR_VTT,
    });
    expect(videoFor(field, mobile, null, undefined)).toEqual({
      mp4: PRISMIC,
      mobileMp4: PRISMIC_MOBILE,
      poster: null,
      captions: null,
    });
  });
});
