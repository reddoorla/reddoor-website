<script lang="ts">
  import ReportDisclosure from "./ReportDisclosure.svelte";
  import type { ReportView } from "./model";

  // What an automated accessibility scan found.
  //
  // WHAT THIS SECTION MAY NOT SAY. Never that the site "is inaccessible", and
  // never a score. axe finds what a machine can find, which is a minority of
  // what a disabled person actually meets on a page — a site can pass every
  // rule here and still be unusable with a screen reader. So the section says
  // exactly what happened: we ran a rule set, these rules produced findings,
  // here is the element and the rule's own explanation of it.
  //
  // The rules are the vendor's and so is the wording. `help` is quoted rather
  // than paraphrased, because Deque wrote it and they know the rule better
  // than we do, and `helpUrl` sends the reader to the people who maintain it
  // rather than to us.
  //
  // A rule is one row however many pages it fired on. "Your headings skip a
  // level on six pages" is one job; six identical rows is not a longer report,
  // it is a worse one.

  let { view }: { view: ReportView } = $props();

  const a = $derived(view.accessibility);

  // What we actually checked, which is NOT the size of the rule set. About half
  // of axe's rules have nothing to apply to on any given page — no table, no
  // video, no iframe — and counting those would inflate the number on our own
  // behalf.
  const checked = $derived((a?.rulesPassed ?? 0) + (a?.violationsTotal ?? 0));

  const IMPACT_LABEL: Record<string, string> = {
    critical: "Critical",
    serious: "Serious",
    moderate: "Moderate",
    minor: "Minor",
  };

  const pageList = (pages: string[]): string => {
    if (pages.length <= 2) return pages.join(", ");
    return `${pages.slice(0, 2).join(", ")} and ${pages.length - 2} more`;
  };
</script>

{#if a}
  {#if !a.measured}
    <!-- The rules did not run. Not "nothing was found" — the opposite claim,
         and the one that would matter most to get wrong. -->
    <p class="type-lede m-0 text-muted">
      The accessibility rules did not run on this audit. That is a gap in our measurement, not a
      finding about your site.
    </p>
  {:else}
    <div class="flex flex-col gap-10">
      <p class="type-lede m-0 text-black">
        {#if a.violationsTotal === 0}
          We ran an automated accessibility scan over {a.pagesExamined}
          {a.pagesExamined === 1 ? "page" : "pages"}. Of the {checked} rules that had something to check,
          every one passed.
        {:else}
          We ran an automated accessibility scan over {a.pagesExamined}
          {a.pagesExamined === 1 ? "page" : "pages"}. Of the {checked} rules that had something to check,
          {a.violationsTotal}
          {a.violationsTotal === 1 ? "found a problem" : "found problems"}.
        {/if}
      </p>

      <!-- Said plainly and unprompted, because the alternative is a client
           believing a clean scan means a usable site. -->
      <p class="type-meta m-0 text-muted">
        An automated scan finds what a machine can find, which is a fraction of what somebody using
        a screen reader actually meets. A clean result here is a floor, not a verdict.
      </p>

      {#if a.violations.length > 0}
        <ul class="m-0 flex list-none flex-col gap-0 p-0">
          {#each a.violations as v (v.id)}
            <li class="flex flex-col gap-2 border-b border-light py-5">
              <p class="type-question m-0 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-black">
                <span>{v.help}</span>
                {#if v.impact}
                  <span class="type-meta text-muted">{IMPACT_LABEL[v.impact] ?? v.impact}</span>
                {/if}
              </p>
              <p class="type-meta m-0 text-muted">
                {v.nodes}
                {v.nodes === 1 ? "element" : "elements"} on {pageList(v.pages)}
              </p>
              {#if v.sample}
                <!-- The receipt: the element itself, so a reader can go and
                     find it rather than take our word for it. -->
                <code class="type-meta wrap-anywhere text-muted">{v.sample}</code>
              {/if}
              <p class="type-meta m-0">
                <a class="underline" href={v.helpUrl} target="_blank" rel="noopener noreferrer">
                  How to fix {v.id}
                </a>
              </p>
            </li>
          {/each}
        </ul>

        {#if a.violationsTotal > a.violations.length}
          <!-- A truncated list that looks complete is the one thing this
               report must never print. -->
          <p class="type-meta m-0 text-muted">
            Showing the {a.violations.length} most serious of {a.violationsTotal} rules with findings.
          </p>
        {/if}
      {/if}

      {#if a.rulesIncomplete > 0}
        <div>
          <ReportDisclosure title="Rules the scan could not decide" headingTag="h4">
            <p class="type-meta m-0 pt-2 text-muted">
              {a.rulesIncomplete}
              {a.rulesIncomplete === 1 ? "rule needs" : "rules need"} a human to look — usually colour
              contrast over an image or a gradient, where the scanner cannot tell what is behind the text.
              These are neither passes nor failures, and they are not counted as either above.
            </p>
          </ReportDisclosure>
        </div>
      {/if}
    </div>
  {/if}
{/if}
