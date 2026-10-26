/**
 * Self-hosted renditions of the clips the code names by Vimeo id (the home
 * hero, the portfolio's Rubrik Zero Labs banner, 20 for 20), which have no
 * Prismic field to hold a file. Each url is a Prismic media-library file,
 * uploaded to the media library (2026-10-26, from the encodes in Dropbox at
 * /Marketing/RD_website_design/RD_web_2026/web-video-encodes-2026-10-26/). A
 * clip with no entry, or an entry whose file fails, plays from Vimeo (see
 * Video.svelte).
 */
export interface HostedVideo {
  mp4: string | null;
  mobileMp4: string | null;
}

const CDN = "https://reddoor-la.cdn.prismic.io/reddoor-la/";

export const HOSTED_VIDEOS: Readonly<Record<string, HostedVideo>> = {
  // Home hero: the Sonder sketches.
  "1082293395": {
    mp4: `${CDN}614GonznktbPp7H4_home-sonder-sketches-1080.mp4`,
    mobileMp4: `${CDN}LGhBzPYgU6hG3b6G_home-sonder-sketches-phone-720.mp4`,
  },
  // Portfolio: Rubrik Zero Labs brand film (V6, 16:9).
  "1205996665": {
    mp4: `${CDN}sqo15Bmkzd_IrFWb_rzl-brand-linkedin-v6-16x9-1080.mp4`,
    mobileMp4: `${CDN}mPDSFQQV1O0LkkrF_rzl-brand-linkedin-v6-16x9-phone-720.mp4`,
  },
  // 20 for 20: the "20" sketch (an 800x800 master, so its main file is 800).
  "1125997849": {
    mp4: `${CDN}Wek5vCH1YghwMHG9_twenty-for-twenty-sketch-800.mp4`,
    mobileMp4: `${CDN}45uRAy_uoF2m69Xm_twenty-for-twenty-sketch-phone-720.mp4`,
  },
};

export function hostedVideo(vimeoId: string): HostedVideo {
  return HOSTED_VIDEOS[vimeoId] ?? { mp4: null, mobileMp4: null };
}
