import { asLink } from "@prismicio/client";
import type { LinkField } from "@prismicio/client";

/** One resolved hero CTA: a real destination plus the label to print on it. */
export interface HeroButton {
  href: string;
  text: string;
}

/** A row of the slice's `buttons` group — a Link field authored with text. */
export interface HeroButtonItem {
  link?: (LinkField & { text?: string | null }) | null;
}

/**
 * Resolve the hero's repeatable link group into renderable CTAs.
 *
 * Two failure modes have to be filtered out rather than rendered, because
 * DefaultButton degrades badly for both: with no label it draws an empty ghost
 * box on the photo, and with no href it silently swaps its `<a>` for a
 * `<button>` that does nothing when clicked. An unresolvable document link
 * (broken or unpublished relationship) reaches us as a filled field whose
 * `asLink` is null, so "filled" alone is not a sufficient test.
 */
export function deriveHeroButtons(
  items: readonly HeroButtonItem[] | null | undefined,
): HeroButton[] {
  return (items ?? [])
    .map((item) => ({
      href: item?.link ? (asLink(item.link) ?? "") : "",
      text: item?.link?.text ?? "",
    }))
    .filter((button) => button.href !== "" && button.text !== "");
}
