import { createClient } from "$lib/prismicio";
import type { RequestHandler } from "./$types";

/**
 * The landing pad for the CRM's abandoned-inquiry chase link.
 *
 * A-102-1 emails and texts a lead who gave us their email and never finished
 * the questions. That message is composed inline in the workflow builder, so
 * its body is not readable or writable through any API — the only part of it we
 * can change from here is the custom value it interpolates:
 *
 *     {{custom_values.sub_domain_url}}/inquiry?email=…&full_name=…&phone=…
 *
 * Repointing that one value from `go.reddoorla.com` to our own host is a single
 * write, and it lands here. Hence a route at `/inquiry` specifically: the path
 * is fixed by a message we cannot edit, so the site has to meet it where it is.
 *
 * There is no `/inquiry` page — the modal lives on the industry landing pages —
 * so this resolves which one and redirects, and `InquiryModal`'s own mount hook
 * takes it from there, opening straight into the questions.
 */

/** Where a chase link that names no industry goes. The CRM knows the industry
 *  as `contact.funnel`, but the link predates that and does not send it; adding
 *  `&funnel={{contact.funnel}}` to the message body is honoured below the
 *  moment somebody does it. Until then this is the only landing page live. */
const DEFAULT_INDUSTRY_UID = "medtech";

/** Carried through to the landing page. utm_* is not listed because it is
 *  matched by prefix. */
const CARRIED = ["email", "full_name", "name", "phone"] as const;

export const prerender = false;

export const GET: RequestHandler = async ({ url, fetch, cookies }) => {
  const client = createClient({ fetch, cookies });
  const industries = await client.getAllByType("industry");
  const live = new Set(industries.map((doc) => doc.uid).filter(Boolean));

  // Validated against published documents rather than sanitised, because the
  // destination of a redirect is exactly the wrong place to trust a query
  // param: anything less than an allowlist here is an open redirect wearing the
  // CRM's return address.
  const asked = (url.searchParams.get("funnel") ?? "").trim().toLowerCase();
  const target = live.has(asked)
    ? asked
    : live.has(DEFAULT_INDUSTRY_UID)
      ? DEFAULT_INDUSTRY_UID
      : null;

  const next = new URLSearchParams();
  if (target) {
    for (const key of CARRIED) {
      const value = url.searchParams.get(key)?.trim();
      if (value) next.set(key, value);
    }
    // The modal posts `location.href` as `sourceUrl`, and the CRM builds its
    // attribution note from the utm_* it finds there — so these have to survive
    // the hop. They are also the one group of params the modal does NOT strip.
    for (const [key, value] of url.searchParams) {
      if (key.startsWith("utm_") && value.trim()) next.set(key, value);
    }
  }

  // `phone` was deliberately dropped here until 2026-08-20, and the history is
  // worth keeping because the same trap is still one edit away.
  //
  // The chase link shipped as `phone={{user.phone}}` — the ASSIGNED USER's
  // phone, not the lead's. Contacts do get assigned ("Contact Assign + UTM
  // Updates" is published), so it rendered one of the business's own numbers
  // into the lead's phone field, ready to be written back to their record on
  // submit. Confirmed in delivered mail, three chase emails for three: every
  // one carried the location's Client SMS Notification Number.
  //
  // The merge field is now `{{contact.phone}}`, verified by probe rather than
  // assumed — a test SMS rendered it as the contact's own number. So the param
  // is trustworthy again and is carried through.
  //
  // If a chase link ever prefills a number that is not the lead's, this is the
  // line to remove, and the cause will be in the workflow body rather than
  // here. The application path also writes the number into a note when the CRM
  // refuses to store it (see /api/book), so a mismatch leaves a trail.

  const query = next.toString();
  return new Response(null, {
    status: 302,
    headers: {
      location: target ? `/${target}${query ? `?${query}` : ""}` : "/",
      // A lead's email address is in the URL that got them here. Referrer-Policy
      // is set globally, but this response is the one that hands the address to
      // the next page, so it says so itself rather than inheriting.
      "referrer-policy": "no-referrer",
      "cache-control": "no-store",
    },
  });
};
