/**
 * Heading levels for the Accordion slice.
 *
 * The slice gained an optional section `label` on both variations, which moves
 * the item titles in the page outline:
 *
 * - **label filled** — the label names the section, so it is the section
 *   heading (h2, one level under the page masthead h1) and the item titles nest
 *   under it as h3.
 * - **label empty** — i.e. every document published before the field existed —
 *   the item titles ARE the section headings and stay h2, exactly as they
 *   rendered before. Demoting them unconditionally would jump the page h1
 *   straight to an h3 (axe `heading-order`, which fails the CI gate).
 *
 * Neither case skips a level, and the rail variation stays in sync for free:
 * `RailRow` renders its label at h2 and only when the same normalized value is
 * non-empty, so the tag and the markup can never disagree.
 *
 * Normalizing (rather than raw truthiness, which is what `TextColumns`'
 * `deriveTitleTag` uses) matters here because the value is also the *only*
 * text inside a heading element: a whitespace-only label would render
 * `<h2> </h2>` — an axe `empty-heading` violation — while still being truthy
 * enough to demote every item title beneath it.
 */
export type ItemTag = "h2" | "h3";

/**
 * Prismic hands back `undefined` for a field a published document predates,
 * `null` for one an editor cleared, and a whitespace string for one they
 * fat-fingered. All three mean "no label".
 */
export function normalizeLabel(label: string | null | undefined): string {
  return (label ?? "").trim();
}

/** Heading level for the item titles, given the (raw or normalized) label. */
export function deriveItemTag(label: string | null | undefined): ItemTag {
  return normalizeLabel(label) ? "h3" : "h2";
}
