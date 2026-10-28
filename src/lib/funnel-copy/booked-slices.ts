import type { Content } from "@prismicio/client";
import { safeHref, type FunnelCopy } from "./copy";

/**
 * The booked page's testimonial band and closing banner are the Testimonial
 * and CtaBanner slices themselves, given slice objects built from the page's
 * own `funnel_copy` fields, so they are the ones /medtech shows rather than
 * look-alikes. Each object carries only what its component reads.
 */
export function bookedQuoteSlice(copy: FunnelCopy): Content.TestimonialSlice {
  return {
    id: "booked-quote",
    slice_type: "testimonial",
    slice_label: null,
    variation: "default",
    version: "initial",
    primary: {
      label: copy.booked_quote_label,
      quote: copy.booked_quote,
      name: copy.booked_quote_name,
      role: copy.booked_quote_role,
      avatar: copy.booked.quotePhoto ?? {},
      hasTopPadding: true,
      hasBottomPadding: true,
      isAnimated: true,
      hide: false,
    },
    items: [],
  } as unknown as Content.TestimonialSlice;
}

export function bookedCtaSlice(copy: FunnelCopy): Content.CtaBannerSlice {
  return {
    id: "booked-cta",
    slice_type: "cta_banner",
    slice_label: null,
    variation: "default",
    version: "initial",
    primary: {
      heading: [{ type: "heading2", text: copy.booked_cta_heading, spans: [] }],
      buttonLabel: copy.booked_cta_button,
      // A text field, so the scheme is checked here: the CSP allows inline
      // script, and a `javascript:` URL would otherwise be a live link.
      buttonLink: { link_type: "Web", url: safeHref(copy.booked_cta_link, "/contact") },
      background: "paper-red",
      hasTopPadding: true,
      hasBottomPadding: true,
      isAnimated: true,
      hide: false,
    },
    items: [],
  } as unknown as Content.CtaBannerSlice;
}
