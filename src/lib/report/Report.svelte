<script lang="ts">
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import RailRow from "$lib/components/RailRow.svelte";
  import ReportDisclosure from "./ReportDisclosure.svelte";
  import ScoreBars from "./ScoreBars.svelte";
  import GoalFit from "./GoalFit.svelte";
  import SourceCheck from "./SourceCheck.svelte";
  import SiteHealth from "./SiteHealth.svelte";
  import Standing from "./Standing.svelte";
  import QuestionMeter from "./QuestionMeter.svelte";
  import FixList from "./FixList.svelte";
  import SearchResults from "./SearchResults.svelte";
  import WhatPasses from "./WhatPasses.svelte";
  import { openingSummary, type ReportView } from "./model";
  import { allFixes, headlineFinding } from "./narrative";

  // The report body, shared by the token route and the fixture route.
  //
  // ONE NARRATIVE, in this order: the headline finding; what an AI already says
  // about them and where they stand in its answers; what they control, in
  // three checks; everything that passed, in one openable section; the fixes;
  // how we measured. "Answer the questions, then inform." A reader who stops
  // after the hero has the most important thing; a reader who stops after the
  // fixes has everything they need to act; the rest is the evidence.
  //
  // It is laid out on the same band rhythm as the industry landing pages:
  // full-bleed sections alternating white and the paper tile, each a RailRow
  // so every section's content column shares a left edge. `fill` on every row:
  // the content takes the whole ContentWidth beside the rail, because this is
  // a document with tables and lists, and the board's 760px measure read as
  // compressed. The rail label names each block (the site's own pattern) so
  // the subsection headings are the kicker, not a second type scale.

  let { view }: { view: ReportView } = $props();

  const who = $derived(view.businessName ?? "your business");
  const headline = $derived(headlineFinding(view));
  const fixes = $derived(allFixes(view));

  // Back to where you were reading.
  //
  // The page sends the reader down to the passes and the fixes with in-page
  // links, and a reader who follows one is then at the bottom of a long
  // document with no way back but the scrollbar. The browser's Back button
  // does return, but nobody trusts it to. So: on any in-page jump, remember
  // where the reader was, and offer a single control that takes them back
  // and then disappears. Delegated from the root so every link in every
  // section gets it without each one being wired.
  let root: HTMLElement | undefined = $state();
  let returnTo: number | null = $state(null);

  $effect(() => {
    const el = root;
    if (!el) return;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href^="#"]');
      if (!a || !el.contains(a)) return;
      returnTo = window.scrollY;
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  });

  function goBack() {
    const y = returnTo;
    returnTo = null;
    if (y !== null) window.scrollTo({ top: y, behavior: "auto" });
  }

  const auditedOn = $derived(
    view.generatedAt
      ? new Date(view.generatedAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null,
  );

  const ANSWERED_LABEL = {
    yes: "Yes",
    partial: "Partial",
    no: "No",
    unknown: "Not measured",
  } as const;

  /**
   * The domains one answer cited, most-cited first, each named once. The raw
   * list repeats a source once per citation; counted, repetition becomes a
   * number, which is the useful form of the same fact.
   */
  const sourceList = (domains: string[]): string => {
    const counts: Record<string, number> = {};
    for (const d of domains) counts[d] = (counts[d] ?? 0) + 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([domain, n]) => (n > 1 ? `${domain} (${n})` : domain))
      .join(" · ");
  };
</script>

<div bind:this={root} class="flex w-full flex-col">
  <!-- ── Masthead ────────────────────────────────────────────────────────── -->
  <!-- `pt-32` clears the fixed nav; the paper tile is the site's own texture. -->
  <section class="bg-paper w-full pt-32 pb-16 md:pb-24">
    <ContentWidth class="flex flex-col gap-6">
      <p class="type-meta m-0 flex flex-wrap gap-x-6 gap-y-1 text-muted">
        <span class="type-eyebrow text-primary">{who}</span>
        <span>{view.url}</span>
        {#if auditedOn}<span>Audited {auditedOn}</span>{/if}
      </p>

      <!-- "Can AI find you?" was a discovery promise on an instrument that
           measures verification. The report says what it can stand behind:
           when an engine — or a buyer — comes to check you out, what do they
           find. -->
      <h1 class="type-hero m-0 max-w-[20ch] text-black">When AI answers for {who}</h1>

      <!-- The one finding a reader would most regret not knowing, chosen by a
           fixed priority in narrative.ts rather than by whichever section
           happened to come first. -->
      <p
        class="type-lede m-0 border-l-2 pl-6 {headline.kind === 'all-clear'
          ? 'border-dark text-black'
          : 'border-primary text-black'}"
      >
        {headline.text}
      </p>

      <p class="type-meta m-0 text-muted">
        Read on for what we found and how we checked it, or
        <a class="underline" href="#fixes">jump to what to fix</a>.
      </p>
    </ContentWidth>
  </section>

  <!-- ── What an AI says about you ───────────────────────────────────────── -->
  <!-- First, because it is the section this report is named for: an engine
       describes them to strangers right now and they have never seen what it
       says. Unlike a score it needs no explanation of our method. -->
  <section class="w-full py-16 md:py-24">
    <ContentWidth class="relative">
      <h2 class="type-display m-0 text-black">What an AI says about you</h2>
      <hr class="mt-7.5 mb-7.5 border-primary" />
    </ContentWidth>

    <RailRow label="What it says" labelAs="h3" fill>
      <div class="flex flex-col gap-10">
        <p class="type-lede m-0 text-black">
          We asked a live AI assistant about {who} and took its answer apart statement by statement. Each
          one is sorted by where it came from — never by whether it is true. We cannot know that; you
          can.
        </p>
        <SourceCheck {view} />
      </div>
    </RailRow>

    <!-- Where they stand: measured out in the world, reported with receipts,
         promised never. A subsection here rather than its own band, because
         it is the same instrument pointed at a different question. -->
    {#if view.categoryProbes.length}
      <RailRow label="Where you stand" labelAs="h3" fill class="mt-16 md:mt-24">
        <div class="flex flex-col gap-10">
          <p class="type-lede m-0 text-black">
            We asked the assistant the questions a buyer types before they have heard of you, and
            recorded every source it cited back.
          </p>

          <Standing {view} />

          <div class="flex flex-col border-t border-light">
            <ReportDisclosure headingTag="h4" title="See each search we ran, and what came back">
              <SearchResults probes={view.categoryProbes} businessName={view.businessName} />
            </ReportDisclosure>

            {#if view.brandedProbes.length}
              <ReportDisclosure
                headingTag="h4"
                title="What the assistant said when asked about you by name"
              >
                <div class="flex flex-col gap-5 pt-1">
                  {#each view.brandedProbes as probe (probe.query)}
                    <div class="flex flex-col gap-2">
                      <p class="m-0 font-medium text-black">&ldquo;{probe.query}&rdquo;</p>
                      <p class="type-meta m-0 text-muted">
                        {probe.snippet}{probe.truncated ? "…" : ""}
                      </p>
                      {#if probe.citedDomains.length}
                        <p class="type-meta m-0 text-muted">
                          Sources: {sourceList(probe.citedDomains)}
                        </p>
                      {/if}
                    </div>
                  {/each}
                  <p class="type-meta m-0 text-muted">
                    A branded search cannot tell you whether someone who has never heard of you
                    would find you. It answers a different question, and for most businesses a more
                    useful one: when the assistant describes you, is it accurate, and is it reading
                    your site or somebody else's page about you.
                  </p>
                </div>
              </ReportDisclosure>
            {/if}
          </div>
        </div>
      </RailRow>
    {/if}
  </section>

  <!-- ── What you control ────────────────────────────────────────────────── -->
  <!-- The half of the report that moves because we edit the site, with a
       before and an after. The visibility measurement above does not behave
       that way and is deliberately not printed beside these. -->
  <section class="bg-paper w-full py-16 md:py-24">
    <ContentWidth class="relative">
      <h2 class="type-display m-0 text-black">What you control</h2>
      <hr class="mt-7.5 mb-7.5 border-primary" />
    </ContentWidth>

    <RailRow label="Your scores" labelAs="h3" fill>
      <div class="flex flex-col gap-10">
        <p class="type-lede m-0 text-black">
          Everything in this section is work on your own site, so every number here is one we can
          move and show you the before and after of.
        </p>
        <ScoreBars {view} />
      </div>
    </RailRow>

    <!-- Findings, not a score: a count of broken links is a fact the reader
         can check in thirty seconds. -->
    <RailRow label="Does it work" labelAs="h3" fill class="mt-16 md:mt-24">
      <SiteHealth {view} />
    </RailRow>

    <!-- Framed in the reader's terms rather than ours: "nobody can book
         without calling you" is a sentence about their business. -->
    {#if view.goalFit}
      <RailRow label="Does your site do its job" labelAs="h3" fill class="mt-16 md:mt-24">
        <GoalFit {view} />
      </RailRow>
    {/if}

    {#if view.buyerQuestions.length}
      <RailRow label="What buyers can and cannot learn" labelAs="h3" fill class="mt-16 md:mt-24">
        <div class="flex flex-col gap-10">
          <!-- Derived from the same verdicts the table prints, so it cannot
               say an answer exists where the table says No. -->
          {#if openingSummary(view)}
            <p class="type-lede m-0 text-black">{openingSummary(view)}</p>
          {/if}

          <QuestionMeter
            yes={view.questionTally.yes}
            partial={view.questionTally.partial}
            no={view.questionTally.no}
            unknown={view.questionTally.unknown}
          />

          <div class="flex flex-col border-t border-light">
            <ReportDisclosure
              headingTag="h4"
              title="See all {view.buyerQuestions
                .length} questions and what your site says about each"
            >
              <div class="overflow-x-auto pt-1">
                <table class="w-full min-w-[420px] border-collapse">
                  <thead>
                    <tr>
                      <th class="type-eyebrow border-b border-light py-2 pr-4 text-left text-muted">
                        What buyers ask
                      </th>
                      <th class="type-eyebrow border-b border-light py-2 pr-4 text-left text-muted">
                        On your site
                      </th>
                      <th class="type-eyebrow border-b border-light py-2 text-left text-muted">
                        What it says
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each view.buyerQuestions as q (q.question)}
                      <tr>
                        <td class="type-meta border-b border-light py-2.5 pr-4 align-top text-muted"
                          >{q.question}</td
                        >
                        <td
                          class="type-eyebrow border-b border-light py-2.5 pr-4 align-top {q.answered ===
                          'no'
                            ? 'text-primary'
                            : 'text-muted'}"
                        >
                          {ANSWERED_LABEL[q.answered]}
                        </td>
                        <!-- The receipt. A verdict with no passage beside it
                             is a claim the reader cannot check. -->
                        <td class="type-meta border-b border-light py-2.5 align-top text-muted">
                          {#if q.evidence}
                            &ldquo;{q.evidence}&rdquo;
                          {:else if q.answered === "unknown"}
                            not judged on this audit
                          {:else}
                            no passage an assistant could quote
                          {/if}
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
              <p class="type-meta m-0 pt-4 text-muted">
                &ldquo;Partial&rdquo; means the information exists but not in a passage an assistant
                could quote back — usually a list of terms rather than a sentence.
              </p>
            </ReportDisclosure>
          </div>
        </div>
      </RailRow>
    {/if}
  </section>

  <!-- ── What passes ─────────────────────────────────────────────────────── -->
  <!-- Every pass on the page, in one openable section. Nothing above lists a
       pass; this is where the receipts for breadth live. -->
  <section class="w-full py-16 md:py-24">
    <RailRow label="Checked and fine" labelAs="p" fill>
      <WhatPasses {view} />
    </RailRow>
  </section>

  <!-- ── What to fix ─────────────────────────────────────────────────────── -->
  <!-- Anchored from the hero: a reader who wants the remedy before the
       diagnosis jumps straight here. -->
  {#if fixes.length}
    <section id="fixes" class="bg-paper w-full scroll-mt-24 py-16 md:py-24">
      <ContentWidth class="relative">
        <h2 class="type-display m-0 text-primary">
          {fixes.length === 1 ? "One thing to fix" : `${fixes.length} things to fix, in order`}
        </h2>
        <hr class="mt-7.5 mb-7.5 border-primary" />
      </ContentWidth>
      <RailRow label="Start here" labelAs="p" fill>
        <FixList {fixes} />
      </RailRow>
    </section>
  {/if}

  {#if returnTo !== null}
    <!-- Fixed, bottom right, above the closing band. Rendered only after an
         in-page jump and gone after one use, so it never competes with the
         page when nobody needs it. -->
    <button
      type="button"
      class="type-eyebrow fixed right-6 bottom-6 z-30 rounded-full border border-dark bg-white px-4 py-2.5 text-dark shadow-md transition-colors hover:bg-dark hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      onclick={goBack}
    >
      ↑ Back to where you were
    </button>
  {/if}

  <!-- ── How we measured ─────────────────────────────────────────────────── -->
  <section class="w-full py-16 md:py-24">
    <RailRow label="Under the hood" labelAs="h2" fill>
      <div class="flex flex-col border-t border-light">
        <ReportDisclosure title="What we ran, and what we could not measure">
          <div class="flex flex-col gap-3 pt-1 text-muted">
            <p class="m-0">
              We crawled your site twice over — once as a plain request and once with a real browser
              — so we could measure how much of each page depends on JavaScript. Most AI crawlers
              run none.
            </p>
            {#if view.categoryProbes.length || view.brandedProbes.length}
              <p class="m-0">
                The visibility test ran {view.categoryProbes.length + view.brandedProbes.length} live
                searches. Every source listed is a citation the assistant actually returned, not something
                inferred from its wording.
              </p>
            {/if}
            <p class="m-0">
              <strong class="text-black">What we did not measure:</strong> we tested one AI assistant
              (Claude), not all of them. Results vary between assistants and change over time, which is
              the argument for measuring again rather than treating any single number as fixed.
            </p>
            <!-- Deliberately in the methodology section rather than the findings:
                 llms.txt is neither scored nor recommended, and this paragraph
                 says so instead of leaving its absence to be noticed. -->
            <p class="m-0">
              <strong class="text-black">A note on llms.txt.</strong> If you have been told to add one,
              we are not going to tell you the same. We look for it, but we do not score it and it will
              never appear in your fix list. It is a 2024 proposal that no answer engine has committed
              to reading, and there is no measured evidence that having one changes whether you get cited.
              If that changes, we will say so and start scoring it.
            </p>
            <p class="m-0">
              Every finding here comes with the receipt we based it on. If any of it looks wrong,
              tell us — we would rather correct it than defend it.
            </p>
          </div>
        </ReportDisclosure>
      </div>
    </RailRow>
  </section>

  <!-- ── Close ───────────────────────────────────────────────────────────── -->
  <!-- The site's closing band: solid red stock, white type. `labelClass` is
       load bearing — the rail label defaults to the board's red kicker, which
       on this band is red on red. -->
  <section class="bg-paper-red w-full py-16 md:py-24">
    <RailRow label="Next" labelAs="p" labelClass="text-white" fill>
      <div class="flex flex-col gap-5">
        <h2 class="type-display m-0 text-white">Half an hour, and we will walk you through it</h2>
        <p class="type-lede m-0 text-white">
          No pitch deck. We will go through these findings live, answer whatever the report raised,
          and tell you honestly which parts you can handle in-house.
        </p>
        <a
          href="/contact"
          class="bump mt-2 self-start rounded-[4px] border-1 border-white px-[15px] py-2.5 text-center text-[14px] leading-[normal] font-normal text-nowrap text-white transition-all duration-300 hover:bg-white hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          Start a conversation
        </a>
      </div>
    </RailRow>
  </section>
</div>
