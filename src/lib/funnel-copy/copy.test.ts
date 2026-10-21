import { describe, it, expect, vi } from "vitest";
import { asText, NotFoundError, type RichTextField } from "@prismicio/client";
import {
  DEFAULT_FUNNEL_COPY,
  localHref,
  photoAlt,
  readFunnelCopy,
  resolveFunnelCopy,
  richHTML,
} from "./copy";
import { rich } from "./defaults";

/**
 * The booking funnel's copy moved into Prismic with the shipped wording as the
 * fallback. Until Tim publishes, a visitor must see exactly what the pages said
 * before the move, so the expectations below are copied from the markup as it
 * stood on `staging` at f056821, not from `defaults.ts`.
 */
const D = DEFAULT_FUNNEL_COPY;
const LINK = (href: string, text: string) =>
  `<a class="text-primary underline" href="${href}">${text}</a>`;
const MAIL = LINK("mailto:info@reddoorla.com", "info@reddoorla.com");

describe("the fallback is today's wording, word for word", () => {
  it("/schedule headings and labels", () => {
    expect(D.schedule_heading).toBe("Let’s find a time.");
    expect(D.schedule_applied_heading).toBe("Thanks — your application is in.");
    expect(D.schedule_booked_heading).toBe("You’re on the calendar.");
    expect(D.schedule_kicker).toBe("Book an intro call");
    expect(D.schedule_booked_kicker).toBe("What happens next");
  });

  it("/schedule ledes", () => {
    expect(richHTML(D.schedule_lede, "lede")).toBe(
      '<p class="lede">Thirty minutes over Zoom with Tim Holmes, our Creative Director. Enough to hear where you’re stuck and tell you honestly whether we’re the right studio for it.</p>',
    );
    expect(richHTML(D.schedule_applied_lede, "lede")).toBe(
      '<p class="lede">While we review your answers, pick a time for your intro call. Thirty minutes over Zoom — enough to tell you honestly whether we’re a fit.</p>',
    );
    expect(richHTML(D.schedule_no_times, "muted")).toBe(
      `<p class="muted">There’s nothing open in the next couple of weeks. Email ${MAIL} and we’ll find you a time.</p>`,
    );
  });

  it("/schedule once booked, with the visitor's email in bold", () => {
    expect(richHTML(D.schedule_booked_body, "booked-body", { email: "a@b.co" })).toBe(
      '<p class="booked-body">We’ve sent a confirmation to <strong>a@b.co</strong>, and the Zoom link is in the calendar invite. It’s thirty minutes with Tim Holmes, our Creative Director.</p>' +
        '<p class="booked-body">Come with the version of the problem you’d describe to a colleague, not the polished one — that’s the conversation worth having. If you need to move it, the invite has a reschedule link, or just reply to it.</p>',
    );
  });

  it("the /schedule form", () => {
    expect([
      D.form_time_label,
      D.form_booking_as,
      D.form_different_details,
      D.form_name_label,
      D.form_name_placeholder,
      D.form_email_label,
      D.form_email_placeholder,
      D.form_phone_label,
      D.form_phone_optional,
      D.form_phone_placeholder,
      D.form_phone_hint,
      D.form_submit,
      D.form_pick_another,
    ]).toEqual([
      "Your time",
      "Booking as",
      "Use different details",
      "Name",
      "Full Name",
      "Email address",
      "you@domain.com",
      "Cell number",
      "optional",
      "+1 (555) 000-0000",
      "So we can text you a reminder.",
      "Confirm this time",
      "Pick another",
    ]);
  });

  it("/not-a-fit", () => {
    expect(D.not_a_fit_heading).toBe("Thanks for being straight with us.");
    expect(D.not_a_fit_kicker).toBe("Where this leaves us");
    expect(richHTML(D.not_a_fit_body, "lede")).toBe(
      '<p class="lede">Rebuilding a brand properly — diagnosing what’s broken, then designing and rolling out the fix — is a real investment, and it isn’t the right spend for every business at every moment. If that’s beyond the budget right now, the honest answer is that we’re not the right fit today, and we’d rather tell you that here than thirty minutes into a call.</p>' +
        '<p class="lede">That can change. Budgets grow, projects sharpen, and our door stays open — if the picture shifts, start the application again and we’ll pick it up from there.</p>',
    );
    expect(richHTML(D.not_a_fit_footnote, "muted")).toBe(
      `<p class="muted">In the meantime, you’re welcome to ${LINK("/portfolio", "look through our work")} — and if you’d like to ask us something anyway, ${MAIL} reaches a human.</p>`,
    );
  });

  it("/cancel, every state", () => {
    expect([
      D.cancel_heading,
      D.cancel_kicker,
      D.cancel_current_label,
      D.cancel_button,
      D.cancel_reschedule_link,
      D.cancel_done_heading,
      D.cancel_done_kicker,
      D.cancel_gone_lede,
      D.cancel_missing_lede,
    ]).toEqual([
      "Cancel your call?",
      "Your intro call",
      "Booked for",
      "Cancel my call",
      "Reschedule instead",
      "That’s cancelled.",
      "No hard feelings",
      "That call is already off the calendar.",
      "We couldn’t find that booking.",
    ]);
    expect(richHTML(D.cancel_lede, "lede")).toBe(
      '<p class="lede">If the time no longer works, moving it takes a few seconds and keeps your place. If you’d rather cancel outright, that’s completely fine too.</p>',
    );
    expect(richHTML(D.cancel_done_body, "done-body")).toBe(
      '<p class="done-body">We’ve taken it off the calendar and let Tim know. Nothing else to do.</p>' +
        `<p class="done-body">If the timing was the only problem, the calendar’s still open — ${LINK("/schedule", "pick a new time")} whenever suits.</p>`,
    );
    expect(richHTML(D.cancel_gone_body, "muted")).toBe(
      `<p class="muted">It’s been cancelled, or it has already passed — either way there’s nothing left to cancel. ${LINK("/schedule", "Book a new time")} whenever suits.</p>`,
    );
    expect(richHTML(D.cancel_missing_body, "muted")).toBe(
      `<p class="muted">The link may have expired, or it may already have been cancelled. Email ${MAIL} if you’d like a hand.</p>`,
    );
  });

  it("/reschedule, every state", () => {
    expect([
      D.reschedule_heading,
      D.reschedule_kicker,
      D.reschedule_current_label,
      D.reschedule_moving_label,
      D.reschedule_button,
      D.reschedule_pick_another,
      D.reschedule_done_heading,
      D.reschedule_done_kicker,
      D.reschedule_gone_lede,
      D.reschedule_missing_lede,
    ]).toEqual([
      "Let’s find a better time.",
      "Reschedule your call",
      "Currently booked for",
      "Moving to",
      "Move my call",
      "Pick another",
      "You’re all set.",
      "What happens next",
      "That call is no longer on the calendar.",
      "We couldn’t find that booking.",
    ]);
    expect(richHTML(D.reschedule_lede, "lede")).toBe(
      '<p class="lede">Choose a new time and we’ll move it. Nothing else changes.</p>',
    );
    expect(richHTML(D.reschedule_done_body, "done-body")).toBe(
      '<p class="done-body">We’ve sent an updated confirmation, and the calendar invite has moved with it — the same Zoom link still works.</p>',
    );
    expect(richHTML(D.reschedule_gone_body, "muted")).toBe(
      `<p class="muted">It’s been cancelled, or it has already passed. ${LINK("/schedule", "Book a new time")} whenever suits.</p>`,
    );
    expect(richHTML(D.reschedule_missing_body, "muted")).toBe(
      `<p class="muted">The link may have expired, or the call may already have happened. You can ${LINK("/schedule", "book a new time")} or email ${MAIL}.</p>`,
    );
  });

  it("has no photo until one is uploaded", () => {
    expect(D.tim_photo).toBeNull();
  });
});

describe("resolveFunnelCopy", () => {
  it("takes what Tim wrote, field by field", () => {
    const copy = resolveFunnelCopy({
      schedule_heading: "Pick a time that works.",
      schedule_lede: rich("A new lede."),
    });
    expect(copy.schedule_heading).toBe("Pick a time that works.");
    expect(asText(copy.schedule_lede)).toBe("A new lede.");
    // Untouched fields keep today's wording.
    expect(copy.schedule_booked_heading).toBe("You’re on the calendar.");
  });

  it("treats a cleared field as unwritten, so the line comes back instead of going blank", () => {
    const copy = resolveFunnelCopy({
      schedule_heading: "   ",
      schedule_lede: [] as RichTextField,
      schedule_applied_lede: [{ type: "paragraph", text: "", spans: [] }] as RichTextField,
    });
    expect(copy.schedule_heading).toBe(D.schedule_heading);
    expect(copy.schedule_lede).toEqual(D.schedule_lede);
    expect(copy.schedule_applied_lede).toEqual(D.schedule_applied_lede);
  });

  it("keeps the photo null for an empty image field", () => {
    expect(resolveFunnelCopy({ tim_photo: {} }).tim_photo).toBeNull();
  });

  it("passes a filled photo through, with its alt or Tim's name", () => {
    const photo = {
      id: "x",
      url: "https://images.prismic.io/reddoor-la/tim.jpg",
      alt: null,
      copyright: null,
      dimensions: { width: 800, height: 800 },
      edit: { x: 0, y: 0, zoom: 1, background: "transparent" },
    };
    const copy = resolveFunnelCopy({ tim_photo: photo });
    expect(copy.tim_photo?.url).toBe(photo.url);
    expect(photoAlt(copy.tim_photo!)).toBe("Tim Holmes, Creative Director");
    expect(photoAlt({ ...photo, alt: "Tim in the studio" })).toBe("Tim in the studio");
  });
});

describe("readFunnelCopy never throws", () => {
  it("falls back when Prismic errors", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const copy = await readFunnelCopy({
      getSingle: () => Promise.reject(new Error("ECONNRESET")),
    });
    expect(copy).toEqual(DEFAULT_FUNNEL_COPY);
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });

  it("falls back quietly when the document does not exist yet", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const copy = await readFunnelCopy({
      getSingle: () => Promise.reject(new NotFoundError("No documents", "url", undefined)),
    });
    expect(copy).toEqual(DEFAULT_FUNNEL_COPY);
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("reads the document when there is one", async () => {
    const copy = await readFunnelCopy({
      getSingle: () => Promise.resolve({ data: { cancel_heading: "Need to cancel?" } }),
    });
    expect(copy.cancel_heading).toBe("Need to cancel?");
  });
});

describe("richHTML", () => {
  it("puts the visitor's email where the {email} token is, escaped", () => {
    const html = richHTML(rich("Sent to {email}."), "p", { email: '<img src=x onerror="1">' });
    expect(html).toBe(
      '<p class="p">Sent to <strong>&lt;img src=x onerror=&quot;1&quot;&gt;</strong>.</p>',
    );
    expect(html).not.toContain("{email}");
  });

  it("keeps a link to this site on the site the visitor is on", () => {
    expect(localHref("https://reddoorla.com/schedule")).toBe("/schedule");
    expect(localHref("https://www.reddoorla.com/")).toBe("/");
    expect(localHref("https://reddoorla.com")).toBe("/");
    expect(localHref("https://reddoorla.com.evil.example/x")).toBe(
      "https://reddoorla.com.evil.example/x",
    );
    expect(localHref("mailto:info@reddoorla.com")).toBe("mailto:info@reddoorla.com");
    expect(localHref("https://reddoorla.com//evil.example/x")).toBe(
      "https://reddoorla.com//evil.example/x",
    );
  });

  it("renders a link with an unsafe scheme as plain text", () => {
    const field = rich("Click [here](javascript:alert`1`) now.");
    expect(richHTML(field, "p")).toBe('<p class="p">Click here now.</p>');
  });
});
