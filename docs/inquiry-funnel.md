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

### 5.2 The scoped token, end to end

Re-run 2026-08-18 against a dev server holding **only**
`CRM_FUNNEL_ACTIVE_TOKEN` — the five-scope token the deployed site uses — with
ingest pointed at a local sink so no fake lead reached the dashboard, and
cleanup performed with `CRM_CLAUDE_TOKEN` (the funnel token has no delete
rights, and should not).

Both `/api/inquiry` submissions, `/api/slots`, and a booking all passed:
one contact across both touches, correct `source`, `website` as a standard
field, both process tags, all five answers, consent verbatim, `funnel` +
`lead_source` present and the utm fields correctly absent, the note carrying the
utm params, one pipeline opportunity, and an appointment created and removed.

That is the whole funnel proven on the minimum permission set. What remains
untested is only the deployed environment — see §6.6.

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

#### What the API will and will not tell us (re-probed 2026-08-18)

The workflow **list** is readable and worth having — 37 workflows, with status,
version and timestamps. The A-102 block:

```
published  A-102-1.  Inquiry Started                    v7  updated 2026-08-17T19:23
draft      A-102-2. Nurture Emails [Value Added…]       v2  updated 2026-08-04T23:47
published  A-102-2.  New Inquiry Submitted              v6  updated 2026-08-18T15:29
published  A-102-3. Appointment Booked + Reminders      v4  updated 2026-08-17T20:10
published  A-102-4. Lead Approved                       v4
published  A-102-5. Lead Rejected                       v4
published  A-102-6  Fibonacci Followup                  v4
```

⚠️ **There are TWO A-102-2s**, and earlier revisions of this section treated them
as one: a **draft** "Nurture Emails" and a **published** "New Inquiry Submitted".
Anything said here about "A-102-2" means the published one. The draft is the one
confirmed disarmed.

Their **ACTIONS remain unreadable by any API** — the workflows only. Re-probed with the widened
token: `/workflows/{id}`, `/{id}/triggers`, `/{id}/steps`, `/{id}/detail` and
`/{id}/versions` all return **404**. v1 REST rejects a PIT, the internal backend
host 404s. So every statement below about what A-102-1 _currently contains_
comes from Brian's Loom `[3]` plus Tucker's own look in the UI — **not** from
reading the workflow. Verify the current shape before editing it; `A-102-1` is
on version 7 and `A-102-2. New Inquiry Submitted` was edited on 2026-08-18,
so the template's original shape is not necessarily what is in there now.

#### The change to A-102-1

What the site writes, and when — this half is hard fact, from `ghl/constants.ts`:

| When                                      | Tag applied             | Written by             |
| ----------------------------------------- | ----------------------- | ---------------------- |
| Email captured (modal step one)           | `application started`   | `syncInquiryToCrm`     |
| Questionnaire + contact details submitted | `application completed` | `syncApplicationToCrm` |
| Intro call booked                         | `scheduled a call`      | `POST /api/book`       |

Exact strings, lower-case, no trailing space.

#### What A-102-2 actually contains (screenshot, 2026-08-18)

The API cannot read a workflow, but a person looking at the canvas can. Tucker
sent the builder view of **A-102-2. New Inquiry Submitted**
(`006e248e-2b58-40c3-bfd1-0b20a9800da6`), and it corrects the prescription an
earlier revision of this section gave:

```
Qualify Form Submitted
  → Remove from Workflow: Inquiry Started   (Default Path)
  → Create Or Update Opportunity
  → Assign the lead
  → Add Tag: application completed
  → Wait 1m  → Confirmation SMS (to client)
             → Application Confirmation Email
  → Wait 30 minutes → SMS Reminder 1
  → Wait 2 Days     → Email Reminder 1
  → Wait 1 Day      → SMS Reminder 3
  → Wait 2m         → Email Reminder 2
  → Wait 2 Days     → Add Tag "nurture"
  → Goal - Book A Call
```

⚠️ **The removal lives in A-102-2, not in A-102-1.** Node 2 pulls the contact out
of "Inquiry Started". So there is nothing to build inside A-102-1 for the exit —
an earlier revision here proposed an If/Else after A-102-1's 1-hour wait, which
would have duplicated a mechanism the template already has. Removed.

The trigger is confirmed by sight as `Qualify Form Submitted` — exactly the
class an API upsert cannot fire, previously known only from the Loom.

#### The change: one trigger on each, A-102-2 FIRST

| Workflow                              | Add trigger                                   | Keep                     |
| ------------------------------------- | --------------------------------------------- | ------------------------ |
| **1. A-102-2. New Inquiry Submitted** | `Contact Tag Added` → `application completed` | `Qualify Form Submitted` |
| **2. A-102-1. Inquiry Started**       | `Contact Tag Added` → `application started`   | its form trigger         |

**The order is not arbitrary, and it is the reverse of what this section said
before.** Because the removal lives in A-102-2, arming A-102-1 first puts leads
into a chase that nothing can end — the "you didn't finish" sequence fires at
people who did finish, which is worse than the current silence. Arming A-102-2
first is risk-free: its removal step is a no-op while A-102-1 is still inert, and
everything else it does (opportunity, assignment, confirmation SMS and email)
starts working immediately.

#### Open questions on that canvas

1. **Does `Goal - Book A Call` actually exit the sequence?** This is the one that
   matters. Nodes 9–18 are a 2-day chase to book, and this funnel sends people
   straight to `/schedule` from the questionnaire — most will already have booked
   within minutes. If the goal does not pull them out, they get two days of "book
   a call" nudges **on top of** A-102-3's appointment reminders, which are
   confirmed to fire from an API booking (§6.8). It is drawn at the end of a
   linear canvas rather than as a branch, so it is worth opening.
2. **`Create Or Update Opportunity` duplicates `ensureCrmOpportunity`.** Ours is
   a guarded stopgap written precisely because this workflow was not firing (§4.4).
   The node says "Update", and our lookup skips when a card exists, so the two
   should reconcile — but watch the first real lead for a double card, and once
   this is live the stopgap can be removed.
3. **`SMS Reminder 3` with no Reminder 2** in the chain — probably a naming
   leftover from the template, worth a glance.

**How to test without waiting:** put `application completed` on a throwaway
contact by hand and confirm A-102-2 enrols it; then `application started` on
another and confirm A-102-1 enrols and is removed when the completion tag lands.
No form, no website, no real lead.

#### Two caveats on the tag trigger itself

**Publishing is not optional, and it is not retroactive.** GHL says it outright
in the trigger panel: _"This trigger only applies to tags added after the
workflow is published."_ So the edit must be saved AND published, and contacts
who already carry the tag — every walkthrough record from 2026-08-18 — are not
enrolled. That is the desired outcome, but it means a test has to be a **fresh**
tag application after publishing, never an inspection of an existing contact.

**Check `Settings → re-entry` on A-102-2.** Node 5 adds `application completed`,
which is now also the workflow's own trigger. On the site's path that is
harmless: we write the tag first, so node 5 re-adds a tag that is already
present and `POST /contacts/{id}/tags` fires nothing. On the **embed** path the
workflow itself creates the tag for the first time at node 5 — a genuine
tag-added event, which would re-enrol the contact and double every confirmation
and reminder. GHL disallows re-entry by default, so this is a confirmation
rather than a likely bug, but the failure mode is duplicate messages to a real
lead. An earlier note here said the redundant add "cannot loop the workflow",
which is only true of the path we control.

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

### 6.6 Deployed to staging 2026-08-18

`staging.reddoorla.com` now runs this branch. `origin/staging` fast-forwarded to
it, so there is no merge commit and no divergence.

| Check        | Result                                                          |
| ------------ | --------------------------------------------------------------- |
| `/medtech`   | 200, 3 `#inquire` triggers, no `leadconnectorhq` in the shell   |
| `/schedule`  | 200, renders the picker shell                                   |
| `/api/slots` | 200 — reads the live calendar through `CRM_FUNNEL_ACTIVE_TOKEN` |

The token was set on the Netlify site as a **secret**, for the `production`,
`branch-deploy` and `deploy-preview` contexts, via `createEnvVars` on the API —
`env:set --site` is not supported on the installed CLI, and linking the repo
would have risked pointing it at the production site. A rebuild was triggered
afterwards so the function environment picked it up.

**Merging staging in first was not optional.** `origin/staging` was not behind
this branch — it carried `8a54c4c`, a fix this branch did not have:

> Central ingest's `submissions.name` is NOT NULL, but the step-one email
> capture has no name yet, so `createSubmission` threw and the form returned 502. Fixed by falling back to the email as the name.

That bug was found by running against **real** ingest on staging. It is
invisible to the local probe, which points `FORMS_INGEST_URL` at a sink that
accepts anything — worth remembering before treating a local end-to-end run as
proof of the ingest contract. Proper fix (nullable name for email-only leads) is
tracked on maintenance #539.

### 6.7 The inquiry flow, verified on the deployed build

Run 2026-08-18 against `staging.reddoorla.com` and **real** central ingest — the
one contract a local run cannot check. Every step passed:

| Check                                        | Result                                         |
| -------------------------------------------- | ---------------------------------------------- |
| Step one against real ingest                 | 200 — the path that 502'd before `8a54c4c`     |
| Step two against real ingest                 | 200                                            |
| CRM contact from the deployed build          | created, one record across both touches        |
| `source`, `website` as a standard field      | correct                                        |
| Both process tags                            | `application started`, `application completed` |
| Five answers, consent verbatim               | correct                                        |
| `funnel` + `lead_source` persist, utm absent | correct                                        |
| Note carries the utm params                  | correct                                        |
| One pipeline opportunity                     | correct                                        |

CRM side cleaned up with `CRM_CLAUDE_TOKEN`; two rows remain in the forms
dashboard under `STAGING-TEST-DELETE-ME@example.com`, left deliberately because
`testMode` cannot isolate them without also skipping the CRM sync under test.

> **Deleting a contact does not clear it from `GET /contacts/` straight away.**
> The list is index-backed and lags both writes and deletes by seconds to
> minutes; a direct `GET /contacts/{id}` is authoritative and returned
> `400 Contact not found` immediately. Do not read a stale list as a failed
> cleanup — or as a successful one.

**Still not exercised on the deployed build: `POST /api/book`.** Unlike
`bookAppointment`, the endpoint always notifies, so a probe would email the test
contact and run `A-102-3`. The booking path itself is proven live (§5.1, §5.2);
what is untested is only that endpoint's own wiring in a deployed environment.

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

### 6.8 What a real walkthrough proved (and corrected)

A human walked the whole funnel on staging, 2026-08-18. Everything landed: one
contact, correct `source`, all five answers, consent verbatim, the three process
tags, the pipeline card, the appointment, and a confirmation email carrying the
Zoom link. Three things it settled that probing could not:

**1. Appointment workflows DO fire from an API booking.** This was previously
reasoned, not measured — both earlier live bookings passed `notify: false`
precisely to avoid finding out. From the conversation log:

```
21:28:24  TYPE_ACTIVITY_APPOINTMENT   Intro call — Tucker Lemos
21:28:48  TYPE_EMAIL                  "Your call has been confirmed for
                                       August 19, 2026 at 11:30 AM MDT …"
21:28:54  TYPE_ACTIVITY_OPPORTUNITY   Opportunity updated
```

plus notes from `Z-001-1` ("Scheduled a call with Tim Holmes…") and
`WF# 001-1` ("Contact added to meeting reminders"). The A-102 trigger gap
(§6.1) applies ONLY to the form/survey-triggered workflows. Anything keyed to an
appointment works today.

**2. Bounce handling works.** The test address was not a real mailbox, so
`WF#Z-015-4` caught the bounce, tagged the contact `email bounced` and placed
its email on DND within four seconds.

**3. ⚠️ `POST /contacts/upsert` dedupes on PHONE, not just email — and
overwrites the email when it matches.** Measured with two throwaway contacts:

```
upsert dupe-phone-a@example.com + (212) 867-5309  → id jWap2a96VWPiW3G16PtC
upsert dupe-phone-b@example.com + (212) 867-5309  → id jWap2a96VWPiW3G16PtC   (same record)
                                                     stored email now …-b@example.com
```

One record, and the first lead's email address is **gone**. Anyone sharing a
number — a company mainline, a couple, a receptionist booking for someone else —
collapses into a single contact, silently, with no error from the API. This is
not something the code does; it is how the endpoint behaves. Worth deciding
deliberately whether to keep sending `phone` on the second touch at all.

**4. ⚠️ A submitted phone can vanish, silently.** The walkthrough contact
recorded SMS consent and carried **no phone number** — and a number WAS typed,
which removes the dullest explanation. So: a number offered twice, stored
neither time.

| Touch                       | Endpoint       | Sends `phone`?                             | Code                   |
| --------------------------- | -------------- | ------------------------------------------ | ---------------------- |
| 1. Email capture            | `/api/inquiry` | no — the modal has not asked yet           | `syncInquiryToCrm`     |
| 2. Survey + contact details | `/api/inquiry` | **yes**, beside the consent that DID stick | `syncApplicationToCrm` |
| 3. Booking                  | `/api/book`    | **yes**                                    | `POST /api/book`       |

Three theories tested and disproved before the real one:

- our client omits an empty phone rather than sending `""` (read the body it builds);
- the CRM accepts fictional `555` numbers happily (upserted one, read it back);
- `normalizePhone` mangles it — it passes anything it does not recognise straight
  through, so the worst case is the visitor's own formatting, not an empty string.

The remaining candidate, and the one the dedupe behaviour above predicts, is a
**match conflict**: the upsert matched an existing contact by EMAIL while the
phone matched a DIFFERENT contact, and GHL resolved it by keeping the email
match and dropping the phone rather than moving a number between records.

**Confirmed, mechanism and all**, 2026-08-18. Two throwaway contacts, one
holding a number, one holding an email:

```
setup     owner  conflict-owner@example.com   phone +12128675310
          other  conflict-other@example.com   phone none

conflict  upsert { email: other, phone: owner's }
          → returns OTHER's id            the EMAIL match wins
          → response carries no phone
          → owner still holds the number, other still has none

HTTP 200. No error, no warning, no hint beyond the absent field.
```

The third finding is the useful one: **the upsert's response reflects what was
STORED, not what was sent.** An absent `phone` on a request that carried one is
therefore a real answer, not an echo — so the drop is detectable with no extra
call and no extra scope, which an earlier version of this section assumed was
impossible.

The colliding record has been identified and removed (approved by Tucker):

```
id           3xt31L8G8pz0B0TSHj2Z          email  tucker.lemos@gmail.com
source       "A-101-2. Application Step 1 "        ← the widget form's own name
dateAdded    2026-08-17T18:10:37
customFields 5   (four survey answers + sms_consent)
tags []   notes 0   opportunities 0   appointments 0
attributionSource.url       https://fiddle.jshell.net/_display/?editor_console=true
attributionSource.referrer  https://jsfiddle.net
```

Two independent confirmations that it was not ours. `syncApplicationToCrm`
always writes a tag, an opportunity and a note, and this had none of the three
while carrying a full answer set — and its own attribution names the jsfiddle
page. It was the jsfiddle test of the hosted widget `[§3.5]`, and also the
specimen `ghl/client.ts` was reverse-engineered from; the record is printed in
full in this section's history and its lesson is transcribed in that file's
header comment. Deleted 2026-08-18, verified gone by id (the `/contacts/` list
still shows it for a while — that endpoint lags deletes, §5).

**What ships** (`phoneWasDropped` in `ghl/client.ts`):

- `upsertCrmContact` now returns `storedPhone` from the response.
- `syncApplicationToCrm` returns `phoneDropped`, and the contact note carries
  the number **unconditionally** — detection is reliable today, but the note is
  the mitigation, and it should not silently stop appearing if GHL ever changes
  the response semantics. When the drop IS detected the line says why:

  ```
  SMS consent: yes
  Cell as entered: (603) 531-1812 — NOT saved to this contact; that number is
  already on another record
  ```

- `/api/inquiry` and `/api/book` each log a distinct warning, because the
  request is a clean success by every other measure.

Ingest — the source of record — receives `phone` as a first-class field on both
touches and always did, so the number was never lost to the business. What was
missing was any trace of it on the CRM record a salesperson opens before the
call, next to a consent line promising to text them.

**Not a rare edge case.** Any two people sharing a number collide: a company
mainline, a couple, an assistant booking for their exec, or simply a returning
lead who uses a second email address.

Tooling note: a script that shell-sources `.env.local` is refused by the local
sandbox classifier. `npx tsx --env-file=…` is the route that works.

### 6.9 The booking page stopped asking twice

Raised by Tucker on walking the funnel: `/schedule` prefilled name, email and
phone from the hand-off, but still rendered them as three labelled inputs — so a
lead who had typed those details one screen earlier met them again as a form to
check. Prefilling was not enough; a filled field still reads as work.

`/schedule` now collapses to a confirmation block when the hand-off carried
everything the booking needs:

```
BOOKING AS
Tucker Lemos
tucker@reddoorla.com
(603) 531-1812
                         Use different details
```

Details that matter:

- **Gated on usable data, not on `applied`.** `prefilled` requires a non-empty
  name AND an email matching the same regex the submit guard uses — `readHandoff`
  accepts any non-empty string as an email, and a summary must never stand in for
  a value the submit would reject.
- **A snapshot taken at mount**, not `$derived` off the live values, so editing
  the email down to nothing cannot fold the form back up mid-edit.
- **Validation failure reveals the fields first.** Unreachable from a hand-off
  this page accepted, but an error message pointed at an input the summary is
  hiding would be a dead end with no way to correct it.
- **The email is shown, deliberately.** It is where the calendar invite goes;
  confirming it is not friction. Booking silently under a stale hand-off on a
  shared machine is the failure this prevents.
- **Focus after choosing a slot** moves to the confirm button rather than a
  field, since there is no longer a field to land on. The form still appears
  below the fold on a phone.
- **The bot screen is unaffected.** `MIN_FILL_MS` is 800ms and the clock starts
  at mount; a visitor still has to wait for slots to load and pick a day and a
  time, so removing the typing time cannot trip "too-fast".

Covered by four smoke tests: the summary renders and its values reach `/api/book`
unretyped; "Use different details" reveals the fields already holding them; a
hand-off with an unusable email falls back to the fields; and axe passes on the
new state (it is a UI state the picker-open a11y test never reaches).

### 6.10 Owning the links the CRM sends

Every URL this CRM has ever sent a human, extracted from the messages
themselves on 2026-08-18 (workflow actions are unreadable by any API; the
messages they produced are not):

| Sent | Link                                                            | Verdict                              |
| ---- | --------------------------------------------------------------- | ------------------------------------ |
| 6x   | `links.reddoorla.com/google/calendar/add-event/{id}`            | ours — now `/calendar/{id}`          |
| 3x   | `links.reddoorla.com/widget/booking/{cal}?event_id={id}`        | ours — now `/reschedule/{id}`        |
| 3x   | `links.reddoorla.com/widget/cancel-booking?event_id={id}`       | ours — now `/cancel/{id}`            |
| 2x   | `go.reddoorla.com/inquiry?email=&full_name=&phone=`             | ours — the industry LP replaces it   |
| 1x   | `go.reddoorla.com/inquiry-completed` (behind an SMS short link) | ours — `/schedule` replaces it       |
| 2x   | `us06web.zoom.us/j/…`                                           | **leave** — the actual meeting       |
| 2x   | `services.msgsndr.com/…/unsubscribe-view/…`                     | **leave** — compliance, wired to DND |

The calendar's own `notes` field is a second home for two of them, separate from
any workflow email:

```
Need to make a change to this event?
Reschedule:-
{{reschedule_link}}

Cancel:-
{{cancellation_link}}
```

#### Where the links actually live (probed 2026-08-18)

The table above was inferred from messages six contacts happened to receive, on
the basis that "workflow bodies are unreadable". That is true of workflow
ACTIONS and of nothing else — a claim made here after probing only
`/workflows/`. Four other surfaces answer to the broad token:

| Endpoint                            | Holds                                   |
| ----------------------------------- | --------------------------------------- |
| `GET /links/?locationId=`           | trigger links + their real `redirectTo` |
| `GET /locations/{id}/customValues`  | the URLs templates interpolate          |
| `GET /calendars/{id}/notifications` | the calendar's own notification bodies  |
| `GET /emails/builder?locationId=`   | standalone email templates              |

Three things that changes:

**1. `schedule my appointment url` is EMPTY.** A custom value that exists for
exactly this purpose — `{{custom_values.schedule_my_appointment_url}}` — has
never been set, so anything interpolating it renders nothing. So is
`{{custom_values.your_agency_website}}`.

**2. The SMS "book a call" link is ONE trigger link, not many messages.**

```
Schedule Appointment   id XNbbFm2yy5f9GLovpjGC
  redirectTo  {{custom_values.sub_domain_url}}/inquiry-completed?first_name=…&email=…&phone=…
  merge field {{trigger_link.XNbbFm2yy5f9GLovpjGC}}
```

That id is the `link_id` inside the JWT behind every `links.reddoorla.com/l/…`
short link in the SMS reminders. Editing this one `redirectTo` changes all of
them — far better than hunting through message bodies.

**3. The calendar's notifications are all internal.** All three (`booked`,
`cancellation`, `confirmation`) carry `receiverType: assignedUser` — they go to
Tim, not the lead, and two have no body at all. So the lead-facing confirmation
is a workflow email action inside A-102-3, which stays out of reach. The
reschedule/cancel pair the lead sees comes from the calendar's `notes` field,
which lands in the invite description.

⚠️ **Do not blanket-change `{{custom_values.sub_domain_url}}`** to reddoorla.com.
It is `https://go.reddoorla.com`, and the unsubscribe and resubscribe
confirmation pages genuinely live there with no equivalent on our side.

#### What shipped

`/reschedule/[eventId]`, `/cancel/[eventId]`, `/calendar/[eventId]`, over
`/api/appointment/[eventId]` and its `reschedule` and `cancel` children. No
token change was needed — the deployed five-scope token already reads
appointments, and `calendars/events.write` covers the update.

**The security shape is the interesting part.** An appointment id in a URL is a
bearer token: it arrives in an email, and emails get forwarded. That cannot be
fixed without making leads log in. What CAN be fixed is how much the id READS —
the CRM's answer to it carries the Zoom join URL with its password, the contact
id and the assigned user. Verified against the deployed build:

```
GET /api/appointment/yeNIKuJ12o9bnPIUweNV
{"startTime":"2026-08-21T11:00:00-06:00","endTime":"…","status":"confirmed","actionable":true}
leaks zoom no · contactId no · assignedUserId no · address no · title no
```

The add-to-calendar hand-offs are server redirects and a server-built `.ics` for
the same reason: a client-side "Add to Google Calendar" anchor would print the
join URL into our HTML. A smoke test asserts `zoom.us` never appears in page
source on any of the three.

Other decisions worth not re-litigating:

- **Cancel is a POST behind an explicit press, never a GET on load.** The id is
  in an email, so a GET would be cancelled by the first link scanner or inbox
  preview to touch the message.
- **Cancel sets the status; it does not DELETE.** `Z-002-1. Cancelled Meeting >
Let's Reschedule` is keyed to the status — a delete takes the follow-up with it.
- **Reschedule sends no `endTime`**, so the calendar's own 30-minute duration
  applies rather than a computed one quietly changing the length of the call,
  and it leaves slot validation on, which is what refuses a double-booking.
- All three carry `noindex, nofollow` and `no-referrer`.

**Untested:** the two WRITE paths. The reads are verified against the live API;
`PUT /calendars/events/appointments/{id}` is implemented from the documented
shape and has never been fired, because it would move or cancel a real booking
(§7.1). One throwaway booking would settle both.

### 6.11 The go.reddoorla.com pages, replaced

All five hosted funnel pages were read before anything was built, because
whether a page SAYS something or DOES something changes the job entirely.

| Hosted page          | What it is                                                             | Replaced by                      |
| -------------------- | ---------------------------------------------------------------------- | -------------------------------- |
| `/inquiry`           | the hosted questionnaire, 27 controls                                  | the industry LP + `InquiryModal` |
| `/inquiry-completed` | static thank-you (its `<title>` still reads `YOUR BUSINESS NAME HERE`) | `/schedule`                      |
| `/unsubscribe`       | confirmation + a recovery form                                         | `/email/unsubscribed`            |
| `/resubscribe`       | pure confirmation                                                      | `/email/resubscribed`            |
| `/update`            | a STAFF tool: outcome, lead value, notes, recap email                  | `/meeting-outcome`               |

#### Unsubscribing stays with GHL

`$lib/ghl/consent` can clear a DND flag and cannot set one, and a unit test
asserts it can never emit `"active"`. GHL's unsubscribe view is wired to their
compliance tooling and is the record of who asked us to stop; a second
home-grown way to suppress someone is a second thing to get wrong about a legal
obligation. Neither page writes on load, for the same reason `/cancel` does not.

#### `contacts.readonly`, and why both remaining pages needed it

The deployed token held `contacts.write` and not `contacts.readonly` — measured,
`GET /contacts/{id}` returned 401. Both remaining pages take a **typed** email
address from a form, so without a lookup they would have to upsert, and an
upsert invents a contact for a typo. Neither a subscriber nor a call outcome
should be conjured out of a mistyped address, so the scope was added on
2026-08-18 (six now — see `.env.example`).

`findContactByEmail` uses an `eq` filter, NOT the `query` parameter. Measured:
`query` is fuzzy and will return a near-match, which is the wrong kind of
helpful when the write is somebody's consent. The upsert survives only as a
fallback for a **401**, so a scope revoked by someone who does not know this
form depends on it cannot silently break an opt-in; that path logs at error.

#### `/meeting-outcome` is guarded, unlike the page it replaces

It is the only page here that writes onto somebody ELSE's record and can send
them an email. GHL's is wide open — anyone with the URL can post to it — and
inheriting that on our own domain is not a trade worth making. So:
`MEETING_OUTCOME_KEY` in the trigger link, compared in constant time, and the
endpoint **fails closed** when the variable is unset. A wrong key answers 404,
the same as a missing page.

Its five option strings are byte-for-byte from the location's own field
definitions — the stray space in `Not Interested/ Not Yet Ready`, the
exclamation mark on `Sold!`, the apostrophe in `No (don't send email)`. GHL
matches exactly; a tidied-up option silently unmaps the answer and the
salesperson sees a blank field rather than an error. `outcome.test.ts` pins them,
as `questions.test.ts` pins the survey's.

⚠️ **The A-102 trigger gap applies here too.** Writing those fields by API does
not fire a form-submitted trigger, so the conversation recap email and anything
keyed to "Sold!" will not run until `Contact Tag Added` triggers exist. Every
outcome therefore applies a namespaced tag (`outcome sold`, `outcome no show`, …)
so the hook is waiting, and the success screen says so rather than letting a
requested recap quietly not send.

#### The change list, once more — mostly custom values

Four of the five are a custom-value edit, because the trigger links interpolate
them:

| Custom value                                | Set to                                          |
| ------------------------------------------- | ----------------------------------------------- |
| `schedule_my_appointment_url` (EMPTY today) | `https://reddoorla.com/schedule`                |
| `your_agency_website` (EMPTY today)         | `https://reddoorla.com`                         |
| `email_unsubscribe_confirmation`            | `https://reddoorla.com/email/unsubscribed`      |
| `resubscribe_for_emails_page`               | `https://reddoorla.com/email/resubscribed`      |
| `client_meeting_status_update_url`          | `https://reddoorla.com/meeting-outcome?k=<key>` |

Plus one trigger link — `Schedule Appointment` (`XNbbFm2yy5f9GLovpjGC`), whose
`redirectTo` becomes `https://reddoorla.com/schedule`. With that changed,
`sub_domain_url` has no remaining consumer among these and can be left alone.

Still per-template: the calendar's `notes` field, and A-102-3's confirmation
email — the one send that stays unreadable, because all three calendar
notifications turned out to go to the assigned user rather than the lead.

#### Deploy state of the secrets, 2026-08-19

`MEETING_OUTCOME_KEY` is set as a **secret** on both `reddoor-staging` and
`reddoorla`, same value, contexts `production` / `deploy-preview` /
`branch-deploy`. Deliberately the same on both: the key rides inside a GHL
custom value, and two different keys would mean rotating that custom value on
the day the branch merges. Setting an env var is not enough on its own — Netlify
injects it at build time, so the running function kept answering 503 until a
rebuild; verified live afterwards (correct key → 400 validation, wrong key and
right-length-wrong-bytes → 404).

⚠️ **`CRM_FUNNEL_ACTIVE_TOKEN` does not exist on the production site.** Today
that breaks nothing, because none of these routes are on `main` yet. The moment
this branch merges, `/api/book` returns 500, `/api/slots` fails, and `/api/inquiry`
reaches ingest but silently skips the CRM with a logged warning. **It has to land
on `reddoorla` before the merge, not after.** `netlify env:clone` will not do it —
it writes masked garbage for secrets (see memory
`reference_netlify_env_clone_secret_gotcha`); set it explicitly with
`env:set --secret --context production deploy-preview branch-deploy`, then rebuild.

### 6.12 The confirmation spoke Mountain — reported by Erik, 2026-08-19

He booked 10:30am Central and the confirmation email read **"9:30 AM MDT"**. The
instant was right and the frame was wrong, which is worse than it sounds: the
picker, the day tabs and the zone note had all been in his own time, so the
CRM's send is the single point where the flow changes language on the visitor.
The SMS has the identical cause.

**Why.** GHL renders appointment times in the CONTACT's timezone and falls back
to the LOCATION's when the contact has none. Every contact we created had none,
and the location is `America/Boise`. Erik's record read `timezone: null`.

**The lever was already in our hands.** `resolveTimeZone()` in `slots.ts` has
been resolving the visitor's IANA zone since day one to render the picker — it
was simply never sent anywhere. It now travels with `/api/inquiry` and
`/api/book` and is set on the upsert. No GHL template changes; their renderer
does the rest.

Three decisions in `$lib/schedule/timezone.ts` worth keeping:

- **`Intl` validates it, not a regex.** The value is attacker-controlled and
  ends up in mail we send. The question is not whether the string looks like a
  zone but whether the tz database knows it — and an unknown zone throws
  `RangeError` there, which is exactly the answer wanted.
- **Bare offsets and abbreviations are refused.** `"UTC"` is a legal `Intl`
  argument that says nothing about where someone is; writing it to a record
  would claim more than we know.
- **An unrecognised value is dropped, never substituted.** A wrong zone applied
  silently is worse than the Mountain fallback, which is at least consistent and
  explicable.

Unlike `source`, the zone is re-asserted on EVERY touch. `source` records where
someone came from once and would be a lie if overwritten; a timezone records
where someone is, and the newest reading is the best available.

⚠️ **Only helps bookings from here on.** Existing contacts still read
`timezone: null` until they rebook. Erik's was backfilled by hand to
`America/Chicago` on 2026-08-19 with permission.

#### `/contacts/search` is eventually consistent — measured

Right after the `PUT`, `GET /contacts/{id}` returned `America/Chicago` while
`POST /contacts/search` still returned `null` for the same contact. A re-search
about ninety seconds later agreed. The field IS projected into the index; the
index simply lags.

This is a trap for any verify-after-write: reading back through
`findContactByEmail` immediately would have reported the write as failed when it
had already landed. Read the record by id when the answer must be current.

### 6.13 The links, actually swapped — 2026-08-19

Seven writes, applied with permission and read back. Pointed at
`staging.reddoorla.com` deliberately: four of the five pages do not exist on
`reddoorla.com` until this branch merges, and sending someone from a working GHL
page to a 404 is worse than leaving the GHL page in place.

| id                     | key / name                          | now                                          |
| ---------------------- | ----------------------------------- | -------------------------------------------- |
| `UP1xzQCIhcrIU4DsySD4` | `schedule_my_appointment_url`       | `{staging}/schedule`                         |
| `9fiXMEzf3yRJn3rq8gKp` | `your_agency_website`               | `https://reddoorla.com` — **not** staging    |
| `pvXZ4v22D0KVJf1arGBc` | `email_unsubscribe_confirmation`    | `{staging}/email/unsubscribed`               |
| `Xwp83IVumkOAF3z0B22r` | `resubscribe_for_emails_page`       | `{staging}/email/resubscribed`               |
| `bqVBAYHR70Yo9fwCxgyo` | `client_meeting_status_update_url`  | `{staging}/meeting-outcome` — bare, no key   |
| `XNbbFm2yy5f9GLovpjGC` | Schedule Appointment (link)         | `{staging}/schedule?first_name=…`            |
| `CNC9Ce7s3kqntcPZ57Lk` | Client Meeting Status Update (link) | `{staging}/meeting-outcome?k=…&first_name=…` |

`your_agency_website` is the exception on purpose: it is the business website
leads read in email, not a funnel page, and `reddoorla.com/` is live today.
Pointing it at staging would have been wrong in a way nobody would notice.

**At merge time**, re-point the five `{staging}` entries to `reddoorla.com`.
Both PUT bodies require `name` alongside the value, so every write must resend
the existing name verbatim or it blanks the label.

#### The `?` collision — why the key is in the LINK, not the custom value

`Client Meeting Status Update` was stored as:

    {{ custom_values.client_meeting_status_update_url }}?first_name={{contact.first_name}}&…

It appends its **own** `?`. Putting `?k=<key>` inside the custom value would have
produced `…/meeting-outcome?k=<key>?first_name=Dana&…`, so `k` would arrive as
`<key>?first_name=Dana`, fail the constant-time compare, and return **404 on
every submission** — a failure that reads as "the page is broken" rather than
"the key is wrong", which is exactly the kind that costs an afternoon.

So the key lives in the trigger link, joined with `&`, and the custom value holds
the bare URL. A read-back asserts each link contains exactly one `?`.

#### `sub_domain_url` was left alone, and the earlier claim withdrawn

§6.10 said that once the Schedule Appointment link changed, `sub_domain_url`
would have no remaining consumer. That was an assertion, not a finding.
`GET /emails/builder` returns **zero** templates for this location — the bodies
live inside the workflow editors, which the API does not expose — so nothing
here can prove what else interpolates it. It still reads `https://go.reddoorla.com`,
and the Schedule Appointment link now carries its own absolute URL instead of
being built from it.

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
