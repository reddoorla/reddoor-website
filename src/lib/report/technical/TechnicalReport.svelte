<script lang="ts">
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import type { Row, TechnicalView } from "./model";

  // The Technical report body. Shared by the token route and the fixture
  // route, so the fixture renders exactly what a reader would see.
  //
  // FIRST SCREEN: what the site runs on, whether anything is broken, and the
  // three things that most want attention. Everything else is a folded
  // appendix, because a buyer who asked "is anything broken" should get that
  // answer before a list of forty rows.

  let { view, reference }: { view: TechnicalView; reference: string | null } = $props();

  const LAYERS: Record<string, string> = {
    cms: "Platform",
    theme: "Theme",
    "page-builder": "Page builder",
    framework: "Framework",
    ecommerce: "Shop",
    plugin: "Plugins",
    forms: "Forms",
    analytics: "Analytics and tracking",
    fonts: "Fonts",
    hosting: "Hosting",
  };
  const ORDER = Object.keys(LAYERS);

  const auditDate = $derived.by(() => {
    const d = new Date(view.generatedAt);
    return Number.isNaN(d.getTime())
      ? null
      : d.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        });
  });
  const schedule = $derived(
    `/schedule?ref=${encodeURIComponent(reference ? `technical-${reference}` : "technical")}`,
  );
  const running = $derived(
    [...view.sections.running.items].sort(
      (a, b) => ORDER.indexOf(a.layer) - ORDER.indexOf(b.layer),
    ),
  );
  const mark = (r: Row) => (r.ok === true ? "Fine" : r.ok === false ? "Needs attention" : "Note");
</script>

{#snippet rows(list: Row[])}
  {#if list.length}
    <dl class="m-0 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
      {#each list as r (r.label)}
        <dt class="m-0 font-medium text-black">{r.label}</dt>
        <dd class="m-0 min-w-0 break-words text-black">
          <span class="sr-only">{mark(r)}: </span>
          <span aria-hidden="true" class={r.ok === false ? "text-primary" : "text-muted"}>
            {r.ok === true ? "✓" : r.ok === false ? "✕" : "·"}
          </span>
          {r.text}
        </dd>
      {/each}
    </dl>
  {:else}
    <p class="m-0 text-muted">Not measured in this scan.</p>
  {/if}
{/snippet}

{#snippet finding(f: { text: string; evidence: string | null })}
  <li class="min-w-0 break-words">
    {f.text}
    {#if f.evidence}<span class="block text-[14px] break-all text-muted">{f.evidence}</span>{/if}
  </li>
{/snippet}

<div class="flex w-full flex-col">
  <section class="bg-paper w-full pt-32 pb-12 md:pb-16">
    <ContentWidth class="flex flex-col gap-6">
      <p class="type-meta m-0 flex flex-wrap gap-x-6 gap-y-1 text-muted">
        <span class="type-eyebrow min-w-0 break-words text-primary">
          Technical report for: {view.host}
        </span>
        {#if auditDate}<span>Checked {auditDate}</span>{/if}
      </p>
      <h1 class="type-hero m-0 max-w-[20ch] [overflow-wrap:anywhere] text-black">
        Is anything on {view.host} broken?
      </h1>

      <p
        class="type-lede m-0 border-l-2 pl-6 [overflow-wrap:anywhere] text-black {view.nothingBroken
          ? 'border-dark'
          : 'border-primary'}"
      >
        {#if view.incomplete}
          We could not complete this scan of {view.host}, so this page makes no all-clear: what
          follows is only what we did manage to read.{view.brokenTotal
            ? ` Even so, we found ${view.brokenTotal === 1 ? "one thing" : `${view.brokenTotal} things`} a visitor runs into today${view.brokenTotal > 3 ? "; the first three are below" : ""}.`
            : ""}
        {:else}
          {view.runningOn ? `${view.host} is ${view.runningOn}, and ` : ""}{view.nothingBroken
            ? "nothing we tested on it is broken."
            : `we found ${view.brokenTotal === 1 ? "one thing" : `${view.brokenTotal} things`} a visitor runs into today${view.brokenTotal > 3 ? "; the first three are below" : ""}.`}
        {/if}
      </p>

      {#if view.broken.length}
        <div>
          <h2 class="type-h4 m-0 mb-2 text-black">Broken now</h2>
          <ol class="m-0 flex list-decimal flex-col gap-2 pl-6 text-black">
            {#each view.broken as f (f.id)}{@render finding(f)}{/each}
          </ol>
        </div>
      {/if}
      {#if view.attention.length}
        <div>
          <h2 class="type-h4 m-0 mb-2 text-black">
            {view.attentionTotal === 1 ? "One thing wants" : `${view.attentionTotal} things want`} attention{view.attentionTotal >
            3
              ? "; the first three"
              : ""}
          </h2>
          <ol class="m-0 flex list-decimal flex-col gap-2 pl-6 text-black">
            {#each view.attention as f (f.id)}{@render finding(f)}{/each}
          </ol>
        </div>
      {/if}

      <p class="m-0 text-black">
        Send this to whoever looks after the site.{view.fixFirst.length
          ? ` If that is nobody, we will fix ${view.fixFirst.length >= 3 ? "the first three" : view.fixFirst.length === 1 ? "it" : "both"} for a fixed price${view.fixFirst.length > 3 ? " and tell you what the rest would take" : ""}.`
          : ""}
      </p>
      <p class="m-0">
        <a
          href={schedule}
          class="inline-block rounded-[4px] border-1 border-primary bg-primary px-[15px] py-2.5 text-[14px] text-white hover:bg-white hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          {view.fixFirst.length ? "Book a call about the first fixes" : "Book a call"}
        </a>
      </p>
    </ContentWidth>
  </section>

  <section class="w-full bg-white py-12">
    <ContentWidth class="flex flex-col gap-4">
      <h2 class="type-h3 m-0 text-black" id="fix-first">What to fix first</h2>
      {#if view.fixFirst.length}
        <ol class="m-0 flex list-decimal flex-col gap-3 pl-6 text-black">
          {#each view.fixFirst as f (f.id)}{@render finding(f)}{/each}
        </ol>
      {:else}
        <p class="m-0 text-black">
          {view.incomplete
            ? "This scan did not complete, so we cannot say that nothing needs fixing."
            : "Nothing in this scan needs fixing."}
        </p>
      {/if}
    </ContentWidth>
  </section>

  <section class="bg-paper w-full py-12">
    <ContentWidth class="flex flex-col gap-4">
      <h2 class="type-h3 m-0 text-black">The full list</h2>
      <p class="m-0 text-muted">
        Each section opens. Every line is something we read off your site, with where we read it.
      </p>

      <details class="border-t border-dark/20 pt-4">
        <summary class="cursor-pointer font-medium text-black">What you are running</summary>
        <div class="mt-4 flex flex-col gap-4">
          {#if running.length}
            <dl
              class="m-0 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]"
            >
              {#each running as g (g.layer)}
                <dt class="m-0 font-medium text-black">{LAYERS[g.layer] ?? g.layer}</dt>
                <dd class="m-0 min-w-0 break-words text-black">{g.names.join(", ")}</dd>
              {/each}
            </dl>
          {:else}
            <p class="m-0 text-black">
              We could not tell what the site is built with from what we read.
            </p>
          {/if}
          {#each view.sections.running.releaseLines as r (r.header)}
            <p class="m-0 text-black">
              Your {r.header === "server" ? "server" : "site's runtime"} reports {r.line}.
              {r.unsupported
                ? "Its makers have ended standard support for it."
                : "Its makers still support it."}
            </p>
          {/each}
        </div>
      </details>

      <details class="border-t border-dark/20 pt-4">
        <summary class="cursor-pointer font-medium text-black">Does the address work</summary>
        <div class="mt-4">{@render rows(view.sections.address)}</div>
      </details>

      <details class="border-t border-dark/20 pt-4">
        <summary class="cursor-pointer font-medium text-black">Is anything broken</summary>
        <div class="mt-4">{@render rows(view.sections.brokenThings)}</div>
      </details>

      <details class="border-t border-dark/20 pt-4">
        <summary class="cursor-pointer font-medium text-black">Weight and images</summary>
        <div class="mt-4 flex flex-col gap-4">
          {@render rows(view.sections.weight.rows)}
          {#if view.sections.weight.heaviest.length}
            <ol class="m-0 flex list-decimal flex-col gap-2 pl-6 text-black">
              {#each view.sections.weight.heaviest as i, n (n)}
                <li class="min-w-0 break-all">{(i.bytes / 1_000_000).toFixed(1)} MB — {i.url}</li>
              {/each}
            </ol>
          {/if}
        </div>
      </details>

      <details class="border-t border-dark/20 pt-4">
        <summary class="cursor-pointer font-medium text-black">On a phone</summary>
        <div class="mt-4">{@render rows(view.sections.phone)}</div>
      </details>

      <details class="border-t border-dark/20 pt-4">
        <summary class="cursor-pointer font-medium text-black">Is it safe</summary>
        <div class="mt-4 flex flex-col gap-4">
          {@render rows(view.sections.safe)}
          <p class="m-0 text-muted">
            This is what your server says about itself, read from outside. It is not a security
            assessment or penetration test.
          </p>
        </div>
      </details>

      <details class="border-t border-dark/20 pt-4">
        <summary class="cursor-pointer font-medium text-black">Is your email safe</summary>
        <div class="mt-4">{@render rows(view.sections.email)}</div>
      </details>

      {#if view.sections.domain}
        <details class="border-t border-dark/20 pt-4">
          <summary class="cursor-pointer font-medium text-black">Your domain</summary>
          <div class="mt-4">{@render rows([view.sections.domain])}</div>
        </details>
      {/if}

      <details class="border-t border-dark/20 pt-4">
        <summary class="cursor-pointer font-medium text-black">Can everyone use it</summary>
        <div class="mt-4 flex flex-col gap-4 text-black">
          {#if view.sections.access.state === "measured"}
            <p class="m-0">
              An automated scan of {view.sections.access.pagesExamined === 1
                ? "one page"
                : `${view.sections.access.pagesExamined} pages`}
              {view.sections.access.rulesFailed === 0
                ? "found no accessibility failures."
                : `found ${view.sections.access.rulesFailed === 1 ? "one kind" : `${view.sections.access.rulesFailed} kinds`} of accessibility failure${view.sections.access.rulesListed < view.sections.access.rulesFailed ? `; the ${view.sections.access.rulesListed} most serious are listed` : ""}.`}
              A scan like this finds only part of what a person using assistive technology would meet,
              and this is not a compliance assessment.
            </p>
            {#each view.sections.access.byImpact as g (g.impact)}
              <div>
                <h3 class="type-h5 m-0 mb-1 capitalize">{g.impact}</h3>
                <ul class="m-0 flex flex-col gap-1 pl-6">
                  {#each g.rules as r (r.id)}
                    <li class="min-w-0 break-words">
                      {r.help}: {r.nodes}
                      {r.nodes === 1 ? "element" : "elements"} on {r.pages}
                      {r.pages === 1 ? "page" : "pages"}
                    </li>
                  {/each}
                </ul>
              </div>
            {/each}
          {:else if view.sections.access.state === "needs-fresh-scan"}
            <p class="m-0">
              Not reported from this scan. It ran before two fixes to how we measure: waiting for
              content that animates in to settle, and leaving out the inside of other companies'
              embedded players. A fresh scan is needed before we print a result.
            </p>
          {:else}
            <p class="m-0">Not measured in this scan.</p>
          {/if}
        </div>
      </details>

      <details class="border-t border-dark/20 pt-4">
        <summary class="cursor-pointer font-medium text-black">What we read</summary>
        <div class="mt-4 flex flex-col gap-2 text-black">
          <p class="m-0">
            We opened {view.sections.read.pages.length}
            {view.sections.read.pages.length === 1 ? "page" : "pages"}{view.sections.read
              .sitemapUrlCount
              ? `; your sitemap lists ${view.sections.read.sitemapUrlCount}`
              : ""}.
          </p>
          <ul class="m-0 flex flex-col gap-1 pl-6 text-[14px]">
            {#each view.sections.read.pages as p (p)}<li class="min-w-0 break-all">{p}</li>{/each}
          </ul>
        </div>
      </details>

      {#if view.more.length}
        <details class="border-t border-dark/20 pt-4">
          <summary class="cursor-pointer font-medium text-black">More to fix</summary>
          <ul class="mt-4 flex flex-col gap-2 pl-6 text-black">
            {#each view.more as f (f.id)}{@render finding(f)}{/each}
          </ul>
        </details>
      {/if}

      {#if view.housekeeping.length}
        <details class="border-t border-dark/20 pt-4">
          <summary class="cursor-pointer font-medium text-black">Housekeeping</summary>
          <ul class="mt-4 flex flex-col gap-2 pl-6 text-black">
            {#each view.housekeeping as f (f.id)}{@render finding(f)}{/each}
          </ul>
        </details>
      {/if}
    </ContentWidth>
  </section>

  <section class="w-full bg-primary py-12 text-white">
    <ContentWidth class="flex flex-col gap-4">
      <p class="type-lede m-0">
        {view.fixFirst.length ? "Want these fixed?" : "Questions about the site?"}
      </p>
      <p class="m-0">
        <a
          href={schedule}
          class="inline-block rounded-[4px] border-1 border-white bg-white px-[15px] py-2.5 text-[14px] text-primary hover:bg-primary hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          {view.fixFirst.length ? "Book a call about the first fixes" : "Book a call"}
        </a>
      </p>
      {#if reference}<p class="type-meta m-0">Report reference: {reference}</p>{/if}
    </ContentWidth>
  </section>
</div>
