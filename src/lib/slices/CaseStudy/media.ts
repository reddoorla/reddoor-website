// Media precedence for the CaseStudy band, extracted so the (non-obvious)
// priority order is testable without mounting the slice.
//
// The Figma frame only ever draws ONE state: the after photo with an "on"
// toggle. Everything else (video, missing before image, missing after image)
// is undesigned, so the rules below are the conservative degrade path:
//
//   1. A `vimeo_id` wins outright — the loop replaces the after image and the
//      before/after toggle is hidden. A video cannot be crossfaded against a
//      still without inventing a second, undesigned control, and the toggle's
//      "after" label would be lying about what is on screen.
//   2. Both images present, no video → the designed state: after image visible,
//      toggle shown.
//   3. Exactly one image → that image, no toggle (a switch with one position is
//      worse than no switch).
//   4. Nothing → no media layer at all; the caller still renders the text.

export type CaseStudyMediaMode = "video" | "toggle" | "image" | "empty";

export interface CaseStudyMediaInput {
  hasAfter: boolean;
  hasBefore: boolean;
  hasVideo: boolean;
}

export interface CaseStudyMedia {
  mode: CaseStudyMediaMode;
  /** Render the before/after switch. */
  showToggle: boolean;
  /**
   * Which image field is the always-mounted base layer. In `video` mode this
   * is the Vimeo poster; in `toggle` mode it is the default (AFTER) view.
   */
  base: "after" | "before" | "none";
}

export function resolveCaseStudyMedia({
  hasAfter,
  hasBefore,
  hasVideo,
}: CaseStudyMediaInput): CaseStudyMedia {
  if (hasVideo) {
    return {
      mode: "video",
      showToggle: false,
      base: hasAfter ? "after" : hasBefore ? "before" : "none",
    };
  }
  if (hasAfter && hasBefore) return { mode: "toggle", showToggle: true, base: "after" };
  if (hasAfter) return { mode: "image", showToggle: false, base: "after" };
  if (hasBefore) return { mode: "image", showToggle: false, base: "before" };
  return { mode: "empty", showToggle: false, base: "none" };
}

/**
 * Prismic KeyText arrives as `null` when unset and can hold stray whitespace
 * once an author has cleared a field by hand — both must read as "no video".
 */
export function normalizeVimeoId(raw: string | null | undefined): string {
  return (raw ?? "").trim();
}
