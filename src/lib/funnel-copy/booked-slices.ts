import type { Content } from "@prismicio/client";
import type { FunnelCopy } from "./copy";

/**
 * The booked page's testimonial band is the Testimonial slice itself, given a
 * slice object built from the page's own `funnel_copy` fields, so it is the
 * one /medtech shows rather than a look-alike. The object carries only what
 * the component reads. (The closing CtaBanner went on 2026-10-29: Tim asked
 * for the site footer straight under the testimonial.)
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
