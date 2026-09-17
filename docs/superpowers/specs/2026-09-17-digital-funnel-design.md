# `/digital` landing page + a second inquiry question set — design

**Date:** 2026-09-17
**Branch:** `feat/digital-funnel` (worktree `.worktrees/digital-funnel`), PR against `staging`
**Trigger:** Rick Garcia (Aston Prestige Windows and Doors) reached `/contact` on
2026-09-16 wanting "a webpage and website". `/contact` syncs to ingest only, and
the one funnel page we have sells a medtech brand rebuild behind a $10,000 gate,
so there was nowhere to send him.

## 1. Why

Tim wants a catch-all funnel page for leads who arrive with no industry and no
brand brief — a web-first offer he can point anyone at. The medtech and Boise
builds made the page type, the modal, the CRM sync and the booking flow
repeatable, and Boise proved a new page is a data file and one command.

What Boise did **not** exercise is a **second question set**. It reused A-101's
five questions unchanged. This design adds the first divergent set, and with it
the seam every later funnel needs: questions keyed per page, answers written to
their own CRM fields, and the $10k budget gate confined to medtech.

## 2. Decisions taken (with Tucker, 2026-09-17)

| Decision | Choice                                                                                                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Audience | Web and digital presence — websites, AI/search visibility. Not the brand-credibility offer medtech and Boise sell.                    |
| Page     | A clone of the medtech page with the branding sections removed and the language made web-first. Same twelve slices, same order.       |
| Projects | Rubrik Zero Labs and MSOT lead; 1-800-DENTIST and Gallery Sonder next.                                                                |
| Budget   | Ranges, **no gate**. Nobody is routed to `/not-a-fit`. Tim sees the range on the card before the call.                                |
| Numbers  | I draft the ranges and the pricing FAQ; Tim sets the real ones at review. Listed as a content gap.                                    |
| CRM      | Four new "Digital Inquiry – …" contact fields, so answers stay filterable in smart lists. Not note-only, not medtech's fields reused. |

## 3. Non-goals

- Any change to `/medtech` or `/boise`, their questions, or their CRM fields.
- New slices or slice variations. `/digital` uses the medtech sequence exactly.
- GHL workflow edits. The chase sequences already reach leads this flow creates
  (§8) and carry the same tags for digital leads, so nothing has to move for
  this to work. Their copy is a separate question, also §8.
- A GHL survey object for the digital questions. Not because it is unreachable —
  the builder can be driven over Chrome's debugging port, which is how the
  A-102 email bodies were edited on 2026-09-15 — but because nothing would read
  it: no survey has been submitted since the widget path died (2026-08-18), and
  the answers land as contact fields either way. The question set is keyed by a
  string this code owns. If a survey object is ever wanted for reporting, the
  builder route is how, and it changes nothing here.
- Ongoing-care or marketing services copy beyond what `/medtech` already
  publishes. Anything new is a content gap for Tim, not invented here.

## 4. The page

### 4.1 Document

- Type `industry`, uid `digital`. No collision (`industry` holds `medtech` and
  the `hide`-tagged `boise`). Served at `/digital` by the existing `[uid]`
  route, prerendered by its `entries()`; `/inquiry` and the OG card route
  enumerate industry docs too, so neither needs telling about the new uid.
- **Slice zone**, identical in type, variation and order to the published
  medtech document:
  1. `industry_hero`
  2. `lead_text/rail` (services eyebrow + lead)
  3. `text_columns/serviceList`
  4. `lead_text/rail` (framework eyebrow + lead)
  5. `text_columns/iconColumns` (the three process steps)
  6. `case_study`
  7. `logo_grid`
  8. `testimonial`
  9. `featured_project`
  10. `value_block/expandable` (about)
  11. `accordion/rail` (FAQ)
  12. `cta_banner`
- **Inquiry tab:** `inquiry_survey_id = "digital"` — the question-set key, not a
  GHL survey id (§5.3). `inquiry_title` / `inquiry_prompt` / `inquiry_thanks`
  carry web-first copy. `inquiry_form_id` stays blank; the CRM `source` label is
  shared with medtech on purpose, so the funnel's leads group together in GHL's
  source reporting. `campaign={data.page.uid}` makes every lead's `funnel` read
  `digital`.

### 4.2 Copy, section by section

Drafted by me from the published medtech page; Tim approves. "No branding
elements" is read as: no brand-identity, packaging, trade-show or design-system
services, and no brand-credibility framing. The studio's visual language
(logos, paper texture, band rhythm) is unchanged.

| Section          | Treatment                                                                                                                                                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero             | Medtech's "from X to Y" headline shape, aimed at a site that is not earning attention. Card describes the three-step process for a website. Image: a Rubrik web mockup from its project document, not a stock photo.                                                            |
| Services         | Medtech's "Digital Presence" items (Website Design, Website Development, AEO/SEO Development, AEO/SEO Deployment) plus its social items. Brand Identity and Design System columns dropped. Any service name not already published on `/medtech` is a content gap, not invented. |
| Framework        | Same three phases and icons, re-pointed at a site: audit the current site and its AI-search visibility → design and build → launch and get found. Eyebrow no longer says Brand Credibility Framework.                                                                           |
| Case study       | Rubrik Zero Labs. No before image on file, so the slice hides its before/after toggle, exactly as Boise's does.                                                                                                                                                                 |
| Logo grid        | Zero Labs, MSOT, 1-800-DENTIST, Gallery Sonder first, filled to nine from clients flagged `digital` in Prismic (SCFAI, Strategy Advantage, Hearts & Minds, CEO of LA County, St. James'). Each links to its project where one is published.                                     |
| Testimonial      | Albert Turgon (MSOT), verbatim — the only client quote on file, and it names their web work. A client quote is never edited to fit a page.                                                                                                                                      |
| Featured project | MSOT's website mockup, as on medtech.                                                                                                                                                                                                                                           |
| About            | Medtech's text, with the clinicians/procurement paragraph rewritten around what a website has to do.                                                                                                                                                                            |
| FAQ              | Rewritten for someone buying a website. The pricing answer carries the draft ranges and is flagged for Erik and Tim, who own pricing language.                                                                                                                                  |
| CTA              | Web-first heading, same `/contact#inquire` button and paper-red background.                                                                                                                                                                                                     |

### 4.3 Content pipeline

`scripts/industry/digital/` follows the runbook in `scripts/industry/README.md`:
`data.json` plus a `fetch-assets.mjs` modelled on **Boise's** (Prismic-sourced),
not medtech's (Figma export). Boise's script already stages logo marks, negative
marks and rollover art from the `logo_soup` document and project imagery through
`stageFromProject`, which is exactly what this page needs. Then
`fit-logos.mjs --industry digital` and its `--check`.

`migrate.mjs` does not write the Inquiry tab today — medtech's values were set
by a Prismic release by hand. This adds an **optional** `inquiry` block: written
only when the data file has one, so re-running medtech's or Boise's load behaves
exactly as it does now.

## 5. The question set

### 5.1 Draft questions

Five, matching the medtech wizard's shape. Tim approves the wording; every
option string must then match the CRM picklist byte for byte (§5.2).

1. **What do you need help with?** (checkbox) — A new website · Redesigning our
   current website · Showing up in Google and AI search · Keeping our site
   updated · Not sure yet
2. **Where can we see your current website?** (text, `website`) — must be
   **skippable**: a startup like Rick's has no site, and an unskippable question
   here is an abandoned application. Medtech's equivalent is the same field; if
   the wizard does not already allow an empty text answer, that is a small
   modal change in scope for this work.
3. **What's the main job your website needs to do?** (radio) — Bring in leads
   and calls · Sell online · Make us look credible · Support hiring · Other
4. **Is there anyone else involved in this project?** (radio) — medtech's five
   options, stored in a **new** field (§5.2).
5. **What's your budget for this project?** (radio) — Under $5,000 ·
   $5,000–$10,000 · $10,000–$25,000 · $25,000+ · Not sure yet. **Placeholder
   numbers**; Tim sets them, and the pricing FAQ moves with them.

### 5.2 CRM fields

Created against location `nluRF7uH234gl3PdTBVD` with **`CRM_CLAUDE_TOKEN`** —
the site's runtime token (`CRM_FUNNEL_ACTIVE_TOKEN`) 401s on
`/locations/{loc}/customFields/*`.

| Field                          | Type       | Holds |
| ------------------------------ | ---------- | ----- |
| Digital Inquiry – Needs        | `CHECKBOX` | Q1    |
| Digital Inquiry – Website Goal | `RADIO`    | Q3    |
| Digital Inquiry – Stakeholders | `RADIO`    | Q4    |
| Digital Inquiry – Budget Range | `RADIO`    | Q5    |

Types mirror their medtech counterparts, read back 2026-09-17:
`Inquiry - Problems`/`Goals` are `CHECKBOX`, `Stakeholders`/`Expects $10k+
Budget` are `RADIO`. Q2 writes GHL's **standard** `website` contact field, as
medtech does — not a custom field. SMS consent keeps using the shared
`SMS Consent` field and its stored sentence.

If `POST /locations/{loc}/customFields` turns out not to be granted to that
token, the fallback is the builder over CDP (`scripts/crm/`, PR #187) — the same
route that edited the A-102 email bodies on 2026-09-15. Creating four fields by
hand in the GHL UI is also fine; what the code needs is their ids, however they
come to exist.

Order of operations, per the survey-copy findings of 2026-08-24: **CRM first,
verified by read-back, then the code**. Read back by **id**, which reflects a
write immediately; the list endpoint lags 1–2s and a single read of it looks
exactly like a silent no-op. Later wording changes are a rename in place (the
`fieldKey` does not move, so merge fields keep working) followed by the matching
code edit — never the reverse.

Not created: a "Digital" pipeline, tags, or workflows. Leads get the existing
`application started` / `application completed` tags, the existing pipeline card
and the existing calendar.

### 5.3 Code

- **`src/lib/ghl/questions.ts`** — `A101_QUESTIONS` stays untouched. Add
  `DIGITAL_QUESTIONS` and turn `questionsFor()` into a lookup: the A-101 survey
  id resolves the medtech set, the literal `"digital"` resolves the new one,
  anything else stays `undefined` (no wizard, email capture only). The key is a
  question-set id this repo owns, documented as such, because GHL surveys cannot
  be created through the API and nothing submits to one.
- **`src/lib/ghl/client.ts`** — no change. `writableFieldIds()` derives the
  allow-list from `questionsFor()`, so the digital set can only write its own
  four ids, and a forged medtech id posted under `"digital"` is dropped.
- **Budget gate** — no change. `isBudgetOptOut()` matches medtech's field id
  and its exact stored `"No"`; the digital set never carries that id, so no
  digital lead can reach `/not-a-fit` or be tagged `not a good fit`.
- **`src/lib/components/InquiryModal.svelte`** — only if Q2 cannot be skipped
  today (§5.1).
- **`scripts/industry/migrate.mjs`** — the optional `inquiry` block (§4.3).

## 6. Tests

- **Unit, `questions.test.ts`:** pin every digital question, option string and
  tag, as the A-101 set is pinned. Pin that the two sets share no field id
  except `website`.
- **Unit, budget gate:** a completed digital answer map is never an opt-out.
- **Unit, `client.test.ts`:** under key `"digital"`, the four ids are writable,
  medtech's four are dropped, `website` rides as a standard field, and SMS
  consent is written from the request boolean rather than the answer map.
- **Unit, loader:** `migrate.mjs` writes the Inquiry fields when the data file
  has an `inquiry` block and leaves them absent when it does not.
- **Smoke:** the fixture page (`/dev/a11y-fixtures`) drives one wizard run on
  the digital set and asserts the posted `surveyId` and field ids — the shape of
  the parsed payload, not a substring grep.
- **After publish (follow-up PR):** `/digital` joins `ROUTES` in
  `tests/smoke/pages.spec.ts`, `PATHS` in `industry-page.spec.ts`, and the card
  list in `og.spec.ts`. All three are red until the document is live, which is
  why they are not in the first PR.

## 7. Error handling

Inherited unchanged from the medtech path and re-verified by the tests above:
ingest is the source of record and a CRM failure never fails the visitor; the
honeypot and timing screen answer `200` to bots; an unknown question-set key
means email capture with no wizard rather than answers filed against the wrong
fields; a phone that collides with another contact is recorded in the note.

## 8. Risks and open items

- **The chase sequences DO reach these leads — corrected 2026-09-17.** An
  earlier draft of this spec repeated the standing belief that A-102-1/2 cannot
  fire from an API sync, so leads hear nothing. The message history says
  otherwise. The one outside submission through `/medtech`
  (`ju***@6figurecreative.com`, 2026-08-21, contact created 18:44) received a
  "your questionnaire was successfully submitted" SMS and email at 18:51, then
  four chases across 08-21, 08-23 and 08-24 ("I saw you submitted your
  questionnaire but you haven't booked"), ending in the `nurture` tag. A test
  contact that stopped after the email step got the "your inquiry wasn't
  completed" chase. Both were API-created.
  **Unresolved:** whether enrolment was automatic or done by hand during the
  August walkthroughs. Workflow triggers are readable only in the builder (over
  CDP), so this is answerable but not answered. It matters here because digital
  leads carry the **same** `application started` / `application completed`
  tags — if the trigger is tag-keyed, they inherit the chase for free; if
  enrolment was manual, both funnels are equally silent and the fix serves both.
  Worth settling before launch, but it blocks nothing in this design.
- **The chase copy is medtech's.** It says "questionnaire" and pitches brand
  work. A web lead reading "still interested in taking your brand to the next
  level" is a small mismatch. Editable over the builder (the same CDP route used
  on 2026-09-15), not through the API. Flag to Tim with the copy review; not in
  scope here.
- **Pricing and service names are placeholders.** The ranges in Q5 and the FAQ
  are mine. Erik owns pricing language. Publishing before Tim sets them would
  put invented numbers in front of leads.
- **The testimonial argues brand credibility** on a page that sells websites,
  and names "branding and web work". Acceptable because it is the only quote on
  file and it is true; a web-only client quote would be better.
- **Zero Labs' logo is a 235×66 raster** where every other mark is SVG, so the
  grid upscales it ~2.8×, and its rollover art under-serves the desktop ladder.
  Known from Boise; it now appears on a second page.
- **`digital` is a catch-all by name.** Any future cohort that must be separable
  in the CRM needs its own uid; `funnel` is the only per-page dimension.
- **Two funnels share one `source` label** (`A-101-2. Application Step 1 `).
  Deliberate, but it means GHL source reporting cannot tell them apart —
  `funnel` and the new fields are what separate them.

## 9. Launch sequence

1. Create the four CRM fields; read each back by id; record the ids.
2. Code and tests (§5.3, §6). `pnpm lint`, `pnpm check`, `pnpm test`, and a
   production build green.
3. Content folder, asset staging, `fit-logos --check`, `migrate --dry-run`
   (zero model mismatches), then load as an **unpublished draft**.
4. PR to `staging`; promote to `main` with a merge commit. **Before the
   document is published, not after:** a published `digital` doc against a prod
   build that predates the question set resolves `questionsFor("digital")` to
   `undefined`, and the modal silently degrades to email capture with no
   wizard — a live page quietly collecting half a lead.
5. Tim reviews the draft in Prismic, sets prices and question wording, publishes.
   The page and its OG card are prerendered, so both exist only after a
   production build that saw the published document — confirm one ran. Wording
   changes are a GHL rename first, then the code.
6. Follow-up PR: the three smoke lists (§6).
7. Rick Garcia gets `reddoorla.com/inquiry?funnel=digital&email=…`.

## 10. What a third funnel costs after this

After this lands, a new funnel with its own questions is: a data file, an asset
script, a question set in `questions.ts`, and as many CRM fields as it has new
questions. The seams — per-page question sets, a per-set allow-list, a gate that
belongs to one set rather than to the flow — exist after this and not before it.
