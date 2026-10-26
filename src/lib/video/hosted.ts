/**
 * Self-hosted renditions of the clips the code names by Vimeo id (the home
 * hero, the portfolio's Rubrik Zero Labs banner, 20 for 20), which have no
 * Prismic field to hold a file. Each url is a Prismic media-library file,
 * uploaded with `.github/workflows/prismic-media-upload.yml`. A clip with no
 * entry, or an entry whose file fails, plays from Vimeo (see Video.svelte).
 */
export interface HostedVideo {
  mp4: string | null;
  mobileMp4: string | null;
}

export const HOSTED_VIDEOS: Readonly<Record<string, HostedVideo>> = {};

export function hostedVideo(vimeoId: string): HostedVideo {
  return HOSTED_VIDEOS[vimeoId] ?? { mp4: null, mobileMp4: null };
}
