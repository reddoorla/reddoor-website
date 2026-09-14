# Boise landing page + `/bew` redirect + per-city content pipeline — design

**Date:** 2026-09-14
**Branch:** `feat/boise-industry-lp` (worktree `.worktrees/boise-lp`), PR against `staging`
**Deadline:** Boise Entrepreneur Week, 28 Sept – 2 Oct 2026, Jack's Urban Meeting Place (JUMP), downtown Boise

## 1. Why

Tim is working Boise Entrepreneur Week (BEW) to win local clients and wants a
landing page and funnel like `/medtech`, pointed at Boise businesses. This is
also the proof of concept for targeting a niche by **place** rather than by
industry: a San Antonio page follows, and the pipeline should make that a data
file and one command.

The medtech build (Aug 2026, 46 commits, PRs #133 #136 #138) made the type,
the slices, the modal, the CRM sync and the booking flow repeatable. This
design adds no new surface to any of that. It adds one document, one redirect,
one content folder, and the tests that prove a second industry page works.

## 2. Decisions already taken (with Tucker, 2026-09-14)

| Decision      | Choice                                                                                                                                        |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Page identity | A durable city page, **uid `boise`**, plus a **`/bew` redirect** that carries the event's utm tags. Not an event page.                        |
| Questionnaire | Reuse the A-101 form and survey unchanged — same five questions **including the $10k+ budget gate**. Zero code, zero CRM work.                |
| Copy          | I draft every field from the positioning in §4; Tim approves. Tim supplies the case study pick, logos, testimonial and a licensed hero photo. |
| Pipeline      | Generalise `scripts/medtech/` to `scripts/industry/<uid>/` now, because San Antonio is already on the list.                                   |

No mention of BEW exists in Discord (7,668 messages, 109 channels, 75 days) or
in Tucker's mail. Tucker's message is the whole brief; §4 is the positioning I
am proposing in its place.

## 3. Non-goals

- New inquiry questions, a per-page budget gate, or any CRM schema change.
- New slices or slice variations. The Boise page uses the medtech slice
  sequence exactly.
- A video, a BEW-specific offer, sponsor logos, or event schedule content.
- The San Antonio page itself. This design makes it cheap; it does not build it.
- Local-SEO structured data (LocalBusiness schema). Worth its own small change
  later; it is not needed for the event.

## 4. The page

### 4.1 Document

- Type `industry`, uid `boise`, no uid collision (`page` has only `home`;
  `industry` has only `medtech`; no showcase uses it). Served at `/boise` by
  `src/routes/[[preview=preview]]/[uid]/+page.server.ts` through the existing
  page→industry fallback. Prerendered by its `entries()`, which enumerates every
  industry doc. The chase-link landing route (`/inquiry`) and the OG card
  route enumerate industry docs too, so nothing needs to be told about the
  new uid.
- **Slice zone**, identical in type, variation and order to the published
  medtech document:
  1. `industry_hero`
  2. `lead_text/rail` (services eyebrow + lead)
  3. `text_columns/serviceList`
  4. `lead_text/rail` (framework eyebrow + lead)
  5. `text_columns/iconColumns` (the three framework steps)
  6. `case_study`
  7. `logo_grid`
  8. `testimonial`
  9. `featured_project`
  10. `value_block/expandable` (about)
  11. `accordion/rail` (FAQ)
  12. `cta_banner`
- **Inquiry tab: all five fields blank.** The modal then defaults to
  `DEFAULT_INQUIRY_FORM_ID` / `DEFAULT_INQUIRY_SURVEY_ID`, and `questionsFor()`
  resolves the A-101 question set. `campaign={data.page.uid}` makes every lead's
  CRM `funnel` field `boise` and fills `utm_campaign` when the visitor arrived
  without one.
- **SEO tab:** `meta_title`, `meta_description` drafted with the copy;
  `meta_image` left empty so the generated card `og/industry/boise.png` is used.
  The card is a build artefact: it exists only after a production build that
  ran with the document published (see §8).

### 4.2 Positioning (what Tim is approving)

The medtech pitch translated from procurement to a local market:

- **Promise.** A Boise business gets the brand and web presence of a national
  player, from a senior team with a founder in Boise. Nothing is handed down;
  the people in the first meeting build the brand.
- **Proof.** Twenty years, 300+ companies, the national names in the logo grid
  (the Toyota / HBO / OWN / Infiniti / Alteryx / Rubrik tier) next to
  businesses a Boise owner recognises as their own size (the Blue Butterfly /
  Herbst Veterinary / Beachfront Dentistry / Enzo's tier). The case study is
  from the second tier so the reader sees it works at their scale.
- **Qualifier.** The copy speaks to owners ready to invest in the brand, not a
  logo refresh, so the $10k+ question in the modal does not arrive as a
  surprise. It does not court idea-stage founders; they fail the gate anyway.
- **Framework.** The three steps keep their medtech names — _The Diagnosis_,
  _The Rebuild_, _The Rollout_ — because they are the studio's process, not
  an industry's, and because the modal can attribute a lead to the step whose
  CTA opened it (`data-inquire-step`, sent to the CRM). One vocabulary across
  pages keeps that attribution comparable.
- **Services.** The same three columns (Brand Identity / Digital Presence /
  Design System); items may be re-ordered toward what a local business buys
  first (web, signage, print) but not invented.
- **FAQ.** Eight questions, re-angled: pricing; timeline and how much of the
  owner's time; "are we too small for you"; "do you only do healthcare and
  tech"; "can we meet in person in Boise"; "will a rebrand confuse the
  customers we have"; "why not a local freelancer or in-house"; "how do we
  start". Every answer gets real copy in the draft; none load empty (the
  medtech README records that its eight FAQ answers loaded with empty bodies
  because the board never supplied them).
- **Voice** matches `/medtech`: plain, confident, no jargon. Deviations from
  anything Tim sends back are recorded in `data.json` under `_copyEdits`, and
  every gap under `_contentGaps`, exactly as the medtech file does.

Tim's inputs, with my shortlist to make the ask concrete:

| Input            | Shortlist                                                                                | Constraint                                                                                                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Case study       | Blue Butterfly, Composition Hospitality, Pacific Luxury Group, Enzo's, Herbst Veterinary | The slice needs a **before** image and at least one **after**; the pick is limited by what art exists.                                                                                                            |
| Featured project | Any of the above not used as the case study                                              | Needs one hero mockup image.                                                                                                                                                                                      |
| Logo grid        | 8–9 logos mixing the two tiers above                                                     | Each may carry a rollover pair; plain logos are fine for launch.                                                                                                                                                  |
| Testimonial      | A local-scale client, quote + name + role + headshot                                     | One only.                                                                                                                                                                                                         |
| Hero photo       | A licensed image, Boise-legible (skyline, foothills, a downtown storefront)              | **The live medtech hero is still the unlicensed iStock comp** (`hero-PLACEHOLDER-istock-comp.png` in Prismic). Boise must not repeat that, and medtech's should be replaced in the same pass if Tim has an asset. |

### 4.3 The `/bew` redirect

`src/routes/bew/+server.ts`, `prerender = false`, `GET` only:

- Responds `302` to `/boise?utm_source=bew&utm_medium=event&utm_campaign=bew-2026`.
- Any incoming `utm_*` parameter **overrides** the matching default, so
  `/bew?utm_content=booth-card` and `/bew?utm_content=slide` distinguish the
  physical touchpoints without more routes.
- Every other incoming parameter is dropped. The destination is a fixed path,
  never derived from input, so there is no open-redirect surface.
- The parameter logic is a pure function (`bewTarget(searchParams): string`)
  in `src/lib/bew.ts` with a colocated vitest; the route is one call to it.

Why a SvelteKit route and not a Netlify `_redirects` rule: the site already
does this for `/inquiry` (the chase-link landing pad), a static route beats the
`[uid]` catch-all by SvelteKit's own precedence, and the dev server serves it
so the smoke suite can assert the behaviour. The cost is a function call per
hit, which at event volume is nothing.

The `utm_*` values ride along through the existing modal, which posts the
landing `location.href` as `sourceUrl`. **Correction (Task 2 review,
2026-09-14):** they do not become CRM custom fields. The four `utm_*` fields
were dropped from `attributionFields` on 2026-08-18 because GHL's attribution
pipeline blanks them on API-created contacts; the sync writes only
`lead_source` and `funnel` (= the page uid, `boise`, for a BEW lead and an
organic Boise lead alike). The utm values are recorded in two places: central
ingest (the source of record, queryable) and the contact's attribution NOTE
(`attributionLines` in `src/lib/ghl/client.ts`, matched by the `utm_` prefix).
So a salesperson reading the contact sees "bew"; a smart list or workflow
trigger cannot filter on it. If Tim needs that, the cheap addition is a tag on
first touch when `utm_source=bew` (ordinary tags persist). **Decided
2026-09-14 (Tucker): add the tag.** It is plan Task 8: `TAG_EVENT_BEW = "bew"`,
applied on both touches from the landing URL's `utm_source`, so a smart list
on `tag = bew` selects the cohort. No CRM schema change; tags are created on
first use.

### 4.4 The content pipeline: `scripts/industry/`

```text
scripts/industry/
  README.md                 # the "next city page" runbook (replaces scripts/medtech/README.md)
  migrate.mjs               # shared; --industry <uid> [--dry-run]
  medtech/
    data.json               # moved unchanged
    assets/                 # moved (gitignored)
    export-assets.mjs       # medtech-only: re-exports by Figma node id
    fetch-dropbox-assets.mjs
    normalize-logos.mjs
    stage-hr-rollovers.mjs
  boise/
    data.json
    assets/                 # gitignored
```

- `migrate.mjs --industry boise` reads `scripts/industry/boise/data.json` and
  `scripts/industry/boise/assets/`. It asserts `data.uid === <folder name>` and
  aborts otherwise, so a copied file cannot overwrite the wrong document.
  Everything else in the script stays as it is: field-level validation against
  the local models before any network call, asset upload, create-or-update by
  uid, never auto-publish.
- `--dry-run` remains the gate: it must print zero diffs before the real run.
- The medtech one-off helpers move with their data and are not generalised;
  Boise has no Figma board and its assets arrive as files. If a later city has
  a board, `export-assets.mjs` is the template to copy.
- `scripts/medtech/regen-types.mjs` is **deleted**, not moved:
  `scripts/prismic/regen-types.mjs` is its successor (takes `--slice` and
  `--custom-type`, handles custom types), and nothing references the old one.
- `.gitignore`: the `scripts/medtech/assets/*` rule and its three
  `!scripts/medtech/assets/logo-*-rev.png` exceptions move to the
  `scripts/industry/medtech/assets/` path, and a `scripts/industry/boise/assets/*`
  rule is added. The comment above them, which names
  `scripts/medtech/export-assets.mjs`, is updated to the new path.
- Every path reference to `scripts/medtech/` in code comments (two in
  `LogoGrid/index.svelte`) is updated so the comments stay true.

### 4.5 CRM: one builder edit, no code

The A-102-1 abandoned-inquiry chase message links to
`{{custom_values.sub_domain_url}}/inquiry?email=…&full_name=…&phone=…`. That
route already honours a `funnel` parameter and falls back to `medtech` without
one, so **an abandoned Boise lead would be chased back to the medtech page**.
Fix: append `&funnel={{contact.funnel}}` to the link in the A-102-1 message
body. The body is inline in the workflow builder, so this is a hand edit
(Tucker, or a CDP run per `reference_ghl_builder_automation`). Verification is
in code: `tests/smoke/inquiry-redirect.spec.ts` gains a case asserting
`/inquiry?funnel=boise&email=…` lands on `/boise` with the email carried.

### 4.6 Event kit

A QR code PNG for `https://reddoorla.com/bew?utm_content=booth-card` and one
for `…?utm_content=slide`, generated by script into the scratchpad and copied
to `~/Desktop` with descriptive names, plus a plain-text list of the links.
Nothing ships in the repo.

## 5. Tests

| Test                                     | Change                                                                                                                                                                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/bew.test.ts`                    | new: defaults, utm override, foreign params dropped, no path injection                                                                                                                                                                      |
| `tests/smoke/bew-redirect.spec.ts`       | new: `/bew` → 302 → `/boise` with the three utm values; `utm_content` survives; a `next=` param does not                                                                                                                                    |
| `tests/smoke/pages.spec.ts`              | `ROUTES` gains `/boise`                                                                                                                                                                                                                     |
| `tests/smoke/industry-page.spec.ts`      | the document-agnostic tests (axe at both viewports, single h1 / no heading jumps, ends on its own CTA, no untouched auto-crop, all twelve slices in order) run over `["/medtech", "/boise"]`; the framework-numeral tests stay medtech-only |
| `tests/smoke/inquiry-redirect.spec.ts`   | new case for `funnel=boise`                                                                                                                                                                                                                 |
| `scripts/industry/migrate.mjs --dry-run` | must report zero diffs for both `medtech` and `boise` before either real run                                                                                                                                                                |

The smoke tests that hit `/boise` read live Prismic content, so they are red
until the document is **published**. That is a sequencing fact, not a flake,
and §8 orders the launch around it.

## 6. Error handling

- **Migration:** unchanged. A model drift fails the dry run with a field-level
  diff; a missing linked project fails before upload with the uid named;
  Prismic outages are reported as outages, not as data errors.
- **Redirect:** malformed or hostile parameters cannot change the destination
  path; at worst a utm value is odd, which the CRM already tolerates.
- **Unpublished document:** `/boise` 404s exactly as any unknown uid does today.
- **OG card:** blank `meta_image` plus the generated card means the page can
  never ship without an `og:image`; the root layout's site default covers even
  a mis-timed build.

## 7. Risks and open items

1. **Copy approval is the critical path.** Code is a session; Tim's turnaround
   is not under our control. The draft goes to him in Prismic preview, not as a
   document, so what he approves is what ships.
2. **Case-study art.** If none of the shortlist has a usable before image, the
   slice hides its toggle (medtech already relies on this for Revogen); the
   page still renders.
3. **The gate.** A Boise crowd will fail the $10k+ question more often than a
   medtech procurement lead. Tucker chose to keep it; the copy's qualifier is
   the mitigation, and the `not a good fit` tag counts how often it fires.
4. **Medtech hero is unlicensed in production.** Not caused by this work, but
   found by it; flagged to Tucker in the session.
5. **Build trigger after publish.** A Prismic publish did not trigger a
   staging build in September (OG-cards journal). Confirm the production
   webhook fires, or trigger the build by hand, before telling Tim the page is
   live.

## 8. Launch sequence

1. Land the pipeline move, the redirect, and the tests on the feature branch;
   `pnpm lint`, `pnpm check`, unit green. Smoke: everything except the
   `/boise` cases green (they wait on step 5).
2. Draft `scripts/industry/boise/data.json` and stage assets; `--dry-run`
   clean; load the unpublished draft.
3. Tim reviews via Prismic preview on production (the `[uid]` route and every
   slice already exist there, so no deploy is needed to see the draft).
   Revisions re-run the migrate script; it updates in place.
4. Tucker applies the A-102-1 `funnel` edit in the GHL builder.
5. Tim (or Tucker) publishes the document. Confirm a production build ran;
   verify `/boise` and `og/industry/boise.png` on production, then run one
   inquiry through the modal on **staging** (same central ingest, and it
   builds from the same Prismic repo) and confirm the CRM contact carries
   `funnel = boise`. No fabricated leads on production.
6. Full smoke suite green; PR to `staging`; promote to `main` with a merge
   commit. The redirect is live when `main` deploys.
7. Event kit to Tucker's Desktop.

## 9. What San Antonio costs after this

A `scripts/industry/san-antonio/` folder with `data.json` and assets, one
`migrate.mjs --industry san-antonio` run, `/san-antonio` added to the smoke
`ROUTES` and the industry-page uid list, and a redirect route only if there is
an event to tag. No models, no code paths, no CRM work.
