<script lang="ts">
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import { animateIn as anim } from "$lib/actions/animateIn";
  import arrowButton from "$lib/assets/icons/arrowButton.svg";
  import Img from "$lib/components/Img.svelte";
  import RevogenBanner from "$lib/components/RevogenHero/RevogenBanner.svelte";
  import VimeoBanner from "$lib/components/RevogenHero/VimeoBanner.svelte";
  // Featured-project imagery — exported from Figma, delivered via the ?as=run
  // (vite-imagetools) responsive pipeline. See the featured sequence in markup.
  import rubrikHero from "$lib/assets/images/rubrikHero.jpg?as=run";
  import rubrikReport from "$lib/assets/images/rubrikReport.jpg?as=run";
  import revogenPackaging from "$lib/assets/images/revogenPackaging.jpg?as=run";
  import ceoLanyard from "$lib/assets/images/ceoLanyard.jpg?as=run";
  import ceoBrandGrid from "$lib/assets/images/ceoBrandGrid.jpg?as=run";
  import trinitySteps from "$lib/assets/images/trinitySteps.jpg?as=run";
  import trinityTablet from "$lib/assets/images/trinityTablet.jpg?as=run";
  import stJamesMural from "$lib/assets/images/stJamesMural.jpg?as=run";
  import stJamesPhone from "$lib/assets/images/stJamesPhone.jpg?as=run";
  import gallerySonder from "$lib/assets/images/gallerySonder.jpg?as=run";
  import type { ProjectDocument } from "../../../prismicio-types.js";
  import { tick } from "svelte";
  import { fade, scale, slide } from "svelte/transition";
  import DefaultButton from "$lib/components/Buttons/DefaultButton.svelte";
  import type { PageData } from "./$types";
  import { mediumString, toSearchRecord } from "$lib/utils/projectServices";
  import { imgixSrcset } from "$lib/utils/imgix";
  import { ArrowDown, ChevronDown, Minus, Search, X } from "@lucide/svelte";

  let { data }: { data: PageData } = $props();

  let projectsDiv: HTMLElement;

  let showAllProjectsButton = $state(true);

  // The six category toggles, in button order. Kept in one config so the button
  // row renders from a single {#each} and the tri-state look (below) isn't
  // copy-pasted per button. `label` is the button text; `name` is the aria wording.
  const FILTERS = [
    { key: "brand", label: "BRAND", name: "Brand" },
    { key: "print", label: "PRINT", name: "Print" },
    { key: "environmental", label: "ENVIRONMENTAL", name: "Environmental" },
    { key: "product", label: "PRODUCT", name: "Product" },
    { key: "digital", label: "DIGITAL", name: "Digital" },
    { key: "packaging", label: "PACKAGING", name: "Packaging" },
  ] as const;
  type Cat = (typeof FILTERS)[number]["key"];

  // ── Pending vs applied ──────────────────────────────────────────────────────
  // Controls mutate PENDING state (cats / orderString / searchQuery) immediately so
  // they feel responsive. The GRID reads APPLIED state and only catches up inside a
  // View Transition (see the committer below), so clicking mid-animation queues the
  // next set instead of interrupting the current animation.
  let cats = $state<Record<Cat, boolean>>({
    brand: false,
    print: false,
    environmental: false,
    product: false,
    digital: false,
    packaging: false,
  });

  let searchQuery = $state("");

  // While a search is active, results rank by relevance unless the visitor picks a
  // real sort. RELEVANCE is only offered while searching; DEFAULT_ORDER is what we
  // fall back to when the query clears.
  const RELEVANCE = "Relevance";
  const DEFAULT_ORDER = "Latest-Earliest";
  let orderString = $state(DEFAULT_ORDER);

  // What the grid actually reflects; commitPending() copies pending → applied inside
  // one serialized View Transition. The grid derivations all read from here.
  let applied = $state({
    brand: false,
    print: false,
    environmental: false,
    product: false,
    digital: false,
    packaging: false,
    order: DEFAULT_ORDER,
    query: "",
  });
  const appliedShowAll = $derived(
    !(
      applied.brand ||
      applied.digital ||
      applied.environmental ||
      applied.product ||
      applied.print ||
      applied.packaging
    ),
  );

  let isOrderSelectOpen = $state(false);

  // Refs for the sort dropdown, used for outside-click / Escape handling below.
  let sortDropdown: HTMLElement | undefined = $state();
  let sortTrigger: HTMLButtonElement | undefined = $state();

  $effect(() => {
    // Close the dropdown whenever a filter/sort changes. Track pending cats + order
    // (so picking a sort closes it instantly) and applied.query (not raw
    // searchQuery, so typing doesn't slam it shut on every keystroke — it closes
    // once the search commits).
    const _deps = [
      cats.brand,
      cats.digital,
      cats.environmental,
      cats.product,
      cats.print,
      cats.packaging,
      orderString,
      applied.query,
    ];
    isOrderSelectOpen = false;
  });

  // While the sort dropdown is open, close it on an outside click or Escape.
  // Listeners only exist while open; the effect re-runs when isOrderSelectOpen
  // flips and its teardown removes them. (Writes happen in handlers, never in the
  // effect body, so this doesn't self-trigger.)
  $effect(() => {
    if (!isOrderSelectOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (sortDropdown && !sortDropdown.contains(e.target as Node)) {
        isOrderSelectOpen = false;
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        isOrderSelectOpen = false;
        sortTrigger?.focus();
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  });

  const sortedProjects = $derived(
    [...data.allProjects].sort((a: ProjectDocument<string>, b: ProjectDocument<string>) => {
      switch (applied.order) {
        case "A-Z":
          return (a.data.title || "").localeCompare(b.data.title || "");
        case "Z-A":
          return (b.data.title || "").localeCompare(a.data.title || "");
        case "Latest-Earliest":
          return (
            new Date(b.first_publication_date).getTime() -
            new Date(a.first_publication_date).getTime()
          );
        case "Earliest-Latest":
          return (
            new Date(a.first_publication_date).getTime() -
            new Date(b.first_publication_date).getTime()
          );
        default:
          return 0;
      }
    }),
  );

  // Minimum query length before search runs; single source of truth shared by
  // Fuse's minMatchCharLength, the rankedUids guard, and the no-results gate.
  const MIN_QUERY = 2;

  // Fuse.js is loaded lazily — it's dead weight on the edge-cached portfolio page
  // for the (many) visitors who never search. The constructor is fetched on the
  // first focus of the search box (loadFuse) and again, defensively, when a query
  // first appears; the index isn't built until it arrives. Until then rankedUids
  // stays null (everything shows).
  let FuseCtor = $state<(typeof import("fuse.js"))["default"] | null>(null);
  let fuseLoadStarted = false;
  async function loadFuse() {
    if (fuseLoadStarted) return;
    fuseLoadStarted = true;
    FuseCtor = (await import("fuse.js")).default;
  }

  const fuse = $derived(
    FuseCtor
      ? new FuseCtor(data.allProjects.map(toSearchRecord), {
          keys: [
            { name: "title", weight: 3 },
            { name: "services", weight: 2 },
            { name: "tagline", weight: 1.5 },
            { name: "body", weight: 1 },
          ],
          threshold: 0.2,
          ignoreLocation: true,
          minMatchCharLength: MIN_QUERY,
        })
      : null,
  );

  let searchInput: HTMLInputElement | undefined = $state();

  function clearSearch() {
    searchQuery = "";
    searchInput?.focus();
  }

  // ─── FLIP motion tuning ─────────────────────────────────────────────────────
  // Cards animate at a roughly CONSTANT on-screen speed no matter how far the grid
  // reflows: the batch duration is derived from how far the farthest *visible* card
  // has to travel (distance ÷ velocity), so a big filter collapse and a small sort
  // nudge feel like they move at the same pace. A card whose start is far off-screen
  // is "cheated" — its start is pulled to just past the viewport edge so it slides in
  // from off-screen instead of rocketing across the whole page. These are the knobs:
  const FLIP_VELOCITY = 0.5; // px per ms — master speed dial (higher = snappier)
  const FLIP_MIN_DURATION = 900; // ms floor — keeps a tiny sort nudge deliberate
  const FLIP_MAX_DURATION = 1550; // ms ceiling — keeps the biggest collapse from dragging
  const FLIP_VIEWPORT_MARGIN = 0.2; // ± fraction of the viewport: BOTH the band of cards
  //   that count toward the duration AND how far off-screen a far card starts.
  const FLIP_EASE = "cubic-bezier(0.16, 1, 0.3, 1)"; // the curve. Try
  //   "cubic-bezier(0.4, 0, 0.2, 1)" if big moves read as bouncy.
  // ───────────────────────────────────────────────────────────────────────────

  // Travel distance (px) → duration (ms): constant velocity, clamped.
  function durationForTravel(travel: number): number {
    const ms = travel / FLIP_VELOCITY;
    return Math.round(Math.min(FLIP_MAX_DURATION, Math.max(FLIP_MIN_DURATION, ms)));
  }

  // Measure every VISIBLE archive card in the DOM, keyed by uid, with its live node.
  // Hidden cards (display:none via the keep-mounted filter) report a zero-area rect
  // and are skipped, so a FLIP's `first`/`last` only ever hold on-screen cards.
  function measureCards(): Map<string, { el: HTMLElement; r: DOMRect }> {
    const m = new Map<string, { el: HTMLElement; r: DOMRect }>();
    if (!projectsDiv) return m;
    for (const el of projectsDiv.querySelectorAll<HTMLElement>("[data-flip-uid]")) {
      const uid = el.dataset.flipUid;
      if (!uid) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue; // hidden card
      m.set(uid, { el, r });
    }
    return m;
  }

  // FLIP the survivors: for every card visible BOTH before and after the applied
  // change, invert (translate it back to its old spot) then play (animate to none)
  // on the LIVE, in-flow node via the Web Animations API. There is no overlay, so
  // the filter buttons stay clickable throughout, the cards scroll with the document
  // for free, and the fixed nav paints above them for free. A card whose old spot is
  // far off-screen starts from the viewport edge (the "cheat") instead of flying the
  // whole page; entering cards appear in place and leaving cards vanish (cards only
  // ever MOVE). Resolves when the animations finish so the committer can serialize.
  function playFlip(
    first: Map<string, { el: HTMLElement; r: DOMRect }>,
    last: Map<string, { el: HTMLElement; r: DOMRect }>,
  ): Promise<void> {
    const marginY = FLIP_VIEWPORT_MARGIN * window.innerHeight;
    const marginX = FLIP_VIEWPORT_MARGIN * window.innerWidth;
    const bandTop = -marginY;
    const bandBottom = window.innerHeight + marginY;
    const inBand = (r: DOMRect) => r.bottom > bandTop && r.top < bandBottom;
    const clampX = (x: number) => Math.min(window.innerWidth + marginX, Math.max(-marginX, x));
    const clampY = (y: number) => Math.min(bandBottom, Math.max(bandTop, y));

    const moves: { el: HTMLElement; dx: number; dy: number }[] = [];
    let maxTravel = 0;

    for (const [uid, b] of first) {
      const a = last.get(uid);
      if (!a) continue; // leaving card — vanishes, no travel
      if (!inBand(b.r) && !inBand(a.r)) continue; // fully off-screen both — skip

      // Pull a far start to just past the viewport edge so the card slides in from
      // off-screen instead of traversing its true (possibly huge) distance.
      const startCx = clampX(b.r.left + b.r.width / 2);
      const startCy = clampY(b.r.top + b.r.height / 2);
      const dx = startCx - (a.r.left + a.r.width / 2);
      const dy = startCy - (a.r.top + a.r.height / 2);
      if (dx === 0 && dy === 0) continue;
      maxTravel = Math.max(maxTravel, Math.hypot(dx, dy));
      moves.push({ el: a.el, dx, dy });
    }

    if (!moves.length) return Promise.resolve();

    const duration = durationForTravel(maxTravel);
    const done = moves.map(({ el, dx, dy }) =>
      el
        .animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0px, 0px)" }],
          { duration, easing: FLIP_EASE },
        )
        .finished.catch(() => {}),
    );
    return Promise.all(done).then(() => {});
  }

  // ── Debounced + serialized committer ────────────────────────────────────────
  // Every pending change (filter, sort, keystroke) resets a debounce timer; when it
  // settles we copy pending → applied and FLIP the grid to catch up. A busy-lock
  // serializes commits so a change made mid-animation queues (and coalesces with any
  // other in-flight changes) instead of interrupting the running FLIP. The filter
  // buttons stay live throughout — they only mutate PENDING state, never the grid —
  // so you can hammer them and every click lands. This shared debounce is also what
  // gives search its ~250ms settle (no separate one).
  const COMMIT_DEBOUNCE = 250; // ms
  let committing = false;
  let commitTimer = 0;

  function pendingEqualsApplied(): boolean {
    return (
      applied.brand === cats.brand &&
      applied.print === cats.print &&
      applied.environmental === cats.environmental &&
      applied.product === cats.product &&
      applied.digital === cats.digital &&
      applied.packaging === cats.packaging &&
      applied.order === orderString &&
      applied.query === searchQuery
    );
  }

  async function commitPending(): Promise<void> {
    // Default to Relevance the moment a search becomes active, and restore a real
    // sort when it clears — but never override a sort the visitor picked themselves.
    const wasActive = applied.query.trim().length >= MIN_QUERY;
    const nowActive = searchQuery.trim().length >= MIN_QUERY;
    if (nowActive && !wasActive) orderString = RELEVANCE;
    else if (!nowActive && wasActive && orderString === RELEVANCE) orderString = DEFAULT_ORDER;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // FIRST: card positions before the grid reflows (skipped under reduced motion).
    const first = reduce ? null : measureCards();

    applied.brand = cats.brand;
    applied.print = cats.print;
    applied.environmental = cats.environmental;
    applied.product = cats.product;
    applied.digital = cats.digital;
    applied.packaging = cats.packaging;
    applied.order = orderString;
    applied.query = searchQuery;

    if (!first) return; // reduced motion / SSR: instant, no animation
    await tick(); // flush Svelte's DOM so the grid is in its new layout
    await playFlip(first, measureCards()); // LAST + invert/play the survivors
  }

  async function runCommit() {
    if (committing) return;
    committing = true;
    try {
      // Keep committing until pending == applied, but yield the loop whenever the
      // debounce is pending again (commitTimer set) so a fresh burst keeps batching.
      while (!pendingEqualsApplied() && !commitTimer) {
        await commitPending();
      }
    } finally {
      committing = false;
    }
    // A change that landed during the last commit, with the debounce already
    // settled, still needs its commit.
    if (!commitTimer && !pendingEqualsApplied()) runCommit();
  }

  function fireCommit() {
    commitTimer = 0;
    runCommit();
  }

  // Debounce any pending change into a single (serialized) commit.
  $effect(() => {
    // Track every pending input so this re-runs (and re-arms the debounce) on change.
    void [
      cats.brand,
      cats.print,
      cats.environmental,
      cats.product,
      cats.digital,
      cats.packaging,
      orderString,
      searchQuery,
    ];
    if (typeof window === "undefined") return;
    // Defensive: start loading Fuse as soon as a real query appears.
    if (searchQuery.trim().length >= MIN_QUERY) loadFuse();
    clearTimeout(commitTimer);
    commitTimer = window.setTimeout(fireCommit, COMMIT_DEBOUNCE);
    return () => clearTimeout(commitTimer);
  });

  // Tri-state look for a category button, from pending (cats) vs applied. RED
  // strictly follows the APPLIED state, so a filter queued OFF stays red until its
  // removal animates in. GREY is the "will become active" state (pending on, not yet
  // applied); toggling back to off reverts it to the inactive style.
  function catBtnClass(key: Cat): string {
    if (applied[key]) return "border-primary bg-primary hover:text-light text-white";
    if (cats[key]) return "border-mid bg-mid/15 text-mid";
    return "border-light text-light hover:border-primary hover:text-primary";
  }

  // Fuse results ordered best-match-first; null === "no active query".
  const rankedUids = $derived.by<string[] | null>(() => {
    const q = applied.query.trim();
    if (q.length < MIN_QUERY) return null;
    if (!fuse) return null; // Fuse still loading — show all until the index is ready
    return fuse.search(q).map((r) => r.item.uid);
  });

  function categoryMatch(project: ProjectDocument<string>): boolean {
    return Boolean(
      appliedShowAll ||
      (project.data.branding && applied.brand) ||
      (project.data.digital && applied.digital) ||
      (project.data.environmental && applied.environmental) ||
      (project.data.print && applied.print) ||
      (project.data.product && applied.product) ||
      (project.data.packaging && applied.packaging),
    );
  }

  // The cards on screen: category-filtered, then — while searching — reduced to Fuse
  // matches. With the Relevance sort active those matches are ordered best-match-
  // first; with any real sort active they keep that sort's order (sortedProjects is
  // already sorted), just filtered to the matches. The FLIP animates the difference.
  const visibleProjects = $derived.by(() => {
    const inCategory = sortedProjects.filter(categoryMatch);
    if (rankedUids === null) return inCategory;
    const rank = new Map(rankedUids.map((uid, i) => [uid, i]));
    const matched = inCategory.filter((p) => rank.has(p.uid ?? ""));
    if (applied.order !== RELEVANCE) return matched;
    return matched.sort((a, b) => (rank.get(a.uid ?? "") ?? 0) - (rank.get(b.uid ?? "") ?? 0));
  });

  const visibleCount = $derived(visibleProjects.length);

  // Keep EVERY card mounted so the grid only ever MOVES survivors (no enter/leave
  // DOM churn, no crossfade): we render all projects — the visible ones first, in
  // display order, then the rest hidden with display:none — and toggle the `hidden`
  // class from this set. Hidden cards keep their decoded images, so re-showing a
  // filtered-out card is instant, and measureCards() skips them (zero-area rect).
  const visibleUidSet = $derived(new Set(visibleProjects.map((p) => p.uid)));
  const orderedProjects = $derived([
    ...visibleProjects,
    ...sortedProjects.filter((p) => !visibleUidSet.has(p.uid)),
  ]);

  // The sort dropdown gains a "Relevance" option only while a search is active
  // (tracks the committed query so the option and the results appear together).
  const isSearching = $derived(applied.query.trim().length >= MIN_QUERY);

  // Active category filters (applied), in button order — surfaced to the aria-live
  // region so screen-reader users hear which filter narrowed (or emptied) the grid.
  const activeCategoryLabels = $derived(FILTERS.filter((f) => applied[f.key]).map((f) => f.name));
  const sortOptions = $derived([
    ...(isSearching ? [RELEVANCE] : []),
    "A-Z",
    "Z-A",
    "Latest-Earliest",
    "Earliest-Latest",
  ]);

  $effect(() => {
    const handleScroll = () => {
      if (projectsDiv) {
        const rect = projectsDiv.getBoundingClientRect();
        const isInView = rect.top <= window.innerHeight && rect.bottom >= 0;
        showAllProjectsButton = !isInView;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  });
</script>

<svelte:head>
  <title>Portfolio | Reddoor Creative</title>
</svelte:head>

{#if showAllProjectsButton}
  <a
    class="fixed z-20 bottom-12 right-12 flex flex-col items-center justify-center gap-2 border-light hover:border-primary text-light hover:text-primary transition-opacity duration-300"
    href="#projectsDiv"
    transition:fade={{ duration: 300 }}
  >
    <div class="text-[8px]">All Projects</div>
    <div
      class="w-12 h-12 rounded-full border-2 transition-colors duration-300 flex items-center justify-center"
    >
      <ArrowDown class="size-[2em]" strokeWidth={1.5} aria-hidden="true" />
    </div>
  </a>
{/if}

<section class="w-screen max-h-180 flex flex-col justify-between lg:aspect-video pt-24 bg-paper">
  <div></div>
  <ContentWidth>
    <h5 class="w-4/5 max-w-5xl mr-0 ml-auto mb-20">
      We are honored to work with these amazing clients. Take a look and consider taking your place
      among them.
    </h5>
  </ContentWidth>
  <ContentWidth>
    <h1 class="text-primary w-full text-left font-serif font-normal text-[100px] mb-9">
      Portfolio
    </h1>
  </ContentWidth>
</section>
<!-- ─────────────────────────────────────────────────────────────────────────
     Featured projects. Each card's circular arrow links to its project page.
     Three layout primitives are used: full-bleed banner, offset image (right
     80% column), and 2-col paper-card + image. The recurring red-label /
     services / arrow row is the `featureLabel` snippet. Imagery exported from
     Figma (node 725:1226).
     ───────────────────────────────────────────────────────────────────────── -->
{#snippet featureLabel({
  name,
  services,
  href,
  aria,
  onDark = false,
}: {
  name: string;
  services: string;
  href: string;
  aria: string;
  onDark?: boolean;
})}
  <div class="w-full flex flex-row justify-between items-start gap-5">
    <div>
      <p class="uppercase {onDark ? 'text-white' : 'text-primary'}">{name}</p>
      <p class={onDark ? "text-white" : "text-light"}>{services}</p>
    </div>
    <a
      {href}
      class="shrink-0 {onDark ? 'brightness-200 ' : ''}hover:brightness-50 transition bump"
      aria-label={aria}
    >
      <img src={arrowButton} alt="" class="size-12.5" />
    </a>
  </div>
{/snippet}

<!-- Rubrik Zero Labs — live brand video (Vimeo) with the static frame as poster -->
<VimeoBanner
  vimeoId="1205996665"
  poster={rubrikHero}
  alt="Rubrik Zero Labs — a glowing data sphere above a city at night"
/>
<section class="pt-16 pb-56 bg-paper">
  <ContentWidth>
    <div use:anim class="w-full md:w-4/5 md:ml-[20%]">
      <h2 class="type-feature mb-12 md:mb-16">Smarter Insights to Keep Your Data Protected</h2>
      <div class="w-full md:w-1/2">
        {@render featureLabel({
          name: "Rubrik Zero Labs",
          services: "Brand, Digital",
          href: "/portfolio/rubrik-zero-labs",
          aria: "Go to Rubrik Zero Labs project",
        })}
      </div>
    </div>
  </ContentWidth>
</section>
<ContentWidth animateIn>
  <div class="mb-24 w-full md:w-4/5 md:ml-[20%] -mt-40">
    <Img src={rubrikReport} alt="Rubrik Zero Labs report hub shown on an iMac" class="w-full" />
  </div>
</ContentWidth>

<!-- Revogen — live interactive grafts hero (ported from the Revogen homepage) -->
<RevogenBanner />
<section class="mt-16 mb-24">
  <ContentWidth>
    <div class="w-full md:w-4/5 md:ml-[20%] flex flex-col-reverse lg:flex-row">
      <div
        use:anim={{ delayMax: 0 }}
        class="bg-paper flex flex-col justify-between p-4 w-full lg:w-1/2 aspect-square"
      >
        <h2 class="type-feature-card text-primary">
          A revolutionary brand with a simple purpose: Healing.
        </h2>
        {@render featureLabel({
          name: "Revogen",
          services: "brand, digital, print, environmental",
          href: "/portfolio/revogen",
          aria: "Go to Revogen project",
        })}
      </div>
      <div use:anim={{ delayMax: 0 }} class="w-full lg:w-1/2 aspect-square overflow-hidden">
        <Img
          class="h-full w-full object-cover"
          src={revogenPackaging}
          alt="Revogen product packaging"
        />
      </div>
    </div>
  </ContentWidth>
</section>

<!-- CEO of Los Angeles -->
<ContentWidth animateIn>
  <div class="mb-24 w-full md:w-4/5 md:ml-[20%]">
    <Img
      src={ceoLanyard}
      alt="Chief Executive Office of LA County — employee badge on a lanyard"
      class="w-full"
    />
  </div>
</ContentWidth>
<section class="mb-24">
  <ContentWidth>
    <div class="w-full md:w-4/5 md:ml-[20%] flex flex-col-reverse lg:flex-row">
      <div
        use:anim={{ delayMax: 0 }}
        class="bg-paper flex flex-col justify-between p-4 w-full lg:w-1/2 aspect-square"
      >
        <h2 class="type-feature-card text-primary">
          The &ldquo;buck stops here&rdquo; with a branding system overhaul of LA County&rsquo;s CEO
        </h2>
        {@render featureLabel({
          name: "CEO of Los Angeles",
          services: "brand, digital, print",
          href: "/portfolio/ceo-la",
          aria: "Go to CEO of Los Angeles project",
        })}
      </div>
      <div use:anim={{ delayMax: 0 }} class="w-full lg:w-1/2 aspect-square overflow-hidden">
        <Img
          class="h-full w-full object-cover"
          src={ceoBrandGrid}
          alt="CEO of LA County brand-guidelines grid"
        />
      </div>
    </div>
  </ContentWidth>
</section>
<!-- Trinity Law School -->
<section class="mb-24">
  <ContentWidth>
    <div class="w-full md:w-4/5 md:ml-[20%] flex flex-col-reverse lg:flex-row">
      <div
        use:anim={{ delayMax: 0 }}
        class="relative w-full lg:w-1/2 aspect-square overflow-hidden"
      >
        <Img
          class="absolute inset-0 h-full w-full object-cover"
          src={trinitySteps}
          alt="Trinity Law School — an associate on the campus steps"
        />
        <div
          class="absolute inset-0 pointer-events-none"
          style="background: linear-gradient(180deg, rgba(255,255,255,0) 60%, rgba(0,0,0,0.3) 96%)"
        ></div>
        <div class="absolute bottom-0 left-0 w-full p-4 z-10">
          {@render featureLabel({
            name: "Trinity Law School",
            services: "Print, Digital",
            href: "/portfolio/trinity-law-school",
            aria: "Go to Trinity Law School project",
            onDark: true,
          })}
        </div>
      </div>
      <div use:anim={{ delayMax: 0 }} class="w-full lg:w-1/2 aspect-square overflow-hidden">
        <Img
          class="h-full w-full object-cover"
          src={trinityTablet}
          alt="Trinity Law School JD viewbook on a tablet"
        />
      </div>
    </div>
  </ContentWidth>
</section>
<!-- St. James' Episcopal School -->
<section class="w-screen aspect-3/2 md:aspect-video relative overflow-hidden">
  <Img
    src={stJamesMural}
    alt="St. James' Episcopal School — a colorful painted mural wall"
    class="absolute inset-0 h-full w-full object-cover"
  />
</section>
<section class="mt-16 mb-24">
  <ContentWidth>
    <div class="w-full md:w-4/5 md:ml-[20%] flex flex-col-reverse lg:flex-row">
      <div
        use:anim={{ delayMax: 0 }}
        class="bg-paper flex flex-col justify-between p-4 w-full lg:w-1/2 aspect-square"
      >
        <h2 class="type-feature-card text-primary">
          A diverse, joyful, and inclusive community of young learners.
        </h2>
        {@render featureLabel({
          name: "St. James' Episcopal School",
          services: "brand, digital, print, environmental",
          href: "/portfolio/st-james-episcopal-school",
          aria: "Go to St. James' Episcopal School project",
        })}
      </div>
      <div use:anim={{ delayMax: 0 }} class="w-full lg:w-1/2 aspect-square overflow-hidden">
        <Img
          class="h-full w-full object-cover"
          src={stJamesPhone}
          alt="St. James' Episcopal School responsive website on a phone"
        />
      </div>
    </div>
  </ContentWidth>
</section>

<!-- Gallery Sonder -->
<ContentWidth animateIn>
  <div class="-mb-40 w-full md:w-4/5 md:ml-[20%]">
    <Img src={gallerySonder} alt="Gallery Sonder storefront lit up at night" class="w-full" />
  </div>
</ContentWidth>
<section class="pb-24 bg-paper pt-56">
  <ContentWidth>
    <div use:anim class="w-full md:w-4/5 md:ml-[20%]">
      <h2 class="type-feature mb-12 md:mb-16">
        A local gallery highlighting the stories of emerging and established artists.
      </h2>
      <div class="w-full md:w-1/2">
        {@render featureLabel({
          name: "Gallery Sonder",
          services: "brand, digital, print, environmental",
          href: "/portfolio/gallery-sonder",
          aria: "Go to Gallery Sonder project",
        })}
      </div>
    </div>
  </ContentWidth>
</section>

<!-- CTA — a snippet so the "let's work together" block can repeat: once above the
     archive grid and again as the page footer. -->
{#snippet cta()}
  <div class="w-screen py-40 xl:h-[80vh] bg-paper-red flex flex-col items-center justify-center">
    <ContentWidth class="flex flex-col md:flex-row items-start justify-between">
      <div use:anim>
        <h2 class="type-cta text-white md:w-4/5 xl:w-2/3">
          It's time to arm your brand with a clear story and compelling design
        </h2>
      </div>
      <div use:anim>
        <a href="/contact">
          <DefaultButton
            class="mt-6 text-white border-white border-1 hover:bg-mid/10"
            text="MEET WITH US"
            filled={false}
          />
        </a>
      </div>
    </ContentWidth>
  </div>
{/snippet}

{@render cta()}

<div class="py-24 bg-paper" bind:this={projectsDiv} id="projectsDiv">
  <ContentWidth>
    <div use:anim class="w-full">
      <h2 class="archive-title text-primary w-full text-left mb-12">But wait, there's more!</h2>
    </div>
    <div class="flex flex-row justify-between w-full">
      <div use:anim class="flex flex-row gap-4 mb-24 flex-wrap max-w-full">
        <div class="relative flex items-center">
          <Search
            class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-light pointer-events-none"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <label for="portfolio-search" class="sr-only">Search projects</label>
          <input
            id="portfolio-search"
            type="search"
            data-testid="portfolio-search"
            placeholder="Search projects…"
            bind:this={searchInput}
            bind:value={searchQuery}
            onfocus={loadFuse}
            class="w-56 max-w-full border-1 border-light py-[10px] pl-9 pr-9 text-light placeholder:text-light/60 focus:border-primary focus:text-primary focus:outline-none transition-colors duration-500"
          />
          {#if searchQuery}
            <button
              type="button"
              aria-label="Clear search"
              data-testid="portfolio-search-clear"
              onclick={clearSearch}
              class="absolute right-2 top-1/2 -translate-y-1/2 text-light hover:text-primary transition-colors duration-300"
            >
              <X class="size-4" strokeWidth={1.5} />
            </button>
          {/if}
        </div>
        <!-- Clicking only mutates PENDING state (cats); the committer debounces and
             animates the grid. The tri-state look comes from catBtnClass. -->
        {#each FILTERS as f (f.key)}
          <button
            class="px-5 py-[10px] transition-colors duration-500 border-1 {catBtnClass(f.key)}"
            aria-pressed={cats[f.key]}
            onclick={() => (cats[f.key] = !cats[f.key])}>{f.label}</button
          >
        {/each}
      </div>
      <div use:anim bind:this={sortDropdown} class="relative z-10">
        <div class="w-48 h-12 bg-paper absolute z-20"></div>
        {#if isOrderSelectOpen}
          <!-- display:contents keeps the absolute-positioned option layout while
               giving the options a real listbox container for assistive tech. -->
          <div role="listbox" aria-label="Sort order" id="sort-listbox" class="contents">
            {#each sortOptions as option, i (option)}
              <button
                role="option"
                aria-selected={orderString === option}
                class="pl-5 py-[10px] w-48 h-12 transition-colors duration-500 border-1 border-t-0 mb-24 flex flex-row items-center justify-between absolute top-0 left-0 {orderString ===
                option
                  ? 'border-primary bg-primary  hover:text-light text-white'
                  : 'border-light text-light  bg-white hover:text-primary'}"
                style="transform: translateY({(i + 1) * 100}%)"
                data-testid="sort-option"
                transition:slide
                onclick={() => (orderString = option)}>{option}</button
              >
            {/each}
          </div>
        {/if}
        <button
          bind:this={sortTrigger}
          aria-haspopup="listbox"
          aria-expanded={isOrderSelectOpen}
          aria-controls="sort-listbox"
          aria-label="Sort projects, current order: {orderString}"
          class="relative z-20 pl-5 py-[10px] w-48 h-12 transition-colors duration-500 border-1 mb-24 flex flex-row items-center justify-between {isOrderSelectOpen
            ? 'border-primary bg-primary  hover:text-light text-white'
            : orderString !== applied.order
              ? 'border-mid bg-mid/15 text-mid'
              : 'border-light bg-paper text-light hover:border-primary hover:text-primary'}"
          data-testid="portfolio-sort"
          onclick={() => (isOrderSelectOpen = !isOrderSelectOpen)}
        >
          <div>{orderString}</div>
          <div class="h-12 w-12 relative">
            {#if !isOrderSelectOpen}
              <span
                class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                transition:scale={{ duration: 300 }}
              >
                <ChevronDown class="size-[1em]" strokeWidth={2} />
              </span>
            {/if}
            {#if isOrderSelectOpen}
              <span
                class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                transition:scale={{ duration: 300 }}
              >
                <Minus class="size-[1em]" strokeWidth={2} />
              </span>
            {/if}
          </div>
        </button>
      </div>
    </div>
    <div aria-live="polite" class="sr-only">
      {#if isSearching}
        {visibleCount} project{visibleCount === 1 ? "" : "s"} match "{applied.query}"{activeCategoryLabels.length
          ? ` in ${activeCategoryLabels.join(", ")}`
          : ""}
      {:else if activeCategoryLabels.length}
        {visibleCount} project{visibleCount === 1 ? "" : "s"} in {activeCategoryLabels.join(", ")}
      {/if}
    </div>
    <div class="w-full md:ml-[20%] md:w-4/5 flex flex-row flex-wrap">
      {#each orderedProjects as project (project.uid ?? project.id)}
        <div
          data-flip-uid={project.uid}
          class="md:pr-6 pb-6 w-full lg:w-1/2 aspect-4/3 relative {visibleUidSet.has(project.uid)
            ? ''
            : 'hidden'}"
        >
          <a
            href={"/portfolio/" + project.uid}
            class="h-full w-full flex flex-col justify-end relative"
          >
            <img
              src={project.data.hero.url || ""}
              srcset={imgixSrcset(project.data.hero.url)}
              sizes="(min-width: 1024px) 50vw, 100vw"
              alt={project.data.title + " Hero Image"}
              class="absolute w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              fetchpriority="low"
            />
            <div
              class="w-full h-full absolute top-0 left-0 hover:opacity-60 transition-opacity duration-700"
              style="background: linear-gradient(180deg, rgba(12, 19, 35, 0.15) 0%, rgba(12, 19, 35, 0.80) 81.09%) 50% / cover no-repeat;"
            ></div>

            <div class="w-full flex flex-row justify-between p-6 z-10">
              <div>
                <p class="text-white uppercase">{project.data.title}</p>
                <p class="text-light">{mediumString(project) || ""}</p>
              </div>
              <span class="brightness-200 hover:brightness-50 transition bump" aria-hidden="true">
                <img src={arrowButton} alt="" class="h-full" />
              </span>
            </div>
          </a>
        </div>
      {/each}
    </div>
    {#if applied.query.trim().length >= MIN_QUERY && visibleCount === 0}
      <div
        class="w-full md:ml-[20%] md:w-4/5 py-16 text-center"
        data-testid="portfolio-search-empty"
      >
        <p class="text-light">No projects match "{applied.query}"</p>
        <button
          type="button"
          onclick={clearSearch}
          class="mt-4 px-5 py-[10px] border-1 border-light text-light hover:border-primary hover:text-primary transition-colors duration-500"
        >
          Clear search
        </button>
      </div>
    {/if}
  </ContentWidth>
</div>

<!-- footer -->
{@render cta()}

<style>
  /* The featured-project headlines are <h2> (heading-order: the page goes
     h1 → h2 with no skipped levels). These classes pin their display type so the
     global `h2 { font-family: Besley }` rule doesn't change the look.
     `.type-feature` is the big muted-gray caption headline (Rubrik, Gallery
     Sonder); `.type-feature-card` is the red paper-card headline (Revogen, CEO,
     St James — colour from the `text-primary` utility). The bare `h5` selector
     stays for the hero intro lead, still an <h5>. `.type-cta` is the footer CTA,
     formerly a global <h3>. */
  .type-feature {
    font-family: "pragmatica", "helvetica", sans-serif;
    font-size: 60px;
    font-weight: 200;
    line-height: 140%; /* 84px */
    color: #8b8c8d;
  }

  .type-feature-card {
    font-family: "pragmatica", "helvetica", sans-serif;
    font-size: 40px;
    font-weight: 200;
    line-height: 125%; /* 50px */
  }

  h5 {
    font-family: Pragmatica;
    font-size: 50px;
    font-style: normal;
    font-weight: 200;
    line-height: 140%; /* 70px */
  }

  .type-cta {
    /* Pin the body font: now an <h2>, the global `h2 { font-family: Besley }`
       rule would otherwise change the look. */
    font-family: "pragmatica", "helvetica", sans-serif;
    font-size: 80px;
    font-weight: 200;
    line-height: 90px;
  }

  .archive-title {
    /* Pin the body font: now that this is an <h2> (for heading semantics), the
       global `h2 { font-family: Besley }` rule would otherwise change its look. */
    font-family: "pragmatica", "helvetica", sans-serif;
    font-size: 60px;
    font-style: normal;
    font-weight: 700;
    line-height: 140%; /* 84px */
  }

  @media only screen and (max-width: 1224px) {
    .type-cta {
      font-size: 60px;
      line-height: 72px;
    }
  }

  @media only screen and (max-width: 1024px) {
    .type-cta {
      font-size: 52px;
      line-height: 64px;
    }
  }

  @media only screen and (max-width: 768px) {
    .type-feature {
      font-size: 34px;
    }
    .type-feature-card {
      font-size: 28px;
    }
    h5 {
      font-size: 28px;
    }
  }

  @media only screen and (max-width: 480px) {
    .type-cta {
      font-size: 36px;
      line-height: 48px;
    }
  }
</style>
