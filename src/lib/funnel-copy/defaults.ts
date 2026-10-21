import type { RichTextField, RTInlineNode, RTParagraphNode } from "@prismicio/client";

/**
 * The booking funnel's wording as it shipped before it moved into Prismic
 * (2026-10-21, Tim: "Is there any way to edit the copy?").
 *
 * This is the fallback for every field of the `funnel_copy` document: a field
 * Tim leaves empty, an unpublished document, and a Prismic outage all render
 * exactly this. So it must stay word for word what the pages said, curly
 * apostrophes included; `copy.test.ts` holds it to that.
 */

/** One paragraph per blank line; `[label](href)` becomes a link. */
export function rich(source: string): RichTextField {
  return source.split(/\n\n+/).map((para): RTParagraphNode => {
    let text = "";
    const spans: RTInlineNode[] = [];
    let last = 0;
    for (const m of para.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
      text += para.slice(last, m.index);
      const start = text.length;
      text += m[1];
      spans.push({
        start,
        end: text.length,
        type: "hyperlink",
        data: { link_type: "Web", url: m[2] },
      });
      last = m.index + m[0].length;
    }
    text += para.slice(last);
    return { type: "paragraph", text, spans };
  }) as RichTextField;
}

const MAIL = "[info@reddoorla.com](mailto:info@reddoorla.com)";

export const FUNNEL_COPY_DEFAULTS = {
  // /schedule
  schedule_heading: "Let’s find a time.",
  schedule_applied_heading: "Thanks — your application is in.",
  schedule_booked_heading: "You’re on the calendar.",
  schedule_kicker: "Book an intro call",
  schedule_booked_kicker: "What happens next",
  schedule_lede: rich(
    "Thirty minutes over Zoom with Tim Holmes, our Creative Director. Enough to hear where you’re stuck and tell you honestly whether we’re the right studio for it.",
  ),
  schedule_applied_lede: rich(
    "While we review your answers, pick a time for your intro call. Thirty minutes over Zoom — enough to tell you honestly whether we’re a fit.",
  ),
  schedule_booked_body: rich(
    "We’ve sent a confirmation to {email}, and the Zoom link is in the calendar invite. It’s thirty minutes with Tim Holmes, our Creative Director.\n\nCome with the version of the problem you’d describe to a colleague, not the polished one — that’s the conversation worth having. If you need to move it, the invite has a reschedule link, or just reply to it.",
  ),
  schedule_no_times: rich(
    `There’s nothing open in the next couple of weeks. Email ${MAIL} and we’ll find you a time.`,
  ),

  // The /schedule form
  form_time_label: "Your time",
  form_booking_as: "Booking as",
  form_different_details: "Use different details",
  form_name_label: "Name",
  form_name_placeholder: "Full Name",
  form_email_label: "Email address",
  form_email_placeholder: "you@domain.com",
  form_phone_label: "Cell number",
  form_phone_optional: "optional",
  form_phone_placeholder: "+1 (555) 000-0000",
  form_phone_hint: "So we can text you a reminder.",
  form_submit: "Confirm this time",
  form_pick_another: "Pick another",

  // /not-a-fit
  not_a_fit_heading: "Thanks for being straight with us.",
  not_a_fit_kicker: "Where this leaves us",
  not_a_fit_body: rich(
    "Rebuilding a brand properly — diagnosing what’s broken, then designing and rolling out the fix — is a real investment, and it isn’t the right spend for every business at every moment. If that’s beyond the budget right now, the honest answer is that we’re not the right fit today, and we’d rather tell you that here than thirty minutes into a call.\n\nThat can change. Budgets grow, projects sharpen, and our door stays open — if the picture shifts, start the application again and we’ll pick it up from there.",
  ),
  not_a_fit_footnote: rich(
    `In the meantime, you’re welcome to [look through our work](/portfolio) — and if you’d like to ask us something anyway, ${MAIL} reaches a human.`,
  ),

  // /cancel
  cancel_heading: "Cancel your call?",
  cancel_kicker: "Your intro call",
  cancel_current_label: "Booked for",
  cancel_lede: rich(
    "If the time no longer works, moving it takes a few seconds and keeps your place. If you’d rather cancel outright, that’s completely fine too.",
  ),
  cancel_button: "Cancel my call",
  cancel_reschedule_link: "Reschedule instead",
  cancel_done_heading: "That’s cancelled.",
  cancel_done_kicker: "No hard feelings",
  cancel_done_body: rich(
    "We’ve taken it off the calendar and let Tim know. Nothing else to do.\n\nIf the timing was the only problem, the calendar’s still open — [pick a new time](/schedule) whenever suits.",
  ),
  cancel_gone_lede: "That call is already off the calendar.",
  cancel_gone_body: rich(
    "It’s been cancelled, or it has already passed — either way there’s nothing left to cancel. [Book a new time](/schedule) whenever suits.",
  ),
  cancel_missing_lede: "We couldn’t find that booking.",
  cancel_missing_body: rich(
    `The link may have expired, or it may already have been cancelled. Email ${MAIL} if you’d like a hand.`,
  ),

  // /reschedule/[eventId]
  reschedule_heading: "Let’s find a better time.",
  reschedule_kicker: "Reschedule your call",
  reschedule_current_label: "Currently booked for",
  reschedule_lede: rich("Choose a new time and we’ll move it. Nothing else changes."),
  reschedule_moving_label: "Moving to",
  reschedule_button: "Move my call",
  reschedule_pick_another: "Pick another",
  reschedule_done_heading: "You’re all set.",
  reschedule_done_kicker: "What happens next",
  reschedule_done_body: rich(
    "We’ve sent an updated confirmation, and the calendar invite has moved with it — the same Zoom link still works.",
  ),
  reschedule_gone_lede: "That call is no longer on the calendar.",
  reschedule_gone_body: rich(
    "It’s been cancelled, or it has already passed. [Book a new time](/schedule) whenever suits.",
  ),
  reschedule_missing_lede: "We couldn’t find that booking.",
  reschedule_missing_body: rich(
    `The link may have expired, or the call may already have happened. You can [book a new time](/schedule) or email ${MAIL}.`,
  ),
} as const;
