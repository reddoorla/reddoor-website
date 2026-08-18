# The Inquiry Funnel

_Last verified 2026-08-18. Branch `feat/medtech-process-section`._

This is the reference for the lead funnel that runs from an industry landing page
through to a booked intro call: what it is meant to achieve, whose model we are
following, what exists in this repo today, and where the seams still are.

Every non-obvious claim carries a `[n]` pointing at [Sources](#8-sources).
Claims are graded so you can tell what was measured from what was reported:

| Grade          | Meaning                                                                     |
| -------------- | --------------------------------------------------------------------------- |
| **verified**   | Read directly out of the CRM API, the codebase, or a test run               |
| **documented** | Stated by a first-party source (Tim's Loom, the offer sheet, the worksheet) |
| **inferred**   | Our reading of the above; the reasoning is given so you can disagree        |

---

## 1. What the funnel is for

The offer is consultative, not transactional. The ladder is a $1,500 Diagnosis,
a ~$20k Rebuild, and a $10k–$200k Rollout `[1]`. Nothing on that ladder can be
bought from a page — the first two rungs require a conversation to scope, and
the third requires trust that only a conversation builds.

So the site's job is **not to sell**. It is to do two things:

1. **Qualify** — establish, before anyone's time is spent, whether this person
   has the problem we solve, the budget to solve it, and the authority to say yes.
2. **Book** — get a qualified lead onto a 30-minute call with as little friction
   as the qualification allows.

Those two goals are in tension, and the whole design of the funnel is the
resolution of that tension:

- **Friction is the feature.** Five questions are five chances to abandon. That
  is intentional — the scarce resource being protected is Tim's calendar, not
  the lead count. A funnel optimised for conversion rate would be one field and
  a Calendly link, and it would fill the week with tyre-kickers.
- **Email comes first, and alone.** Frame one of the modal captures an address
  and posts it immediately `[2]`. Everything after that is optional from the
  lead's point of view — which means a lead who bails on question three is still
  a reachable lead, and the CRM knows they started. The split into two forms is
  the single most important structural decision in the flow, and it exists
  entirely to make abandonment recoverable. **(inferred, from `[3]` + `[2]`)**
- **The questions are BANT in disguise.** "What would you expect to pay…" is
  Budget, and its bands map onto the price ladder. "Is there anyone else
  involved in this project?" is Authority. The problems and goals checkboxes are
  Need. Timing is the missing letter — see §6.2. **(inferred)**
- **Many front doors, one hallway, one destination.** The template ships a
  webchat widget, a Google Business Profile connection, Messenger and Instagram
  inlets, a contact form, and a lead-magnet track (`Z-003`) — all of which feed
  the same contact record and the same questionnaire `[3]`. Our industry landing
  pages are one more front door, not a parallel system.

---

## 2. The template we are following

Reddoor's GoHighLevel sub-account is a **productized snapshot from 6 Figure
Creative** (Brian Hood's coaching program) — "we sell it to all of our clients"
`[3]`. The `A-1xx` / `Z-0xx` asset numbering throughout the CRM is theirs. It is
unrelated to "6-Figure Creator".

We follow the template's **process**, on **our** pages, in **our** design
language. The snapshot's own funnel pages live on `go.reddoorla.com` and are
built in GHL's page builder; we are not using them.

### 2.1 The canonical journey

| #   | Their page           | What happens                                  | CRM asset                          | Workflow fired                            |
| --- | -------------------- | --------------------------------------------- | ---------------------------------- | ----------------------------------------- |
| 1   | `/work-with-me`      | Direct-offer video + email field              | Form `A-101-2. Application Step 1` | `A-102-1. Inquiry Started`                |
| 2   | `/inquiry`           | Five-question questionnaire + contact/consent | Survey `Inquiry Form`              | `A-102-2. New Inquiry Submitted`          |
| 3   | `/inquiry-completed` | **"Book A Call"** — the calendar              | Calendar `Schedule an intro call…` | `A-102-3. Appointment Booked + Reminders` |
| 4   | `/call-booked`       | Prep / what to expect                         | —                                  | `A-102-4. Approved` · `A-102-5. Rejected` |

Plus a standalone `/schedule` page (`Z-001-3 Team Calendars`) pointing at the
same calendar, for cold booking from a signature or a DM `[3]`.

**verified** — page set and asset names read from the CRM 2026-08-18; workflow
names read from the workflow list.

### 2.2 Two structural facts that are easy to get wrong

**The calendar is its own page, but it is not a destination.** The lead is taken
there _automatically_ on completing the questionnaire. The copy on that page is
"While we are reviewing your inquiry, please choose a time" — booking runs **in
parallel** with vetting, which is why Lead Approved / Lead Rejected sit _after_
Appointment Booked in the pipeline rather than before it `[3]`.

> The failure mode to avoid is a calendar reachable only from the nav. A
> separate route is right; a _disconnected_ one is not. The questionnaire must
> redirect into it.

**There is exactly one deliberate human step.** Brian's words: it is "the only
time you personally have to actually move a card" `[3]` — a human drags a lead
from _Scheduled Appointment_ to Lead Approved (fires `A-102-4`) or to lost
(fires `A-102-5`). Everything downstream of that runs off the `A-101-1 Status
Update` form, which is texted to Tim before each call.

Pipeline status semantics, which are not what you would guess: `open` =
short-term follow-up · `abandoned` = **good fit, long-term follow-up** ·
`lost` = dead · `won` = cash collected `[3]`.

---

## 3. What we have built

### 3.1 Shape

```
industry landing page (prerendered)
│
└─ InquiryModal.svelte
   │
   ├─ frame 1 ....... email ─────────────► POST /api/inquiry ──┬──► ingest   source of record
   │                                            (touch 1)      └──► CRM      sync, never fatal
   │
   ├─ frames 2–6 .... the five questions
   │
   └─ frame 7 ....... name, phone, consent ► POST /api/inquiry ──┬──► ingest
                      │                          (touch 2)       └──► CRM
                      │
                      ▼   goto("/schedule"), details handed over in sessionStorage
/schedule (prerendered shell)
│
├─ on mount ─────────────────────────────► GET  /api/slots ────────► CRM   free-slots, uncached,
│                                                                          regrouped into the
│                                                                          VISITOR's timezone
└─ confirm ──────────────────────────────► POST /api/book ─────┬──► CRM   the outcome
                                                               └──► ingest  notification
```

The landing pages are prerendered (the root layout sets `prerender = "auto"`),
and a prerendered page cannot host a form `action` — which is why the modal
POSTs to an API route instead of using a SvelteKit action `[4]`.

### 3.2 Module map

| File                                                                                  | Job                                                             |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| [`src/lib/ghl/constants.ts`](../src/lib/ghl/constants.ts)                             | Every CRM identifier, each with the reasoning for its value     |
| [`src/lib/ghl/questions.ts`](../src/lib/ghl/questions.ts)                             | The five questions, transcribed from the live survey            |
| [`src/lib/ghl/client.ts`](../src/lib/ghl/client.ts)                                   | Contacts, notes, tags, opportunities; the two sync entry points |
| [`src/lib/ghl/booking.ts`](../src/lib/ghl/booking.ts)                                 | Free slots + appointment creation                               |
| [`src/lib/ghl/phone.ts`](../src/lib/ghl/phone.ts)                                     | E.164 normalisation                                             |
| [`src/lib/components/InquiryModal.svelte`](../src/lib/components/InquiryModal.svelte) | The whole client-side flow                                      |
| [`src/routes/api/inquiry/+server.ts`](../src/routes/api/inquiry/+server.ts)           | Validate → screen → ingest → CRM sync                           |
| [`src/lib/schedule/slots.ts`](../src/lib/schedule/slots.ts)                           | Regrouping and formatting slots in the visitor's timezone       |
| [`src/lib/schedule/handoff.ts`](../src/lib/schedule/handoff.ts)                       | Carrying a finished application to /schedule via sessionStorage |
| [`src/routes/schedule/+page.svelte`](../src/routes/schedule/+page.svelte)             | The booking page: day tabs, time grid, confirm, booked state    |
| [`src/routes/api/slots/+server.ts`](../src/routes/api/slots/+server.ts)               | Free slots, flat and uncached                                   |
| [`src/routes/api/book/+server.ts`](../src/routes/api/book/+server.ts)                 | Upsert → book → tag → notify ingest                             |

Content comes from an **Inquiry tab** on the `industry` custom type (modal
title, prompt, thank-you, survey id) — a tab rather than a slice, because the
modal is page-level furniture, not a section anyone places. **verified**

### 3.3 The two endpoints have deliberately opposite failure philosophies

This is the part most likely to look like an inconsistency and is not.

**`/api/inquiry` — ingest is the source of record.** The lead is safe the
moment ingest accepts. The CRM sync runs after, is awaited so failures are
logged with a real status, and is **never fatal**: a CRM outage must not tell a
visitor their application failed when it is sitting in the dashboard `[4]`.

**`/api/book` — the CRM call _is_ the outcome.** If the appointment does not
exist in their calendar, nothing was booked, and a success message is a lie the
visitor discovers when nobody joins. So the appointment is made **first** and
failures are surfaced; ingest is notified afterwards so a booking is never
invisible to the team `[5]`.

One consequence worth knowing: `bookAppointment` deliberately leaves
`ignoreFreeSlotValidation` and `ignoreDateRange` off, so the CRM rejects a slot
taken between page load and submit. That 4xx becomes a **409 with
`refreshSlots: true`** and the message "That time was just taken. Please choose
another." — a real, correctable visitor error `[5]`.

### 3.4 Security posture

Four rules, all load-bearing:

1. **The server decides what is writable, never the client.** The answer map
   arrives from the browser keyed by CRM field id; `writableFieldIds(surveyId)`
   whitelists it. Without that, a forged payload could write _any_ custom field
   on the contact, including fields belonging to unrelated pipelines `[6]`.
2. **SMS consent is never taken from a client-supplied string.** It is excluded
   from the whitelist on purpose and written server-side from the request's
   boolean using the CRM's exact stored sentence. A client must not be able to
   assert consent on a visitor's behalf `[6]`.
3. **Newlines are collapsed in every label and value** before they reach the
   newline-joined ingest message — otherwise a raw newline forges a whole line,
   e.g. a fake `SMS consent: yes` `[4]`.
4. **The bot screen runs ahead of every validation 400.** A filled honeypot is
   silently accepted so a bot learns nothing from accepted-vs-rejected `[4]`.

### 3.5 What replaced what, and why

The original integration fired from the **browser** at the hosted widget's
internal endpoint, `POST backend.leadconnectorhq.com/forms/submit`. It never
worked, and could not have:

- That endpoint sits behind Cloudflare bot management requiring a `cf_clearance`
  cookie, which Turnstile only redeems for a widget running **on a Cloudflare
  zone**. We are on Netlify, cross-origin — redemption aborts, 429 `[7]`.
- The body also carries `signatureHash`, a CryptoJS `Salted__` blob keyed inside
  their bundle: not reproducible, rotatable at will `[7]`.
- **The proof:** an audit of the location on 2026-08-18 found exactly **one**
  form submission on record, ever — a jsfiddle test of the raw embed — and
  nothing from this site `[8]`. **verified**

The replacement does not chase byte-parity with an unreproducible payload. It
**copies the effect**: we read a real widget-created contact back through the
API and mirrored what it did to the record `[8]`.

The booking half is native for the same class of reason: our CSP has been
enforcing since 2026-07-16 and `frame-src` allows only Vimeo, Prismic,
Cloudflare and Netlify — the `links.reddoorla.com` booking iframe is inert on
staging and production `[9]`. It would also reintroduce the third-party cookies
we cleaned up fleet-wide. And it is what Tim asked for: "use our CSS and then I
can tweak any spacing" `[10]`.

---

## 4. The data contract

### 4.1 What a submission does to the contact record

Observed on a real widget-created contact and mirrored by our client `[8]`:

| Property            | Value                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| `source`            | `"A-101-2. Application Step 1 "` — **the trailing space is the CRM's**, part of the form's name |
| `type`              | `"lead"` — derived by the CRM, not settable                                                     |
| `customFields`      | the five answers + SMS consent, keyed by field id                                               |
| `website`           | a **standard** contact field, not a custom one                                                  |
| `dnd`               | untouched — consent is only a custom-field value                                                |
| `attributionSource` | set by their tracking pipeline; **read-only to us**                                             |
| `tags`              | `[]` from the embed — we go beyond this, see §4.3                                               |

`source` is written on the **first** touch only. The CRM keeps the first-touch
label and the survey submission does not overwrite it, so the second touch must
leave it alone `[6]`.

### 4.2 Attribution

`attributionSource` is read-only — `UpsertContactDto` has no attribution
property at all `[11]`. The template ships utm as writable contact custom
fields, and that looked like the answer. **It is not.** Measured against the
live CRM on 2026-08-18, writing all six in one upsert:

| Sampled | Fields present                                                                     |
| ------- | ---------------------------------------------------------------------------------- |
| t=0s    | `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `lead_source`, `funnel` |
| t=10s   | `lead_source`, `funnel`                                                            |
| t=120s  | `lead_source`, `funnel`                                                            |

GHL accepts a `contact.utm_*` write and hands it straight back on an immediate
read, then its own attribution pipeline reconciles those fields against
`attributionSource` — null on any API-created contact — and blanks them. They
are read-only in effect, with delayed enforcement that makes them look writable
long enough to fool a test that reads straight back.

**So we write two fields, and the utm params live in the contact note:**

| Field          | Id                     | Written?                               |
| -------------- | ---------------------- | -------------------------------------- |
| `lead_source`  | `6kweGxbWRwBR2LV508jv` | yes — always `reddoorla.com`           |
| `funnel`       | `NlnuKejf3ThqsfBVvMgU` | yes — the page uid, omitted when blank |
| `utm_source`   | `0IUZyt1voFzbwN6wzEkE` | no — reverted by the CRM               |
| `utm_medium`   | `crVdbGgZZtPu9RGXm5zh` | no — reverted by the CRM               |
| `utm_campaign` | `9cpTB290UIOnrKtAlBfE` | no — reverted by the CRM               |
| `utm_content`  | `5EDQLTB4hjyWWdPDCzpU` | no — reverted by the CRM               |

Nothing is lost: `attributionLines` writes the landing page, the referrer and
every utm/gclid param into the contact note, verified live. That is where a
salesperson reads them anyway, and it is where this flow put them before the
custom fields looked like a better home.

> Cold `/schedule` bookings send no campaign at all, so `funnel` is omitted
> rather than written blank — the funnel value is established at inquiry time,
> where the landing page is actually known, and a booking must not relabel a
> medtech lead.

### 4.3 Tags

`application started` · `application completed` · `scheduled a call` — the
CRM's own vocabulary. Two things to know:

- **Tags are ADDED via `POST /contacts/{id}/tags`, never sent on upsert.** The
  upsert body's `tags` property **overwrites the entire array**, which would
  wipe anything a workflow had applied `[11]`.
- In the template these tags are an **output** of the A-102 workflows, not what
  starts them. We write them anyway so the record reads correctly by hand — and
  so the chain lights up the moment a Contact-Tag-Added trigger is added. See §6.1.

### 4.4 Pipeline

Pipeline `01. Sales Pipeline` (`WAOZ0z0Po1E5eePUMjWd`), first stage
`1. New Inquiry` (`d4d833e0-6663-456a-8c01-4c0be26625c8`).

**We create one opportunity, guarded, as a stopgap.** Normally the opportunity
is a workflow action inside `A-102-2`, which is unfinished — so nothing reaches
the pipeline and the one deliberate human step (§2.2) has no surface to happen
on. `ensureCrmOpportunity` looks the contact up first and creates only if it has
none, so finishing `A-102-2` later cannot produce duplicates.

A failed **lookup** is treated as "do not create". Creating on an unknown state
risks a duplicate in a live pipeline; skipping only risks a missing card a human
can add. The cheaper mistake wins `[6]`.

**We move nothing.** See §7.

### 4.5 Calendar

`Schedule an intro call with Reddoor Creative` (`kNRHivTnovXd07knBgu1`) — the
only calendar on the account. Round-robin with one member (Tim), 30-minute slots
on a 30-minute interval, Mon–Fri 09:00–17:00 **in the location timezone**, a
five-day booking window, no minimum notice, auto-confirmed, held over Zoom.
**verified**

The location timezone is `America/Boise`, so those hours are Mountain —
8am–4pm Pacific for an LA-facing business. This may be deliberate (the team
spans San Antonio, LA and Boise per the worksheet's About copy `[12]`) — flagged
for Tim, not assumed to be a bug. See §6.3.

### 4.6 Scopes

Location-level Private Integration Token, env key **`CRM_FUNNEL_ACTIVE_TOKEN`**
(read by `/api/inquiry`, `/api/slots` and `/api/book`). A second, broader token
lives under `CRM_CLAUDE_TOKEN` for local investigation and is referenced nowhere
in `src/` — the split exists so a permissive token can never be the one that
ships. Headers:
`Authorization: Bearer <token>` and `Version: 2021-07-28` — the help-centre
article omits `Bearer` and is stale; the marketplace docs are current `[11]`.

Exercised successfully against the live API: `contacts.readonly`,
`contacts.write`, `opportunities.readonly`, `opportunities.write`,
`calendars.readonly`, `forms.readonly`, `surveys.readonly`, `locations.readonly`,
`locations/customFields.readonly`, `workflows.readonly` (list only — see §6.1).
`calendars/events.write` confirmed by a type-rejection probe. The token was
granted broadly, so anything not listed here is untested rather than known-absent.

> **Probing write scopes safely:** POST with deliberately **wrong types** (e.g.
> `email: 12345`) so schema validation rejects before any record is created.
> 401 = scope missing; 4xx = granted. One trap: pass the **real** `locationId` —
> a fake one returns 401 _"This location is not accessible from this token!"_,
> which is the location check failing, not the scope check, and reads as a false
> negative. That mistake was made and corrected on 2026-08-18.

---

## 5. Verification status

| Layer                         | State                                                                                                                                                                                                                                          |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit tests                    | 136 passing (`src/lib/ghl/*.test.ts`, `src/lib/schedule/slots.test.ts`, `src/routes/api/inquiry/server.test.ts`)                                                                                                                               |
| Smoke tests                   | 72 passing, 1 skipped — including a `strayCrmCalls` guard that aborts any `*.leadconnectorhq.com` request so a reintroduced browser fire fails loudly, and `/api/book` stubbed in every spec that can reach it                                 |
| Timezone coverage             | The booking page runs in three zones — Los Angeles, New York and Shanghai. Shanghai is the one that matters: it splits a single Mountain calendar day across two local days                                                                    |
| `svelte-check` / lint / build | Clean                                                                                                                                                                                                                                          |
| **Live end-to-end booking**   | **RUN AND PASSED 2026-08-18.** Booked the furthest slot in the window against the real calendar with `notify: false`, read it back, then deleted the appointment and the throwaway contact — calendar confirmed back to zero events. See §5.1. |

---

### 5.1 What the live booking proved

Run through our own modules against the real CRM, on a throwaway contact at
`example.com` rather than the jsfiddle reference specimen — that record is the
only evidence we have of what a real widget submission looks like and must not
be mutated.

| Check                            | Result                                                                                                                           |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Appointment created and readable | `confirmed`, 14:30→15:00, correct contact                                                                                        |
| Start time round-trip            | Byte-identical to what `free-slots` returned                                                                                     |
| Zoom link                        | Auto-attached by the calendar — confirms that omitting `meetingLocationType` was right, since setting it would have dropped this |
| `scheduled a call` tag           | Applied                                                                                                                          |
| **Double-booking the same slot** | **Rejected, `400 "The slot you have selected is no longer available."`**                                                         |
| Cleanup                          | Appointment and contact deleted; calendar back to zero events                                                                    |

That double-book rejection is the important one. Leaving
`ignoreFreeSlotValidation` off is what produces the 409 → "That time was just
taken" path in `/api/book`, and until now it was only ever exercised against a
stub. The CRM really does refuse.

One cosmetic finding: the create response carries **no `endTime`** (the
read-back does). `bookAppointment` already defaults it to `""` and `/api/book`
never returns it, so nothing downstream is affected.

## 6. Open items

### 6.1 The A-102 trigger gap — the blocker

**`POST /contacts/upsert` cannot fire a form-submitted or survey-submitted
trigger.** It fires contact-created/updated and tag triggers only.

Both A-102 workflows are keyed to exactly the trigger class we cannot fire `[3]`:

- **`A-102-1`** triggers on the **A-101-2 form submission** ("anytime someone
  starts to fill out inquiry form"). It assigns a user, adds a tag, waits an
  hour, sends chase emails, adds a `nurture` tag — and is **removed from the
  sequence if the survey is submitted in that hour**.
- **`A-102-2`** triggers on the **survey submission** ("they fill up that
  pre-call questionnaire"). It chases the booking and opens the opportunity.

So on an API path the automation chain stays inert. Applying tags alone does
nothing, because the tag is an _output_ of A-102-1, not its trigger.

**The fix is two CRM edits, and they must land together:**

1. Add a `Contact Tag Added` trigger to each (`application started`,
   `application completed`).
2. **Re-key `A-102-1`'s removal condition** to the completion tag.

Doing (1) without (2) means every lead who _does_ finish still gets an hour of
"you didn't finish" emails. That is worse than the current silence.

> This is Tim-side work in the CRM UI. Workflow triggers are **not readable by
> any API** — v2 `/workflows/` is list-only (`/steps`, `/triggers`, `/detail`
> all 404), v1 REST rejects a PIT, and the internal backend host 404s. The only
> documentation of them is Brian's Loom `[3]`, which is why that transcript is
> the citation for the whole section.

`A-102` was independently confirmed incomplete by Tucker in the CRM UI.

### 6.2 Questionnaire drift from the offer sheet

The live survey's option lists have drifted from offer sheet 3.0 `[1]`:

- **Missing pain:** "sales reps waste time explaining what marketing should
  already communicate."
- **Two strong goals swapped for softer ones:** "command premium pricing /
  protect margins" and "gain trust with procurement and value-analysis
  committees" are in the offer sheet but not the survey.
- **No timing/trigger question** (the missing "T" in BANT). **Decided: not
  adding one for now** — five questions are enough to clear chaff, and timing is
  the most natural way to open a live call, whereas budget and authority are the
  awkward ones best asked in a form. Revisit if we get swamped.

The two option-level fixes are a different category: no new step, no completion
cost. Pending a decision from Tim (message drafted, not yet sent).

**Order of operations if we change them: GHL first, code second.** See §7.

### 6.3 Calendar timezone

`America/Boise` — confirm with Tim whether Mountain hours are intended for an
LA-facing business, or a snapshot leftover. Either way, the page must render
slots in the **visitor's** timezone with the zone **named**, never as the raw
offset the API returns.

### 6.4 `/schedule` — built, but never run against the live calendar

The page ships: day tabs, a time grid, a confirm step, and a booked/prep state
standing in for the template's `/call-booked`. Completing the questionnaire now
navigates straight into it, with the visitor's details handed over in
sessionStorage, so the calendar is never the disconnected page §2.2 warns about.
It also works cold — which is why `/api/book` upserts rather than assuming a
contact exists `[5]`.

Three decisions inside it worth knowing:

- **Slots are fetched from the browser, not a server `load`.** The root layout
  puts every SSR response on Netlify's durable CDN for five minutes with a day
  of stale-while-revalidate — right for marketing pages, wrong for a list where
  a stale entry means two people arrive for the same call. `/api/slots` sets
  `no-store` for the same reason: a short TTL would serve a just-taken slot
  straight back after the "that time was just taken" message, and the visitor
  would loop.
- **The CRM's day buckets are thrown away and the slots regrouped by the
  visitor's local date.** GHL buckets by the LOCATION's Mountain date; between
  UTC+1 and UTC+8 that window straddles local midnight, so one CRM day is
  genuinely two days on the visitor's screen. Every label is derived from a real
  instant rather than a date string — `new Date("2026-08-19")` is UTC midnight
  and renders as the 18th anywhere west of Greenwich.
- **The chosen time goes back to the CRM byte-identical to what `free-slots`
  returned.** Only the display is converted. Re-serialising a local time would
  drift by the offset and book the wrong hour.

**Still outstanding: no booking has ever been made against the live calendar.**
Every test runs against a stub. One end-to-end verification with `notify: false`
(so no real person is emailed) needs permission first — the standing rule in §7.

### 6.5 Housekeeping

- `netlify.toml`'s CSP `connect-src` still allows
  `https://backend.leadconnectorhq.com` — a leftover from the deleted browser
  fire. Nothing uses it now; it should come out.
- `/medtech` has no direct-offer video. The canonical template landing page puts
  one above the email field `[3]`. Worth making that divergence deliberate
  rather than accidental.
- `/schedule` is deliberately **not** in the sitemap, unlike `/contact`. It is a
  funnel step, and indexing it invites cold bookings that skip qualification
  entirely — the one thing the funnel exists to prevent. Direct links from a
  signature or a DM still work; that is what `Z-001-3` is for. Easy to reverse
  by adding it to `STATIC_ROUTES` in `src/routes/sitemap.xml/+server.ts`.
- `playwright.config.ts` sets `use: { reducedMotion: "reduce" }` and it is **not
  taking effect** — probed 2026-08-18 on Playwright 1.62.1: in the page,
  `matchMedia("(prefers-reduced-motion: reduce)").matches` is `false` and
  computed `transitionDuration` is unchanged, while `page.emulateMedia` flips
  both. So the suite is not running reduced-motion, contrary to what that
  config, `industry-page.spec.ts` and the smooth-scroll flake note all assume.
  Worth fixing centrally, but it changes motion behaviour for every existing
  test, so it does not belong in a booking-page change.
- The program worksheet sets a QC bar of page-speed ≥ 90 and page weight
  < 2MB `[12]` — worth measuring `/schedule` against now that it exists.

---

## 7. Rules of engagement

1. **No CRM writes without explicit permission** — including probe writes.
   Standing instruction from Tucker, 2026-08-18.
2. **Survey option strings change in GHL first, then in code.** GHL matches
   submitted values against its picklists **byte-for-byte**; an option "fixed"
   in `questions.ts` ahead of the CRM silently unmaps the answer from the contact
   record. `questions.test.ts` pins the strings for this reason.
3. **We create no opportunity beyond the guarded stopgap, and move none.** The
   pipeline is designed around one human gate; racing `A-102-2` makes duplicates.
4. **Never render the CRM's raw UTC offset to a visitor.** Convert to their zone
   and name it.
5. **Never send `tags` on an upsert.** It overwrites; use the tags endpoint.
6. **Never print or echo token values** (`CRM_FUNNEL_ACTIVE_TOKEN`, `CRM_CLAUDE_TOKEN`, `DISCORD_BOT_KEY`, …).
7. Some message bodies live in **Marketing → Snippets**, not the workflow
   builder — editing the workflow won't change them.

---

## 8. Sources

| #   | Source                                                                                                                                       | Notes                                                                                                                                                                        |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `RD_Emerging MedTech & Biologics_Niche and offer_Summary` (Google Doc `1ddSvPGBIhTeOuAMpBQ0GTiMxjbXV-dNupQoHf7Ehivs`)                        | The offer sheet, v3.0. Price ladder + canonical pains/goals                                                                                                                  |
| 2   | [`src/lib/components/InquiryModal.svelte`](../src/lib/components/InquiryModal.svelte)                                                        | Frame machine; `postIngest`                                                                                                                                                  |
| 3   | Brian Hood onboarding Loom, transcript pasted into this project 2026-08-18                                                                   | **The only documentation of the workflow triggers.** Also the source for step order, the parallel-booking rationale, the one-manual-step rule, and pipeline status semantics |
| 4   | [`src/routes/api/inquiry/+server.ts`](../src/routes/api/inquiry/+server.ts)                                                                  | Validation, bot screen, ingest-first ordering                                                                                                                                |
| 5   | [`src/routes/api/book/+server.ts`](../src/routes/api/book/+server.ts)                                                                        | CRM-first ordering, 409 on a taken slot                                                                                                                                      |
| 6   | [`src/lib/ghl/client.ts`](../src/lib/ghl/client.ts)                                                                                          | Whitelist, consent handling, `source` first-touch rule, opportunity guard                                                                                                    |
| 7   | Header comment history preserved in [`src/lib/ghl/constants.ts`](../src/lib/ghl/constants.ts); memory `reference_ghl_form_endpoint_contract` | Why the widget endpoint is structurally unusable                                                                                                                             |
| 8   | CRM audit via the v2 API, 2026-08-18                                                                                                         | One form submission on record ever; contact read-back that defined the target effect                                                                                         |
| 9   | [`netlify.toml`](../netlify.toml) `Content-Security-Policy`                                                                                  | `frame-src` excludes LeadConnector                                                                                                                                           |
| 10  | Discord, Tim → Tucker                                                                                                                        | "use our CSS and then I can tweak any spacing"; the calendar drop                                                                                                            |
| 11  | `github.com/GoHighLevel/highlevel-api-docs` → `apps/contacts.json`                                                                           | Authoritative schema. The Docusaurus pages are SPA-rendered and fetch empty — read the JSON                                                                                  |
| 12  | `Reddoor_Creating Your Website` (Google Doc `1iOn0yJ7SM2swl5xgStPYhyTZecCR8GZrD6lKvCg51sE`)                                                  | Program worksheet: QC bar, team locations                                                                                                                                    |
| 13  | Commits `871d5c4`, `0d50f80`, `dfa0543`                                                                                                      | Server-side sync; attribution + process state + pipeline card; booking                                                                                                       |

**Related memory:** `reference_6fc_funnel_model` ·
`reference_ghl_form_endpoint_contract` · `project_industry_inquiry_flow`
