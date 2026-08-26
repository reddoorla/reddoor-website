<script lang="ts">
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import ReportDisclosure from "$lib/report/ReportDisclosure.svelte";
  import ScoreBand from "$lib/report/ScoreBand.svelte";
  import FixList from "$lib/report/FixList.svelte";
  import SearchResults from "$lib/report/SearchResults.svelte";
  import { toReportView } from "$lib/report/model";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const view = $derived(toReportView(data.report));
  const who = $derived(view.businessName ?? "your business");

  const auditedOn = $derived(
    view.generatedAt
      ? new Date(view.generatedAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null,
  );

  const ANSWERED_LABEL = { yes: "Yes", partial: "Partial", no: "No" } as const;
</script>

<svelte:head>
  <title>Can AI find {who}?</title>
  <!-- The third of three independent guards, with robots.txt and the
       x-robots-tag set in +page.server.ts. Letting a prospect's report reach a
       search index is the one mistake here that cannot be walked back. -->
  <meta name="robots" content="noindex, nofollow, noarchive" />
</svelte:head>

<main class="flex w-full flex-col items-center pt-32 pb-24">
  <!-- ── Verdict ─────────────────────────────────────────────────────────── -->
  <ContentWidth class="flex flex-col gap-6">
    <p class="type-meta m-0 flex flex-wrap gap-x-6 gap-y-1 text-muted">
      <span class="type-eyebrow text-primary">{who}</span>
      <span>{view.url}</span>
      {#if auditedOn}<span>Audited {auditedOn}</span>{/if}
    </p>

    <h1 class="type-hero m-0 max-w-[20ch] text-black">Can AI find {who}?</h1>

    {#if view.narrative?.answers}
      <p class="type-lede m-0 max-w-[44ch] border-l-2 border-primary pl-6 text-dark">
        {view.narrative.answers}
      </p>
    {/if}
  </ContentWidth>

  <!-- ── The four numbers ────────────────────────────────────────────────── -->
  <div class="mt-14 w-full">
    <ScoreBand {view} />
  </div>

  <!-- ── What to fix, moved to the front ─────────────────────────────────── -->
  {#if view.fixes.length}
    <ContentWidth class="mt-20 flex flex-col gap-5">
      <p class="type-kicker m-0 text-primary">Start here</p>
      <h2 class="type-display m-0 max-w-[24ch] text-black">
        {view.fixes.length === 1
          ? "One thing to fix"
          : `${view.fixes.length} things to fix, in order`}
      </h2>
      <FixList fixes={view.fixes} />
    </ContentWidth>
  {/if}

  <!-- ── The live test ───────────────────────────────────────────────────── -->
  {#if view.categoryProbes.length}
    <ContentWidth class="mt-20 flex flex-col gap-5">
      <p class="type-kicker m-0 text-primary">The test</p>
      <h2 class="type-display m-0 max-w-[24ch] text-black">What buyers were shown instead</h2>
      <p class="m-0 max-w-[66ch] text-muted">
        We asked a live AI assistant the questions a buyer types before they have heard of you, and
        recorded every source it cited back.
      </p>
      <SearchResults probes={view.categoryProbes} businessName={view.businessName} />

      {#if view.brandedProbes.length}
        <ReportDisclosure title="What the engines said when asked about you by name">
          <div class="flex flex-col gap-5 pt-1">
            {#each view.brandedProbes as probe (probe.query)}
              <div class="flex flex-col gap-2">
                <p class="m-0 font-medium text-black">&ldquo;{probe.query}&rdquo;</p>
                <p class="m-0 max-w-[66ch] text-sm text-muted">
                  {probe.snippet}{probe.truncated ? "…" : ""}
                </p>
              </div>
            {/each}
            <p class="m-0 max-w-[66ch] text-sm text-muted">
              A branded search echoes your name back whether or not the engine knows anything real
              about you, so it is reported separately and never counted toward the visibility score.
            </p>
          </div>
        </ReportDisclosure>
      {/if}
    </ContentWidth>
  {/if}

  <!-- ── Namesake ────────────────────────────────────────────────────────── -->
  <!-- Surfaced as its own finding rather than an anonymous row in a competitor
       list. On the first real audit this was the most valuable thing the run
       produced and it rendered as one line among eight. -->
  {#if view.namesake}
    <ContentWidth class="mt-20 flex flex-col gap-5">
      <p class="type-kicker m-0 text-primary">Worth your attention</p>
      <div class="flex flex-col gap-4 border border-primary/30 bg-paper p-7">
        <h2 class="type-question m-0 max-w-[32ch] text-black">
          Someone else is answering to your name
        </h2>
        <p class="m-0 max-w-[66ch] text-muted">
          Across the searches we ran, <strong class="text-black">{view.namesake.domain}</strong> was
          cited {view.namesake.count}
          {view.namesake.count === 1 ? "time" : "times"} — more than any other source. It is a different
          company with a name close enough to yours that the engines have to disambiguate between you.
        </p>
        <p class="m-0 max-w-[66ch] text-muted">
          This is not something a page edit fixes on its own. It is worth a conversation.
        </p>
      </div>
    </ContentWidth>
  {/if}

  <!-- ── Buyer questions ─────────────────────────────────────────────────── -->
  {#if view.buyerQuestions.length}
    <ContentWidth class="mt-20 flex flex-col gap-5">
      <p class="type-kicker m-0 text-primary">Your content</p>
      <h2 class="type-display m-0 max-w-[26ch] text-black">
        What buyers can and cannot learn from your site
      </h2>

      <div class="grid grid-cols-1 gap-px border border-light bg-light sm:grid-cols-3">
        {#each [{ n: view.questionTally.yes, l: "Answered clearly", bad: false }, { n: view.questionTally.partial, l: "Partly answered", bad: false }, { n: view.questionTally.no, l: "Not answered at all", bad: true }] as cell (cell.l)}
          <div class="flex flex-col gap-1 bg-white p-5">
            <p class="type-display m-0 leading-none {cell.bad ? 'text-primary' : 'text-black'}">
              {cell.n}
            </p>
            <p class="m-0 text-sm text-muted">{cell.l}</p>
          </div>
        {/each}
      </div>

      <ReportDisclosure
        title="See all {view.buyerQuestions.length} questions and what your site says about each"
      >
        <div class="overflow-x-auto pt-1">
          <table class="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr>
                <th
                  class="border-b border-light py-2 pr-4 text-left text-xs tracking-widest text-muted uppercase"
                >
                  What buyers ask
                </th>
                <th
                  class="border-b border-light py-2 text-left text-xs tracking-widest text-muted uppercase"
                >
                  On your site
                </th>
              </tr>
            </thead>
            <tbody>
              {#each view.buyerQuestions as q (q.question)}
                <tr>
                  <td class="border-b border-light py-2.5 pr-4 align-top text-muted"
                    >{q.question}</td
                  >
                  <td
                    class="border-b border-light py-2.5 align-top text-xs font-semibold tracking-widest uppercase {q.answered ===
                    'no'
                      ? 'text-primary'
                      : 'text-muted'}"
                  >
                    {ANSWERED_LABEL[q.answered]}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <p class="m-0 max-w-[66ch] pt-4 text-sm text-muted">
          &ldquo;Partial&rdquo; means the information exists but not in a passage an engine could
          quote back — usually a list of terms rather than a sentence.
        </p>
      </ReportDisclosure>
    </ContentWidth>
  {/if}

  <!-- ── How we measured ─────────────────────────────────────────────────── -->
  <ContentWidth class="mt-20 flex flex-col gap-5">
    <p class="type-kicker m-0 text-primary">Under the hood</p>
    <h2 class="type-display m-0 max-w-[24ch] text-black">How we measured this</h2>

    <ReportDisclosure title="What we ran, and what we could not measure">
      <div class="flex max-w-[66ch] flex-col gap-3 pt-1 text-muted">
        <p class="m-0">
          We crawled your site twice over — once as a plain request and once with a real browser —
          so we could measure how much of each page depends on JavaScript. Most AI crawlers run
          none.
        </p>
        {#if view.categoryProbes.length || view.brandedProbes.length}
          <p class="m-0">
            The visibility test ran {view.categoryProbes.length + view.brandedProbes.length} live searches.
            Every source listed is a citation the engine actually returned, not something inferred from
            its wording.
          </p>
        {/if}
        <p class="m-0">
          <strong class="text-black">What we did not measure:</strong> we tested one AI assistant, not
          all of them. Results vary between engines and change over time, which is the argument for measuring
          again rather than treating any single number as fixed.
        </p>
        <p class="m-0">
          Every finding here is one you can reproduce. If any of it looks wrong, tell us — we would
          rather correct it than defend it.
        </p>
      </div>
    </ReportDisclosure>
  </ContentWidth>

  <!-- ── Close ───────────────────────────────────────────────────────────── -->
  <ContentWidth class="mt-20 flex flex-col gap-4 bg-paper p-10">
    <p class="type-kicker m-0 text-primary">Next</p>
    <h2 class="type-display m-0 max-w-[22ch] text-black">
      Half an hour, and we will walk you through it
    </h2>
    <p class="m-0 max-w-[52ch] text-muted">
      No pitch deck. We will go through these findings live, answer whatever the report raised, and
      tell you honestly which parts you can handle in-house.
    </p>
    <a
      href="/contact"
      class="type-question mt-2 self-start border-b-2 border-primary pb-1 text-black transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
    >
      Start a conversation
    </a>
  </ContentWidth>
</main>
