import { isFilled, type FilledImageFieldImage, type LinkToMediaField } from "@prismicio/client";
import type { FunnelCopyDocumentData } from "../../../prismicio-types";
import { captionsUrl, mediaUrl } from "$lib/video/media";
import { parseVimeo } from "$lib/slices/OfferHero/vimeo";

/**
 * The parts of the "You're on the calendar" page that are not one line of
 * text: the three preparation steps, the four projects, the video's files and
 * poster, and the testimonial's photo. Each falls back as a whole, like the
 * text fields: an empty group or field shows what the board shows.
 */
export type BookedExtras = {
  steps: string[];
  /** UIDs of `project` documents, in the order the page shows them. */
  projectUids: string[];
  video: {
    vimeo: string;
    mp4: string | null;
    mobileMp4: string | null;
    captions: string | null;
    poster: FilledImageFieldImage | null;
  };
  quotePhoto: FilledImageFieldImage | null;
};

/** A Prismic image as the API returns it, for a default that names an asset
 *  already in the reddoor-la media library. */
function image(url: string, width: number, height: number, alt: string): FilledImageFieldImage {
  return {
    id: url.split("/").pop()!.split("_")[0],
    url,
    dimensions: { width, height },
    edit: { x: 0, y: 0, zoom: 1, background: "transparent" },
    alt,
    copyright: null,
  };
}

const CDN = "https://reddoor-la.cdn.prismic.io/reddoor-la";

export const BOOKED_DEFAULTS: BookedExtras = {
  // The board numbers the third step "02"; the numbers are positional here, so
  // it reads 03.
  steps: [
    "Check your inbox for the call invite and add it to your calendar.",
    "Make sure you have a Zoom account and join the call from a laptop or computer.",
    "Be in quiet place and be ready to take notes and talk about your business.",
  ],
  // The board's four cards: Revogen, MSOT, Rubrik Zero Labs, TOSA.
  projectUids: ["revogen", "msot", "rubrik-zero-labs", "the-texas-organ-sharing-alliance"],
  // The board's still is the offer video on /brand-friction-audit; these are
  // that offer_hero slice's own files.
  video: {
    vimeo: "https://vimeo.com/1238093596",
    mp4: `${CDN}/68VseVXFh5HebH-f_brand-friction-offer-115x-1080.mp4`,
    mobileMp4: `${CDN}/UbwlVDScalYl__h8_brand-friction-offer-115x-phone-720.mp4`,
    captions: `${CDN}/Q0Xl7YhjosTN0VYs_brand-friction-offer-115x.en.vtt`,
    poster: image(
      "https://images.prismic.io/reddoor-la/9rax62WJ7Arsmr_-_Screenshot2026-10-21at2.57.45PM.png?auto=format,compress",
      3294,
      1852,
      "",
    ),
  },
  // Albert's headshot from the /medtech testimonial.
  quotePhoto: image(
    "https://images.prismic.io/reddoor-la/BxAzx6mJWW4sXMD5_testimonial-albert-turgon.png?auto=format,compress",
    200,
    200,
    "Albert Turgon",
  ),
};

type BookedData = Pick<
  FunnelCopyDocumentData,
  | "booked_steps"
  | "booked_vimeo_video"
  | "booked_projects"
  | "booked_video_mp4"
  | "booked_video_mp4_mobile"
  | "booked_video_captions"
  | "booked_video_poster"
  | "booked_quote_photo"
>;

const filledImage = (field: unknown): FilledImageFieldImage | null =>
  field && isFilled.image(field as FilledImageFieldImage) ? (field as FilledImageFieldImage) : null;

export function resolveBooked(data: Partial<BookedData> | null | undefined): BookedExtras {
  const steps = (data?.booked_steps ?? [])
    .map((item) => (typeof item?.text === "string" ? item.text.trim() : ""))
    .filter(Boolean);

  // Once each: the page keys its cards by UID, and a repeated key throws as
  // the booked state mounts, after the CRM has already taken the booking.
  const projectUids = (data?.booked_projects ?? [])
    .map((item) => {
      const link = item?.project;
      return link && isFilled.contentRelationship(link) && link.uid ? link.uid : "";
    })
    .filter((uid, i, all) => uid && all.indexOf(uid) === i);

  // The video's fields go together: a new Vimeo link would otherwise still
  // play the old mp4 (the file plays first), and a new mp4 would show the old
  // captions and poster. So setting any video replaces all of it.
  const media = (field: LinkToMediaField | null | undefined) => field ?? null;
  const vimeo = typeof data?.booked_vimeo_video === "string" ? data.booked_vimeo_video.trim() : "";
  const mp4 = mediaUrl(media(data?.booked_video_mp4));
  const mobileMp4 = mediaUrl(media(data?.booked_video_mp4_mobile));
  // Only a paste that names a Vimeo video counts: "tbd" or a YouTube link
  // would otherwise swap the working default for a box that plays nothing.
  const ownVideo = Boolean(parseVimeo(vimeo) || mp4 || mobileMp4);
  // A poster alone is a new still for whichever video plays.
  const poster = filledImage(data?.booked_video_poster);

  return {
    steps: steps.length ? steps : BOOKED_DEFAULTS.steps,
    projectUids: projectUids.length ? projectUids : BOOKED_DEFAULTS.projectUids,
    video: ownVideo
      ? {
          vimeo,
          mp4,
          mobileMp4,
          captions: captionsUrl(media(data?.booked_video_captions)),
          poster,
        }
      : { ...BOOKED_DEFAULTS.video, poster: poster ?? BOOKED_DEFAULTS.video.poster },
    quotePhoto: filledImage(data?.booked_quote_photo) ?? BOOKED_DEFAULTS.quotePhoto,
  };
}
