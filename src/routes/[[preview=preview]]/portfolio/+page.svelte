<script lang="ts">
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import { animateIn as anim } from "$lib/actions/animateIn";
  import ScreenWidthImage from "$lib/components/ScreenWidth/ScreenWidthImage.svelte";
  import FourByThreeImage from "$lib/components/FullWidth/FourByThreeImage.svelte";
  import ceoHeroDesktop from "$lib/assets/images/CEO_HERO_Badge_Lanyard 1.jpg?as=run";
  import ceoHeroMobile from "$lib/assets/images/ceoHeroMobile.jpg?as=run";
  import arrowButton from "$lib/assets/icons/arrowButton.svg";
  import bed from "$lib/assets/images/bed.jpg?as=run";
  import catalogs from "$lib/assets/images/catalogs.jpg?as=run";
  import longHollow from "$lib/assets/images/longHollow.png?as=run";
  import hq from "$lib/assets/images/headquarters.png?as=run";
  import screamer from "$lib/assets/images/screamer.jpg";
  import roadmap from "$lib/assets/images/roadmap.png?as=run";
  import stJames from "$lib/assets/images/stJames.jpg?as=run";
  import report from "$lib/assets/images/annualReport.png?as=run";
  import dentist from "$lib/assets/images/1800dentist.png?as=run";
  import Img from "$lib/components/Img.svelte";
  import type { ProjectDocument } from "../../../prismicio-types.js";
  import { tick } from "svelte";
  import { fade, scale, slide } from "svelte/transition";
  import DefaultButton from "$lib/components/Buttons/DefaultButton.svelte";
  import type { PageData } from "./$types";
  import { mediumString, toSearchRecord } from "$lib/utils/projectServices";
  import { ArrowDown, ChevronDown, Minus, Search, X } from "@lucide/svelte";
  import Fuse from "fuse.js";

  let { data }: { data: PageData } = $props();

  let projectsDiv: HTMLElement;

  let viewportWidth = $state(0);
  let viewportHeight = $state(0);
  let showAllProjectsButton = $state(true);

  const ceoHero = $derived(viewportWidth < 768 ? ceoHeroMobile : ceoHeroDesktop);

  let showBrand = $state(false);
  let showDigital = $state(false);
  let showEnvironmental = $state(false);
  let showProduct = $state(false);
  let showPackaging = $state(false);
  let showPrint = $state(false);
  let showWeb = $state(false);

  let searchQuery = $state("");

  const showAll = $derived(
    !(
      showBrand ||
      showDigital ||
      showEnvironmental ||
      showProduct ||
      showPrint ||
      showWeb ||
      showPackaging
    ),
  );

  // While a search is active, results rank by relevance unless the visitor picks a
  // real sort. RELEVANCE is only offered while searching; DEFAULT_ORDER is what we
  // fall back to when the query clears.
  const RELEVANCE = "Relevance";
  const DEFAULT_ORDER = "Latest-Earliest";
  let orderString = $state(DEFAULT_ORDER);

  let isOrderSelectOpen = $state(false);

  $effect(() => {
    // read filters/order so the dropdown closes whenever any of them change
    const _deps = [
      showBrand,
      showDigital,
      showEnvironmental,
      showProduct,
      showPrint,
      showWeb,
      showPackaging,
      orderString,
      searchQuery,
    ];
    isOrderSelectOpen = false;
  });

  const sortedProjects = $derived(
    [...data.allProjects].sort((a: ProjectDocument<string>, b: ProjectDocument<string>) => {
      switch (orderString) {
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
  // Fuse's minMatchCharLength, the matchedUids guard, and the no-results gate.
  const MIN_QUERY = 2;

  const fuse = $derived(
    new Fuse(data.allProjects.map(toSearchRecord), {
      keys: [
        { name: "title", weight: 3 },
        { name: "services", weight: 2 },
        { name: "tagline", weight: 1.5 },
        { name: "body", weight: 1 },
      ],
      threshold: 0.2,
      ignoreLocation: true,
      minMatchCharLength: MIN_QUERY,
    }),
  );

  let debouncedQuery = $state("");
  let searchInput: HTMLInputElement | undefined = $state();

  function clearSearch() {
    searchQuery = "";
    searchInput?.focus();
  }

  // ─── View-transition motion tuning ─────────────────────────────────────────
  // Cards animate at a roughly CONSTANT on-screen speed no matter how far the grid
  // reflows: the duration is derived from how far the farthest *visible* card has
  // to travel (distance ÷ velocity), so a big filter collapse and a small sort
  // nudge feel like they move at the same pace. A card whose start is far off-
  // screen is "cheated" — its start is pulled to just past the viewport edge so it
  // slides in from off-screen instead of rocketing across the whole page.
  // These are the knobs to play with:
  const VT_VELOCITY = 0.5; // px per ms — master speed dial (higher = snappier)
  const VT_MIN_DURATION = 900; // ms floor — keeps a tiny sort nudge deliberate
  const VT_MAX_DURATION = 1550; // ms ceiling — keeps the biggest collapse from dragging
  const VT_VIEWPORT_MARGIN = 0.2; // ± fraction of the viewport. Defines BOTH the band
  //   of cards that count toward the duration AND how far off-screen a far card
  //   starts (it slides in from this edge). 0.2 = ±20vh / ±20vw.
  const VT_EASE = "cubic-bezier(0.16, 1, 0.3, 1)"; // the curve. Try
  //   "cubic-bezier(0.4, 0, 0.2, 1)" if big moves read as bouncy.
  // ───────────────────────────────────────────────────────────────────────────

  type CardBox = { cx: number; cy: number; top: number; bottom: number };

  // Center + vertical extent of every named archive card currently in the DOM,
  // keyed by uid. Read synchronously; getBoundingClientRect is valid inside the
  // View Transition callback even though painting is frozen (layout still runs).
  function cardCenters(): Map<string, CardBox> {
    if (!projectsDiv) return new Map();
    const entries: [string, CardBox][] = [];
    for (const el of projectsDiv.querySelectorAll<HTMLElement>("[data-vt-uid]")) {
      const uid = el.dataset.vtUid;
      if (!uid) continue;
      const r = el.getBoundingClientRect();
      entries.push([
        uid,
        { cx: r.left + r.width / 2, cy: r.top + r.height / 2, top: r.top, bottom: r.bottom },
      ]);
    }
    return new Map(entries);
  }

  // Travel distance (px) → duration (ms): constant velocity, clamped.
  function durationForTravel(travel: number): number {
    const ms = travel / VT_VELOCITY;
    return Math.round(Math.min(VT_MAX_DURATION, Math.max(VT_MIN_DURATION, ms)));
  }

  // Wrap a list-changing state update in a View Transition. The browser snapshots
  // the grid before & after; we measure how far the farthest visible card moves to
  // set a constant-velocity duration, and (for cards whose true start is far off-
  // screen) rewrite their group animation so they slide in from just past the
  // viewport edge instead of flying the full distance. `await tick()` flushes
  // Svelte's DOM inside the snapshot. Falls back to an instant update when the API
  // is unavailable or the user prefers reduced motion.
  function withViewTransition(update: () => void) {
    if (
      typeof document === "undefined" ||
      !document.startViewTransition ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      update();
      return;
    }

    const before = cardCenters();
    // Cards whose start was clamped to the viewport edge. Each animates from this
    // screen-space offset applied ON TOP of the browser's own positioning
    // transform — filled in after `ready`, where that transform actually exists.
    const clamped: { uid: string; dx: number; dy: number }[] = [];

    const transition = document.startViewTransition(async () => {
      update();
      await tick();

      const after = cardCenters();
      const marginY = VT_VIEWPORT_MARGIN * window.innerHeight;
      const marginX = VT_VIEWPORT_MARGIN * window.innerWidth;
      const bandTop = -marginY;
      const bandBottom = window.innerHeight + marginY;
      const inBand = (b: CardBox) => b.bottom > bandTop && b.top < bandBottom;
      const clampX = (x: number) => Math.min(window.innerWidth + marginX, Math.max(-marginX, x));
      const clampY = (y: number) => Math.min(bandBottom, Math.max(bandTop, y));

      let maxTravel = 0;

      for (const [uid, b] of before) {
        const a = after.get(uid);
        if (!a) continue; // leaving card — fades in place, no travel
        if (!inBand(b) && !inBand(a)) continue; // fully off-screen — cheated

        // Pull a far start to just past the viewport edge: the card slides in from
        // off-screen instead of traversing its true (possibly huge) distance.
        const startX = clampX(b.cx);
        const startY = clampY(b.cy);
        const dx = startX - a.cx;
        const dy = startY - a.cy;
        maxTravel = Math.max(maxTravel, Math.hypot(dx, dy));

        if (startX !== b.cx || startY !== b.cy) clamped.push({ uid, dx, dy });
      }

      document.documentElement.style.setProperty(
        "--vt-duration",
        `${durationForTravel(maxTravel)}ms`,
      );
      document.documentElement.style.setProperty("--vt-ease", VT_EASE);
    });

    // Once the pseudo-elements exist, retarget each clamped card's group animation
    // to START from the clamped offset *composed with* the browser's end
    // (positioning) transform — so it slides in from the viewport edge to its real
    // slot, instead of collapsing to the top-left origin (which is what replacing
    // the transform with a bare translate(0,0) did). We rewrite keyframes only, so
    // the UA animation's timing — already driven by --vt-duration / --vt-ease —
    // is preserved.
    if (clamped.length) {
      transition.ready
        .then(() => {
          for (const { uid, dx, dy } of clamped) {
            const pseudo = `::view-transition-group(vt-${uid})`;
            for (const anim of document.getAnimations()) {
              const effect = anim.effect;
              if (!(effect instanceof KeyframeEffect) || effect.pseudoElement !== pseudo) continue;
              const frames = effect.getKeyframes();
              const end = frames[frames.length - 1]?.transform;
              if (!end || end === "none") break; // can't position safely → leave default
              effect.setKeyframes([
                { transform: `translate(${dx}px, ${dy}px) ${end}`, offset: 0 },
                { transform: String(end), offset: 1 },
              ]);
              break;
            }
          }
        })
        .catch(() => {});
    }
  }

  // ~250ms debounce. This writes DIFFERENT state vars (debouncedQuery / orderString)
  // than the one it reads synchronously (searchQuery); the reads inside the timeout
  // run outside the effect's tracked scope, so this does NOT trip the Svelte 5
  // $effect self-write scheduler bug.
  $effect(() => {
    const q = searchQuery;
    const id = setTimeout(
      () =>
        withViewTransition(() => {
          const wasActive = debouncedQuery.trim().length >= MIN_QUERY;
          const nowActive = q.trim().length >= MIN_QUERY;
          debouncedQuery = q;
          // Default to relevance the moment a search becomes active, and restore a
          // real sort when it clears — but never override a sort the visitor picked
          // themselves while searching.
          if (nowActive && !wasActive) orderString = RELEVANCE;
          else if (!nowActive && wasActive && orderString === RELEVANCE)
            orderString = DEFAULT_ORDER;
        }),
      250,
    );
    return () => clearTimeout(id);
  });

  // Fuse results ordered best-match-first; null === "no active query".
  const rankedUids = $derived.by<string[] | null>(() => {
    const q = debouncedQuery.trim();
    if (q.length < MIN_QUERY) return null;
    return fuse.search(q).map((r) => r.item.uid);
  });

  function categoryMatch(project: ProjectDocument<string>): boolean {
    return Boolean(
      showAll ||
      (project.data.branding && showBrand) ||
      (project.data.digital && showDigital) ||
      (project.data.environmental && showEnvironmental) ||
      (project.data.print && showPrint) ||
      (project.data.product && showProduct) ||
      (project.data.packaging && showPackaging),
    );
  }

  // The cards actually rendered: category-filtered, then — while searching —
  // reduced to Fuse matches. With the Relevance sort active those matches are
  // ordered best-match-first; with any real sort active they keep that sort's order
  // (sortedProjects is already sorted), just filtered to the matches. Only visible
  // cards are in the DOM; the View Transition animates the difference.
  const visibleProjects = $derived.by(() => {
    const inCategory = sortedProjects.filter(categoryMatch);
    if (rankedUids === null) return inCategory;
    const rank = new Map(rankedUids.map((uid, i) => [uid, i]));
    const matched = inCategory.filter((p) => rank.has(p.uid ?? ""));
    if (orderString !== RELEVANCE) return matched;
    return matched.sort((a, b) => (rank.get(a.uid ?? "") ?? 0) - (rank.get(b.uid ?? "") ?? 0));
  });

  const visibleCount = $derived(visibleProjects.length);

  // The sort dropdown gains a "Relevance" option only while a search is active.
  const isSearching = $derived(debouncedQuery.trim().length >= MIN_QUERY);
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

<svelte:window bind:innerWidth={viewportWidth} bind:innerHeight={viewportHeight} />

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

<section
  class="w-screen max-h-[720px] flex flex-col justify-between lg:aspect-video pt-24 bg-paper"
>
  <div></div>
  <ContentWidth>
    <h5 class="w-4/5 max-w-(--breakpoint-lg) mr-0 ml-auto">
      We are honored to work with these amazing clients. Take a look and consider taking your place
      among them.
    </h5>
  </ContentWidth>
  <ContentWidth>
    <h1 class="text-primary w-full text-left">Portfolio</h1>
  </ContentWidth>
</section>
<section class="max-w-screen overflow-x-clip">
  <div
    class="right-0 max-h-screen aspect-video relative {viewportHeight * 16 > viewportWidth * 9
      ? 'h-screen min-w-full'
      : 'w-screen min-h-full'}"
  >
    <Img
      src={ceoHero}
      alt="ceo name tag"
      class="absolute h-full w-full max-w-screen object-cover object-left"
      style="object-position:{viewportWidth < 1440 && viewportWidth > 768
        ? viewportWidth - (viewportHeight * 16) / 9 + 240
        : 0}px center"
      loading="eager"
      fetchpriority="high"
    />

    <div class="w-full max-w-[100vw] h-full max-h-screen relative">
      <ContentWidth class="h-full z-10 relative">
        <h4 class="md:w-3/5 absolute left-0 top-20 text-white">
          The "buck stops here" with a branding system overhaul of LA County's CEO
        </h4>

        <div class="absolute bottom-20 flex justify-between w-full md:w-2/5">
          <div>
            <p class="text-white">COUNTY OF LOS ANGELES</p>
            <p class="text-light">brand, digital, print</p>
          </div>
          <a
            href="/portfolio/ceo-la"
            class="hover:brightness-200 transition bump"
            aria-label="Go to CEO LA project"
          >
            <img src={arrowButton} alt="" class="h-full" />
          </a>
        </div>
      </ContentWidth>
    </div>
  </div>
</section>
<section class="my-24">
  <ContentWidth>
    <div class="w-full md:w-4/5 md:ml-[20%] flex flex-col">
      <div use:anim>
        <Img class="w-full aspect-4/3" src={bed} alt="a beautiful bed" />
      </div>
      <div class="w-full flex flex-col-reverse lg:flex-row">
        <div
          use:anim={{ delayMax: 0 }}
          class="bg-paper flex flex-col justify-between p-4 w-full lg:w-1/2 aspect-square"
        >
          <h5 class="font-sm text-primary">
            A mission to create beautiful and affordable lighting for the home.
          </h5>
          <div class="w-full flex flex-row justify-between">
            <div>
              <p class="text-primary">PROGRESS LIGHTING</p>
              <p class="text-light">brand, environmental, packaging, print</p>
            </div>
            <a
              href="/portfolio/progress-lighting"
              class="hover:brightness-50 transition bump"
              aria-label="Go to Progress Lighting project"
            >
              <img src={arrowButton} alt="" class="h-full" />
            </a>
          </div>
        </div>
        <div use:anim={{ delayMax: 0 }} class="w-full lg:w-1/2 aspect-square overflow-hidden">
          <Img
            class="h-full w-auto top-0 left-0 object-cover object-left"
            src={catalogs}
            alt="catalogs"
          />
        </div>
      </div>
    </div>
  </ContentWidth>
</section>

<ScreenWidthImage img={longHollow} alt="longhollow ranch" />
<section class="bg-paper pt-16 pb-60 -mb-56">
  <ContentWidth>
    <div class="w-full md:w-4/5 md:ml-[20%]">
      <div use:anim>
        <h4 class=" mb-20">
          An Authentic Texas Ranch <br /> Offering Resort-Quality Retreats.
        </h4>
      </div>

      <div use:anim class="w-full md:w-1/2 flex flex-row justify-between">
        <div>
          <p class="text-primary">LONEHOLLOW RANCH</p>
          <p class="text-light">brand, digital, environmental, print</p>
        </div>
        <a
          href="/portfolio/lonehollow-ranch"
          class="hover:brightness-50 transition bump"
          aria-label="Go to Lonehollow Ranch project"
        >
          <img src={arrowButton} alt="" class="h-full" />
        </a>
      </div>
    </div>
  </ContentWidth>
</section>
<ContentWidth animateIn>
  <div class="w-full md:w-4/5 md:ml-[20%]">
    <FourByThreeImage img={hq} alt="rustic headquarters sign" />
  </div>
</ContentWidth>
<ContentWidth>
  <div class="w-full md:w-4/5 md:ml-[20%] flex flex-col-reverse md:flex-row">
    <div
      use:anim={{ delayMax: 0 }}
      class="flex flex-col justify-between p-4 w-full lg:w-1/2 aspect-square relative"
      style="background-image: url({screamer}); background-size: 180%; background-position:35% 0"
    >
      <div
        class="w-full h-full absolute top-0 left-0"
        style="background: linear-gradient(0deg, rgba(0, 0, 0, 0.25) 0%, rgba(0, 0, 0, 0.25) 100%)"
      ></div>
      <div></div>
      <div class="w-full flex flex-row justify-between z-10">
        <div>
          <p class="text-white">YOUNGLIFE CONNECT</p>
          <p class="text-white">digital</p>
        </div>
        <a
          href="/portfolio/young-life-connect"
          class="brightness-200 hover:brightness-50 transition bump"
          aria-label="Go to YoungLife Connect project"
        >
          <img src={arrowButton} alt="" class="h-full" />
        </a>
      </div>
    </div>
    <div use:anim={{ delayMax: 0 }} class="w-full lg:w-1/2 aspect-square overflow-hidden">
      <Img class="h-full object-cover" src={roadmap} alt="roadmap mockup on iphone" />
    </div>
  </div>
</ContentWidth>
<section class="mt-16">
  <ScreenWidthImage img={stJames} alt="st james' stairwell" />
  <ContentWidth>
    <div class="w-full mt-12 md:w-4/5 md:ml-[20%] flex flex-col">
      <div class="w-full flex flex-col-reverse lg:flex-row">
        <div
          use:anim={{ delayMax: 0 }}
          class="bg-paper flex flex-col justify-between p-4 w-full lg:w-1/2 aspect-square"
        >
          <h5 class="font-sm text-primary">
            A diverse, joyful, and inclusive community of young learners.
          </h5>
          <div class="w-full flex flex-row justify-between">
            <div>
              <p class="text-primary uppercase">St. james' episcopal school</p>
              <p class="text-light">brand, digital, environmental, print</p>
            </div>
            <a
              href="/portfolio/st-james-episcopal-school"
              class="hover:brightness-50 transition bump"
              aria-label="Go to St. James' project"
            >
              <img src={arrowButton} alt="" class="h-full" />
            </a>
          </div>
        </div>
        <div use:anim={{ delayMax: 0 }} class="w-full lg:w-1/2 aspect-square overflow-hidden">
          <Img class="h-full object-cover" src={report} alt="annual reports" />
        </div>
      </div>
    </div>
  </ContentWidth>
</section>

<ContentWidth animateIn>
  <div class="mt-24 w-full md:w-4/5 md:ml-[20%]">
    <FourByThreeImage img={dentist} alt="a dentist" />
  </div>
</ContentWidth>
<section class="bg-paper pb-16 pt-60 -mt-56">
  <ContentWidth>
    <div class="w-full md:w-4/5 md:ml-[20%]">
      <div use:anim>
        <h4 class=" mb-20">
          A dental referral service bridging the gap between patients and providers.
        </h4>
      </div>
      <div use:anim class="w-full md:w-1/2 flex flex-row justify-between">
        <div>
          <p class="text-primary">1-800-DENTIST</p>
          <p class="text-light">digital</p>
        </div>
        <a
          href="/portfolio/1-800-dentist"
          class="hover:brightness-50 transition bump"
          aria-label="Go to 1-800-Dentist project"
        >
          <img src={arrowButton} alt="" class="h-full" />
        </a>
      </div>
    </div>
  </ContentWidth>
</section>
<section>
  <div class="w-screen py-40 md:h-[80vh] bg-paper-red flex flex-col items-center justify-center">
    <ContentWidth class="flex flex-col md:flex-row items-start justify-between">
      <div use:anim>
        <h3 class="text-white md:w-3/5">
          Isn't it time to arm your brand with a clear story and compelling design?
        </h3>
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
</section>

<div class="py-24 bg-paper" bind:this={projectsDiv} id="projectsDiv">
  <ContentWidth>
    <div use:anim class="w-full">
      <div class="archive-title text-primary w-full text-left mb-12">But wait, there's more!</div>
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
        <button
          class="px-5 py-[10px] transition-colors duration-500 border-1 {showBrand
            ? 'border-primary bg-primary  hover:text-light text-white'
            : 'border-light text-light hover:border-primary hover:text-primary'}"
          onclick={() => withViewTransition(() => (showBrand = !showBrand))}>BRAND</button
        >
        <button
          class="px-5 py-[10px] transition-colors duration-500 border-1 {showPrint
            ? 'border-primary bg-primary  hover:text-light text-white'
            : 'border-light text-light hover:border-primary hover:text-primary'}"
          onclick={() => withViewTransition(() => (showPrint = !showPrint))}>PRINT</button
        >
        <button
          class="px-5 py-[10px] transition-colors duration-500 border-1 {showEnvironmental
            ? 'border-primary bg-primary  hover:text-light text-white'
            : 'border-light text-light hover:border-primary hover:text-primary'}"
          onclick={() => withViewTransition(() => (showEnvironmental = !showEnvironmental))}
          >ENVIRONMENTAL</button
        >
        <button
          class="px-5 py-[10px] transition-colors duration-500 border-1 {showProduct
            ? 'border-primary bg-primary  hover:text-light text-white'
            : 'border-light text-light hover:border-primary hover:text-primary'}"
          onclick={() => withViewTransition(() => (showProduct = !showProduct))}>PRODUCT</button
        >
        <button
          class="px-5 py-[10px] transition-colors duration-500 border-1 {showDigital
            ? 'border-primary bg-primary  hover:text-light text-white'
            : 'border-light text-light hover:border-primary hover:text-primary'}"
          onclick={() => withViewTransition(() => (showDigital = !showDigital))}>DIGITAL</button
        >
      </div>
      <div use:anim class="relative z-10">
        <div class="w-48 h-12 bg-paper absolute z-20"></div>
        {#if isOrderSelectOpen}
          {#each sortOptions as option, i (option)}
            <button
              class="pl-5 py-[10px] w-48 h-12 transition-colors duration-500 border-1 border-t-0 mb-24 flex flex-row items-center justify-between absolute top-0 left-0 {orderString ===
              option
                ? 'border-primary bg-primary  hover:text-light text-white'
                : 'border-light text-light  bg-white hover:text-primary'}"
              style="transform: translateY({(i + 1) * 100}%)"
              data-testid="sort-option"
              transition:slide
              onclick={() => withViewTransition(() => (orderString = option))}>{option}</button
            >
          {/each}
        {/if}
        <button
          class="relative z-20 pl-5 py-[10px] w-48 h-12 transition-colors duration-500 border-1 mb-24 flex flex-row items-center justify-between {isOrderSelectOpen
            ? 'border-primary bg-primary  hover:text-light text-white'
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
      {#if debouncedQuery.trim().length >= MIN_QUERY}
        {visibleCount} project{visibleCount === 1 ? "" : "s"} match "{debouncedQuery}"
      {/if}
    </div>
    <div class="w-full md:ml-[20%] md:w-4/5 flex flex-row flex-wrap">
      {#each visibleProjects as project (project.uid)}
        <div
          style="view-transition-name: vt-{project.uid}"
          data-vt-uid={project.uid}
          class="md:pr-6 pb-6 w-full lg:w-1/2 aspect-4/3 relative"
        >
          <a
            href={"/portfolio/" + project.uid}
            class="h-full w-full flex flex-col justify-end relative"
          >
            <img
              src={project.data.hero.url || ""}
              alt={project.data.title + " Hero Image"}
              class="absolute w-full h-full object-cover"
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
    {#if debouncedQuery.trim().length >= MIN_QUERY && visibleCount === 0}
      <div
        class="w-full md:ml-[20%] md:w-4/5 py-16 text-center"
        data-testid="portfolio-search-empty"
      >
        <p class="text-light">No projects match "{debouncedQuery}"</p>
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
<div class="w-screen py-40 md:h-[80vh] bg-paper-red flex flex-col items-center justify-center">
  <ContentWidth class="flex flex-col md:flex-row items-start justify-between">
    <div use:anim>
      <h3 class="text-white md:w-3/5">
        It's time to arm your brand with a clear story and compelling design
      </h3>
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

<style>
  h4 {
    font-family: Pragmatica;
    font-size: 60px;
    font-style: normal;
    font-weight: 200;
    line-height: 125%; /* 75px */
  }

  h5 {
    font-family: Pragmatica;
    font-size: 50px;
    font-style: normal;
    font-weight: 200;
    line-height: 140%; /* 70px */
  }

  .archive-title {
    font-size: 60px;
    font-style: normal;
    font-weight: 700;
    line-height: 140%; /* 84px */
  }

  @media only screen and (max-width: 768px) {
    h4 {
      font-size: 40px;
    }
    h5 {
      font-size: 28px;
    }
  }

  /* Archive grid filter / search / sort animation, driven by the View Transitions
     API (see withViewTransition). :global because ::view-transition-* are
     document-level pseudo-elements, not scoped to component markup. */
  :global(::view-transition-group(*)),
  :global(::view-transition-old(*)),
  :global(::view-transition-new(*)) {
    animation-duration: var(--vt-duration, 650ms);
    animation-timing-function: var(--vt-ease, cubic-bezier(0.16, 1, 0.3, 1));
  }

  /* The page-level "root" snapshot can only cross-fade, so on filter/search —
     where the grid collapses and everything below shifts — it flashed. Skip it
     so ONLY the named cards animate; the background/footer settle instantly. */
  :global(::view-transition-group(root)),
  :global(::view-transition-old(root)),
  :global(::view-transition-new(root)) {
    animation: none;
  }

  @media (prefers-reduced-motion: reduce) {
    :global(::view-transition-group(*)),
    :global(::view-transition-old(*)),
    :global(::view-transition-new(*)) {
      animation: none !important;
    }
  }
</style>
