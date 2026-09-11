import { error, redirect } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { loadReport } from "$lib/report/load";
import { EDIT_COOKIE, EDIT_COOKIE_MAX_AGE, keyMatches } from "$lib/report/edit-auth";
import type { PageServerLoad } from "./$types";

export const prerender = false;

/**
 * The private address for editing one report.
 *
 * ── Why this is a separate path, not a flag on the report URL ───────────────
 *
 * The address an operator edits at must not be one query string away from the
 * address they paste to a prospect. With `/audit/{token}?edit=<key>`, a single
 * careless paste would hand the prospect the ability to rewrite their own
 * audit. With a separate path, that same slip shares the read-only report.
 *
 * The key is exchanged for a cookie on first arrival and then redirected out of
 * the URL, so it stops sitting in the address bar, in history, and in anything
 * that copies a URL.
 *
 * Guards match /meeting-outcome, this site's other internal page: never
 * prerendered, never indexed, and `no-referrer` so the address cannot travel
 * out in a Referer header. It FAILS CLOSED — no REPORT_EDIT_KEY in the
 * environment means the route refuses everything rather than falling back to
 * open.
 */
export const load: PageServerLoad = async (event) => {
  // TRIMMED, and that is not cosmetic. REPORT_EDIT_KEY is pasted into Netlify's
  // environment UI by a human, and `openssl rand -base64 32` is exactly how a
  // trailing newline arrives. Untrimmed, that newline 404s every arrival: the
  // link the operator holds carries the key without the newline, so it never
  // matches, the answer is byte-identical to a wrong key and to a missing page,
  // and nothing on that path logs. The operator is left with an edit address
  // that simply does not work and no way to tell why.
  const configuredRaw = env.REPORT_EDIT_KEY ?? "";
  const expected = configuredRaw.trim();
  // A whitespace-only value is treated as unset rather than as a secret nothing
  // can present: it fails closed loudly here instead of silently 404ing forever.
  if (!expected) {
    console.error("[audit-edit] REPORT_EDIT_KEY not set or blank — refusing");
    // Deliberately the same answer as a missing page. An authorised operator
    // always arrives with the key, so nobody legitimate sees this.
    throw error(404, "Not found");
  }

  // The two accepting paths converge on ONE check. Both are equally
  // unauthenticated until it passes — HttpOnly and SameSite constrain browsers,
  // not a hand-written request, so a forged cookie is no harder to send than a
  // guessed `?k=`. Converging keeps that single fact in one place, and gives the
  // whitespace warning below one provably-authenticated home instead of two
  // call sites that can drift apart.
  const keyInUrl = event.url.searchParams.get("k");
  const presented = keyInUrl || (event.cookies.get(EDIT_COOKIE) ?? "");
  if (!presented || !keyMatches(presented, expected)) throw error(404, "Not found");

  // Deliberately AFTER the key check, not before it.
  //
  // The CONDITION is a property of the deployment — the environment value, which
  // no caller can influence — so this reports a misconfiguration, never anything
  // about a request. The PLACEMENT is what keeps it that way: sitting before the
  // check, any stranger hitting this URL could drive it, handing them a lever on
  // this deploy's logs and burying the one line the operator needs under noise
  // from whoever is scanning today. Behind the check, only someone already
  // holding the key can emit it.
  //
  // Nothing is lost by waiting, because the trim above means whitespace can no
  // longer be the REASON a request is refused. A 404 here is now a genuinely
  // different key, which this line would not explain anyway; an ACCEPTED request
  // against a value carrying stray whitespace is the case worth saying out loud,
  // and that is the case it fires on.
  if (configuredRaw !== expected) {
    console.warn(
      "[audit-edit] REPORT_EDIT_KEY has leading or trailing whitespace; it was trimmed " +
        "before comparing and this request was accepted. Re-paste the value in the " +
        "environment without the stray whitespace.",
    );
  }

  if (keyInUrl) {
    event.cookies.set(EDIT_COOKIE, keyInUrl, {
      httpOnly: true,
      sameSite: "strict",
      secure: true,
      path: "/audit",
      maxAge: EDIT_COOKIE_MAX_AGE,
    });
    // 303 so a refresh does not re-submit the key, and so the address bar stops
    // carrying it immediately.
    throw redirect(303, `/audit/${event.params.token}/edit`);
  }

  return {
    ...(await loadReport(event)),
    editing: true,
    meta_robots: "noindex, nofollow",
  };
};
