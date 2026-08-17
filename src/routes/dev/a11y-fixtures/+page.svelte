<script lang="ts">
  import type { Content, RichTextField } from "@prismicio/client";
  import { onMount } from "svelte";
  import LeadText from "$lib/slices/LeadText/index.svelte";
  import TextColumns from "$lib/slices/TextColumns/index.svelte";
  import Accordion from "$lib/slices/Accordion/index.svelte";

  // Hydration marker for interaction tests: onMount only runs client-side after
  // hydration, so `html[data-hydrated]` is a deterministic "the page is now
  // interactive" signal. Interacting before this races the first click away
  // (Playwright's actionability checks don't wait for framework hydration).
  onMount(() => document.documentElement.setAttribute("data-hydrated", "true"));

  // Minimal API-shaped rich text (a single paragraph). Fixtures render statically
  // (isAnimated: false) so nothing is opacity-hidden when axe scans on load.
  const rt = (text: string): RichTextField =>
    [{ type: "paragraph", text, spans: [] }] as unknown as RichTextField;

  const leadSlice: Content.LeadTextSlice = {
    id: "fixture-lead",
    slice_type: "lead_text",
    slice_label: null,
    variation: "default",
    version: "initial",
    primary: {
      eyebrow: "The Challenge",
      body: rt(
        "As a brand-new global media agency, CANVAS Worldwide wanted to “do business differently”; they needed an identity on a tight timeline to communicate that message from day one.",
      ),
      isAnimated: false,
      hide: false,
    },
    items: [],
  };

  const columnsSlice: Content.TextColumnsSlice = {
    id: "fixture-columns",
    slice_type: "text_columns",
    slice_label: null,
    variation: "default",
    version: "initial",
    primary: {
      eyebrow: "Our Solution",
      hasTopRule: true,
      desktopColumns: "3",
      columns: [
        { title: "Straight A Design", body: rt("Imagination on a blank canvas.") },
        { title: "Collective Buy-In", body: rt("A standing ovation from leadership.") },
        { title: "Collaborative Effort", body: rt("A bold, thought-provoking solution.") },
      ],
      isAnimated: false,
      hide: false,
    },
    items: [],
  };

  const accordionOpen: Content.AccordionSlice = {
    id: "fixture-accordion-open",
    slice_type: "accordion",
    slice_label: null,
    variation: "default",
    version: "initial",
    primary: {
      defaultOpen: true,
      items: [
        {
          title: "About Canvas Worldwide",
          body: rt("A joint venture between INNOCEAN Worldwide and Horizon Media."),
        },
      ],
      hide: false,
    },
    items: [],
  };

  // Second instance starts collapsed to exercise the inert (removed from a11y
  // tree + tab order) branch under axe.
  const accordionClosed: Content.AccordionSlice = {
    ...accordionOpen,
    id: "fixture-accordion-closed",
    primary: {
      defaultOpen: false,
      hide: false,
      items: [
        {
          title: "About (collapsed)",
          body: rt("This panel starts collapsed and is inert until expanded."),
        },
      ],
    },
  };

  // Regression lock for the review findings: an eyebrow-less TextColumns must
  // promote its column titles to h2 (no h1→h3 skip), and duplicate/blank titles
  // must not throw each_key_duplicate (columns are keyed by index, not title).
  // If either fix regresses, this fixture crashes the page → the axe gate fails.
  const columnsEdge: Content.TextColumnsSlice = {
    id: "fixture-columns-edge",
    slice_type: "text_columns",
    slice_label: null,
    variation: "default",
    version: "initial",
    primary: {
      eyebrow: "",
      hasTopRule: false,
      desktopColumns: "3",
      columns: [
        { title: "Shared metric", body: rt("First column.") },
        { title: "Shared metric", body: rt("Duplicate title — index-keyed, no crash.") },
        { title: "", body: rt("Blank title renders no heading.") },
      ],
      isAnimated: false,
      hide: false,
    },
    items: [],
  };

  // Accordion with duplicate item titles — index-keyed, so it renders instead of
  // throwing each_key_duplicate. (Distinct name from the other fixtures so the
  // smoke tests' by-name lookups stay unambiguous.)
  const accordionDup: Content.AccordionSlice = {
    id: "fixture-accordion-dup",
    slice_type: "accordion",
    slice_label: null,
    variation: "default",
    version: "initial",
    primary: {
      defaultOpen: false,
      items: [
        { title: "Repeated disclosure", body: rt("First.") },
        { title: "Repeated disclosure", body: rt("Second, same title.") },
      ],
      hide: false,
    },
    items: [],
  };
</script>

<svelte:head>
  <title>a11y fixtures — Reddoor</title>
  <!-- Test-harness target, not a public page: keep it out of search indexes
       (robots.txt also Disallows /dev/). The route still renders so the
       Lighthouse/axe harness can hit it. -->
  <meta name="robots" content="noindex" />
  <meta
    name="description"
    content="Reddoor accessibility fixtures — semantic landmarks, heading hierarchy, and a stable target for @lhci/cli and Playwright + axe-core coverage. Not linked from the public site."
  />
</svelte:head>

<!-- No <main> here: the root layout already wraps every page in
     <main id="main-content">. A second <main> would nest/duplicate the main
     landmark (axe: landmark-no-duplicate-main / landmark-main-is-top-level). -->
<div class="min-h-screen bg-white p-8 text-black">
  <header>
    <h1>Accessibility fixtures</h1>
    <p>
      This page exists so <code>@lhci/cli</code> and Playwright + axe-core have a stable target with predictable
      a11y characteristics. It is not linked from the public site.
    </p>
  </header>

  <section aria-labelledby="landmarks-heading">
    <h2 id="landmarks-heading">Landmarks</h2>
    <p>
      The root layout provides the single <code>main</code> landmark; each section here declares
      <code>aria-labelledby</code> matched to its heading id so screen readers and axe both see a clean
      outline.
    </p>
  </section>

  <section aria-labelledby="links-heading">
    <h2 id="links-heading">Links</h2>
    <p>
      <a href="/">Back to home</a> — relative link with descriptive visible text, so no
      <code>aria-label</code> override is needed.
    </p>
  </section>

  <!-- Portfolio intro slices (LeadText / TextColumns / Accordion). Rendered here
       so the axe gate (which scans /dev/a11y-fixtures) covers them. Each carries
       its own section heading (h2) + the columns' h3 children, so the outline
       stays skip-free. The collapsed accordion exercises the inert branch. -->
  <LeadText slice={leadSlice} />
  <TextColumns slice={columnsSlice} />
  <TextColumns slice={columnsEdge} />
  <Accordion slice={accordionOpen} />
  <Accordion slice={accordionClosed} />
  <Accordion slice={accordionDup} />
</div>
