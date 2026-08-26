<script lang="ts">
  import ReportDisclosure from "./ReportDisclosure.svelte";
  import type { ReportView } from "./model";

  // What is broken, what is heavy, and whether anyone can actually reach you.
  //
  // These sit under "What you control" because every one of them is a site
  // edit with a before and an after — which is the whole basis on which this
  // half of the report is allowed to promise anything.
  //
  // Each row is a finding, not a score. A count of broken links is a fact a
  // reader can go and check in thirty seconds; a "site health score" would be
  // another number we invented and then graded people against. Where a check
  // could not run, the row says so rather than rendering a reassuring zero —
  // "we did not measure" and "nothing was wrong" are opposite claims and only
  // one of them is ours to make.

  let { view }: { view: ReportView } = $props();

  const mb = (bytes: number): string => (bytes / 1_000_000).toFixed(1);

  type Row = {
    key: string;
    label: string;
    /** The finding in a phrase. Null when the check did not run. */
    value: string | null;
    /** Is this worth their attention? Drives the only colour on the row. */
    alert: boolean;
    detail: string;
  };

  const rows = $derived.by((): Row[] => {
    const out: Row[] = [];
    const assets = view.assets;
    const journey = view.journey;
    const consistency = view.consistency;

    // ── Broken things ──────────────────────────────────────────────────
    if (assets) {
      const broken = assets.brokenLinks.length + assets.brokenImages.length;
      out.push({
        key: "broken",
        label: "Broken links and images",
        value: broken === 0 ? "None found" : `${broken} found`,
        alert: broken > 0,
        // The denominator, always. Saying "no broken links" having tested 40
        // of 200 is the kind of quiet overclaim this report exists not to make.
        detail:
          `We checked ${assets.linksChecked} of ${assets.linksFound} links and ` +
          `${assets.imagesChecked} of ${assets.imagesFound} images.`,
      });

      // ── Weight ───────────────────────────────────────────────────────
      // Null, not zero: a server that does not report content-length leaves
      // this genuinely unknown, and printing "0 MB of images" for a page full
      // of photographs would be a lie the reader can see through.
      if (assets.imageBytesMeasured !== null) {
        const heaviest = assets.heaviestImages.at(0);
        out.push({
          key: "weight",
          label: "Image weight",
          value: `${mb(assets.imageBytesMeasured)} MB across ${assets.imagesWithKnownSize} images`,
          alert: (heaviest?.bytes ?? 0) >= 1_000_000,
          detail: heaviest
            ? `The heaviest single image is ${mb(heaviest.bytes ?? 0)} MB. On a phone, that is the ` +
              `difference between a page that appears and one that is still loading when the visitor leaves.`
            : "No single image is large enough to be worth calling out.",
        });
      }
    }

    // ── Reaching you ───────────────────────────────────────────────────
    if (journey) {
      const dead = journey.deadEnds.length;
      const worst = journey.worstClicksToContact;
      out.push({
        key: "contact",
        label: "Getting hold of you",
        value:
          journey.affordances.length === 0
            ? "No way to make contact found"
            : dead > 0
              ? `${dead} of ${journey.pagesExamined} pages offer no route`
              : worst === 0
                ? "Every page offers a way"
                : `At most ${worst} click${worst === 1 ? "" : "s"} away`,
        alert: journey.affordances.length === 0 || dead > 0,
        detail:
          `Search engines send people to whichever page answers their question, not to your home ` +
          `page — so we measured this from all ${journey.pagesExamined} pages we looked at, not just the first.`,
      });
    }

    // ── Saying the same thing everywhere ───────────────────────────────
    if (consistency) {
      if (consistency.phones.length > 0) {
        out.push({
          key: "phones",
          label: "Phone numbers",
          value:
            consistency.phones.length === 1
              ? "One, used consistently"
              : `${consistency.phones.length} different numbers`,
          alert: consistency.phones.length > 1,
          detail:
            consistency.phones.length === 1
              ? "The same number everywhere it appears, however it is written."
              : "A visitor cannot tell which one is current, and anything trying to reconcile your business across sources sees it disagreeing with itself.",
        });
      }

      if (consistency.newestCopyrightYear !== null) {
        // Compared against the audit's own date rather than today's, so a
        // report reread next year does not silently change its own findings.
        const auditYear = view.generatedAt ? new Date(view.generatedAt).getFullYear() : null;
        const stale = auditYear !== null && auditYear - consistency.newestCopyrightYear >= 2;
        out.push({
          key: "copyright",
          label: "Copyright year",
          value: String(consistency.newestCopyrightYear),
          alert: stale,
          detail: stale
            ? "It reads as a site nobody has touched in years — to every visitor, on every page."
            : "Current.",
        });
      }

      if (consistency.pagesOffTemplate.length > 0) {
        out.push({
          key: "template",
          label: "Pages outside your template",
          value: `${consistency.pagesOffTemplate.length} found`,
          alert: true,
          detail:
            "These carry none of your site's navigation. Someone who lands on one is in a different website with no way back into this one.",
        });
      }
    }

    return out;
  });

  const problems = $derived(rows.filter((r) => r.alert));
</script>

{#if rows.length === 0}
  <p class="type-lede m-0 max-w-[52ch] text-muted">
    These checks did not run on this audit. That is a gap in the measurement, not a finding about
    your site.
  </p>
{:else}
  <div class="flex flex-col gap-10">
    <p class="type-lede m-0 max-w-[52ch] text-black">
      {#if problems.length === 0}
        We went looking for the things that quietly cost you visitors, and did not find them.
      {:else}
        {problems.length}
        {problems.length === 1 ? "thing here is" : "things here are"} worth your attention.
      {/if}
    </p>

    <dl class="m-0 flex w-full flex-col">
      {#each rows as row (row.key)}
        <div class="flex flex-col gap-1.5 border-t border-light py-6">
          <div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <dt class="type-eyebrow m-0 {row.alert ? 'text-primary' : 'text-dark'}">{row.label}</dt>
            <dd class="type-question m-0 {row.alert ? 'text-primary' : 'text-black'}">
              {row.value}
            </dd>
          </div>
          <p class="type-meta m-0 max-w-[62ch] text-muted">{row.detail}</p>
        </div>
      {/each}
    </dl>

    <!-- The receipts. Every finding above names something a reader can open in
         another tab and check for themselves, which is the difference between
         a report and an assertion. -->
    {#if view.assets && (view.assets.brokenLinks.length > 0 || view.assets.brokenImages.length > 0 || view.assets.heaviestImages.length > 0)}
      <div class="flex flex-col border-t border-light">
        <ReportDisclosure title="See exactly what we found, with the addresses">
          <div class="flex flex-col gap-6 pt-1">
            {#if view.assets.brokenLinks.length > 0}
              <div class="flex flex-col gap-2">
                <p class="type-eyebrow m-0 text-dark">Links that did not load</p>
                {#each view.assets.brokenLinks.slice(0, 12) as item (item.url)}
                  <p class="m-0 text-sm break-all text-muted">
                    <span class="font-medium text-primary">{item.status}</span>
                    {item.url}
                    <span class="text-light"
                      >— linked from {item.referencedBy.length} page{item.referencedBy.length === 1
                        ? ""
                        : "s"}</span
                    >
                  </p>
                {/each}
              </div>
            {/if}

            {#if view.assets.brokenImages.length > 0}
              <div class="flex flex-col gap-2">
                <p class="type-eyebrow m-0 text-dark">Images that did not load</p>
                {#each view.assets.brokenImages.slice(0, 12) as item (item.url)}
                  <p class="m-0 text-sm break-all text-muted">
                    <span class="font-medium text-primary">{item.status}</span>
                    {item.url}
                  </p>
                {/each}
              </div>
            {/if}

            {#if view.assets.heaviestImages.length > 0}
              <div class="flex flex-col gap-2">
                <p class="type-eyebrow m-0 text-dark">Heaviest images</p>
                {#each view.assets.heaviestImages as item (item.url)}
                  <p class="m-0 text-sm break-all text-muted">
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
