/**
 * What a generated OG card says. Pure: the endpoint and the loaders share
 * these so the URL a page advertises and the card the endpoint draws agree.
 */

/** Code-routed pages have no Prismic document, so their card copy lives here —
 *  each line echoes the page's own hero, like the PR #138 funnel cards. */
export const SITE_HEADLINES: Record<string, string> = {
  default: "Brand strategy & design.",
  about: "A clear story and compelling design.",
  contact: "Isn’t it time to arm your brand?",
  portfolio: "Portfolio",
  showcase: "Our private showcase.",
};

const MAX = 90;
const TITLE_SUFFIX = /\s*\|\s*reddoor\s*creative\s*$/i;

/** A CMS document's title as a card headline: the site's "| Reddoor Creative"
 *  suffix dropped, whitespace collapsed, over-long titles cut. */
export function docHeadline(title: string): string {
  const text = title.replace(TITLE_SUFFIX, "").replace(/\s+/g, " ").trim();
  if (!text) return SITE_HEADLINES.default;
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
