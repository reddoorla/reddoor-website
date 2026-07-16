# Portfolio-intro migration

One-shot, idempotent content migration that adds the **portfolio-page intro** to
each project's Prismic doc, driven by the Figma "Project Page Design" page.

The intro is three slices (shipped in the LeadText / TextColumns / Accordion
slices, PR #93):

1. **LeadText** — `"The Challenge"` eyebrow + a serif lead paragraph.
2. **TextColumns** — `"Our Solution"` eyebrow + three columns (title + body).
3. **Accordion** — `"About X"`, open by default (only where the design has one).

The masthead (title, hero image, tagline, Branding/Digital tags) already exists on
each doc as page-level fields — this migration does **not** touch it. The existing
project body flows after the intro, unchanged.

## Provenance

`data.json` is the frozen plan: one entry per Figma frame, each mapped 1:1 to a
`project` doc by masthead title. The copy was parsed from the Figma `<text>` layer
metadata of file `FwaZy5Jz0JsbJjJRvytnmY`, page _Project Page Design_ (node
`799:786`). The 16 frames cover: rubrik-zero-labs, canvas-worldwide, ceo-la, msot,
gallery-sonder, summittrek, trinity-law-school, progress-lighting,
composition-hospitality, st-james-episcopal-school, aura, worthe (The Burbank
Portfolio), 1-800-dentist, hearts-and-minds, the-texas-organ-sharing-alliance,
revogen.

`dropExistingLead` (per entry) removes a doc's old opening `rich_text` only where
the new intro supersedes it — the four docs whose opening paragraph duplicates the
new lead/accordion (`ceo-la`, `composition-hospitality`, `aura`, `worthe`,
`canvas-worldwide`) plus `rubrik-zero-labs` (explicit design decision). Everywhere
else the existing opening paragraph is kept and flows after the intro, so nothing
is deleted that isn't re-added elsewhere.

Idempotency semantics (`lib.mjs`, unit-tested in `lib.test.mjs`): "the intro" is
identified **positionally** — starting at slice 0, at most one existing slice is
consumed per intro slot, and only while it matches that slot's type (`lead_text`,
then `text_columns`, then the optional `accordion`). That is exactly what a prior
run wrote and nothing else: editor-added intro-type slices — deeper in the doc,
directly after the intro, or even opening a never-migrated doc — are never
consumed. `dropExistingLead` drops the post-intro slice only if it is a
`rich_text` whose copy **prefix-duplicates** the entry's lead/accordion text
(first ~60 normalized characters — i.e. re-pasted intro copy; a paragraph that
merely opens with the intro's exact first sentence would also match, anything
else won't). Re-running converges: the second run rewrites the intro it wrote
and changes nothing else.

## Run

Requires `PRISMIC_WRITE_TOKEN` in `.env.local` (Prismic → Settings → API &
Security → Write APIs).

```sh
# preview the whole plan, no writes
node --env-file=.env.local scripts/portfolio-intro/migrate.mjs --dry-run

# migrate everything (stages drafts)
node --env-file=.env.local scripts/portfolio-intro/migrate.mjs

# just one or a few
node --env-file=.env.local scripts/portfolio-intro/migrate.mjs --only=aura,worthe

# audit which docs already carry the intro
node --env-file=.env.local scripts/portfolio-intro/list-projects.mjs
```

## Publish

The Prismic Migration API stages content as an **unpublished draft** and never
auto-publishes. After running, open each doc in Prismic, review the new intro, and
**Publish** to go live. There is no public API to publish programmatically — this
is the review checkpoint.

## SummitTrek: no accordion (by decision)

`summittrek` ships without an accordion: its "About SummitTrek" body was a
`Description` placeholder in Figma, and the omission was confirmed as final. If
that ever changes, add `intro.accordion` to the `summittrek` entry in `data.json`
and re-run `--only=summittrek`.
