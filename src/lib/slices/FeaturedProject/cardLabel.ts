/**
 * Accessible name for the featured-project card's single wrapping link.
 *
 * The whole plate is one `<a>` and the circle-arrow inside it is decorative
 * (`aria-hidden`), so the link's name is the only thing that tells a screen
 * reader where it goes. It is set with `aria-label` rather than left to the
 * caption's text content for two reasons:
 *
 *   1. the visible title is uppercased with CSS `text-transform`, and browsers
 *      feed the *transformed* text into the accessible name — "MSOT" styling
 *      would be announced as shouting or spelled out letter by letter;
 *   2. the stored title is natural case ("Medical Solutions of Texas"), which
 *      is what should be spoken.
 *
 * Fallback chain, first non-blank wins:
 *
 *   1. `title` — the project name, the useful label,
 *   2. the alt authored on the image in Prismic — better than nothing when an
 *      editor leaves the title empty,
 *   3. `"View project"` — never return `""`, because a link with an empty
 *      accessible name is an axe `link-name` violation.
 *
 * Whitespace-only values count as absent (Prismic returns `""` for a cleared
 * Text field, and a stray space must not beat the alt). The winner is trimmed.
 *
 * WCAG 2.5.3 "Label in Name": the caption shows the services line under the
 * title, so the services follow the winner ("Medical Solutions of Texas,
 * brand, digital"). The name then contains everything the card shows,
 * case-insensitively. With the title alone it did not, and axe 4.14, which
 * runs `label-content-name-mismatch` by default, failed the card on it.
 */
export function resolveCardLabel(
  title: string | null | undefined,
  imageAlt: string | null | undefined,
  services?: string | null,
): string {
  const name = title?.trim() || imageAlt?.trim() || "View project";
  const shown = services?.trim();
  return shown ? `${name}, ${shown}` : name;
}
