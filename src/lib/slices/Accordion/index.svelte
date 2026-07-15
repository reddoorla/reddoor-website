<script lang="ts">
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import RichTextBody from "$lib/components/RichTextBody.svelte";
  import { Plus, Minus } from "@lucide/svelte";
  import { untrack } from "svelte";
  import type { Content } from "@prismicio/client";

  let { slice }: { slice: Content.AccordionSlice } = $props();

  // SSR-stable unique base so aria-controls / aria-labelledby ids don't collide
  // when the slice appears more than once on a page.
  const uid = $props.id();
  const panelId = (i: number) => `acc-panel-${uid}-${i}`;
  const buttonId = (i: number) => `acc-button-${uid}-${i}`;

  // Per-item open state, seeded once from the authored defaultOpen (runs on both
  // SSR and client so the initial markup matches — no hydration flash). `untrack`
  // marks the read as intentional-initial-value, not a reactive dependency.
  let open = $state(
    untrack(() => slice.primary.items.map(() => slice.primary.defaultOpen ?? false)),
  );
</script>

{#if !slice.primary.hide}
  <section
    data-slice-type={slice.slice_type}
    data-slice-variation={slice.variation}
    class="w-full py-7.5"
  >
    <ContentWidth>
      <div class="w-full md:w-3/5 mx-auto flex flex-col gap-4">
        <!-- Key by index (matches the index-addressed `open` state): `title` is
             optional + non-unique, so keying on it would throw each_key_duplicate
             on blank/repeated titles. -->
        {#each slice.primary.items as item, i (i)}
          <div class="rounded-[10px] bg-[#f3f5f1]/50 p-5">
            <!-- Disclosure header: the button IS the toggle (aria-expanded), wrapped
                 in an h2 so it takes part in the page outline (masthead h1 → h2). -->
            <h2 class="m-0">
              <button
                id={buttonId(i)}
                type="button"
                class="group flex w-full items-center justify-between gap-6 text-left"
                aria-expanded={open[i]}
                aria-controls={panelId(i)}
                onclick={() => (open[i] = !open[i])}
              >
                <span class="font-sans text-base font-bold leading-normal text-primary">
                  {item.title}
                </span>
                <span
                  class="flex size-12.5 shrink-0 items-center justify-center rounded-full border border-light text-mid transition-colors group-hover:border-mid"
                  aria-hidden="true"
                >
                  {#if open[i]}
                    <Minus size={28} strokeWidth={1} />
                  {:else}
                    <Plus size={28} strokeWidth={1} />
                  {/if}
                </span>
              </button>
            </h2>

            <!-- Pure-CSS reveal: grid 0fr→1fr animates height without JS; the inner
                 wrapper clips the overflow. `inert` while collapsed removes the
                 panel from tab order + the a11y tree (and satisfies
                 aria-hidden-focus for any links inside). Reduced motion → instant. -->
            <div
              id={panelId(i)}
              role="region"
              aria-labelledby={buttonId(i)}
              class="grid transition-[grid-template-rows] duration-500 ease-out motion-reduce:transition-none"
              style="grid-template-rows: {open[i] ? '1fr' : '0fr'}"
              inert={!open[i]}
            >
              <div class="overflow-hidden">
                <div class="acc-body pt-2.5">
                  <RichTextBody field={item.body} />
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </ContentWidth>
  </section>
{/if}

<style>
  /* Small sans body (Pragmatica Extra Light 16), matching the columns copy. */
  .acc-body :global(p) {
    font-size: 16px;
    font-weight: 200;
    line-height: 1.5;
    color: #000;
  }
  .acc-body :global(p:not(:last-child)) {
    margin-bottom: 0.75rem;
  }
  .acc-body :global(a) {
    color: #d71920;
    text-decoration: underline;
    transition: color 400ms;
  }
  .acc-body :global(a:hover) {
    color: #aa1419;
  }
</style>
