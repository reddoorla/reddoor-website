<script lang="ts">
  import ReportDisclosure from "./ReportDisclosure.svelte";
  import type { ReportView } from "./model";

  // Whether the site works — checked the way a stranger would check it.
  //
  // These sit under "What you control" because every one of them is a site edit
  // with a before and an after, which is the whole basis on which this half of
  // the report is allowed to promise anything.
  //
  // Each row is a finding, not a score. A count of broken links is a fact a
  // reader can go and check in thirty seconds; a "site health score" would be
  // another number we invented and then graded people against. Where a check
  // could not run, it says so rather than rendering a reassuring zero — "we did
  // not measure" and "nothing was wrong" are opposite claims and only one of
  // them is ours to make.
  //
  // THE LAYOUT IS THE ARGUMENT. An earlier version gave every check a full row,
  // so on a healthy site the loudest thing in a section headed "Does it work"
  // was a row reading "Copyright year — 2026 — Current". A finding that nothing
  // is wrong must not occupy the same space as eleven broken links. So the rows
  // split: anything worth acting on gets a full row with its detail, and
  // everything that passed collapses into one compact list underneath. That also
  // buys room to check far more — sixteen quiet passes read as thoroughness,
  // sixteen fat rows read as padding.

  let { view }: { view: ReportView } = $props();

  const mb = (bytes: number): string => (bytes / 1_000_000).toFixed(1);
  const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

  type Row = {
    key: string;
    label: string;
    /** The finding in a phrase. */
    value: string;
    /** Worth their attention? Drives the only colour on the row, and decides
     *  whether it gets a row at all or joins the cleared list. */
    alert: boolean;
    /** Shown only on a full row — a cleared check needs no explaining. */
    detail: string;
  };

  const rows = $derived.by((): Row[] => {
    const out: Row[] = [];
    const { assets, journey, consistency, basics } = view;

    // ── Can people reach it at all ───────────────────────────────────────
    // First, because everything below assumes the answer is yes.
    if (basics) {
      if (basics.insecureEntry.measured) {
        out.push({
          key: "https",
          label: "Typing your address without “https”",
          value: basics.insecureEntry.ok ? "Redirects to the secure site" : "Does not redirect",
          alert: !basics.insecureEntry.ok,
          detail:
            "Pasted links, printed cards and old bookmarks all still start with plain http. When that does not " +
            "redirect, the visitor gets a browser warning saying your site is not secure — or nothing at all.",
        });
      }

      // No counterpart to check is not a finding; a counterpart that fails is.
      if (basics.hostVariant.measured) {
        out.push({
          key: "host",
          label: `Visitors who type ${basics.hostVariant.host}`,
          value: basics.hostVariant.ok ? "Lands on your site" : "Does not reach you",
          alert: !basics.hostVariant.ok,
          detail:
            "Half the people who type your address by hand will include the www and half will leave it off. " +
            "Both spellings need to end up in the same place.",
        });
      }

      if (basics.notFound.measured) {
        // Three outcomes, not two, and the third is the one live sites actually
        // have. Ludlow Kingsley answers 200 for every missing URL by quietly
        // redirecting it to the homepage — so a mistyped link shows a real page
        // that is not the one asked for, which is a different problem from an
        // empty 200 in place and deserves different words.
        const soft = basics.notFound.status !== null && basics.notFound.status < 400;
        const redirected =
          soft &&
          basics.notFound.landedOn !== null &&
          basics.notFound.landedOn !== basics.notFound.url;
        out.push({
          key: "notfound",
          label: "A page that does not exist",
          value: redirected
            ? "Quietly shows another page instead"
            : soft
              ? `Answers ${basics.notFound.status}, as though it were real`
              : basics.notFound.linksBackToSite
                ? "Shows your own error page"
                : "Shows a bare error page",
          alert: !basics.notFound.ok,
          detail: redirected
            ? `We asked for a page that cannot exist and your site answered ${basics.notFound.status} with ` +
              `${basics.notFound.landedOn}. Nobody is ever told the link was wrong: a visitor following an outdated ` +
              `link believes they are where they meant to be, and search engines see an unlimited number of ` +
              `addresses all serving the same content.`
            : soft
              ? "Your server says “found” for a page that is not there. Search engines index the empty result, and a " +
                "visitor following a mistyped or outdated link sees what looks like a real but empty page."
              : "Someone reaching a dead link should land on your site with a way back into it, not on a blank " +
                "server message with no navigation. That visitor leaves.",
        });
      }
    }

    // ── On a phone ───────────────────────────────────────────────────────
    if (view.viewportOk !== null) {
      out.push({
        key: "viewport",
        label: "Built for phone screens",
        value: view.viewportOk ? "Yes" : "No",
        alert: !view.viewportOk,
        detail:
          "Without the one tag that tells a phone how wide the page is, the browser renders it at desktop width and " +
          "shrinks it. The text is unreadable and every tap target is too small. Most of your visitors are on a phone.",
      });
    }

    // A number you cannot tap. Invisible from a desktop, which is where nobody
    // looks for it. `linked` is absent on older reports — undefined must not
    // read as false, so only an explicit false counts.
    if (consistency) {
      const untappable = consistency.phones.filter((p) => p.linked === false);
      if (consistency.phones.length > 0 && consistency.phones.some((p) => p.linked !== undefined)) {
        out.push({
          key: "tappable",
          label: "Tapping your phone number",
          value:
            untappable.length === 0
              ? "Works"
              : `${untappable.length} ${plural(untappable.length, "number is", "numbers are")} plain text`,
          alert: untappable.length > 0,
          detail:
            "On a phone, a number written as text is something the visitor has to memorise and retype. Written as a " +
            "link it is one tap. It is a one-attribute change and it is the moment they were most likely to call.",
        });
      }
    }

    // ── What is broken ───────────────────────────────────────────────────
    if (assets) {
      const broken = assets.brokenLinks.length + assets.brokenImages.length;
      out.push({
        key: "broken",
        label: "Broken links and images",
        value: broken === 0 ? "None found" : `${broken} found`,
        alert: broken > 0,
        // The denominator, always. Saying "no broken links" having tested 40
        // of 200 is the kind of quiet overclaim this report exists not to make.
        detail:
          `We checked ${assets.linksChecked} of ${assets.linksFound} links and ` +
          `${assets.imagesChecked} of ${assets.imagesFound} images. Each one below is an address you can open.`,
      });
    }

    if (basics?.mixedContent.measured) {
      const n = basics.mixedContent.imageUrls.length;
      out.push({
        key: "mixed",
        label: "Images loaded insecurely",
        value: n === 0 ? "None" : `${n} ${plural(n, "image", "images")}`,
        alert: n > 0,
        detail:
          `Your site is served securely, but ${n === 1 ? "this image is" : "these images are"} requested over plain ` +
          `http. Browsers block or refuse to upgrade them, so they are broken for some visitors and a security ` +
          `warning for the rest. Of ${basics.mixedContent.imagesSeen} images we could see.`,
      });
    }

    // ── Weight ───────────────────────────────────────────────────────────
    // Null, not zero: a server that does not report content-length leaves this
    // genuinely unknown, and printing "0 MB of images" for a page full of
    // photographs would be a lie the reader can see through.
    if (assets && assets.imageBytesMeasured !== null) {
      const heaviest = assets.heaviestImages.at(0);
      out.push({
        key: "weight",
        label: "Image weight",
        value: `${mb(assets.imageBytesMeasured)} MB across ${assets.imagesWithKnownSize} images`,
        alert: (heaviest?.bytes ?? 0) >= 1_000_000,
        detail: heaviest
          ? `The heaviest single image is ${mb(heaviest.bytes ?? 0)} MB. On a phone, that is the ` +
            `difference between a page that appears and one that is still loading when the visitor leaves.`
          : "No single image is large enough to be worth calling out.",
      });
    }

    // ── Reaching you ─────────────────────────────────────────────────────
    if (journey) {
      const dead = journey.deadEnds.length;
      const worst = journey.worstClicksToContact;
      out.push({
        key: "contact",
        label: "Getting hold of you",
        value:
          journey.affordances.length === 0
            ? "No way to make contact found"
            : dead > 0
              ? `${dead} of ${journey.pagesExamined} pages offer no route`
              : // Null with no dead ends should not be reachable, but it is a
                // count rather than a guarantee — say we did not measure it
                // rather than print "At most null clicks away".
                worst === null
                ? "Not measured"
                : worst === 0
                  ? "Every page offers a way"
                  : `At most ${worst} ${plural(worst, "click", "clicks")} away`,
        alert: journey.affordances.length === 0 || dead > 0,
        detail:
          `Search engines send people to whichever page answers their question, not to your home ` +
          `page — so we measured this from all ${journey.pagesExamined} pages we looked at, not just the first.`,
      });
    }

    // ── Content basics ───────────────────────────────────────────────────
    if (basics && basics.altText.imagesTotal > 0) {
      const { imagesTotal, imagesWithAlt, pagesExamined } = basics.altText;
      const without = imagesTotal - imagesWithAlt;
      const share = Math.round((imagesWithAlt / imagesTotal) * 100);
      out.push({
        key: "alt",
        label: "Images with a description",
        value: `${share}%`,
        // Below half is worth raising; a handful of decorative images is not.
        alert: share < 50,
        detail:
          `${without} of ${imagesTotal} images across ${pagesExamined} pages carry no alt text. Anyone using a ` +
          `screen reader hears nothing there, and nothing that reads your pages — including the engines above — ` +
          `knows what those pictures show.`,
      });
    }

    if (basics && basics.duplicateTitles.length > 0) {
      const worst = basics.duplicateTitles[0];
      out.push({
        key: "titles",
        label: "Pages sharing one title",
        value: `${basics.duplicateTitles.length} ${plural(basics.duplicateTitles.length, "title", "titles")} reused`,
        alert: true,
        detail: worst
          ? `“${worst.title}” is the title of ${worst.pages.length} different pages. That text is the browser tab, ` +
            `the bookmark and the search result, so those pages are indistinguishable in all three.`
          : "",
      });
    }

    // ── Saying the same thing everywhere ─────────────────────────────────
    if (consistency) {
      if (consistency.phones.length > 0) {
        out.push({
          key: "phones",
          label: "Phone numbers",
          value:
            consistency.phones.length === 1
              ? "One, used consistently"
              : `${consistency.phones.length} different numbers`,
          alert: consistency.phones.length > 1,
          detail:
            "A visitor cannot tell which one is current, and anything trying to reconcile your business across " +
            "sources sees it disagreeing with itself.",
        });
      }

      if (consistency.newestCopyrightYear !== null) {
        // Compared against the audit's own date rather than today's, so a
        // report reread next year does not silently change its own findings.
        //
        // On a current site this is now a one-line entry in the cleared list
        // rather than a full row — which is the whole point of the split. It is
        // a real finding when it is stale and a triviality when it is not, and
        // the layout should say so.
        const auditYear = view.generatedAt ? new Date(view.generatedAt).getFullYear() : null;
        const stale = auditYear !== null && auditYear - consistency.newestCopyrightYear >= 2;
        out.push({
          key: "copyright",
          label: "Copyright year",
          value: String(consistency.newestCopyrightYear),
          alert: stale,
          detail:
            "It reads as a site nobody has touched in years — to every visitor, on every page.",
        });
      }

      if (consistency.pagesOffTemplate.length > 0) {
        out.push({
          key: "template",
          label: "Pages outside your template",
          value: `${consistency.pagesOffTemplate.length} found`,
          alert: true,
          detail:
            "These carry none of your site's navigation. Someone who lands on one is in a different website with " +
            "no way back into this one.",
        });
      }
    }

    return out;
  });

  const problems = $derived(rows.filter((r) => r.alert));
  const cleared = $derived(rows.filter((r) => !r.alert));

  const hasReceipts = $derived(
    Boolean(
      view.assets &&
      (view.assets.brokenLinks.length > 0 ||
        view.assets.brokenImages.length > 0 ||
        view.assets.heaviestImages.length > 0),
    ) || Boolean(view.basics && view.basics.mixedContent.imageUrls.length > 0),
  );
</script>

{#if rows.length === 0}
  <p class="type-lede m-0 max-w-[52ch] text-muted">
    These checks did not run on this audit. That is a gap in the measurement, not a finding about
    your site.
  </p>
{:else}
  <div class="flex flex-col gap-10">
    <p class="type-lede m-0 max-w-[52ch] text-black">
      {#if problems.length === 0}
        We ran {rows.length} checks on the things that quietly cost you visitors, and every one of them
        came back clean.
      {:else}
        Of {rows.length} checks, {problems.length}
        {plural(problems.length, "is", "are")} worth your attention.
      {/if}
    </p>

    <!-- The findings, at full weight. -->
    {#if problems.length > 0}
      <dl class="m-0 flex w-full flex-col">
        {#each problems as row (row.key)}
          <div class="flex flex-col gap-1.5 border-t border-light py-6">
            <div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <dt class="type-eyebrow m-0 text-primary">{row.label}</dt>
              <dd class="type-question m-0 text-primary">{row.value}</dd>
            </div>
            <p class="type-meta m-0 max-w-[62ch] text-muted">{row.detail}</p>
          </div>
        {/each}
      </dl>
    {/if}

    <!-- Everything that passed, at the weight a pass deserves: one line each,
         two columns, no explanation. It is a receipt for the breadth of the
         check, not a set of findings, and it must never out-shout the block
         above. -->
    {#if cleared.length > 0}
      <div class="flex flex-col gap-4 {problems.length > 0 ? 'border-t border-light pt-8' : ''}">
        <p class="type-eyebrow m-0 text-dark">
          {problems.length > 0 ? "Also checked, nothing wrong" : "What we checked"}
        </p>
        <dl class="m-0 grid w-full grid-cols-1 gap-x-10 gap-y-2 sm:grid-cols-2">
          {#each cleared as row (row.key)}
            <div
              class="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-light/60 py-1.5"
            >
              <dt class="type-meta m-0 text-muted">{row.label}</dt>
              <dd class="type-meta m-0 text-right text-dark tabular-nums">{row.value}</dd>
            </div>
          {/each}
        </dl>
      </div>
    {/if}

    <!-- The receipts. Every finding above names something a reader can open in
         another tab and check for themselves, which is the difference between
         a report and an assertion. -->
    {#if hasReceipts}
      <div class="flex flex-col border-t border-light">
        <ReportDisclosure title="See exactly what we found, with the addresses">
          <div class="flex flex-col gap-6 pt-1">
            {#if view.assets && view.assets.brokenLinks.length > 0}
              <div class="flex flex-col gap-2">
                <p class="type-eyebrow m-0 text-dark">Links that did not load</p>
                {#each view.assets.brokenLinks.slice(0, 12) as item (item.url)}
                  <p class="m-0 text-sm break-all text-muted">
                    <span class="font-medium text-primary">{item.status}</span>
                    {item.url}
                    <span class="text-light"
                      >— linked from {item.referencedBy.length}
                      {plural(item.referencedBy.length, "page", "pages")}</span
                    >
                  </p>
                {/each}
              </div>
            {/if}

            {#if view.assets && view.assets.brokenImages.length > 0}
              <div class="flex flex-col gap-2">
                <p class="type-eyebrow m-0 text-dark">Images that did not load</p>
                {#each view.assets.brokenImages.slice(0, 12) as item (item.url)}
                  <p class="m-0 text-sm break-all text-muted">
                    <span class="font-medium text-primary">{item.status}</span>
                    {item.url}
                  </p>
                {/each}
              </div>
            {/if}

            {#if view.basics && view.basics.mixedContent.imageUrls.length > 0}
              <div class="flex flex-col gap-2">
                <p class="type-eyebrow m-0 text-dark">Images requested over plain http</p>
                {#each view.basics.mixedContent.imageUrls as url (url)}
                  <p class="m-0 text-sm break-all text-muted">{url}</p>
                {/each}
              </div>
            {/if}

            {#if view.assets && view.assets.heaviestImages.length > 0}
              <div class="flex flex-col gap-2">
                <p class="type-eyebrow m-0 text-dark">Heaviest images</p>
                {#each view.assets.heaviestImages as item (item.url)}
                  <p class="m-0 text-sm break-all text-muted">
                    <span class="font-medium text-black tabular-nums">{mb(item.bytes ?? 0)} MB</span
                    >
                    {item.url}
                  </p>
                {/each}
              </div>
            {/if}
          </div>
        </ReportDisclosure>
      </div>
    {/if}
  </div>
{/if}
