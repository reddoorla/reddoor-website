import { test, expect } from "@playwright/test";

// /inquiry is the landing pad for A-102-1's abandoned-inquiry chase link.
//
// That message is composed inline in the workflow builder — unreadable and
// unwritable through any API — so the only part of it we control is the custom
// value it interpolates, `{{custom_values.sub_domain_url}}/inquiry?…`. The path
// is therefore fixed by something we cannot edit, and the site has to meet it.
//
// These assert the redirect itself rather than what the modal does on arrival:
// the Location header is the whole contract, and testing it at the HTTP level
// keeps them free of hydration timing and of whatever the published Prismic
// document currently says. The modal's half of the flow — opening straight into
// the questions with the fields already filled — is covered by the chase-link
// block in inquiry-modal.spec.ts.

/** Follow nothing: the header under test is on the first response. */
async function locationOf(request: import("@playwright/test").APIRequestContext, path: string) {
  const res = await request.get(path, { maxRedirects: 0 });
  expect(res.status()).toBe(302);
  return new URL(res.headers()["location"], "http://x");
}

const LEAD = "email=pat%40example.com&full_name=Pat%20Buyer";

test("a chase link lands on the industry page with the lead's details", async ({ request }) => {
  const to = await locationOf(request, `/inquiry?${LEAD}`);
  expect(to.pathname).toBe("/medtech");
  expect(to.searchParams.get("email")).toBe("pat@example.com");
  expect(to.searchParams.get("full_name")).toBe("Pat Buyer");
});

test("the phone param is dropped, not forwarded", async ({ request }) => {
  // The link sends `phone={{user.phone}}` — the ASSIGNED USER's phone, not the
  // lead's. On an assigned contact that renders one of the business's own
  // numbers, prefills it as the lead's, and writes it back to their record on
  // submit; on an unassigned one it renders empty. Never right, so never
  // carried. See the note in src/routes/inquiry/+server.ts.
  const to = await locationOf(request, `/inquiry?${LEAD}&phone=(310)%20555-0101`);
  expect(to.searchParams.has("phone")).toBe(false);
  expect(to.search).not.toContain("555-0101");
});

test("utm params survive the hop", async ({ request }) => {
  // The modal posts `location.href` as `sourceUrl` and the CRM builds its
  // attribution note from the utm_* it finds there, so dropping these here
  // would quietly unattribute every resumed lead.
  const to = await locationOf(request, `/inquiry?${LEAD}&utm_source=crm&utm_medium=email`);
  expect(to.searchParams.get("utm_source")).toBe("crm");
  expect(to.searchParams.get("utm_medium")).toBe("email");
});

test("an explicit funnel is honoured when it names a live industry", async ({ request }) => {
  // The CRM holds the industry as `contact.funnel`. The message body does not
  // send it yet, but the day somebody adds `&funnel={{contact.funnel}}` this
  // starts routing on it with no deploy.
  const to = await locationOf(request, `/inquiry?${LEAD}&funnel=medtech`);
  expect(to.pathname).toBe("/medtech");
});

test("an unknown funnel falls back instead of redirecting anywhere it names", async ({
  request,
}) => {
  // The destination of a redirect is the wrong place to trust a query param.
  // The uid is checked against published industry documents, so these resolve
  // to the default rather than to themselves.
  for (const evil of ["//evil.example.com", "../../etc", "https://evil.example.com", "nope"]) {
    const to = await locationOf(request, `/inquiry?${LEAD}&funnel=${encodeURIComponent(evil)}`);
    expect(to.pathname).toBe("/medtech");
    expect(to.host).toBe("x");
  }
});

test("the response neither caches nor leaks the address onward", async ({ request }) => {
  // A lead's email is in the URL that got them here, and this response is what
  // hands it to the next page.
  const res = await request.get(`/inquiry?${LEAD}`, { maxRedirects: 0 });
  expect(res.headers()["referrer-policy"]).toBe("no-referrer");
  expect(res.headers()["cache-control"]).toContain("no-store");
});
