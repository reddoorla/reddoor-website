import { json } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { REPORT_TOKEN_PATTERN } from "$lib/report/fetch";
import {
  EDIT_COOKIE,
  configuredEditKey,
  editKeyNeededTrimming,
  keyMatches,
} from "$lib/report/edit-auth";
import type { RequestHandler } from "./$types";

/**
 * Save an operator's edits to one prospect report.
 *
 * Two credentials, doing two different jobs. The edit COOKIE proves the caller
 * is an operator in a browser; it never leaves this site. The shared TOKEN
 * proves to maintenance that the request came from this server rather than from
 * anyone who guessed a report URL, and it never reaches a browser. Neither
 * alone would be enough: the cookie cannot authenticate a cross-service call,
 * and a token in client-side code is not a secret.
 *
 * Fails closed on both. An unset key or an unset token refuses everything.
 */
export const POST: RequestHandler = async ({ request, cookies, fetch }) => {
  // Read through the SAME helper the edit route uses. A divergence here is not
  // cosmetic: if one side trimmed a pasted newline and the other did not, the
  // editor would open and accept typing while every save 404d, and the operator
  // would watch their work fail to persist with nothing explaining it.
  const configuredRaw = env.REPORT_EDIT_KEY;
  const expected = configuredEditKey(configuredRaw);
  const cookie = cookies.get(EDIT_COOKIE);
  // The same answer as a missing page, exactly as the edit route gives.
  if (!expected || !cookie || !keyMatches(cookie, expected)) {
    return json({ ok: false, error: "not-found" }, { status: 404 });
  }

  // After the check, for the reason given at length in the edit route: the
  // condition is a property of the deployment, but before the check any
  // stranger could drive the log line.
  if (editKeyNeededTrimming(configuredRaw)) {
    console.warn(
      "[audit-edit] REPORT_EDIT_KEY has leading or trailing whitespace; it was trimmed " +
        "before comparing and this request was accepted. Re-paste the value without it.",
    );
  }

  if (!env.PROSPECT_EDIT_TOKEN || !env.PROSPECT_REPORT_URL) {
    console.error("[audit-edit] PROSPECT_EDIT_TOKEN / PROSPECT_REPORT_URL not set — refusing");
    return json({ ok: false, error: "unconfigured" }, { status: 503 });
  }

  let body: { token?: unknown; overrides?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad-json" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  // Validated here because the value is interpolated into an outbound URL.
  if (!REPORT_TOKEN_PATTERN.test(token)) {
    return json({ ok: false, error: "bad-token" }, { status: 400 });
  }

  const base = env.PROSPECT_REPORT_URL.replace(/\/$/, "");
  const res = await fetch(`${base}/api/audit-report/${token}/overrides`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.PROSPECT_EDIT_TOKEN}`,
    },
    body: JSON.stringify({ overrides: body.overrides }),
  });

  // Pass the upstream verdict through. Reporting success on a refusal would
  // leave the operator believing an edit landed when it did not.
  if (!res.ok) return json({ ok: false, error: "upstream" }, { status: res.status });
  return json({ ok: true }, { status: 200 });
};
