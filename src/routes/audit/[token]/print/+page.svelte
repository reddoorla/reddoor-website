<script lang="ts">
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

  const ANSWERED_LABEL = {
    yes: "Yes",
    partial: "Partial",
    no: "No",
    unknown: "Not measured",
  } as const;
  const EFFORT_LABEL = {
    low: "About an hour",
    medium: "A few days",
    high: "A larger piece of work",
  } as const;

  // Three scores, all of them things we can move.
  //
  // AI Visibility used to sit here as a fourth and has been removed, not
  // reformatted: it scored zero for six of the eleven sites we have audited,
  // including our own, and nothing in this audit reliably moves it. A zero on
  // the same row as three numbers we CAN move reads as a fourth failing grade
  // and takes over the conversation — a reader spends the meeting on the one
  // number nobody can act on. Where the business stands in AI answers is still
  // reported in full further down, as a finding with its sources attached.
  // Findability is not here for the same reason AI Visibility is not: it never
  // varied. 26 of the 29 sites audited to date score 88 or above, because 40 of
  // its 100 points are crawler access and nearly every site allows everyone in.
  // On paper especially, a bar that is always long lends the two beside it a
  // steadiness they have not earned. The yes/no it actually establishes is
  // printed as a line instead — see crawlerReach below.
  const scoreCells = $derived([
    { v: view.scores.readability, l: "Readability" },
    { v: view.scores.answers, l: "Answers" },
  ]);

  const reach = $derived(view.crawlerReach);
  const accuracy = $derived(view.accuracy);

  function uniqueDomains(domains: string[]): string[] {
    return [...new Set(domains)];
  }
</script>

<svelte:head>
  <title>Prospect audit — {who}</title>
  <meta name="robots" content="noindex, nofollow, noarchive" />
</svelte:head>

<!--
  The PDF leave-behind, and deliberately NOT the interactive page with a print
  stylesheet over it.

  The page collapses its evidence behind disclosures, which is right on screen
  and wrong on paper: a leave-behind that hides half its content is worse than
  the long version it replaced. So everything here is flat and visible, in one
  pass, with nothing to click.

  Self-contained styles rather than the site's utilities: this document is
  printed by a headless browser at a fixed page size, never rendered beside the
  rest of the site, and it needs page-break control that has no place in the
  shared token set.

  DESIGN STATUS: machinery, pending a full design pass. The structure and the
  print mechanics are settled; the visual treatment is not.
-->
<article class="sheet">
  <header>
    <p class="eyebrow">Prospect audit</p>
    <h1>When AI answers for {who}</h1>
    <p class="meta">
      {view.url}{#if auditedOn}
        &middot; audited {auditedOn}{/if}
    </p>
  </header>

  <section class="scores">
    {#each scoreCells as cell (cell.l)}
      <div class="score">
        <span class="score-v">{cell.v ?? "—"}</span>
        <span class="score-l">{cell.l}</span>
      </div>
    {/each}
  </section>

  {#if reach}
    <p class="denominator">
      {#if !reach.measured}
        Whether AI crawlers can reach the site could not be checked on this audit.
      {:else if reach.blocked.length > 0}
        AI crawlers blocked by robots.txt: {reach.blocked.join(", ")}. Nothing else in this report
        can help while that is true.
      {:else}
        All {reach.checked} AI crawlers we checked are allowed in.
      {/if}
    </p>
  {/if}

  {#if view.visibility}
    <p class="denominator">
      Named in {view.visibility.named} of {view.visibility.total}
      {view.visibility.total === 1 ? "buyer search" : "buyer searches"}.
    </p>
  {/if}

  {#if view.narrative?.answers}
    <p class="verdict">{view.narrative.answers}</p>
  {/if}

  <!-- Sorted by SOURCE, never by truth — the same rule as the web report. We
       cannot know whether a claim is right; saying "the AI got this wrong"
       about something a client knows is true would discredit the page. -->
  {#if accuracy && accuracy.answersRead > 0 && accuracy.assertions.length > 0}
    <section>
      <h2>What an AI already says about you</h2>
      {#each accuracy.assertions.filter((a) => a.verdict !== "unverified") as a (a.claim + a.query)}
        <div class="fix">
          <p class="fix-t">
            {a.claim}
            <span class="answered {a.verdict}">
              {a.verdict === "confirmed"
                ? "your site says this"
                : a.verdict === "contradicted"
                  ? "your site says otherwise"
                  : "not on your site"}
            </span>
          </p>
          <p class="fix-w">The AI said: &ldquo;{a.engineQuote}&rdquo;</p>
          {#if a.sourceDomains.length}
            <p class="fix-w">Cited: {uniqueDomains(a.sourceDomains).join(", ")}</p>
          {/if}
        </div>
      {/each}
      {#if !accuracy.siteFullyRead}
        <p class="fix-w">
          We read {accuracy.pagesRead} of {accuracy.pagesTotal} pages for this check. Nothing above is
          reported as missing on the strength of pages we did not read.
        </p>
      {/if}
    </section>
  {/if}

  {#if view.fixes.length}
    <section>
      <h2>What to fix, in order</h2>
      {#each view.fixes as fix, i (fix.title)}
        <div class="fix">
          <h3>{i + 1}. {fix.title}</h3>
          <p class="tags">{EFFORT_LABEL[fix.effort]} &middot; {fix.impact} impact</p>
          <p>{fix.why}</p>
        </div>
      {/each}
    </section>
  {/if}

  {#if view.categoryProbes.length}
    <section>
      <h2>What buyers were shown instead</h2>
      <p class="lede">
        Each of these is a search a buyer would type before they had heard of you, asked of a live
        AI assistant. Every site listed is one it cited back.
      </p>
      {#each view.categoryProbes as probe (probe.query)}
        {@const domains = uniqueDomains(probe.citedDomains)}
        <div class="probe">
          <h3>&ldquo;{probe.query}&rdquo;</h3>
          <p class="outcome">
            {#if probe.domainCited || probe.brandMentioned}
              {who} appeared in this answer.
            {:else}
              {who} was not named. {domains.length}
              {domains.length === 1 ? "other site was" : "other sites were"} cited.
            {/if}
          </p>
          {#if domains.length}<p class="domains">{domains.join(" · ")}</p>{/if}
        </div>
      {/each}
    </section>
  {/if}

  {#if view.namesake}
    <section class="callout">
      <h2>Someone else is answering to your name</h2>
      <p>
        Across the searches we ran, <strong>{view.namesake.domain}</strong> was cited
        {view.namesake.count}
        {view.namesake.count === 1 ? "time" : "times"} — more than any other source. It is a different
        company with a name close enough to yours that the engines have to disambiguate between you.
      </p>
      <p>This is not something a page edit fixes on its own. It is worth a conversation.</p>
    </section>
  {/if}

  {#if view.buyerQuestions.length}
    <section>
      <h2>What buyers can and cannot learn from your site</h2>
      <p class="lede">
        {view.questionTally.yes} answered clearly, {view.questionTally.partial} partly,
        {view.questionTally.no} not at all.
      </p>
      <table>
        <thead>
          <tr><th>What buyers ask</th><th>On your site</th></tr>
        </thead>
        <tbody>
          {#each view.buyerQuestions as q (q.question)}
            <tr>
              <td>{q.question}</td>
              <td class="answered {q.answered}">{ANSWERED_LABEL[q.answered]}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      <p class="note">
        &ldquo;Partial&rdquo; means the information exists but not in a passage an engine could
        quote back — usually a list of terms rather than a sentence.
      </p>
    </section>
  {/if}

  <section>
    <h2>How we measured this</h2>
    <p>
      We crawled the site twice over — once as a plain request and once with a real browser — so we
      could measure how much of each page depends on JavaScript. Most AI crawlers run none.
    </p>
    {#if view.categoryProbes.length || view.brandedProbes.length}
      <p>
        The visibility test ran {view.categoryProbes.length + view.brandedProbes.length} live searches.
        Every source listed is a citation the engine actually returned, not something inferred from its
        wording.
      </p>
    {/if}
    <p>
      <strong>What we did not measure:</strong> we tested one AI assistant, not all of them. Results vary
      between engines and change over time, which is the argument for measuring again rather than treating
      any single number as fixed.
    </p>
  </section>

  <footer>
    <p>Prepared by Reddoor Creative &middot; reddoorla.com</p>
  </footer>
</article>

<style>
  /* Paper, not a viewport. preferCSSPageSize in the PDF renderer honours this. */
  @page {
    size: A4;
    margin: 18mm 16mm;
  }

  :global(body) {
    background: #fff;
    color: #2a2f37;
    font-family: "pragmatica", "helvetica", sans-serif;
    font-size: 10.5pt;
    line-height: 1.5;
  }

  .sheet {
    max-width: 100%;
  }

  h1,
  h2,
  h3 {
    color: #14181d;
    margin: 0;
    /* A heading stranded at the foot of a page reads as a mistake. */
    break-after: avoid;
  }

  h1 {
    font-size: 24pt;
    line-height: 1.1;
    margin-bottom: 4pt;
  }
  h2 {
    font-size: 14pt;
    margin-bottom: 8pt;
    padding-bottom: 4pt;
    border-bottom: 1pt solid #d71920;
  }
  h3 {
    font-size: 11.5pt;
    margin-bottom: 3pt;
  }

  p {
    margin: 0 0 7pt;
  }

  header {
    margin-bottom: 14pt;
  }

  .eyebrow {
    font-size: 8pt;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #d71920;
    font-weight: 600;
    margin-bottom: 6pt;
  }

  .meta {
    font-size: 9pt;
    color: #6e6f72;
  }

  section {
    margin-bottom: 16pt;
    /* Keep a section together where it fits on one page. */
    break-inside: avoid;
  }

  .scores {
    display: flex;
    gap: 0;
    border: 1pt solid #dce1e4;
    margin-bottom: 8pt;
  }

  .score {
    flex: 1;
    padding: 8pt 10pt;
    border-right: 1pt solid #dce1e4;
  }
  .score:last-child {
    border-right: 0;
  }

  .score-v {
    display: block;
    font-size: 20pt;
    font-weight: 600;
    line-height: 1;
    color: #14181d;
  }

  .score-l {
    display: block;
    font-size: 7.5pt;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #424b5a;
    margin-top: 3pt;
  }

  .denominator {
    font-size: 9.5pt;
    color: #d71920;
    font-weight: 600;
  }

  .verdict {
    font-size: 12pt;
    line-height: 1.45;
    color: #424b5a;
    border-left: 2pt solid #d71920;
    padding-left: 10pt;
    margin-bottom: 16pt;
  }

  .lede {
    color: #6e6f72;
  }

  /* Each item stays whole rather than splitting mid-thought across a page. */
  .fix,
  .probe {
    break-inside: avoid;
    margin-bottom: 11pt;
  }

  .tags {
    font-size: 8pt;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #6e6f72;
    margin-bottom: 4pt;
  }

  .outcome {
    font-weight: 600;
    margin-bottom: 3pt;
  }

  .domains {
    font-size: 8.5pt;
    color: #6e6f72;
    word-break: break-word;
  }

  /* Borders as well as fill: a reader who prints without background graphics
     still gets the emphasis. */
  .callout {
    border: 1pt solid #d71920;
    background: #fdf2f2;
    padding: 10pt 12pt;
  }
  .callout h2 {
    border-bottom: 0;
    padding-bottom: 0;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9.5pt;
    margin-bottom: 6pt;
  }

  th {
    text-align: left;
    font-size: 7.5pt;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #6e6f72;
    border-bottom: 1pt solid #dce1e4;
    padding: 4pt 6pt 4pt 0;
  }

  td {
    padding: 4pt 6pt 4pt 0;
    border-bottom: 0.5pt solid #e9edef;
    vertical-align: top;
  }

  .answered {
    font-size: 8pt;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 600;
    white-space: nowrap;
  }
  .answered.no {
    color: #d71920;
  }
  .answered.yes,
  .answered.partial,
  .answered.unknown {
    color: #6e6f72;
  }
  /* The accuracy verdicts share this chip. Red for the two that are findings
     about the site, grey for the one that is proof the engine reads it. */
  .answered.contradicted,
  .answered.absent {
    color: #d71920;
  }
  .answered.confirmed {
    color: #6e6f72;
  }

  .note {
    font-size: 8.5pt;
    color: #6e6f72;
  }

  footer {
    border-top: 1pt solid #dce1e4;
    padding-top: 6pt;
    font-size: 8.5pt;
    color: #6e6f72;
  }
</style>
