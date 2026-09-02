<script lang="ts">
  import { ownSiteCitations, type Assertion, type ReportView } from "./model";

  // What an AI already says about this business, and where it got it.
  //
  // This is the section the report is named for. An engine describes them to
  // anyone who asks, right now, and they have never seen what it says — that is
  // a more immediate fact than any score, and unlike the visibility number it
  // points at something they control.
  //
  // EVERY STATEMENT IS SORTED BY SOURCE, NEVER BY TRUTH. We cannot know whether
  // a claim is right: the engine may be perfectly correct about something the
  // site never mentions. Telling a client "the AI got this wrong" about a fact
  // they know is true would discredit every other line in the document. "Your
  // site does not say this, and here is who it read instead" is both the honest
  // framing and the stronger one.
  //
  // The order is deliberate and is not worst-first. Confirmed comes FIRST,
  // because it is the only proof in the whole report that editing the site
  // changes what the engines say — everything we recommend rests on it, and a
  // reader who has just seen it happen reads the rest differently. Then
  // contradicted (two answers in public, one of them theirs), then absent (the
  // engine read somebody else). Unverified sinks to the bottom: it is a note
  // about our measurement, not about them.

  let { view }: { view: ReportView } = $props();

  const acc = $derived(view.accuracy);
  const who = $derived(view.businessName ?? "this business");

  const GROUPS = [
    {
      verdict: "confirmed" as const,
      title: "The assistant is reading your own site",
      lede: "Each of these matches a passage on your pages. That is the proof that editing them changes the answer.",
      alert: false,
    },
    {
      verdict: "contradicted" as const,
      title: "Your site says something different",
      lede: "Two answers to the same question exist in public, and only one of them is yours.",
      alert: true,
    },
    {
      verdict: "absent" as const,
      title: "Your site does not say this",
      lede: "The assistant got it from somewhere else. That somewhere is named beside each one.",
      alert: true,
    },
  ];

  const of = (v: Assertion["verdict"]): Assertion[] =>
    (acc?.assertions ?? []).filter((a) => a.verdict === v);

  const unverified = $derived(of("unverified"));

  /**
   * Every claim pulled out of one engine answer carries that answer's citations,
   * so consecutive rows from the same answer printed the identical list over and
   * over — six times in the first real run, which was most of the section's
   * height. A repeated list nobody is comparing reads as a bug, not as emphasis.
   *
   * Collapsed by RUN rather than by group, and that distinction is the whole
   * fix: the section is grouped by verdict, but citations belong to the ANSWER,
   * and one verdict group routinely holds claims from two different answers.
   * A first attempt collapsed per group and did nothing, because those six rows
   * were never identical — four shared one list and two shared another.
   *
   * So a row prints its citations only when they differ from the row above it.
   * The line says "that answer", and the rows beneath it are from that same
   * answer, which is what makes the omission read as continuation.
   */
  const withCitations = (rows: Assertion[]) => {
    const key = (d: string[]) => [...d].sort().join("|");
    let previous = "";
    return rows.map((row) => {
      const k = key(row.sourceDomains);
      const show = row.sourceDomains.length > 0 && k !== previous;
      previous = k;
      return { row, showCitations: show };
    });
  };

  const groups = $derived(
    GROUPS.map((g) => ({ ...g, rows: withCitations(of(g.verdict)) })).filter((g) => g.rows.length),
  );

  // Only what the engine read INSTEAD of them. A domain we judged to be their
  // own is not "somewhere else the engine looked", and calling it that would be
  // a factual error about their business inside a section about factual errors
  // about their business.
  const elsewhere = $derived((acc?.sources ?? []).filter((s) => s.owner !== "yours"));

  const OWNER_LABEL = {
    platform: "a listing site",
    theirs: "someone else's site",
    unknown: "we could not tell whose",
    yours: "yours",
  } as const;
</script>

{#if !acc || acc.answersRead === 0}
  <p class="type-lede m-0 max-w-[52ch] text-muted">
    <!-- Never "we found nothing wrong". We had nothing to read. -->
    We could not check this on this audit — no assistant answer about {who} was captured to check against.
    That is a gap in the measurement, not a finding about your site.
  </p>
{:else if acc.assertions.length === 0}
  <p class="type-lede m-0 max-w-[52ch] text-black">
    We read {acc.answersRead === 1 ? "one answer" : `${acc.answersRead} answers`} about {who} and could
    not pull a checkable statement out of {acc.answersRead === 1 ? "it" : "them"}. That usually
    means the assistant spoke in generalities, which is its own finding: there was nothing specific
    enough about you to repeat.
  </p>
{:else}
  <div class="flex flex-col gap-12">
    <!-- For a common name this is the headline of the branded search, and it
         used to be visible only inside a truncated quote. -->
    {#if acc.conflation.detected}
      <div class="flex flex-col gap-2 border-l-2 border-primary pl-6">
        <p class="type-question m-0 max-w-[40ch] text-primary">
          The assistant is not sure which {who} you are
        </p>
        <p class="type-meta m-0 max-w-[62ch] text-muted">
          Asked about you by name, it described more than one business{acc.conflation.otherNames
            .length
            ? ` — including ${acc.conflation.otherNames.join(", ")}`
            : ""}. Until your own pages make the name, the place and the work unambiguous, anything
          it says about &ldquo;{who}&rdquo; may be about someone else.
        </p>
        {#if acc.conflation.engineQuote}
          <p class="type-meta m-0 max-w-[66ch] border-l-2 border-light pl-4 text-muted">
            The AI said: &ldquo;{acc.conflation.engineQuote}&rdquo;
          </p>
        {/if}
      </div>
    {/if}

    {#each groups as group (group.verdict)}
      <div class="flex flex-col gap-5">
        <div class="flex flex-col gap-1.5">
          <h3 class="type-question m-0 max-w-[40ch] {group.alert ? 'text-primary' : 'text-black'}">
            {group.title}
          </h3>
          <p class="type-meta m-0 max-w-[62ch] text-muted">{group.lede}</p>
          {#if group.verdict === "confirmed"}
            <!-- The sources under each statement are what it read ALONGSIDE the
                 site, never the site itself, so the count has to be said here or
                 the heading and the list contradict each other. -->
            <p class="type-meta m-0 max-w-[62ch] text-muted">
              Across the answers we checked, the assistant cited your own site
              {ownSiteCitations(view) === 1 ? "once" : `${ownSiteCitations(view)} times`}.
            </p>
          {/if}
        </div>

        <dl class="m-0 flex flex-col">
          {#each group.rows as { row, showCitations } (row.claim + row.query)}
            <div class="flex flex-col gap-2 border-t border-light py-6">
              <dt class="m-0 max-w-[62ch] font-medium text-black">{row.claim}</dt>

              <!-- The engine's words, verified as a real substring of its answer
                   rather than paraphrased. A client checking us on this is the
                   best possible outcome, so it has to survive being checked. -->
              <dd class="type-meta m-0 max-w-[66ch] border-l-2 border-light pl-4 text-muted">
                The AI said: &ldquo;{row.engineQuote}&rdquo;
              </dd>

              {#if row.siteQuote}
                <dd class="type-meta m-0 max-w-[66ch] border-l-2 border-light pl-4 text-muted">
                  Your site says: &ldquo;{row.siteQuote}&rdquo;
                </dd>
              {/if}

              <!-- The obvious objection, answered before it is raised: a client
                   who opens their own team page and finds something similar
                   would otherwise conclude we cannot read. -->
              {#if row.nearbyMention}
                <dd class="type-meta m-0 max-w-[66ch] text-light">
                  The closest your site comes: &ldquo;{row.nearbyMention}&rdquo;
                </dd>
              {/if}

              {#if showCitations}
                <dd class="type-meta m-0 max-w-[66ch] wrap-break-word text-light">
                  Also read for that answer: {row.sourceDomains.join(" · ")}
                </dd>
              {/if}
            </div>
          {/each}
        </dl>
      </div>
    {/each}

    {#if elsewhere.length}
      <div class="flex flex-col gap-3 border-t border-light pt-6">
        <p class="type-eyebrow m-0 text-dark">Who else the assistant read</p>
        <dl class="m-0 flex flex-col gap-2">
          {#each elsewhere as source (source.domain)}
            <div class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <dt class="m-0 font-medium text-black">{source.domain}</dt>
              <dd class="type-meta m-0 text-muted">
                {OWNER_LABEL[source.owner]} — {source.because}
              </dd>
            </div>
          {/each}
        </dl>
        <p class="type-meta m-0 max-w-[62ch] text-muted">
          These are the pages about you that you did not write. You cannot edit most of them, but
          you can make your own pages say the thing plainly enough that they stop being the best
          available source.
        </p>
      </div>
    {/if}

    <!-- Ours, not theirs, so it sits at the bottom and is excluded from every
         count above — the same place an unmeasured requirement goes in the goal
         checklist. -->
    {#if unverified.length || !acc.siteFullyRead}
      <div class="flex flex-col gap-2 border-t border-light pt-6">
        <p class="type-eyebrow m-0 text-dark">Not judged on this audit</p>
        {#if unverified.length}
          <!-- Each statement with its own reason. A joined string of reasons
               with no statements beside them read as an error dump. -->
          <ul class="m-0 flex list-none flex-col gap-1.5 p-0">
            {#each unverified as u (u.claim + u.query)}
              <li class="type-meta max-w-[62ch] text-muted">
                &ldquo;{u.claim}&rdquo; — {u.unverifiedReason ??
                  "we could not check it against your pages"}
              </li>
            {/each}
          </ul>
        {/if}
        {#if !acc.siteFullyRead}
          <p class="type-meta m-0 max-w-[62ch] text-muted">
            We read {acc.pagesRead} of your {acc.pagesTotal} pages for this check — the site was too large
            to send whole. Nothing above is reported as missing from your site on the strength of pages
            we did not read.
          </p>
        {/if}
      </div>
    {/if}
  </div>
{/if}
