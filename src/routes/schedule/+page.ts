import metaImage from "$lib/assets/icons/logos/printedReddoor.png";
import type { PageLoad } from "./$types";

/**
 * The shell is static — every slot is fetched from the browser (see
 * /api/slots for why) — so it prerenders. Explicit rather than inherited from
 * the layout's "auto": nothing links here yet, the questionnaire arrives by
 * `goto`, and an uncrawled "auto" route would quietly fall back to SSR.
 */
export const prerender = true;

export const load: PageLoad = () => ({
  title: "Schedule a Call | Reddoor Creative",
  meta_title: "Schedule a Call | Reddoor Creative",
  meta_description:
    "Book a 30-minute intro call with Reddoor Creative. Pick a time that suits you and we'll send the Zoom link.",
  meta_image: metaImage,
});
