import metaImage from "$lib/assets/og/schedule.jpg";
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
  // Deliberately out of the index, though NOT out of reach. The page is built
  // to be shared directly — a signature, a DM, the CRM's own trigger link — and
  // `noindex` does nothing to that. What it prevents is the page being found
  // cold in search, where a stranger books a 30-minute call with no application
  // behind it and no idea what the call is for. It is a funnel step, not a
  // landing page, and the sitemap has always agreed: /schedule was never listed.
  meta_robots: "noindex, follow",
});
