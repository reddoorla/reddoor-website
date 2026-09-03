<script lang="ts">
  import ReportDisclosure from "./ReportDisclosure.svelte";
  import type { ReportView } from "./model";

  // What they are running, named back to them.
  //
  // This is the only section of the report that grades nothing. It exists to
  // answer the reader's first silent question — do these people know what they
  // are talking about — before a single finding is made, which is why it sits
  // ahead of "Does it work" rather than in the appendix with the method notes.
  //
  // Naming a WordPress site's THEME and its individual PLUGINS is the line that
  // does the work. Anyone can say "you're on WordPress"; a reader who sees
  // "astra, elementor, gravityforms, wp-rocket" knows we opened the page and
  // read it.
  //
  // Two rules it must not break, both inherited from the audit's own stack.ts:
  //
  //   - Every line carries the URL or header we read it off. A line without a
  //     receipt is an assertion, and this report does not make assertions. The
  //     receipts are folded away because there are dozens of them and they are
  //     for the one reader in ten who checks — but they are always there.
  //   - Our blindness is never their absence. A site whose markup we could not
  //     read renders as "we could not tell", never as a site running nothing.

  let { view }: { view: ReportView } = $props();

  // Mirrors LAYER_ORDER/LAYER_LABELS in the audit's stack.ts. Duplicated rather
  // than imported for the same reason model.ts declares its types structurally
  // — see the note in fetch.ts about the dependency bump this repo cannot take
  // yet. The order is broadest thing first: a reader wants "you're on
  // WordPress" before "you load Hotjar".
  const LAYERS: { key: string; label: string }[] = [
    { key: "cms", label: "Platform" },
    { key: "theme", label: "Theme" },
    { key: "page-builder", label: "Page builder" },
    { key: "framework", label: "Framework" },
    { key: "ecommerce", label: "Store" },
    { key: "plugin", label: "Plugins" },
    { key: "forms", label: "Forms" },
    { key: "analytics", label: "Analytics and tracking" },
    { key: "fonts", label: "Fonts" },
    { key: "hosting", label: "Hosting and CDN" },
  ];

  const stack = $derived(view.stack);

  const groups = $derived(
    LAYERS.map((layer) => ({
      ...layer,
      items: (stack?.items ?? []).filter((i) => i.layer === layer.key),
    })).filter((g) => g.items.length > 0),
  );

  const total = $derived(stack?.items.length ?? 0);
</script>

{#if stack}
  {#if !stack.measured}
    <!-- We could not see. Not "they run nothing" — a site behind a caching
         plugin that rewrites its asset paths is invisible to this, and so is a
         run whose pages never fetched. -->
    <p class="type-lede m-0 text-muted">
      We could not read enough of the markup on this run to tell what the site is built on. That is
      a gap in our measurement, not a finding about the site.
    </p>
  {:else if total === 0}
    <!-- Measured, and recognised nothing. A real and unremarkable answer for a
         hand-built site, and it must not read as a failure. -->
    <p class="type-lede m-0 text-black">
      We read the markup on {stack.pagesExamined}
      {stack.pagesExamined === 1 ? "page" : "pages"} and did not recognise a platform, framework or tracking
      script — which is what a hand-built site looks like.
    </p>
  {:else}
    <div class="flex flex-col gap-10">
      <p class="type-lede m-0 text-black">
        Before anything else, here is what we can see you are running. We read it off your own pages
        — nothing here is a guess, and nothing here is a problem.
      </p>

      <dl class="m-0 flex flex-col gap-0">
        {#each groups as group (group.key)}
          <div
            class="flex flex-col gap-1 border-b border-light py-4 md:flex-row md:items-baseline md:gap-8"
          >
            <dt class="type-meta m-0 shrink-0 text-muted md:w-48">{group.label}</dt>
            <dd class="type-body m-0 min-w-0 text-black">
              {group.items.map((i) => i.name).join(", ")}
            </dd>
          </div>
        {/each}
      </dl>

      <!-- The receipts. Folded because there are dozens and they are for the
           one reader who checks — but a claim we cannot show is a claim we do
           not make, so they are always here. -->
      <div>
        <ReportDisclosure title="Where we read each of these" headingTag="h4">
          <div class="flex flex-col gap-4 pt-2">
            <p class="type-meta m-0 text-muted">
              Each line is the URL or response header we read that name off, on {stack.pagesExamined}
              {stack.pagesExamined === 1 ? "page" : "pages"}{stack.headersExamined
                ? ""
                : " (response headers were not available on this run, so nothing above names your host)"}.
            </p>
            <ul class="m-0 flex list-none flex-col gap-3 p-0">
              {#each stack.items as item (item.layer + item.name)}
                <li class="flex flex-col gap-0.5">
                  <span class="type-meta text-black">{item.name}</span>
                  <!-- Wraps rather than truncates: a receipt the reader cannot
                       read in full is not a receipt. -->
                  <code class="type-meta wrap-anywhere text-muted">{item.evidence}</code>
                </li>
              {/each}
            </ul>
          </div>
        </ReportDisclosure>
      </div>
    </div>
  {/if}
{/if}
