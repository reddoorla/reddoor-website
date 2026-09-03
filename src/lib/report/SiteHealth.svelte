<script lang="ts">
  import ReportDisclosure from "./ReportDisclosure.svelte";
  import { healthRows } from "./health";
  import type { ReportView } from "./model";

  // Whether the site works — checked the way a stranger would check it.
  //
  // These sit under "What you control" because every one of them is a site edit
  // with a before and an after, which is the whole basis on which this half of
  // the report is allowed to promise anything.
  //
  // THE LAYOUT IS THE ARGUMENT. An earlier version gave every check a full row,
  // so on a healthy site the loudest thing in a section headed "Does it work"
  // was a row reading "Copyright year — 2026 — Current". Now only a finding
  // gets a row. Everything that passed is a receipt, and the receipts for the
  // whole page live in one place, under "What passes" — a reader who wants to
  // know how much was checked opens that; a reader who wants to know what is
  // wrong is not made to scroll past sixteen things that are not.
  //
  // The rows themselves are computed in health.ts so that list can be shared.

  let { view }: { view: ReportView } = $props();

  const mb = (bytes: number): string => (bytes / 1_000_000).toFixed(1);
  const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

  const rows = $derived(healthRows(view));
  const problems = $derived(rows.filter((r) => r.alert));

  const hasReceipts = $derived(
    Boolean(
      view.assets &&
      (view.assets.brokenLinks.length > 0 ||
        view.assets.brokenImages.length > 0 ||
        view.assets.heaviestImages.length > 0),
    ) || Boolean(view.basics && view.basics.mixedContent.imageUrls.length > 0),
  );
</script>

{#if rows.length === 0}
  <p class="type-lede m-0 text-muted">
    These checks did not run on this audit. That is a gap in the measurement, not a finding about
    your site.
  </p>
{:else}
  <div class="flex flex-col gap-10">
    <p class="type-lede m-0 text-black">
      {#if problems.length === 0}
        We ran {rows.length} checks on the things that quietly cost you visitors, and every one of them
        came back clean.
      {:else}
        Of {rows.length} checks, {problems.length}
        {plural(problems.length, "is", "are")} worth your attention.
      {/if}
    </p>

    {#if problems.length === 0}
      <p class="type-meta m-0 text-muted">
        They are listed under <a class="underline" href="#passes">what passes</a>.
      </p>
    {:else}
      <!-- The findings, at full weight. -->
      <ul class="m-0 flex w-full flex-col list-none p-0">
        {#each problems as row (row.key)}
          <li class="flex flex-col gap-1.5 border-t border-light py-6">
            <div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <p class="type-eyebrow m-0 text-primary">{row.label}</p>
              <p class="type-question m-0 text-primary">{row.value}</p>
            </div>
            <p class="type-meta m-0 text-muted">{row.detail}</p>
          </li>
        {/each}
      </ul>
    {/if}

    <!-- The receipts. Every finding above names something a reader can open in
         another tab and check for themselves, which is the difference between
         a report and an assertion. -->
    {#if hasReceipts}
      <div class="flex flex-col border-t border-light">
        <ReportDisclosure headingTag="h4" title="See exactly what we found, with the addresses">
          <div class="flex flex-col gap-6 pt-1">
            {#if view.assets && view.assets.brokenLinks.length > 0}
              <div class="flex flex-col gap-2">
                <p class="type-eyebrow m-0 text-dark">Links that did not load</p>
                {#each view.assets.brokenLinks.slice(0, 12) as item (item.url)}
                  <p class="type-meta m-0 break-all text-muted">
                    <span class="font-medium text-primary">{item.status}</span>
                    {item.url}
                    <span class="text-muted"
                      >— linked from {item.referencedBy.length}
                      {plural(item.referencedBy.length, "page", "pages")}</span
                    >
                  </p>
                {/each}
              </div>
            {/if}

            {#if view.assets && view.assets.brokenImages.length > 0}
              <div class="flex flex-col gap-2">
                <p class="type-eyebrow m-0 text-dark">Images that did not load</p>
                {#each view.assets.brokenImages.slice(0, 12) as item (item.url)}
                  <p class="type-meta m-0 break-all text-muted">
                    <span class="font-medium text-primary">{item.status}</span>
                    {item.url}
                  </p>
                {/each}
              </div>
            {/if}

            {#if view.basics && view.basics.mixedContent.imageUrls.length > 0}
              <div class="flex flex-col gap-2">
                <p class="type-eyebrow m-0 text-dark">Images requested over plain http</p>
                {#each view.basics.mixedContent.imageUrls as url (url)}
                  <p class="type-meta m-0 break-all text-muted">{url}</p>
                {/each}
              </div>
            {/if}

            {#if view.assets && view.assets.heaviestImages.length > 0}
              <div class="flex flex-col gap-2">
                <p class="type-eyebrow m-0 text-dark">Heaviest images</p>
                {#each view.assets.heaviestImages as item (item.url)}
                  <p class="type-meta m-0 break-all text-muted">
                    <span class="font-medium text-black tabular-nums">{mb(item.bytes ?? 0)} MB</span
                    >
                    {item.url}
                  </p>
                {/each}
              </div>
            {/if}
          </div>
        </ReportDisclosure>
      </div>
    {/if}
  </div>
{/if}
