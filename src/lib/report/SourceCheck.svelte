<script lang="ts">
  import ReportDisclosure from "./ReportDisclosure.svelte";
  import { displayQuote, numberWord } from "./narrative";
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
  // FINDINGS ONLY. The first real run spent three screens here on statements
  // the assistant had got right, straight after the one finding that actually
  // mattered — that it could not tell which business it was describing. That
  // is the wrong shape: a confirmed statement is proof the engine reads the
  // site, which is worth one sentence and a place in the passes list, not a
  // row each. So: the collision first, with what to do about it; then what the
  // site contradicts; then what the site does not say; then the count.

  let { view }: { view: ReportView } = $props();

  const acc = $derived(view.accuracy);
  const who = $derived(view.businessName ?? "this business");

  const GROUPS = [
    {
      verdict: "contradicted" as const,
      title: "Your site says something different",
      lede: "Two answers to the same question exist in public, and only one of them is yours.",
    },
    {
      verdict: "absent" as const,
      title: "Your site does not say this",
      lede: "The assistant got it from somewhere else. That somewhere is named beside each one.",
    },
  ];

  const of = (v: Assertion["verdict"]): Assertion[] =>
    (acc?.assertions ?? []).filter((a) => a.verdict === v);

  const unverified = $derived(of("unverified"));
  const confirmed = $derived(of("confirmed").length);

  /**
   * Every claim pulled out of one engine answer carries that answer's citations,
   * so consecutive rows from the same answer would print the identical list
   * over and over. A row prints its citations only when they differ from the
   * row above it; the rows beneath are from that same answer.
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
  // own is not "somewhere else the engine looked".
  const elsewhere = $derived((acc?.sources ?? []).filter((s) => s.owner !== "yours"));

  const OWNER_LABEL = {
    platform: "a listing site",
    theirs: "someone else's site",
    unknown: "we could not tell whose",
    yours: "yours",
  } as const;

  // The collision, from either instrument: the branded answer describing more
  // than one business, or a namesake domain cited across the buyer searches.
  // One block, because a reader does not care which of our checks noticed.
  const collision = $derived(Boolean(acc?.conflation.detected) || view.namesake !== null);
</script>

{#if !acc || acc.answersRead === 0}
  <p class="type-lede m-0 text-muted">
    <!-- Never "we found nothing wrong". We had nothing to read. -->
    We could not check this on this audit — no assistant answer about {who} was captured to check against.
    That is a gap in the measurement, not a finding about your site.
  </p>
{:else if acc.assertions.length === 0}
  <p class="type-lede m-0 text-black">
    We read {acc.answersRead === 1 ? "one answer" : `${acc.answersRead} answers`} about {who} and could
    not pull a checkable statement out of {acc.answersRead === 1 ? "it" : "them"}. That usually
    means the assistant spoke in generalities, which is its own finding: there was nothing specific
    enough about you to repeat.
  </p>
{:else}
  <div class="flex flex-col gap-12">
    {#if collision}
      <!-- The finding that outranks everything else in this section, with the
           remedy attached. It used to end at the diagnosis and go straight
           into the things that were working, which read as a shrug. One
           bordered block, nothing bordered inside it. -->
      <div class="flex flex-col gap-4 border-l-2 border-primary pl-6">
        <h4 class="type-question m-0 text-primary">
          {acc.conflation.detected
            ? `The assistant is not sure which ${who} you are`
            : "Someone else is answering to your name"}
        </h4>
        {#if acc.conflation.detected}
          <p class="type-meta m-0 text-muted">
            Asked about you by name, it described more than one business{acc.conflation.otherNames
              .length
              ? ` — including ${acc.conflation.otherNames.join(", ")}`
              : ""}. Until your own pages make the name, the place and the work unambiguous,
            anything it says about &ldquo;{who}&rdquo; may be about someone else.
          </p>
          {#if acc.conflation.engineQuote}
            <p class="type-meta m-0 text-muted">
              The AI said: &ldquo;{displayQuote(acc.conflation.engineQuote)}&rdquo;
            </p>
          {/if}
        {/if}
        {#if view.namesake}
          <p class="type-meta m-0 text-muted">
            Across the buyer searches we ran, <strong class="text-black"
              >{view.namesake.domain}</strong
            >
            was cited {view.namesake.count}
            {view.namesake.count === 1 ? "time" : "times"} — more than any other source. It is a different
            company with a name close enough to yours that the assistant has to tell you apart.
          </p>
        {/if}

        <p class="type-eyebrow m-0 pt-2 text-dark">What to do about it</p>
        <ol class="m-0 flex list-decimal flex-col gap-2 pl-5 text-muted">
          <li>
            Put the full name, the place and the work in one sentence at the top of the home page
            and the About page, and in both page titles. That is the sentence an assistant quotes
            when it has to say which one you are.
          </li>
          <li>
            Make the profiles it read instead say the same sentence. The listing sites named below
            carry your name, and any of them can be the one it picks.
          </li>
          <li>
            Mark the organisation up: a schema.org Organization block on the home page with the
            name, the address and links to the profiles you own, so the connections are stated
            rather than guessed.
          </li>
        </ol>
        <p class="type-meta m-0 text-muted">
          These are our recommendations, not measurements. They make you easier to tell apart, and
          none of them is a promise about what an assistant will do.
        </p>
      </div>
    {/if}

    {#each groups as group (group.verdict)}
      <div class="flex flex-col gap-5">
        <div class="flex flex-col gap-1.5">
          <h4 class="type-question m-0 text-primary">{group.title}</h4>
          <p class="type-meta m-0 text-muted">{group.lede}</p>
        </div>

        <ul class="m-0 flex flex-col list-none p-0">
          {#each group.rows as { row, showCitations } (row.claim + row.query)}
            <li class="flex flex-col gap-2 border-t border-light py-6">
              <p class="m-0 font-medium text-black">{row.claim}</p>

              <!-- The engine's words, verified as a real substring of its answer
                   rather than paraphrased. A client checking us on this is the
                   best possible outcome, so it has to survive being checked. -->
              <p class="type-meta m-0 text-muted">
                The AI said: &ldquo;{displayQuote(row.engineQuote)}&rdquo;
              </p>

              {#if row.siteQuote}
                <p class="type-meta m-0 text-muted">
                  Your site says: &ldquo;{row.siteQuote}&rdquo;
                </p>
              {/if}

              <!-- The obvious objection, answered before it is raised: a client
                   who opens their own team page and finds something similar
                   would otherwise conclude we cannot read. -->
              {#if row.nearbyMention}
                <p class="type-meta m-0 text-muted">
                  The closest your site comes: &ldquo;{row.nearbyMention}&rdquo;
                </p>
              {/if}

              {#if showCitations}
                <p class="type-meta m-0 wrap-break-word text-muted">
                  Also read for that answer: {row.sourceDomains.join(" · ")}
                </p>
              {/if}
            </li>
          {/each}
        </ul>
      </div>
    {/each}

    {#if confirmed > 0}
      <!-- The proof that editing the site changes the answer, in one sentence.
           The statements themselves are in the passes list. -->
      <p class="type-meta m-0 {groups.length ? 'border-t border-light pt-6' : ''} text-muted">
        {numberWord(confirmed).replace(/^./, (c) => c.toUpperCase())}
        {confirmed === 1 ? "statement" : "statements"} the assistant made
        {confirmed === 1 ? "matches" : "match"} a passage on your own site, and across the answers we
        checked it cited your site
        {ownSiteCitations(view) === 1 ? "once" : `${ownSiteCitations(view)} times`}. That is the
        proof that editing your pages changes the answer; the statements are listed under
        <a class="underline" href="#passes">what passes</a>.
      </p>
    {/if}

    {#if elsewhere.length}
      <div class="flex flex-col border-t border-light">
        <ReportDisclosure
          headingTag="h4"
          title="Who else the assistant read: {elsewhere.length} {elsewhere.length === 1
            ? 'source'
            : 'sources'}"
        >
          <div class="flex flex-col gap-3 pt-1">
            <ul class="m-0 flex flex-col gap-2 list-none p-0">
              {#each elsewhere as source (source.domain)}
                <li class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <p class="m-0 font-medium text-black">{source.domain}</p>
                  <p class="type-meta m-0 text-muted">
                    {OWNER_LABEL[source.owner]} — {source.because}
                  </p>
                </li>
              {/each}
            </ul>
            <p class="type-meta m-0 text-muted">
              These are the pages about you that you did not write. You cannot edit most of them,
              but you can make your own pages say the thing plainly enough that they stop being the
              best available source.
            </p>
          </div>
        </ReportDisclosure>
      </div>
    {/if}

    <!-- Ours, not theirs, so it sits at the bottom, collapsed, and is excluded
         from every count above. The one line that stays visible is the caveat
         on how much of the site we read, because it qualifies the findings. -->
    {#if unverified.length || !acc.siteFullyRead}
      <div class="flex flex-col border-t border-light">
        {#if unverified.length}
          <ReportDisclosure
            headingTag="h4"
            title="Not judged on this audit: {unverified.length} {unverified.length === 1
              ? 'statement'
              : 'statements'} we could not check"
          >
            <ul class="m-0 flex list-none flex-col gap-1.5 p-0 pt-1">
              {#each unverified as u (u.claim + u.query)}
                <li class="type-meta text-muted">
                  &ldquo;{u.claim}&rdquo; — {u.unverifiedReason ??
                    "we could not check it against your pages"}
                </li>
              {/each}
            </ul>
          </ReportDisclosure>
        {/if}
        {#if !acc.siteFullyRead}
          <p class="type-meta m-0 pt-5 text-muted">
            We read {acc.pagesRead} of your {acc.pagesTotal} pages for this check — the site was too large
            to send whole. Nothing above is reported as missing from your site on the strength of pages
            we did not read.
          </p>
        {/if}
      </div>
    {/if}
  </div>
{/if}
