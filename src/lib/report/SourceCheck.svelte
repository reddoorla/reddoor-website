<script lang="ts">
  import type { Assertion, ReportView } from "./model";

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
      title: "The engine is reading your own site",
      lede: "It quoted these back from your pages. This is the proof that editing them changes the answer.",
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
      lede: "The engine got it from somewhere else. That somewhere is named beside each one.",
      alert: true,
    },
  ];

  const of = (v: Assertion["verdict"]): Assertion[] =>
    (acc?.assertions ?? []).filter((a) => a.verdict === v);

  const unverified = $derived(of("unverified"));

  /**
   * Every claim pulled out of one engine answer carries that answer's citations,
   * so a group whose rows all came from the same answer printed the identical
   * six domains six times. On the first real run that was most of the section's
   * height, and repetition of a list nobody is comparing reads as a bug rather
   * than as emphasis.
   *
   * Shown once above the rows when the whole group shares a list, per row when
   * they genuinely differ — because then the difference is the information.
   */
  const sameList = (rows: Assertion[]): string[] | null => {
    const first = rows[0]?.sourceDomains ?? [];
    if (first.length === 0) return null;
    const key = (d: string[]) => [...d].sort().join("|");
    return rows.every((r) => key(r.sourceDomains) === key(first)) ? first : null;
  };

  const groups = $derived(
    GROUPS.map((g) => {
      const rows = of(g.verdict);
      return { ...g, rows, shared: sameList(rows) };
    }).filter((g) => g.rows.length),
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
    We could not check this on this audit — no engine answer about {who} was captured to check against.
    That is a gap in the measurement, not a finding about your site.
  </p>
{:else if acc.assertions.length === 0}
  <p class="type-lede m-0 max-w-[52ch] text-black">
    We read {acc.answersRead === 1 ? "one answer" : `${acc.answersRead} answers`} about {who} and could
    not pull a checkable statement out of {acc.answersRead === 1 ? "it" : "them"}. That usually
    means the engine spoke in generalities, which is its own finding: there was nothing specific
    enough about you to repeat.
  </p>
{:else}
  <div class="flex flex-col gap-12">
    {#each groups as group (group.verdict)}
      <div class="flex flex-col gap-5">
        <div class="flex flex-col gap-1.5">
          <h3 class="type-question m-0 max-w-[40ch] {group.alert ? 'text-primary' : 'text-black'}">
            {group.title}
          </h3>
          <p class="type-meta m-0 max-w-[62ch] text-muted">{group.lede}</p>
          {#if group.shared}
            <p class="type-meta m-0 max-w-[66ch] wrap-break-word text-light">
              All from one answer, which cited: {group.shared.join(" · ")}
            </p>
          {/if}
        </div>

        <dl class="m-0 flex flex-col">
          {#each group.rows as row (row.claim + row.query)}
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

              {#if !group.shared && row.sourceDomains.length}
                <dd class="type-meta m-0 max-w-[66ch] wrap-break-word text-light">
                  Cited on that answer: {row.sourceDomains.join(" · ")}
                </dd>
              {/if}
            </div>
          {/each}
        </dl>
      </div>
    {/each}

    {#if elsewhere.length}
      <div class="flex flex-col gap-3 border-t border-light pt-6">
        <p class="type-eyebrow m-0 text-dark">Who the engine read instead of you</p>
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
          These are where stale hours, old phone numbers and a previous owner's name live. You
          cannot edit most of them, but you can make your own pages say the thing plainly enough
          that they stop being the best available source.
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
          <p class="type-meta m-0 max-w-[62ch] text-muted">
            {unverified.length === 1
              ? "One further statement could not be judged"
              : `${unverified.length} further statements could not be judged`}: {unverified
              .map((u) => u.unverifiedReason)
              .filter(Boolean)
              .join("; ") || "we could not check them against your pages"}.
          </p>
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
