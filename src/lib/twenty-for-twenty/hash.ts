type CardLike = {
  number: number;
  name: string | null | undefined;
};

const SLUG_NON_ALNUM = /[^a-z0-9]+/g;
const SLUG_EDGE_HYPHENS = /^-+|-+$/g;

/**
 * Build the canonical hash slug for a card.
 *
 * Examples:
 *   slugForCard({ number: 4, name: "Brand Cocktail" }) // "04-brand-cocktail"
 *   slugForCard({ number: 12, name: null })            // "12"
 */
export function slugForCard(card: CardLike): string {
  const num = card.number.toString().padStart(2, "0");
  if (!card.name) return num;
  const slug = card.name.toLowerCase().replace(SLUG_NON_ALNUM, "-").replace(SLUG_EDGE_HYPHENS, "");
  return slug ? `${num}-${slug}` : num;
}

/**
 * Extract the leading integer from a URL hash. Returns null if absent.
 *
 * Accepts:
 *   "#04"               -> 4
 *   "#04-brand-cocktail"-> 4
 *   "04"                -> 4
 *   "#"                 -> null
 *   "#brand-cocktail"   -> null
 *   ""                  -> null
 */
export function parseCardNumberFromHash(hash: string): number | null {
  const match = hash.match(/^#?(\d+)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}
