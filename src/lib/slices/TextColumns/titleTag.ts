/**
 * Heading level for a TextColumns column title.
 *
 * The rule differs per variation because the variations sit in different page
 * outlines:
 *
 * - **default** renders its own eyebrow as the section heading (h2), so the
 *   column titles below it are its h3 children. With no eyebrow the column
 *   titles ARE the section headings, so they get promoted to h2 — otherwise an
 *   eyebrow-less instance would jump straight from the page h1 to an h3
 *   (axe `heading-order`). This is the pre-existing behaviour and is checked by
 *   the `columnsEdge` a11y fixture; do not change it.
 *
 * - **serviceList / iconColumns** are landing-page variations that always
 *   follow a LeadText "rail" whose eyebrow is the section h2 — either the
 *   preceding slice's (when this slice's own eyebrow is deliberately left
 *   blank so the rail is not labelled twice) or this slice's own, which
 *   `RailRow` renders as an h2. Both cases want h3, so promoting on a blank
 *   eyebrow would be wrong here: it would emit a second sibling-level h2 that
 *   duplicates the section label instead of nesting under it.
 *
 * Truthiness (not `.trim()`) matches how the component decides to *render* the
 * eyebrow at all, so the tag and the markup can never disagree.
 */
export type TitleTag = "h2" | "h3";

export function deriveTitleTag(variation: string, eyebrow: string | null | undefined): TitleTag {
  if (variation === "serviceList" || variation === "iconColumns") return "h3";
  return eyebrow ? "h3" : "h2";
}
