<script lang="ts">
  import { GOAL_LABELS, goalVerdict, type GoalRequirement, type ReportView } from "./model";
  import { numberWord } from "./narrative";

  // Whether the site does the one job it exists to do.
  //
  // This opens the report, ahead of every score, because it is the only section
  // framed in the reader's terms rather than ours. "Findability 82" is a number
  // about our method. "Nobody can book without calling you" is a sentence about
  // their business, and it is the one they will read out loud to a colleague.
  //
  // THE ORDER IS THE ARGUMENT, and it is the only place the commercial ladder
  // appears. Missing things come first, cheapest to fix first: a tappable phone
  // number is an afternoon, a published price is a content engagement, and "no
  // way to book without calling" is a build. A reader meets the small things
  // first, agrees with them, and arrives at the structural ones already
  // persuaded. The report never says "tier", never names a service and never
  // prices anything — if the ordering has done its work the conversation starts
  // itself.
  //
  // Requirements we could not judge sink to the bottom and are excluded from
  // the count. "4 of 5" must never quietly include something we did not look at.

  let { view }: { view: ReportView } = $props();

  const fit = $derived(view.goalFit);
  const who = $derived(view.businessName ?? "this business");

  const SCOPE_ORDER = { quick: 0, content: 1, structural: 2 } as const;
  const STATUS_ORDER = { missing: 0, met: 1, unmeasured: 2 } as const;

  const ordered = $derived.by((): GoalRequirement[] =>
    [...(fit?.requirements ?? [])].sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        SCOPE_ORDER[a.scope] - SCOPE_ORDER[b.scope],
    ),
  );

  const missing = $derived(ordered.filter((r) => r.status === "missing"));
  const unmeasured = $derived(ordered.filter((r) => r.status === "unmeasured"));
  const judged = $derived(ordered.filter((r) => r.status !== "unmeasured"));

  const verdict = $derived(goalVerdict(missing.length, judged.length));
</script>

{#if !fit}
  <p class="type-lede m-0 text-muted">
    This check did not run on this audit. That is a gap in the measurement, not a finding about your
    site.
  </p>
{:else if fit.goal === "unknown"}
  <!-- A real measurement, not a failure. We read every page and could not tell
       what the site is for — which is a finding about the site, so it must not
       be dressed up as an apology from us. No checklist is rendered on purpose:
       grading against a purpose we could not identify would report our own
       guess as their failing. -->
  <div class="flex flex-col gap-5">
    <p class="type-lede m-0 text-primary">
      We read every page and could not tell what {who} wants a visitor to actually do.
    </p>
    <p class="m-0 text-muted">
      That is not a criticism of the writing — it is a finding about the structure. Sites that
      convert push toward one action, and the whole page arranges itself around it. When nothing is
      being asked for, a visitor who is interested has to invent their own next step, and most of
      them do not.
    </p>
    <p class="m-0 text-muted">
      It is also the first thing worth fixing, because every other finding in this report is
      measured against it.
    </p>
  </div>
{:else}
  <div class="flex flex-col gap-10">
    <div class="flex flex-col gap-4">
      <p class="type-lede m-0 text-black">
        {#if fit.source === "operator"}
          You told us your site is built to get a visitor to
          <strong>{GOAL_LABELS[fit.goal] ?? fit.goal}</strong>.
        {:else}
          As far as we can tell from reading it, your site is built to get a visitor to
          <strong>{GOAL_LABELS[fit.goal] ?? fit.goal}</strong>.
        {/if}
        {verdict}
      </p>
      {#if fit.source === "inferred"}
        <!-- Said plainly. If we inferred it wrong the reader should be able to
             tell us, and a reader who disagrees with the premise has just told
             us something more useful than any check below. -->
        <p class="type-meta m-0 text-muted">
          We worked that out from the site itself rather than asking you. If it is wrong, say so —
          that in itself is worth knowing, because it is what a visitor would have concluded too.
        </p>
      {/if}
    </div>

    <!-- Findings only. The requirements that are met are receipts, not
         findings, and they are listed with every other pass on the page
         rather than given a row each here. -->
    {#if missing.length > 0}
      <ul class="m-0 flex w-full flex-col list-none p-0">
        {#each missing as row (row.key)}
          <li class="flex flex-col gap-1.5 border-t border-light py-6">
            <div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <p class="type-eyebrow m-0 text-primary">{row.label}</p>
              <p class="type-question m-0 text-primary">Not on the site</p>
            </div>
            <p class="type-meta m-0 text-muted">{row.why}</p>
            <!-- A missing row can carry evidence too: it names the stranded
                 pages and how many of how many we examined. Shown under the
                 reason, not instead of it. -->
            {#if row.evidence}
              <p class="type-meta m-0 wrap-break-word text-muted">{row.evidence}</p>
            {/if}
          </li>
        {/each}
      </ul>
    {:else if judged.length > 0}
      <p class="type-meta m-0 text-muted">
        All {numberWord(judged.length)} of the things it needs are in place. They are listed under
        <a class="underline" href="#passes">what passes</a>.
      </p>
    {/if}

    {#if unmeasured.length > 0}
      <div class="flex flex-col gap-2 border-t border-light pt-6">
        <p class="type-eyebrow m-0 text-dark">Not measured on this audit</p>
        <p class="type-meta m-0 text-muted">
          {unmeasured.map((r) => r.label.toLowerCase()).join(", ")} — these are not counted above in either
          direction. We could not check them here, which is a gap in the measurement rather than a finding
          about your site.
        </p>
      </div>
    {/if}
  </div>
{/if}
