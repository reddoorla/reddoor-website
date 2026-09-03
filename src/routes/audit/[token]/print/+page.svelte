<script lang="ts">
  import { openingSummary, toReportView, wasNamed, type Assertion } from "$lib/report/model";
  import { allFixes, displayQuote, headlineFinding, passes } from "$lib/report/narrative";
  import { healthRows } from "$lib/report/health";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const view = $derived(toReportView(data.report));
  const who = $derived(view.businessName ?? "your business");
  const headline = $derived(headlineFinding(view));

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

  // Two scores, both things we can move. AI Visibility and Findability are not
  // here, for the reasons given in ScoreBars.svelte: one nothing we do moves,
  // the other never varied.
  const scoreCells = $derived([
    { v: view.scores.readability, l: "Readability" },
    { v: view.scores.answers, l: "Answers" },
  ]);

  const reach = $derived(view.crawlerReach);
  const accuracy = $derived(view.accuracy);

  function uniqueDomains(domains: string[]): string[] {
    return [...new Set(domains)];
  }

  // The same rules as the web page: a contradiction is a finding; a statement
  // the site does not make is not (the engine may be right); the statements
  // we could not judge are printed in full because they are what a buyer
  // hears; confirmed statements are one line and live under "What passes".
  // A row prints its sources only when they differ from the row above.
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
  const contradictedRows = $derived(
    withCitations((accuracy?.assertions ?? []).filter((a) => a.verdict === "contradicted")),
  );
  const unjudgedRows = $derived(
    withCitations((accuracy?.assertions ?? []).filter((a) => a.verdict === "unverified")),
  );
  const elsewhere = $derived((accuracy?.sources ?? []).filter((s) => s.owner !== "yours"));
  const sampled = $derived(
    Boolean(accuracy && !accuracy.siteFullyRead) ||
      (view.sitemapUrlCount !== null &&
        accuracy !== null &&
        view.sitemapUrlCount > accuracy.pagesTotal),
  );
  const confirmed = $derived(
    (accuracy?.assertions ?? []).filter((a) => a.verdict === "confirmed").length,
  );
  const collision = $derived(Boolean(accuracy?.conflation.detected) || view.namesake !== null);

  const healthProblems = $derived(healthRows(view).filter((r) => r.alert));
  const goalMissing = $derived(
    (view.goalFit?.requirements ?? []).filter((r) => r.status === "missing"),
  );
  const passGroups = $derived(passes(view));
  const orderedFixes = $derived(allFixes(view));
</script>

<svelte:head>
  <title>Prospect audit — {who}</title>
  <meta name="robots" content="noindex, nofollow, noarchive" />
</svelte:head>

<!--
  The PDF leave-behind, and deliberately NOT the interactive page with a print
  stylesheet over it. The page collapses its evidence behind disclosures, which
  is right on screen and wrong on paper, so everything here is flat and visible
  in one pass — in the same order as the page, telling the same story: the
  headline, what an AI says, what you control, what passes, the fixes.

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

  <p class="verdict">{headline.text}</p>

  <section class="scores">
    {#each scoreCells as cell (cell.l)}
      <div class="score">
        <span class="score-v">{cell.v ?? "—"}</span>
        <span class="score-l">{cell.l}</span>
      </div>
    {/each}
  </section>

  {#if reach && (!reach.measured || reach.blocked.length > 0)}
    <p class="denominator">
      {#if !reach.measured}
        The robots.txt could not be read on this audit.
      {:else}
        AI crawlers blocked by robots.txt: {reach.blocked.join(", ")}. Nothing else in this report
        can help while that is true.
      {/if}
    </p>
  {/if}

  {#if view.visibility}
    <p class="denominator">
      Named in {view.visibility.named} of {view.visibility.total}
      {view.visibility.total === 1 ? "buyer search" : "buyer searches"}.
    </p>
    <p class="caveat">
      This is a measurement, not a scorecard — nothing we can do to your website reliably moves it.
      What it is good for is knowing where you stand and who the assistant reaches for instead.
    </p>
  {/if}

  <!-- Sorted by SOURCE, never by truth — the same rule as the web report. We
       cannot know whether a claim is right; saying "the AI got this wrong"
       about something a client knows is true would discredit the page. -->
  {#if accuracy && accuracy.answersRead > 0 && accuracy.assertions.length > 0}
    <section>
      <h2>What an AI says about you</h2>
      {#if collision}
        <div class="callout">
          <h3>
            {accuracy.conflation.detected
              ? `The assistant is not sure which ${who} you are`
              : "Someone else is answering to your name"}
          </h3>
          {#if accuracy.conflation.detected}
            <p>
              Asked about you by name, it described more than one business{accuracy.conflation
                .otherNames.length
                ? ` — including ${accuracy.conflation.otherNames.join(", ")}`
                : ""}. Until your own pages make the name, the place and the work unambiguous,
              anything it says about &ldquo;{who}&rdquo; may be about someone else.
            </p>
            {#if accuracy.conflation.engineQuote}
              <p class="fix-w">
                The AI said: &ldquo;{displayQuote(accuracy.conflation.engineQuote)}&rdquo;
              </p>
            {/if}
          {/if}
          {#if view.namesake}
            <p>
              Across the buyer searches we ran, <strong>{view.namesake.domain}</strong> was cited
              {view.namesake.count}
              {view.namesake.count === 1 ? "time" : "times"} — more than any other source. It is a different
              company with a name close enough to yours that the assistant has to tell you apart.
            </p>
          {/if}
          <p class="note">The remedy is the first item under Our recommendations.</p>
        </div>
      {/if}
      {#each contradictedRows as { row, showCitations } (row.claim + row.query)}
        <div class="fix">
          <p class="fix-t">
            {row.claim}
            <span class="answered contradicted">your site says otherwise</span>
          </p>
          <p class="fix-w">The AI said: &ldquo;{displayQuote(row.engineQuote)}&rdquo;</p>
          {#if row.siteQuote}
            <p class="fix-w">Your site says: &ldquo;{row.siteQuote}&rdquo;</p>
          {/if}
          {#if showCitations}
            <p class="fix-w">
              Also read for that answer: {uniqueDomains(row.sourceDomains).join(", ")}
            </p>
          {/if}
        </div>
      {/each}
      {#if unjudgedRows.length}
        <h3>What else it says about you</h3>
        <p class="note">
          Statements we could not check against your pages, either because no page of yours could
          confirm or deny them, or because we did not read the page that might. They are what a
          buyer hears, so they are here in full.
        </p>
        {#each unjudgedRows as { row, showCitations } (row.claim + row.query)}
          <div class="fix">
            <p class="fix-t">{row.claim}</p>
            <p class="fix-w">The AI said: &ldquo;{displayQuote(row.engineQuote)}&rdquo;</p>
            {#if row.unverifiedReason}
              <p class="fix-w">Why we could not check it: {row.unverifiedReason}</p>
            {/if}
            {#if showCitations}
              <p class="fix-w">
                Also read for that answer: {uniqueDomains(row.sourceDomains).join(", ")}
              </p>
            {/if}
          </div>
        {/each}
      {/if}
      {#if confirmed > 0}
        <p class="note">
          {confirmed}
          {confirmed === 1 ? "statement" : "statements"} the assistant made
          {confirmed === 1 ? "matches" : "match"} a passage on your own site — listed under What passes.
        </p>
      {/if}
      {#if elsewhere.length}
        <h3>
          Who else the assistant read: {elsewhere.length}
          {elsewhere.length === 1 ? "source" : "sources"}
        </h3>
        <p class="domains">
          {elsewhere.map((s) => s.domain).join(" · ")}
        </p>
      {/if}
      {#if sampled}
        <p class="fix-w">
          We read {accuracy.pagesRead} of the {accuracy.pagesTotal} pages we crawled for this check{view.sitemapUrlCount !==
          null
            ? `; your sitemap lists ${view.sitemapUrlCount}`
            : ""}. Nothing above is reported as missing on the strength of pages we did not read.
        </p>
      {/if}
    </section>
  {/if}

  {#if view.categoryProbes.length}
    <section>
      <h2>Where you stand in AI answers</h2>
      <p class="lede">
        Each of these is a search a buyer would type before they had heard of you, asked of a live
        AI assistant. Every site listed is one it cited back.
      </p>
      {#each view.categoryProbes as probe (probe.query)}
        {@const domains = uniqueDomains(probe.citedDomains)}
        <div class="probe">
          <h3>&ldquo;{probe.query}&rdquo;</h3>
          <p class="outcome">
            {#if wasNamed(probe)}
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

  <section>
    <h2>What you control</h2>

    <h3>Does it work</h3>
    {#if healthProblems.length === 0}
      <p class="note">Every check on whether the site works came back clean — see What passes.</p>
    {:else}
      {#each healthProblems as row (row.key)}
        <div class="fix">
          <p class="fix-t">{row.label} <span class="answered no">{row.value}</span></p>
          <p class="fix-w">{row.detail}</p>
        </div>
      {/each}
    {/if}

    {#if view.goalFit}
      <h3>Does your site do its job</h3>
      {#if view.goalFit.goal === "unknown"}
        <p>We read every page and could not tell what {who} wants a visitor to do.</p>
      {:else if goalMissing.length === 0}
        <p class="note">Everything the site needs for that job is in place — see What passes.</p>
      {:else}
        {#each goalMissing as row (row.key)}
          <div class="fix">
            <p class="fix-t">{row.label} <span class="answered no">Not on the site</span></p>
            <p class="fix-w">{row.why}</p>
            {#if row.evidence}<p class="fix-w">{row.evidence}</p>{/if}
          </div>
        {/each}
      {/if}
    {/if}

    {#if view.buyerQuestions.length}
      <h3>What buyers can and cannot learn from your site</h3>
      {#if openingSummary(view)}
        <p class="lede">{openingSummary(view)}</p>
      {/if}
      <table>
        <thead>
          <tr><th>What buyers ask</th><th>On your site</th><th>What it says</th></tr>
        </thead>
        <tbody>
          {#each view.buyerQuestions as q (q.question)}
            <tr>
              <td>{q.question}</td>
              <td class="answered {q.answered}">{ANSWERED_LABEL[q.answered]}</td>
              <td class="evidence">
                {#if q.evidence}&ldquo;{q.evidence}&rdquo;{:else if q.answered === "unknown"}not
                  judged on this audit{:else}no passage an assistant could quote{/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
      <p class="note">
        &ldquo;Partial&rdquo; means the information exists but not in a passage an assistant could
        quote back — usually a list of terms rather than a sentence.
      </p>
    {/if}
  </section>

  {#if passGroups.length}
    <section class="passes">
      <h2>What passes</h2>
      {#each passGroups as group (group.title)}
        <h3>{group.title}</h3>
        <ul>
          {#each group.items as item, i (group.title + i)}
            <li>{item}</li>
          {/each}
        </ul>
      {/each}
    </section>
  {/if}

  {#if orderedFixes.length}
    <section>
      <h2>Our recommendations</h2>
      <p class="lede">
        What we would do next, in order. The rows marked measured come straight from a check above;
        the rest are judgement. None of them is a promise about what an engine will do.
      </p>
      {#each orderedFixes as fix, i (fix.title)}
        <div class="fix">
          <h3>{i + 1}. {fix.title}</h3>
          <p class="tags">
            {EFFORT_LABEL[fix.effort]} &middot; {fix.impact} impact{fix.origin === "measured"
              ? " · measured"
              : ""}
          </p>
          <p>{fix.why}</p>
        </div>
      {/each}
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
        Every source listed is a citation the assistant actually returned, not something inferred from
        its wording.
      </p>
    {/if}
    <p>
      <strong>What we did not measure:</strong> we tested one AI assistant, not all of them. Results vary
      between assistants and change over time, which is the argument for measuring again rather than treating
      any single number as fixed.
    </p>
  </section>

  <section class="next">
    <h2>Next</h2>
    <p>
      Half an hour, and we will walk you through it. No pitch deck — we go through these findings
      live and tell you honestly which parts you can handle in-house. Reply to whoever sent you
      this, or start at reddoorla.com/contact.
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

  /* Paper carries none of the site's chrome. */
  :global(header),
  :global(nav),
  :global(body > footer) {
    display: none;
  }

  .caveat {
    color: #57544f;
    font-size: 9.5pt;
    margin: 4pt 0 0;
  }
  .evidence {
    color: #57544f;
    font-size: 9pt;
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
  section > h3 {
    margin-top: 10pt;
  }

  p {
    margin: 0 0 7pt;
  }

  ul {
    margin: 0 0 7pt;
    padding-left: 14pt;
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
    margin-bottom: 11pt;
  }
  .callout h3 {
    margin-bottom: 6pt;
  }

  .passes ul {
    columns: 2;
    column-gap: 14pt;
    font-size: 9pt;
    color: #57544f;
  }
  .passes li {
    break-inside: avoid;
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
  .answered.no,
  .answered.contradicted,
  .answered.absent {
    color: #d71920;
  }
  .answered.yes,
  .answered.partial,
  .answered.unknown {
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
