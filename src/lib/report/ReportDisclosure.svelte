<script lang="ts">
  import { CircleArrowDown } from "@lucide/svelte";
  import type { Snippet } from "svelte";

  // The report's collapsed sections. This follows the Accordion slice's
  // disclosure contract exactly — same aria wiring, same pure-CSS grid reveal,
  // same `inert` while closed — rather than introducing a second disclosure
  // pattern on the site. It differs only in taking a snippet instead of Prismic
  // RichText, which is why it is a component here and not that slice.
  //
  // The report is a page, not a CMS document, so there is no slice data to hang
  // this off.

  let {
    title,
    label,
    headingTag = "h3",
    open = $bindable(false),
    children,
  }: {
    title: string;
    /** Richer collapsed content for the toggle — a rank number, status chips —
     *  where a bare string cannot carry it. `title` is still required when this
     *  is passed: it stays the toggle's accessible name, so the button always
     *  announces something a screen reader can act on regardless of how the
     *  visible label is laid out. Added so the fix list could collapse without
     *  forking a second disclosure pattern, per the note above. */
    label?: Snippet;
    /** The report's sections are h2, so items nest as h3 by default. Pass a
     *  different level only to keep the document's heading order unbroken —
     *  never to change how it looks. */
    headingTag?: "h2" | "h3" | "h4";
    open?: boolean;
    children: Snippet;
  } = $props();

  // SSR-stable unique base so aria-controls / aria-labelledby never collide
  // when several disclosures share a page — and this page has many.
  const uid = $props.id();
  const panelId = `report-panel-${uid}`;
  const buttonId = `report-button-${uid}`;
</script>

<div class="border-b border-light">
  <svelte:element this={headingTag} class="m-0 type-question text-mid">
    <button
      id={buttonId}
      type="button"
      class="group flex w-full items-center gap-5 py-5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      aria-expanded={open}
      aria-controls={panelId}
      onclick={() => (open = !open)}
    >
      <span
        class="min-w-0 flex-1 wrap-break-word transition-colors group-hover:text-black motion-reduce:transition-none"
      >
        {#if label}
          <!-- The visible label. `title` still names the button for assistive
               tech via the sr-only span, so a snippet that lays out chips and
               numbers cannot leave the control unnamed. -->
          <span class="sr-only">{title}</span>
          <span aria-hidden="true">{@render label()}</span>
        {:else}
          {title}
        {/if}
      </span>
      <!-- One glyph, rotated: down = collapsed, up = expanded. The bare
           `transition` is deliberate — v4's rotate-* sets the standalone
           `rotate` property, and the default property list is the only one
           covering both `rotate` and `color`. -->
      <span
        class="shrink-0 text-light transition duration-300 ease-out group-hover:text-mid motion-reduce:transition-none {open
          ? 'rotate-180'
          : ''}"
        aria-hidden="true"
      >
        <CircleArrowDown size={30} strokeWidth={1} />
      </span>
    </button>
  </svelte:element>

  <!-- grid 0fr→1fr animates height with no JS; the inner wrapper clips. `inert`
       while collapsed pulls the panel out of both the tab order and the
       accessibility tree, so a screen reader is not offered content the page is
       hiding. -->
  <div
    id={panelId}
    role="region"
    aria-labelledby={buttonId}
    class="grid transition-[grid-template-rows] duration-500 ease-out motion-reduce:transition-none"
    style="grid-template-rows: {open ? '1fr' : '0fr'}"
    inert={!open}
  >
    <div class="overflow-hidden">
      <!-- Right inset clears the 30px icon + 20px gutter so the body never runs
           under the toggle. -->
      <div class="pb-5 md:pr-12.5">
        {@render children()}
      </div>
    </div>
  </div>
</div>
