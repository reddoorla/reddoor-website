# Landmark and heading gaps the a11y suite cannot see

Found 2026-08-20 while chasing a flaky smoke test. All of these are real defects
on the live site. None of them has ever failed CI, and none of them will, for a
single reason worth understanding before reading the list.

## Why a full a11y suite reports none of this

The specs build their scans as

```ts
new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
```

which is a defensible choice — it scopes the gate to conformance obligations
rather than opinion. But the rules that catch landmark and heading structure are
not tagged that way (axe-core 4.13.0):

| Rule                   | Tags                                           |
| ---------------------- | ---------------------------------------------- |
| `landmark-one-main`    | `cat.semantics`, **`best-practice`**           |
| `landmark-unique`      | `cat.semantics`, **`best-practice`**           |
| `page-has-heading-one` | `cat.semantics`, **`best-practice`**           |
| `heading-order`        | `cat.semantics`, **`best-practice`**           |
| `duplicate-id`         | `wcag2a-obsolete`, **`deprecated`**            |
| `duplicate-id-active`  | `wcag2a-obsolete`, **`deprecated`**            |
| `duplicate-id-aria`    | `wcag2a`, `wcag412` — ARIA-referenced ids only |

So the entire landmark and heading surface sits outside the gate. A page can
have five `<h1>`s, no `<nav>`, and a `<footer>` that is not a landmark, and the
suite stays green. That is the gap, not any one of the findings below.

`duplicate-id-aria` deserves a note because it looks like cover and is not:
`id="main-content"` is referenced by the skip link's `href`, which is not an
ARIA reference, so the rule does not apply to it.

## What was found

Measured on the dev server, hydrated, at the routes named. Reproduce with the
inventory probe in the closing section.

| Route      | `<h1>` | `<nav>` | `<footer>` inside `<main>` |
| ---------- | ------ | ------- | -------------------------- |
| `/`        | **5**  | 0       | yes                        |
| `/about`   | **0**  | 0       | yes                        |
| `/medtech` | 1      | 0       | yes                        |

### 1. Five `<h1>` elements on the home page

They are fragments of the animated hero:

    "Arm your brand with"
    "a clear story..."
    "Arm your brand with"
    "compelling design"
    "Arm your brand with"

A screen reader announces five top-level headings, the stem repeated three
times, interleaved with its alternates. Anyone navigating by heading — a normal
way to skim a page — meets that instead of one title. Search engines read the
same markup.

The animation is the reason, not the excuse: the effect needs each phrase as its
own element, and `h1` is what gives it the size.

### 2. `/about` has no `<h1>` at all

The page has no top-level heading. Heading navigation has nothing to enter on,
and the document has no programmatic title.

### 3. No `<nav>` landmark on any page

Zero `<nav>` elements site-wide. The header's links are anchors in a `<div>`.
Landmark navigation offers no way to reach the menu, and a "skip to navigation"
affordance would have no target. The skip link we do ship goes to `#main-content`
and works.

### 4. `<footer>` is nested inside `<main>`

`+layout.svelte` closes `</footer>` immediately before `</main>`. A `footer`
maps to the `contentinfo` landmark **only** when it is not inside `main`,
`article`, `section`, `aside` or `nav` — so as shipped, the site exposes no
`contentinfo` at all. Contact details and secondary navigation live there.

## The common cause

Heading level is coupled to visual size through global element selectors (see
the heading-order note in the repo's history: `.type-*` classes exist precisely
as the escape hatch). When a designer needs hero-sized type they reach for `h1`,
and when they need something smaller on `/about` they reach for a level that
happens to leave no `h1` behind. Document semantics end up decided by type
scale.

That is why these arrive as a set rather than as four unrelated bugs, and why
fixing them one at a time invites regression. The durable fix is to let the
class carry the size and the tag carry the meaning.

## What was fixed, and what was not

**Fixed 2026-08-20** — a sixth issue of the same family, and the one that led
here. `<main id="main-content">` sat inside `{#key data.pathname}`, so every
client-side navigation held two `main` landmarks and two identical ids for about
500ms while the crossfade overlapped. Keying an inner wrapper holds the landmark
stable; `tests/smoke/landmark-during-nav.spec.ts` pins it. The animation is
unchanged.

**Not fixed.** The four above. Items 3 and 4 are contained markup changes. Items
1 and 2 need a decision about the hero, because the fix changes what the
animation is built from — that is a design conversation, not a cleanup.

## Reproducing

Landmark and heading counts are deterministic; they need no particular load and
no timing luck.

```ts
const info = await page.evaluate(() => ({
  mains: document.querySelectorAll("main").length,
  navs: document.querySelectorAll("nav").length,
  h1s: [...document.querySelectorAll("h1")].map((h) => h.textContent?.trim()),
  footerInMain: !!document.querySelector("footer")?.closest("main"),
}));
```

To see the whole surface at once rather than these four, drop the tag filter:

```ts
new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"]);
```

Expect that to go red immediately, here and probably elsewhere. It was left out
deliberately: turning it on is a decision to triage a backlog, and it should be
taken on a day when going red is affordable.
