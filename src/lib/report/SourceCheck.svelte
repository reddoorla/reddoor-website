<script lang="ts">
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
  // site never mentions. On our own report it said we were registered in
  // Texas, which is true and which our site does not say — and "your site does
  // not say this" read as an accusation about a fact. So a statement the site
  // does not make is not printed as a finding at all. What the reader gets
  // instead is who the assistant read, which is the actionable part.
  //
  // What IS printed, in this order: the collision (with its remedy pointed at,
  // not inlined — the fix list is where the plan lives); what the site
  // contradicts; then, as headlines only, everything the assistant said that we
  // did not find on the site. Those are the important ones: "shows very low
  // business activity compared with other companies in its sector" is what a
  // buyer hears, and it is the sentence that makes someone want to change
  // something. They were behind a disclosure once. Never again.

  let { view }: { view: ReportView } = $props();

  const acc = $derived(view.accuracy);
  const who = $derived(view.businessName ?? "this business");

  const of = (v: Assertion["verdict"]): Assertion[] =>
    (acc?.assertions ?? []).filter((a) => a.verdict === v);

  const contradicted = $derived(of("contradicted"));
  // Everything the assistant said that we did not find on the site: the
  // statements it plainly does not make and the ones we could not settle. One
  // list, headlines only. The engine's wording, the reason we could not check
  // and the source lists were three lines of ours under each line of theirs,
  // and on our own report they buried the one sentence that mattered.
  const notOnSite = $derived([...of("absent"), ...of("unverified")]);
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

  // The honest denominator. `pagesTotal` is how many pages the crawl read,
  // which is capped — it is not how many pages the site has. The sitemap count
  // is, when there is one.
  const sampled = $derived(
    Boolean(acc && !acc.siteFullyRead) ||
      (view.sitemapUrlCount !== null && acc !== null && view.sitemapUrlCount > acc.pagesTotal),
  );
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
      <!-- The finding that outranks everything else in this section. The
           remedy is the first fix in the list, and this points at it rather
           than repeating it: a plan in the middle of the findings broke the
           narrative. One bordered block, nothing bordered inside it. -->
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
        <p class="type-meta m-0 text-muted">
          The remedy is the first item in <a class="underline" href="#fixes">what to fix</a>.
        </p>
      </div>
    {/if}

    {#if contradicted.length}
      <div class="flex flex-col gap-5">
        <div class="flex flex-col gap-1.5">
          <h4 class="type-question m-0 text-primary">Your site says something different</h4>
          <p class="type-meta m-0 text-muted">
            Two answers to the same question exist in public, and only one of them is yours.
          </p>
        </div>

        <ul class="m-0 flex list-none flex-col p-0">
          {#each withCitations(contradicted) as { row, showCitations } (row.claim + row.query)}
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
              {#if showCitations}
                <p class="type-meta m-0 wrap-break-word text-muted">
                  Also read for that answer: {row.sourceDomains.join(" · ")}
                </p>
              {/if}
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if notOnSite.length}
      <!-- Headlines, nothing under them. These are what a buyer hears; the
           reader knows their own business and needs no help judging each. -->
      <div class="flex flex-col gap-5">
        <div class="flex flex-col gap-1.5">
          <h4 class="type-question m-0 text-black">
            What the AI says about you that is not on your site
          </h4>
          <p class="type-meta m-0 text-muted">We did not find these on your site.</p>
        </div>

        <ul class="m-0 flex list-none flex-col p-0">
          {#each notOnSite as u (u.claim + u.query)}
            <li class="border-t border-light py-4 font-medium text-black">{u.claim}</li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if confirmed > 0}
      <!-- The proof that editing the site changes the answer, in one sentence.
           The statements themselves are in the passes list. -->
      <p class="type-meta m-0 border-t border-light pt-6 text-muted">
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
      <!-- Visible, not collapsed. "Your site does not say this" used to be the
           finding here; the useful part of that finding was always the list of
           pages about them that they did not write. -->
      <div class="flex flex-col gap-4 border-t border-light pt-6">
        <div class="flex flex-col gap-1.5">
          <h4 class="type-question m-0 text-black">
            Who else the assistant read: {elsewhere.length}
            {elsewhere.length === 1 ? "source" : "sources"}
          </h4>
          <p class="type-meta m-0 text-muted">
            These are the pages about you that you did not write. You cannot edit most of them, but
            you can make your own pages say the thing plainly enough that they stop being the best
            available source.
          </p>
        </div>
        <ul class="m-0 grid list-none grid-cols-1 gap-x-10 p-0 sm:grid-cols-2">
          {#each elsewhere as source (source.domain)}
            <li
              class="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-light/60 py-1.5"
            >
              <span class="type-meta text-black">{source.domain}</span>
              <span class="type-meta text-muted">{OWNER_LABEL[source.owner]}</span>
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if sampled}
      <!-- Ours, not theirs. The crawl reads a capped number of pages, so the
           count is "pages we crawled", never "your pages" — and the sitemap
           says how many there really are. -->
      <p class="type-meta m-0 border-t border-light pt-6 text-muted">
        We read {acc.pagesRead} of the {acc.pagesTotal} pages we crawled for this check{view.sitemapUrlCount !==
        null
          ? `; your sitemap lists ${view.sitemapUrlCount}`
          : ""}. Nothing above is reported as missing from your site on the strength of pages we did
        not read.
      </p>
    {/if}
  </div>
{/if}
