<script lang="ts">
  import CitationChart from "./CitationChart.svelte";
  import { fieldShape, type ReportView } from "./model";

  // Where the prospect stands in AI answers — reported as a finding with its
  // evidence attached, never as a score on the same track as the site work.
  //
  // This exists because the number alone was misleading in both directions.
  //
  // A zero looks like a failing grade and reads as something the reader ought
  // to be able to fix. It is neither. The published evidence puts the strongest
  // predictors of AI visibility off the site altogether — off-site brand
  // mentions and existing search rank — so a low number is not a verdict on the
  // site, and it must not read as one. (Our own audits point the same way, but
  // they are nine hand-picked sites against one engine over two days and are
  // not the basis for anything a client reads. See docs/aeo-evidence-base.md in
  // reddoor-maintenance for what is actually supported.)
  //
  // And two zeros can mean opposite things. If the engine answers a category
  // with billion-dollar manufacturers and federal agencies, no website work
  // reaches that answer and the honest counsel is to spend the money
  // elsewhere. If it answers with five local businesses the same size as the
  // reader's, the answer is plainly reachable and they are simply not in it.
  // Same zero, opposite advice — so the shape of the answer ships with the
  // number, or the number should not ship at all.
  //
  // The ranked chart is the visual; this component supplies the sentence that
  // frames it, the spread the chart's top rows cannot show, and the limit.
  // An earlier draft drew its own stacked concentration bar here and put two
  // pictures of one dataset on the page — the chart already ranks the sources,
  // so what was left to add was the size of the tail, which is a number.
  //
  // What is deliberately absent: any claim that this moves because we worked on
  // it. Nothing in the audit has been shown to move it, and saying otherwise is
  // the thing this whole report exists not to do.

  let { view }: { view: ReportView } = $props();

  const space = $derived(view.answerSpace);
  const who = $derived(view.businessName ?? "you");

  // The share the largest single source holds — the fragmentation finding in
  // one number. Measured across real categories it runs 4-16%, which is what
  // makes "just get listed in the sources the engine reads" a pitch rather than
  // a plan: there is no short list to get listed on.
  const topShare = $derived(space?.topSources.at(0)?.share ?? null);

  // The rest of the spread sentence, assembled here so every space is explicit.
  // Written inline in the markup it needed an {#if} for the optional clause,
  // and Svelte collapses the newline that follows a block tag — which is how it
  // shipped reading "of the citations.It takes 14 sources".
  // What KIND of source the engine reached for.
  //
  // The same count means opposite things depending on this. A field of
  // directories is one where no amount of website work puts the reader in the
  // answer, and the honest counsel is to spend the money elsewhere. A field of
  // businesses their own size is plainly reachable, and they are simply not in
  // it yet. The old lede printed the same zero for both.
  const shape = $derived(fieldShape(view.citedDomains));

  const shapeSentence = $derived.by(() => {
    if (!view.citedDomains.length) return "We recorded no sources for these answers.";
    const { listings, sites, businessCount } = shape;
    if (sites === 0) {
      return "Every source it cited was a directory or review site — not one business's own website, including the businesses it named.";
    }
    if (listings === 0) {
      return `It answered entirely from businesses' own websites — ${businessCount} of them.`;
    }
    const majority =
      listings > sites ? "mostly directories and review sites" : "mostly businesses' own websites";
    return `It answered ${majority}: ${listings} ${listings === 1 ? "citation" : "citations"} went to listing sites and ${sites} to the websites of ${businessCount} ${businessCount === 1 ? "business" : "businesses"}.`;
  });

  // The reader's own standing, stated plainly and AFTER the field is described.
  const standingSentence = $derived.by(() => {
    if (!view.visibility) return "";
    const { named, total } = view.visibility;
    if (named === 0) {
      return `${who} was not among them, in any of the ${total} questions we asked.`;
    }
    return `${who} was cited in ${named} of the ${total} questions we asked.`;
  });

  const spreadSentence = $derived.by(() => {
    if (!space || topShare === null) return "";
    const answers = `${space.answersWithCitations} ${space.answersWithCitations === 1 ? "answer" : "answers"}`;
    const half =
      space.domainsToHalf === null
        ? ""
        : ` It takes ${space.domainsToHalf} ${space.domainsToHalf === 1 ? "source" : "sources"} to cover half of them.`;
    return (
      `across these ${answers}, and the most-cited one holds only ` +
      `${Math.round(topShare * 100)}% of the citations.${half}` +
      ` There is no short list here to buy your way onto.`
    );
  });
</script>

{#if view.visibility}
  <div class="flex flex-col gap-10">
    <!-- The finding, in a sentence, before any number is parsed.
         The section above it already says what was asked and why, so this does
         not restate the method — an earlier draft repeated "before they have
         heard of you" verbatim two paragraphs running. -->
    <!-- Leads with the SHAPE of the field, not the reader's count in it.
         It used to open "It did not name {who} in any of the 5", which is true,
         unactionable, and the only sentence anyone remembered — a zero at the
         top of a section takes over the meeting, and this is the one number in
         the report that nothing we do reliably moves. The standing is still
         reported, one paragraph down, once the reader knows what room it is. -->
    <p class="type-lede m-0 max-w-[52ch] text-black">
      {shapeSentence}
    </p>

    <p class="m-0 max-w-[62ch] text-muted">{standingSentence}</p>

    {#if view.citedDomains.length}
      <CitationChart
        domains={view.citedDomains}
        url={view.url}
        namedCount={view.visibility.named}
        namesakeDomain={view.namesake?.domain ?? null}
      />
    {/if}

    <!-- The size of the tail. The chart ranks the top handful; this is the part
         it cannot show, and it is the part that decides whether "get listed
         where the engine looks" is a plan or a sales line. -->
    {#if space && space.citationsTotal > 0 && topShare !== null}
      <!-- Assembled in the script, not inline.
           Inline, the sentence needed an {#if} mid-paragraph for the optional
           clause, and Svelte collapses the newline after a block tag — so it
           rendered as "of the citations.It takes 14 sources". Building the
           string where the spacing is explicit removes the class of bug rather
           than patching this instance of it. -->
      <p class="type-meta m-0 max-w-[62ch] text-muted">
        Those are the most-cited names, not the whole field. The engine drew on
        <strong class="text-black">{space.distinctDomains} different sources</strong>
        {spreadSentence}
      </p>
    {/if}

    <!-- The honest limit, stated where the reader is most likely to ask for a
         promise. This is the product's position, not a disclaimer: everything
         above is measurement, and measurement is what is being sold here. -->
    <div class="flex flex-col gap-3 border-l-2 border-primary bg-paper p-7 md:p-10">
      <p class="type-lede m-0 max-w-[46ch] text-black">What this does and does not tell you</p>
      <!-- This paragraph used to argue from our own audits: "the businesses the
           engines named most often had the worst-built sites we measured". That
           is nine hand-picked sites, one engine, a two-day window — enough to
           notice something, nowhere near enough to tell a client. It now argues
           from the published research, which says the same thing at a scale we
           could never reach ourselves. Deliberately no figures: a number in
           client copy has to be one we can defend on the spot. -->
      <!-- Third pass on this paragraph, each one narrower than the last.
           Draft 1 argued from our own nine audits. Draft 2 swapped in "the
           published research says the strongest predictors are off-site" —
           which an adversarial check then took apart: the study behind it
           measured no on-site variables at all (so it cannot rank off-site
           against on-site), and it sampled only established brands with strong
           link profiles, which excludes every prospect we have.

           What is left is the true and stronger claim: nobody has measured this
           for a business their size. Saying so is better than borrowing
           confidence from a study that did not include them. -->
      <p class="m-0 max-w-[62ch] text-muted">
        This is a measurement, not a scorecard, and nothing we can do to your website reliably moves
        it. Nobody has published a study of businesses your size showing what does. The research
        that exists looked at large, established brands, and even there the signals that mattered
        were off their websites — how often they were mentioned elsewhere. Anyone who promises to
        raise this number with website work is selling you something they do not control.
      </p>
      <p class="m-0 max-w-[62ch] text-muted">
        What it is genuinely good for is knowing where you stand, seeing who the engines reach for
        instead, and judging whether that is a room you could realistically be in. We will re-run it
        whenever you like and tell you honestly whether anything moved.
      </p>
    </div>
  </div>
{:else}
  <p class="type-lede m-0 max-w-[52ch] text-muted">
    The live visibility test did not run on this audit, so there is nothing to report here. That is
    a gap in the measurement, not a finding about your site.
  </p>
{/if}
