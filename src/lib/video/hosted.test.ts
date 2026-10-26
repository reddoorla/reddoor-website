import { describe, expect, it } from "vitest";
import { CONTENT_SECURITY_POLICY } from "$lib/security/headers";
import { hostedVideo } from "./hosted";

// The three clips the code names by Vimeo id play from Prismic's media
// library, on a host the CSP's media-src allows (else the browser blocks the
// file and Video.svelte quietly falls back to Vimeo).
describe("hostedVideo", () => {
  const mediaSrc = (/(?:^|; )media-src ([^;]*)/.exec(CONTENT_SECURITY_POLICY)?.[1] ?? "").split(
    " ",
  );
  const allowed = (url: string) => mediaSrc.includes(`https://${new URL(url).host}`);

  for (const [page, id] of [
    ["home", "1082293395"],
    ["portfolio", "1205996665"],
    ["20 for 20", "1125997849"],
  ]) {
    it(`gives the ${page} clip a self-hosted mp4 and phone mp4 the CSP allows`, () => {
      const v = hostedVideo(id);
      for (const url of [v.mp4, v.mobileMp4]) {
        expect(url).toMatch(/^https:\/\/.+\.mp4$/);
        expect(allowed(url!)).toBe(true);
      }
    });
  }

  it("has nothing for a clip it does not know, so that clip plays Vimeo", () => {
    expect(hostedVideo("1")).toEqual({ mp4: null, mobileMp4: null });
  });
});
