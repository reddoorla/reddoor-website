import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

/**
 * `/reschedule` with no booking id.
 *
 * This exists because it is reachable in production today. The CRM's no-show
 * snippets build `{{custom_values.sub_domain_url}}/reschedule/{{appointment.id}}`,
 * and `{{appointment.id}}` renders **empty** — measured, from a delivered SMS:
 *
 *     Please click here to reschedule
 *     https://staging.reddoorla.com/reschedule/
 *
 * SvelteKit 308s that trailing slash to `/reschedule`, which had no route, so a
 * client chasing a missed call landed on a 404. Sending them to the booking page
 * is the outcome the message was asking for anyway — "let's find another time"
 * — so this is the right destination even once the merge field is fixed, for
 * every other way an id can go missing: a truncated link in a mail client, a
 * copy-paste that drops the last segment, a forwarded text.
 *
 * A booking that IS identified still goes to `/reschedule/[eventId]`, which
 * moves the existing appointment rather than creating a second one.
 */
export const prerender = false;

export const load: PageServerLoad = () => {
  redirect(307, "/schedule");
};
