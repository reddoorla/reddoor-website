import { describe, expect, it, vi } from "vitest";
import { render } from "svelte/server";
import { ssr } from "$lib/report/ssr-test-harness";

// The page's `videos` (what +layout.server.ts resolves) is the only input that
// decides which file a slice plays, so it is what each test sets.
const state = vi.hoisted(() => ({ page: { data: { videos: {} as Record<string, unknown> } } }));
vi.mock("$app/state", () => state);

// The unit config has no Svelte plugin, so each component the slice imports is
// compiled by the same harness as the slice. PrismicImage ships uncompiled
// .svelte files, and only the <source> of the video matters here: a no-op does.
vi.mock("@prismicio/svelte", () => ({ PrismicImage: () => {} }));
vi.mock("$lib/components/VimeoEmbed.svelte", async () => ({
  default: await ssr("src/lib/components/VimeoEmbed.svelte"),
}));
vi.mock("$lib/components/Video.svelte", async () => ({
  default: await ssr("src/lib/components/Video.svelte"),
}));
vi.mock("$lib/components/SliceSection.svelte", async () => ({
  default: await ssr("src/lib/components/SliceSection.svelte"),
}));

const ScreenWidthMedia = await ssr<{ slice: unknown }>(
  "src/lib/slices/ScreenWidthMedia/index.svelte",
);

const PRISMIC_MP4 = "https://reddoor-la.cdn.prismic.io/reddoor-la/a1_alpha-1080.mp4";
const R2_MP4 =
  "https://media.reddoorla.com/reddoor-website/alpha-0123456789/player-x/alpha-1080.mp4";
const R2_POSTER =
  "https://media.reddoorla.com/reddoor-website/alpha-0123456789/player-x/alpha-poster.jpg";

/** A screen_width_image slice whose video_mp4 is PRISMIC_MP4, as pipeline-rules.json classes it. */
const slice = {
  slice_type: "screen_width_image",
  variation: "default",
  primary: {
    hide: false,
    background: "white",
    image: {
      url: "https://images.prismic.io/reddoor-la/poster.jpg",
      alt: "",
      dimensions: { width: 1920, height: 1080 },
    },
    video_mp4: {
      link_type: "Media",
      url: PRISMIC_MP4,
      name: "alpha-1080.mp4",
      kind: "file",
    },
    video_mp4_mobile: null,
    video_captions: null,
    vimeoid: null,
    loopvideo: true,
    aspect: "16/9",
  },
};

/** The `src` of every <source> the slice renders. */
function sourceSrcs(html: string): string[] {
  return [...html.matchAll(/<source\b[^>]*\bsrc="([^"]*)"/g)].map((m) => m[1]!);
}

describe("ScreenWidthMedia plays the R2 file its build resolved", () => {
  it("plays the media.reddoorla.com file when the page lists the video", () => {
    state.page = {
      data: {
        videos: {
          [PRISMIC_MP4]: { mp4: R2_MP4, mobileMp4: null, poster: R2_POSTER, captions: null },
        },
      },
    };

    const html = render(ScreenWidthMedia, { props: { slice } }).body;

    expect(sourceSrcs(html)).toContain(R2_MP4);
    expect(html).not.toContain(PRISMIC_MP4);
  });

  it("plays the Prismic file when the page lists no rendition for the video", () => {
    state.page = { data: { videos: {} } };

    const html = render(ScreenWidthMedia, { props: { slice } }).body;

    expect(sourceSrcs(html)).toContain(PRISMIC_MP4);
    expect(html).not.toContain("media.reddoorla.com");
  });
});
