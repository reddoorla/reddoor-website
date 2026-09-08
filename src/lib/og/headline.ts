/**
 * What a generated OG card says. Pure: the endpoint and the loaders share
 * these so the URL a page advertises and the card the endpoint draws agree.
 */

/**
 * The title each code-routed page already shows in the tab and in `og:title`.
 *
 * Tucker, 2026-09-08: "just use the title by default for the text, if we want
 * something else we'll add it ourselves" — so a card is never hand-written
 * marketing copy. Documents (page / industry / showcase / project) take their
 * own `title` field; these five have no document, so their titles are mirrored
 * here from the page's own `<svelte:head><title>`. An editor overrides any of
 * them from the route's `route_meta` document (`card_headline`, else
 * `meta_title`) — that is the "add it ourselves" half, and it wins over this.
 *
 * `default` is the site-wide fallback card (404, /dev/*, anything whose loader
 * returns no meta_image), so its title is the site itself. `audit` is one
 * static card for every prospect report, named by the report page's title with
 * the business left generic — a per-report card would need the function, and
 * cards are drawn at build time.
 */
export const SITE_TITLES: Record<string, string> = {
  default: "Reddoor Creative",
  about: "About | Reddoor Creative",
  contact: "Contact | Reddoor Creative",
  portfolio: "Portfolio | Reddoor Creative",
  showcase: "Reddoor Creative | Showcase",
  audit: auditHeadline(null),
};

const MAX = 90;
/** The site name as a title decoration, at either end: pages are titled
 *  "About | Reddoor Creative" but /showcase is "Reddoor Creative | Showcase". */
const SITE_NAME = /^\s*reddoor\s*creative\s*\|\s*|\s*\|\s*reddoor\s*creative\s*$/gi;

/** A title as a card headline: the site name dropped where it is only a
 *  decoration, whitespace collapsed, over-long titles cut. A title that IS
 *  the site name survives — that is the default card. */
export function docHeadline(title: string): string {
  const text = title.replace(SITE_NAME, "").replace(/\s+/g, " ").trim();
  if (!text) return SITE_TITLES.default;
  return text.length > MAX ? text.slice(0, MAX - 1) + "…" : text;
}

export function auditHeadline(businessName: string | null | undefined): string {
  return `When AI answers for ${businessName?.trim() || "your business"}`;
}

/** Headline font size in px. The card has ~380px of headline room at 950px
 *  wide; three lines of Besley 92 fit about 40 characters, so longer copy
 *  steps down rather than overflowing the footer. */
export function headlineSize(text: string): 92 | 72 | 56 {
  if (text.length <= 24) return 92;
  if (text.length <= 40) return 72;
  return 56;
}
