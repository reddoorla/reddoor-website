import { describe, it, expect } from "vitest";
import { asLink } from "@prismicio/client";
import { previewPage } from "./preview-url";

/**
 * The preview button on Tim's `funnel_copy` document must open
 * /preview/funnel (redirectToPreviewURL adds "/preview"), and every other
 * document must keep the URL the route resolver gives it. Checked through
 * `asLink`, which is what resolvePreviewURL calls with this resolver.
 */
const doc = (type: string, url: string | null) =>
  ({ id: "X", uid: null, type, url, lang: "en-us", tags: [], data: {} }) as never;

describe("previewPage", () => {
  it("opens the funnel copy on its preview page", () => {
    expect(asLink(doc("funnel_copy", null), { linkResolver: previewPage })).toBe("/funnel");
  });

  it("leaves every other document on its own URL", () => {
    expect(asLink(doc("page", "/about"), { linkResolver: previewPage })).toBe("/about");
    expect(asLink(doc("project", "/portfolio/x"), { linkResolver: previewPage })).toBe(
      "/portfolio/x",
    );
  });
});
