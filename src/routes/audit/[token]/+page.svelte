<script lang="ts">
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import RailRow from "$lib/components/RailRow.svelte";
  import ReportDisclosure from "$lib/report/ReportDisclosure.svelte";
  import ScoreBars from "$lib/report/ScoreBars.svelte";
  import SiteHealth from "$lib/report/SiteHealth.svelte";
  import Standing from "$lib/report/Standing.svelte";
  import QuestionMeter from "$lib/report/QuestionMeter.svelte";
  import FixList from "$lib/report/FixList.svelte";
  import SearchResults from "$lib/report/SearchResults.svelte";
  import { toReportView } from "$lib/report/model";
  import type { PageData } from "./$types";

  // The report is laid out on the same band rhythm as the industry landing
  // pages: full-bleed sections alternating white and the paper tile, each one a
  // RailRow so every section's content column shares a left edge. A stack of
  // centred ContentWidth blocks separated by margins does not read as one page —
  // it reads as a document that happens to be on the site.
  //
  // Every section is headline → visual → disclosure, in that order: the reader
  // should be able to take the finding from the picture and move on, and open
  // the detail only where it caught them.

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

<main class="flex w-full flex-col">
  <!-- ── Masthead ────────────────────────────────────────────────────────── -->
  <!-- `pt-32` clears the fixed nav; the paper tile is the site's own texture,
       not a new surface invented for this page. -->
  <section class="bg-paper w-full pt-32 pb-16 md:pb-24">
    <ContentWidth class="flex flex-col gap-6">
      <p class="type-meta m-0 flex flex-wrap gap-x-6 gap-y-1 text-muted">
        <span class="type-eyebrow text-primary">{who}</span>
        <span>{view.url}</span>
        {#if auditedOn}<span>Audited {auditedOn}</span>{/if}
      </p>

      <h1 class="type-hero m-0 max-w-[20ch] text-black">Can AI find {who}?</h1>

      {#if view.narrative?.answers}
        <p class="type-lede m-0 max-w-[52ch] border-l-2 border-primary pl-6 text-black">
          {view.narrative.answers}
        </p>
      {/if}
    </ContentWidth>
  </section>

  <!-- ── What you control ────────────────────────────────────────────────── -->
  <!-- The report is split in two, and the split is the honest part of it.
       These three measure the site, they move because we edit the site, and
       every one of them has a before and an after. The visibility number does
       not behave that way and is no longer printed beside them — see the
       section below and the note in ScoreBars. -->
  <section class="w-full py-16 md:py-24">
    <ContentWidth class="relative">
      <h2 class="type-display m-0 max-w-[24ch] text-black">What you control</h2>
      <hr class="mt-7.5 mb-7.5 border-primary" />
    </ContentWidth>
    <RailRow label="Your site" labelAs="p">
      <div class="flex flex-col gap-10">
        <p class="type-lede m-0 max-w-[52ch] text-black">
          Everything in this section is work on your own site, so every number here is one we can
          move and show you the before and after of.
        </p>
        <ScoreBars {view} />
      </div>
    </RailRow>
  </section>

  <!-- ── Does it work ────────────────────────────────────────────────────── -->
  <!-- The other half of what they control, and the half Lighthouse cannot
       reach: it audits one page and scores it, so it never sees the link that
       404s three pages in and never names the image that cost the score.
       Findings, not another score — a count of broken links is a fact the
       reader can check in thirty seconds. -->
  <section class="bg-paper w-full py-16 md:py-24">
    <ContentWidth class="relative">
      <h2 class="type-display m-0 max-w-[24ch] text-black">Does it work</h2>
      <hr class="mt-7.5 mb-7.5 border-primary" />
    </ContentWidth>
    <RailRow label="The basics" labelAs="p">
      <SiteHealth {view} />
    </RailRow>
  </section>

  <!-- ── What to fix ─────────────────────────────────────────────────────── -->
  <!-- Kept ahead of the evidence: the prior pass moved it here deliberately, on
       the argument that a prospect wants the remedy before the diagnosis. Now
       that the list is collapsed it costs a screen rather than five. -->
  {#if view.fixes.length}
    <section class="w-full py-16 md:py-24">
      <ContentWidth class="relative">
        <h2 class="type-display m-0 max-w-[24ch] text-primary">
          {view.fixes.length === 1
            ? "One thing to fix"
            : `${view.fixes.length} things to fix, in order`}
        </h2>
        <hr class="mt-7.5 mb-7.5 border-primary" />
      </ContentWidth>
      <!-- Not `wide`: at 1004px the disclosure chevron sits some 400px right of
           the chips it belongs to, and the row stops reading as one control. -->
      <RailRow label="Start here" labelAs="p">
        <FixList fixes={view.fixes} />
      </RailRow>
    </section>
  {/if}

  <!-- ── Where you stand ─────────────────────────────────────────────────── -->
  <!-- The other half of the split, and the section this whole restructure is
       for: measured out in the world, reported with receipts, promised never.
       It used to be a fourth bar on the scorecard above, which said it was the
       same kind of claim as the three site scores and that it was ours to move.
       It is neither. See ScoreBars and Standing for the evidence. -->
  {#if view.categoryProbes.length}
    <section class="bg-paper w-full py-16 md:py-24">
      <ContentWidth class="relative">
        <h2 class="type-display m-0 max-w-[26ch] text-black">Where you stand in AI answers</h2>
        <hr class="mt-7.5 mb-7.5 border-primary" />
      </ContentWidth>
      <RailRow label="The world" labelAs="p">
        <div class="flex flex-col gap-10">
          <p class="type-lede m-0 max-w-[52ch] text-black">
            We asked a live AI assistant the questions a buyer types before they have heard of you,
            and recorded every source it cited back.
          </p>

          <!-- The finding, the ranked chart, the size of the tail, and the
               limit — kept together in one component so the number cannot be
               lifted out of the context that makes it honest. -->
          <Standing {view} />

          <div class="flex flex-col border-t border-light">
            <ReportDisclosure title="See each search we ran, and what came back">
              <SearchResults probes={view.categoryProbes} businessName={view.businessName} />
            </ReportDisclosure>

            {#if view.brandedProbes.length}
              <ReportDisclosure title="What the engines said when asked about you by name">
                <div class="flex flex-col gap-5 pt-1">
                  {#each view.brandedProbes as probe (probe.query)}
                    <div class="flex flex-col gap-2">
                      <p class="m-0 font-medium text-black">&ldquo;{probe.query}&rdquo;</p>
                      <p class="m-0 max-w-[66ch] text-sm text-muted">
                        {probe.snippet}{probe.truncated ? "…" : ""}
                      </p>
                      <!-- Who the engine listened to, for THIS site. Shown
                           because third-party profiles — directories, review
                           sites, recruiting pages — are where stale hours and
                           old phone numbers live, and a reader can only judge
                           that by seeing the list.

                           Deliberately no cross-site claim here. The audits
                           stored to date cover nine sites, four runs of which
                           are our own, over a two-day window against a single
                           engine; that is enough to notice a pattern and
                           nowhere near enough to assert one. -->
                      {#if probe.citedDomains.length}
                        <p class="type-meta m-0 max-w-[66ch] text-light">
                          Sources: {probe.citedDomains.join(" · ")}
                        </p>
                      {/if}
                    </div>
                  {/each}
                  <!-- This paragraph used to claim a branded search "echoes your
                       name back whether or not the engine knows anything real
                       about you". That is not true and it talked a real finding
                       down: when the answer quotes specifics off your own site
                       rather than inventing them, that is the thing working. It
                       is excluded from the visibility score because it measures
                       a different question, not because it measures nothing. -->
                  <p class="m-0 max-w-[66ch] text-sm text-muted">
                    A branded search cannot tell you whether someone who has never heard of you
                    would find you, which is why it is kept out of the visibility score above. It
                    answers a different question, and for most businesses a more useful one: when an
                    engine describes you, is it accurate, and is it reading your site or somebody
                    else's page about you.
                  </p>
                </div>
              </ReportDisclosure>
            {/if}
          </div>
        </div>
      </RailRow>
    </section>
  {/if}

  <!-- ── Namesake ────────────────────────────────────────────────────────── -->
  <!-- Surfaced as its own finding rather than an anonymous row in a competitor
       list. On the first real audit this was the most valuable thing the run
       produced and it rendered as one line among eight. -->
  {#if view.namesake}
    <section class="w-full pb-16 md:pb-24">
      <RailRow label="Worth your attention" labelAs="p">
        <div class="flex flex-col gap-4 border-l-2 border-primary bg-paper p-7 md:p-10">
          <h2 class="type-lede m-0 max-w-[32ch] text-black">
            Someone else is answering to your name
          </h2>
          <p class="m-0 max-w-[62ch] text-muted">
            Across the searches we ran, <strong class="text-black">{view.namesake.domain}</strong>
            was cited {view.namesake.count}
            {view.namesake.count === 1 ? "time" : "times"} — more than any other source. It is a different
            company with a name close enough to yours that the engines have to disambiguate between you.
          </p>
          <p class="m-0 max-w-[62ch] text-muted">
            This is not something a page edit fixes on its own. It is worth a conversation.
          </p>
        </div>
      </RailRow>
    </section>
  {/if}

  <!-- ── Buyer questions ─────────────────────────────────────────────────── -->
  {#if view.buyerQuestions.length}
    <section class="bg-paper w-full py-16 md:py-24">
      <ContentWidth class="relative">
        <h2 class="type-display m-0 max-w-[26ch] text-black">
          What buyers can and cannot learn from your site
        </h2>
        <hr class="mt-7.5 mb-7.5 border-primary" />
      </ContentWidth>
      <RailRow label="Your content" labelAs="p">
        <div class="flex flex-col gap-10">
          <QuestionMeter
            yes={view.questionTally.yes}
            partial={view.questionTally.partial}
            no={view.questionTally.no}
          />

          <div class="flex flex-col border-t border-light">
            <ReportDisclosure
              title="See all {view.buyerQuestions
                .length} questions and what your site says about each"
            >
              <div class="overflow-x-auto pt-1">
                <table class="w-full min-w-[420px] border-collapse text-sm">
                  <thead>
                    <tr>
                      <th class="type-eyebrow border-b border-light py-2 pr-4 text-left text-muted">
                        What buyers ask
                      </th>
                      <th class="type-eyebrow border-b border-light py-2 text-left text-muted">
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
                          class="type-eyebrow border-b border-light py-2.5 align-top {q.answered ===
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
                &ldquo;Partial&rdquo; means the information exists but not in a passage an engine
                could quote back — usually a list of terms rather than a sentence.
              </p>
            </ReportDisclosure>
          </div>
        </div>
      </RailRow>
    </section>
  {/if}

  <!-- ── How we measured ─────────────────────────────────────────────────── -->
  <section class="w-full py-16 md:py-24">
    <RailRow label="Under the hood" labelAs="h2">
      <div class="flex flex-col border-t border-light">
        <ReportDisclosure title="What we ran, and what we could not measure">
          <div class="flex max-w-[66ch] flex-col gap-3 pt-1 text-muted">
            <p class="m-0">
              We crawled your site twice over — once as a plain request and once with a real browser
              — so we could measure how much of each page depends on JavaScript. Most AI crawlers
              run none.
            </p>
            {#if view.categoryProbes.length || view.brandedProbes.length}
              <p class="m-0">
                The visibility test ran {view.categoryProbes.length + view.brandedProbes.length} live
                searches. Every source listed is a citation the engine actually returned, not something
                inferred from its wording.
              </p>
            {/if}
            <p class="m-0">
              <strong class="text-black">What we did not measure:</strong> we tested one AI assistant,
              not all of them. Results vary between engines and change over time, which is the argument
              for measuring again rather than treating any single number as fixed.
            </p>
            <p class="m-0">
              Every finding here is one you can reproduce. If any of it looks wrong, tell us — we
              would rather correct it than defend it.
            </p>
          </div>
        </ReportDisclosure>
      </div>
    </RailRow>
  </section>

  <!-- ── Close ───────────────────────────────────────────────────────────── -->
  <!-- The site's closing band: solid red stock, white type. The report ends
       where every other page on the site ends, which is most of what makes it
       feel like part of the site rather than an attachment to it. -->
  <section class="bg-paper-red w-full py-16 md:py-24">
    <RailRow label="Next" labelAs="p">
      <div class="flex flex-col gap-5">
        <h2 class="type-display m-0 max-w-[22ch] text-white">
          Half an hour, and we will walk you through it
        </h2>
        <p class="type-lede m-0 max-w-[52ch] text-white">
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
</main>
