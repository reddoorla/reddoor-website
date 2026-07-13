# ContentWidthMedia Slideshow Item — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let one item in the `ContentWidthMedia` slice's `images` group render as an inline image slideshow, reusing the existing Slideshow carousel behavior.

**Architecture:** Add a repeatable media `Link` field (`slides`) to the group item (no new custom type, no page-query changes). Extract the carousel from `Slideshow/index.svelte` into a shared, snippet-driven `$lib/components/Slideshow/Slideshow.svelte`; each caller passes a `slide` snippet to render its own image type (`PrismicImage` for the Slideshow slice, a new `MediaImg` for media-link URLs). Controls are hidden below a ~400px container width (auto-run); `prefers-reduced-motion` disables autoplay everywhere.

**Tech Stack:** SvelteKit, Svelte 5 (runes + snippets), Tailwind v4 (container queries), Prismic (`@prismicio/svelte`, `@prismicio/client`), Vitest 4, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-13-contentwidthmedia-slideshow-item-design.md`

**Branch:** `feat/contentwidthmedia-slideshow-item` (already created off `main`; the spec is committed there).

---

## File Structure

- **Create** `src/lib/utils/mediaSrcset.ts` — pure helper that turns a Prismic media URL into `{src, srcset, sizes}` with imgix params. Unit-tested.
- **Create** `src/lib/utils/mediaSrcset.test.ts` — Vitest unit tests for the helper.
- **Create** `src/lib/components/Slideshow/MediaImg.svelte` — responsive `<img>` for a media-link URL (uses `mediaSrcset`).
- **Create** `src/lib/components/Slideshow/Slideshow.svelte` — shared carousel (extracted logic + internal snippets + container-query controls + reduced-motion).
- **Modify** `src/lib/slices/Slideshow/index.svelte` — thin wrapper delegating to the shared component.
- **Modify** `src/lib/slices/ContentWidthMedia/model.json` — add `slides` field (via Prismic MCP `save_slice_data`, never hand-edited).
- **Regenerate** `src/prismicio-types.d.ts` — Slice Machine output after the model change.
- **Modify** `src/lib/slices/ContentWidthMedia/index.svelte` — slideshow render branch + `slide` snippet.
- **Modify** `src/lib/slices/ContentWidthMedia/mocks.json` — add `slides` to the mock.
- **Create** `src/routes/dev/slideshow-fixture/+page.svelte` — CMS-free test harness (wide + narrow instances).
- **Create** `tests/smoke/slideshow.spec.ts` — Playwright verification.

---

## Task 1: `mediaSrcset` helper (pure, unit-TDD)

**Files:**
- Create: `src/lib/utils/mediaSrcset.ts`
- Test: `src/lib/utils/mediaSrcset.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/utils/mediaSrcset.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mediaImgAttrs } from "./mediaSrcset";

const URL = "https://images.prismic.io/reddoor-la/abc_photo.jpg";

describe("mediaImgAttrs", () => {
  it("builds one srcset entry per width, largest as src", () => {
    const { src, srcset, sizes } = mediaImgAttrs(URL, {
      widths: [400, 800],
      sizes: "50vw",
    });
    const entries = srcset.split(", ");
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatch(/ 400w$/);
    expect(entries[1]).toMatch(/ 800w$/);
    expect(src).toContain("width=800");
    expect(sizes).toBe("50vw");
  });

  it("adds imgix auto-format/compress + fit=max to every url", () => {
    const { srcset } = mediaImgAttrs(URL, { widths: [640] });
    // URLSearchParams encodes the comma in auto=format,compress as %2C
    expect(srcset).toMatch(/auto=format%2Ccompress/);
    expect(srcset).toContain("fit=max");
    expect(srcset).toContain("width=640");
  });

  it("falls back to default widths and 100vw sizes", () => {
    const { srcset, sizes } = mediaImgAttrs(URL);
    expect(srcset.split(", ")).toHaveLength(5); // [400,640,800,1200,1600]
    expect(sizes).toBe("100vw");
  });

  it("returns empty attrs for an empty url", () => {
    expect(mediaImgAttrs("")).toEqual({ src: "", srcset: "", sizes: "100vw" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:unit src/lib/utils/mediaSrcset.test.ts`
Expected: FAIL — `Cannot find module './mediaSrcset'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/utils/mediaSrcset.ts`:

```ts
/**
 * Prismic media-library URLs are imgix-backed, so we can reproduce
 * PrismicImage's responsive behavior (modern formats + width-appropriate
 * assets) for a raw media-link URL that has no Image field to hand to
 * <PrismicImage>. Used by MediaImg for ContentWidthMedia slideshow slides.
 */
const DEFAULT_WIDTHS = [400, 640, 800, 1200, 1600];

export function mediaImgAttrs(
  url: string,
  opts: { widths?: number[]; sizes?: string } = {},
): { src: string; srcset: string; sizes: string } {
  const sizes = opts.sizes ?? "100vw";
  if (!url) return { src: "", srcset: "", sizes };

  const widths = opts.widths ?? DEFAULT_WIDTHS;
  const at = (w: number) => {
    const u = new URL(url);
    u.searchParams.set("auto", "format,compress");
    u.searchParams.set("fit", "max");
    u.searchParams.set("width", String(w));
    return u.toString();
  };

  return {
    src: at(widths[widths.length - 1]),
    srcset: widths.map((w) => `${at(w)} ${w}w`).join(", "),
    sizes,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:unit src/lib/utils/mediaSrcset.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/mediaSrcset.ts src/lib/utils/mediaSrcset.test.ts
git commit -m "feat(slideshow): mediaImgAttrs helper for responsive media-link images"
```

---

## Task 2: `MediaImg` component

**Files:**
- Create: `src/lib/components/Slideshow/MediaImg.svelte`

- [ ] **Step 1: Write the component**

Create `src/lib/components/Slideshow/MediaImg.svelte`:

```svelte
<script lang="ts">
  import { mediaImgAttrs } from "$lib/utils/mediaSrcset";

  let {
    url,
    alt = "",
    sizes = "(min-width: 1024px) 50vw, 100vw",
    class: className = "",
  }: {
    url: string;
    alt?: string;
    sizes?: string;
    class?: string;
  } = $props();

  const attrs = $derived(mediaImgAttrs(url, { sizes }));
</script>

<img
  src={attrs.src}
  srcset={attrs.srcset}
  sizes={attrs.sizes}
  {alt}
  loading="lazy"
  decoding="async"
  class="object-cover {className}"
/>
```

- [ ] **Step 2: Type-check**

Run: `pnpm check`
Expected: no new errors referencing `MediaImg.svelte`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/Slideshow/MediaImg.svelte
git commit -m "feat(slideshow): MediaImg responsive image for media-link slides"
```

---

## Task 3: Shared `Slideshow` carousel component

Extract the carousel from `src/lib/slices/Slideshow/index.svelte` (read it first for parity) into a reusable component that renders each slide through a `slide` snippet, hides controls below a container-width threshold, and respects `prefers-reduced-motion`.

**Files:**
- Create: `src/lib/components/Slideshow/Slideshow.svelte`

- [ ] **Step 1: Write the component**

Create `src/lib/components/Slideshow/Slideshow.svelte`:

```svelte
<script lang="ts">
  import type { Snippet } from "svelte";
  import { createSwipeAction } from "$lib/utils/swipeAction";
  import { ChevronLeft, ChevronRight, Pause, Play } from "@lucide/svelte";

  let {
    slides,
    slide,
    aspectClass = "aspect-video",
    hasNavDots = false,
    interval = 5000,
    transitionMs = 1600,
    autoplay = true,
  }: {
    slides: unknown[];
    slide: Snippet<[unknown, number]>;
    aspectClass?: string;
    hasNavDots?: boolean;
    interval?: number;
    transitionMs?: number;
    autoplay?: boolean;
  } = $props();

  const count = $derived(slides.length);
  const isCarousel = $derived(count > 1);

  // Reduced motion: no autoplay, instant transitions. SSR-safe (client only).
  let reduceMotion = $state(false);
  $effect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotion = mq.matches;
    const on = () => (reduceMotion = mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  });

  const canAutoplay = $derived(autoplay && isCarousel && !reduceMotion);

  // Infinite loop via a tripled track (mirrors the original slice).
  const tripled = $derived([...slides, ...slides, ...slides]);
  const slideWidth = $derived(100 / tripled.length);

  let currentIndex = $state(0);
  let isPlaying = $state(true);
  let isTransitioning = $state(false);
  let sliderInterval: ReturnType<typeof setInterval> | null = null;

  const translateX = $derived(-(currentIndex + count) * slideWidth);
  const displayIndex = $derived(count ? ((currentIndex % count) + count) % count : 0);

  const stopAutoPlay = () => {
    if (sliderInterval) {
      clearInterval(sliderInterval);
      sliderInterval = null;
    }
  };
  const startAutoPlay = () => {
    stopAutoPlay();
    if (!isPlaying || !canAutoplay) return;
    sliderInterval = setInterval(() => moveSlide(1), interval);
  };

  const moveSlide = (direction: number) => {
    if (isTransitioning || !isCarousel) return;
    isTransitioning = true;
    currentIndex += direction;
    setTimeout(
      () => {
        if (currentIndex >= count) currentIndex = currentIndex % count;
        else if (currentIndex < 0) currentIndex = count + (currentIndex % count);
        isTransitioning = false;
      },
      reduceMotion ? 0 : transitionMs,
    );
    if (isPlaying) startAutoPlay();
  };

  const slideLeft = () => moveSlide(-1);
  const slideRight = () => moveSlide(1);
  const goToSlide = (i: number) => {
    if (isTransitioning) return;
    currentIndex = i;
    if (isPlaying) startAutoPlay();
  };
  const togglePlayPause = () => {
    isPlaying = !isPlaying;
    if (isPlaying) startAutoPlay();
    else stopAutoPlay();
  };

  const handleSwipe = (
    e: CustomEvent<{ direction: "left" | "top" | "right" | "bottom" | null }>,
  ) => {
    if (e.detail.direction === "left") slideRight();
    else if (e.detail.direction === "right") slideLeft();
  };
  const swipe = createSwipeAction(handleSwipe);

  $effect(() => {
    // Re-run when autoplay eligibility changes.
    void canAutoplay;
    void isPlaying;
    void interval;
    startAutoPlay();
    return stopAutoPlay;
  });
</script>

{#snippet controlButton(onclick: () => void, label: string, disabled: boolean, inner: Snippet)}
  <button
    {onclick}
    {disabled}
    aria-label={label}
    class="h-6 w-6 rounded-full border-mid border-2 p-1 flex align-middle justify-center cursor-pointer transition-all duration-300 active:-translate-y-1 hover:bg-primary hover:border-primary hover:text-white disabled:opacity-50 disabled:cursor-default"
  >
    {@render inner()}
  </button>
{/snippet}

<div class="@container w-full h-full relative overflow-hidden {aspectClass}">
  {#if isCarousel}
    <div
      use:swipe
      class="flex flex-row flex-nowrap transition-transform ease-[cubic-bezier(0.25,0.1,0.25,1)] h-full"
      style="width: {tripled.length * 100}%; transform: translateX({translateX}%); transition-duration: {isTransitioning &&
      !reduceMotion
        ? transitionMs
        : 0}ms;"
    >
      {#each tripled as item, i (i)}
        <div class="h-full z-0" style="width: {slideWidth}%;">{@render slide(item, i)}</div>
      {/each}
    </div>

    <!-- Prev/next: hidden below ~400px container width (auto-run). -->
    <div
      class="ml-8 h-6 w-[72px] hidden @min-[400px]:flex justify-between z-10 absolute bottom-2 lg:bottom-6 left-0"
    >
      {#snippet chevL()}<ChevronLeft
          class="size-[1em] translate-y-[-1.75px] translate-x-[-0.75px] scale-90"
          strokeWidth={2}
        />{/snippet}
      {#snippet chevR()}<ChevronRight
          class="size-[1em] translate-y-[-1.75px] translate-x-[0.75px] scale-90"
          strokeWidth={2}
        />{/snippet}
      {@render controlButton(slideLeft, "Previous slide", isTransitioning, chevL)}
      {@render controlButton(slideRight, "Next slide", isTransitioning, chevR)}
    </div>

    <!-- Play/pause: hidden below ~400px. -->
    <div class="hidden @min-[400px]:block absolute bottom-2 lg:bottom-6 right-2 lg:right-6 z-10">
      {#snippet playIcon()}
        {#if isPlaying}
          <Pause class="size-[1em] translate-y-[-1.5px] scale-90" strokeWidth={2} />
        {:else}
          <Play class="size-[1em] translate-y-[-1.5px] translate-x-px scale-75" strokeWidth={2} />
        {/if}
      {/snippet}
      {@render controlButton(
        togglePlayPause,
        isPlaying ? "Pause slideshow" : "Play slideshow",
        false,
        playIcon,
      )}
    </div>

    {#if hasNavDots}
      <div
        class="hidden @min-[400px]:flex absolute bottom-2 lg:bottom-6 left-1/2 -translate-x-1/2 gap-1.5 z-10"
      >
        {#each slides as _, i (i)}
          <button
            onclick={() => goToSlide(i)}
            disabled={displayIndex === i}
            class="w-2 h-2 rounded-full transition-all duration-300 opacity-60 hover:opacity-100 {displayIndex ===
            i
              ? 'bg-primary'
              : 'bg-mid'}"
            aria-label="Go to slide {i + 1}"
          ></button>
        {/each}
      </div>
    {/if}
  {:else}
    <!-- 0 or 1 slide: render the single slide, no carousel chrome. -->
    <div class="h-full w-full">{#if count}{@render slide(slides[0], 0)}{/if}</div>
  {/if}
</div>
```

- [ ] **Step 2: Type-check**

Run: `pnpm check`
Expected: no new errors in `Slideshow.svelte`. (If `Snippet` import or the `@min-[400px]` arbitrary variant trips eslint/prettier, run `pnpm format` and re-check.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/Slideshow/Slideshow.svelte
git commit -m "feat(slideshow): shared snippet-driven carousel component"
```

---

## Task 4: Refactor the `Slideshow` slice to the shared component

**Files:**
- Modify: `src/lib/slices/Slideshow/index.svelte`

- [ ] **Step 1: Replace the inline carousel with `<Slideshow>`**

In `src/lib/slices/Slideshow/index.svelte`: remove the carousel state/logic block (the `mediaArray`/`tripledArray`/`currentIndex`/autoplay/`moveSlide`/`swipe`/`goToSlide`/`$effect` code, lines ~12–102 in the original) and the inline markup for the slides container + controls (the `<div use:swipe …>` block). Keep the `ContentWidth`, sidebar (`label`/`RichTextBody`), background, `isAnimated`, and `hide` wrapper. Replace the carousel `<div>` with:

```svelte
<Slideshow
  slides={slice.primary.images}
  hasNavDots={!!slice.primary.hasNavDots}
  aspectClass="aspect-video"
>
  {#snippet slide(media)}
    <PrismicImage
      field={media.image}
      class="h-full w-full object-contain"
      imgixParams={{ auto: ["format", "compress"] }}
      widths={[400, 640, 800, 1200, 1600]}
      sizes="(min-width: 768px) 80vw, 100vw"
      loading="lazy"
      decoding="async"
    />
  {/snippet}
</Slideshow>
```

Add the import at the top of `<script>`:

```svelte
import Slideshow from "$lib/components/Slideshow/Slideshow.svelte";
```

and remove now-unused imports (`createSwipeAction`, the Lucide icons, and any state helpers moved into the component). Keep `PrismicImage`, `RichTextBody`, `ContentWidth`, `anim`.

- [ ] **Step 2: Type-check + lint**

Run: `pnpm check && pnpm lint`
Expected: PASS, no unused-import errors.

- [ ] **Step 3: Manually verify the Slideshow slice is visually unchanged**

Run: `pnpm dev` (starts vite:5173 + slicemachine:9999). In SliceMachine (`http://localhost:9999`) open the **Slideshow** slice → Simulate. Confirm: slides advance, arrows/play-pause work, dots appear if `hasNavDots`, and layout matches the pre-refactor output. Stop the servers when done (`kill` the `:5173`/`:9999` listeners).

- [ ] **Step 4: Commit**

```bash
git add src/lib/slices/Slideshow/index.svelte
git commit -m "refactor(slideshow): slice delegates to shared carousel component"
```

---

## Task 5: Add the `slides` field to the ContentWidthMedia model

**Files:**
- Modify: `src/lib/slices/ContentWidthMedia/model.json` (via Prismic MCP — do NOT hand-edit)
- Regenerate: `src/prismicio-types.d.ts`

- [ ] **Step 1: Add the field via the Prismic MCP**

Use the Prismic MCP `save_slice_data` tool to add a field to the `images` group of the `default` variation's `primary`:

```json
"slides": {
  "type": "Link",
  "config": {
    "label": "slideshow images",
    "select": "media",
    "repeat": true
  }
}
```

(If the MCP requires the full model, load the current `model.json`, insert `slides` into `variations[0].primary.images.config.fields`, and save via the tool.)

- [ ] **Step 2: Regenerate Prismic types**

Run: `pnpm slicemachine` briefly (it regenerates `src/prismicio-types.d.ts` on the model change), then stop it. Then:

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 3: Confirm the generated slide-item type**

Open `src/prismicio-types.d.ts` and find the `ContentWidthImageSliceDefaultPrimaryImagesItem` interface. Confirm it now has a `slides` property. **Note its exact type** (a repeatable media link surfaces as a `LinkField`-array-like `GroupField<…>` or `LinkField[]`); use that exact shape in Task 6's `filledSlides` mapping. If the property name differs from `slides`, adjust Task 6 accordingly.

- [ ] **Step 4: Commit**

```bash
git add src/lib/slices/ContentWidthMedia/model.json src/prismicio-types.d.ts
git commit -m "feat(slideshow): add repeatable media 'slides' field to ContentWidthMedia item"
```

---

## Task 6: Render the slideshow branch in ContentWidthMedia

**Files:**
- Modify: `src/lib/slices/ContentWidthMedia/index.svelte`

- [ ] **Step 1: Add imports + helpers**

In `<script>` of `src/lib/slices/ContentWidthMedia/index.svelte`, add:

```svelte
import Slideshow from "$lib/components/Slideshow/Slideshow.svelte";
import MediaImg from "$lib/components/Slideshow/MediaImg.svelte";
```

Add a helper to extract filled slide URLs (adjust `.filter`/field access to the exact type confirmed in Task 5 Step 3):

```svelte
// A ContentWidthMedia item is a slideshow when it has ≥1 filled media slide.
// Media links surface with a `url`; filter out empty entries.
const slideUrls = (item: { slides?: Array<{ url?: string }> | null }): string[] =>
  (item.slides ?? []).map((s) => s?.url).filter((u): u is string => !!u);
```

Add an aspect-class helper mirroring the existing per-item aspect ternary, with `free → aspect-video` (a carousel needs a defined height):

```svelte
const slideshowAspect = (aspect: string | null): string =>
  aspect === "square"
    ? "aspect-square"
    : aspect === "4/3"
      ? "aspect-4/3"
      : aspect === "3/4"
        ? "aspect-3/4"
        : aspect === "9/16"
          ? "aspect-9/16"
          : "aspect-video"; // "16/9" and "free" both → aspect-video
```

- [ ] **Step 2: Add the slideshow branch at the top of the item loop**

Inside `{#each slice.primary.images as item, i (i)}`, wrap the existing `{#if isFilled.link(item.link)}` in a new leading branch so a slideshow item takes precedence and ignores `item.link`:

```svelte
{#each slice.primary.images as item, i (i)}
  {#if slideUrls(item).length}
    <div
      use:anim={{ enabled: animationEnabled, delayMax: itemDelayMax }}
      class="{slice.primary.hasGap ? 'pr-6 pb-6' : ''} relative w-full flex flex-col items-center justify-start {slice
        .primary.desktopcolumns === '2'
        ? 'lg:w-1/2'
        : ''} {slice.primary.desktopcolumns === '3' ? 'lg:w-1/3' : ''}"
    >
      {#if item.label}
        <div class="w-full border-b-1 border-dark label mb-8">{item.label}</div>
      {/if}
      <Slideshow slides={slideUrls(item)} aspectClass={slideshowAspect(item.aspect)} hasNavDots>
        {#snippet slide(url)}
          <MediaImg url={url as string} alt={item.label ?? ""} class="h-full w-full" />
        {/snippet}
      </Slideshow>
    </div>
  {:else if isFilled.link(item.link)}
    <!-- existing link branch, unchanged -->
    …
  {:else}
    <!-- existing no-link branch, unchanged -->
    …
  {/if}
{/each}
```

(Leave the two existing branches exactly as they are; only add the leading `{#if slideUrls(item).length}` branch and shift the old `{#if}` to `{:else if}`.)

- [ ] **Step 3: Type-check + lint + format**

Run: `pnpm check && pnpm lint`
Expected: PASS. If prettier reformats the ternary, run `pnpm format` first.

- [ ] **Step 4: Commit**

```bash
git add src/lib/slices/ContentWidthMedia/index.svelte
git commit -m "feat(slideshow): render slideshow branch in ContentWidthMedia items"
```

---

## Task 7: Add slides to the ContentWidthMedia mock

**Files:**
- Modify: `src/lib/slices/ContentWidthMedia/mocks.json`

- [ ] **Step 1: Populate `slides` via the simulator (reliable mock shape)**

Run: `pnpm dev`. In SliceMachine (`http://localhost:9999`) open **ContentWidthMedia** → the `images` item → the new **slideshow images** field. Add 3 media images from the media library, then click **Save mock content** (writes `mocks.json` with the correct `__TYPE__` shape for a repeatable media link). Keep `vimeoid` empty on that item so precedence picks the slideshow.

- [ ] **Step 2: Verify the simulator renders the carousel**

Still in the simulator, confirm the item now renders the slideshow (images advance; controls appear because the simulator viewport is wide). Stop the dev servers.

- [ ] **Step 3: Commit**

```bash
git add src/lib/slices/ContentWidthMedia/mocks.json
git commit -m "test(slideshow): add slides to ContentWidthMedia mock"
```

---

## Task 8: Dev fixture + Playwright verification

**Files:**
- Create: `src/routes/dev/slideshow-fixture/+page.svelte`
- Create: `tests/smoke/slideshow.spec.ts`

- [ ] **Step 1: Create the CMS-free fixture route**

Create `src/routes/dev/slideshow-fixture/+page.svelte` with two instances at fixed container widths (so the container-query behavior is deterministic) and a short autoplay interval:

```svelte
<script lang="ts">
  import Slideshow from "$lib/components/Slideshow/Slideshow.svelte";
  import MediaImg from "$lib/components/Slideshow/MediaImg.svelte";

  // Reachable imgix-backed URLs (Unsplash), same source the CWM mock uses.
  const urls = [
    "https://images.unsplash.com/photo-1491975474562-1f4e30bc9468",
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40",
    "https://images.unsplash.com/photo-1531403009284-440f080d1e12",
  ];
</script>

<svelte:head><meta name="robots" content="noindex" /></svelte:head>

<div class="p-8">
  <h1>Slideshow fixture</h1>
  <div id="wide" style="width: 800px;">
    <Slideshow slides={urls} aspectClass="aspect-video" hasNavDots interval={500}>
      {#snippet slide(u)}<MediaImg url={u as string} alt="" class="h-full w-full" />{/snippet}
    </Slideshow>
  </div>
  <div id="narrow" style="width: 320px;">
    <Slideshow slides={urls} aspectClass="aspect-video" hasNavDots interval={500}>
      {#snippet slide(u)}<MediaImg url={u as string} alt="" class="h-full w-full" />{/snippet}
    </Slideshow>
  </div>
</div>
```

- [ ] **Step 2: Write the Playwright spec**

Create `tests/smoke/slideshow.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

const FIXTURE = "/dev/slideshow-fixture";

test("wide cell shows carousel controls; narrow cell hides them (auto-run)", async ({ page }) => {
  await page.goto(FIXTURE, { waitUntil: "domcontentloaded" });

  const wide = page.locator("#wide");
  const narrow = page.locator("#narrow");

  // Wide: prev/next + play/pause visible.
  await expect(wide.getByRole("button", { name: "Next slide" })).toBeVisible();
  await expect(wide.getByRole("button", { name: /slideshow/i })).toBeVisible();

  // Narrow (<400px container): controls hidden via container query.
  await expect(narrow.getByRole("button", { name: "Next slide" })).toBeHidden();
  await expect(narrow.getByRole("button", { name: /slideshow/i })).toBeHidden();
});

test("clicking next advances the wide carousel track", async ({ page }) => {
  await page.goto(FIXTURE, { waitUntil: "domcontentloaded" });
  const track = page.locator("#wide .flex-nowrap");
  const before = await track.getAttribute("style");
  await page.locator("#wide").getByRole("button", { name: "Next slide" }).click();
  await page.waitForTimeout(50);
  const after = await track.getAttribute("style");
  expect(after).not.toBe(before); // translateX changed
});

test("reduced motion (smoke default) does not auto-advance", async ({ page }) => {
  await page.goto(FIXTURE, { waitUntil: "domcontentloaded" });
  const track = page.locator("#wide .flex-nowrap");
  const t0 = await track.getAttribute("style");
  await page.waitForTimeout(1200); // > interval (500ms)
  const t1 = await track.getAttribute("style");
  expect(t1).toBe(t0); // static under prefers-reduced-motion: reduce
});

test.describe("with motion enabled", () => {
  test.use({ reducedMotion: "no-preference" });
  test("narrow cell auto-runs on its own", async ({ page }) => {
    await page.goto(FIXTURE, { waitUntil: "domcontentloaded" });
    const track = page.locator("#narrow .flex-nowrap");
    const t0 = await track.getAttribute("style");
    await page.waitForTimeout(900); // > interval (500ms) + a tick
    const t1 = await track.getAttribute("style");
    expect(t1).not.toBe(t0); // auto-advanced with no controls
  });
});
```

- [ ] **Step 3: Run the spec**

Run: `pnpm test:smoke slideshow`
Expected: 4 tests PASS. (If the `.flex-nowrap` selector is ambiguous, scope it to the track by adding a `data-testid="track"` on the track `<div>` in `Slideshow.svelte` and select that instead.)

- [ ] **Step 4: Commit**

```bash
git add src/routes/dev/slideshow-fixture/+page.svelte tests/smoke/slideshow.spec.ts
git commit -m "test(slideshow): dev fixture + Playwright coverage for carousel behavior"
```

---

## Task 9: Full verification pass

- [ ] **Step 1: Run the whole gate**

Run:

```bash
pnpm check && pnpm lint && pnpm test:unit && pnpm test:smoke
```

Expected: all PASS. Investigate any failure before proceeding (do not skip).

- [ ] **Step 2: Browser-verify a real render (verify skill)**

Run `pnpm dev`, open the ContentWidthMedia slice simulator, confirm the slideshow item renders and behaves (advances, controls at wide width). Then confirm the standalone Slideshow slice still looks correct. Stop the servers.

- [ ] **Step 3: Confirm no stray changes**

Run: `git status` — only the intended files changed. `git log --oneline main..HEAD` shows the task commits.

---

## Self-Review notes (author)

- **Spec coverage:** data model (T5), precedence + ignore-link + aspect-free fallback (T6), shared snippet component + internal snippets (T3), MediaImg quality (T1/T2), Slideshow refactor + reduced-motion inheritance (T3/T4), container-query controls + reduced-motion (T3, verified T8), mocks (T7), testing (T1/T8/T9). All covered.
- **Known verification-time adjustment:** the exact `slides` runtime/type shape is confirmed in T5 S3 and threaded into T6's `slideUrls`; the plan flags this explicitly rather than guessing.
- **Reduced-motion + smoke:** because the Playwright base sets `reducedMotion: "reduce"`, the auto-advance assertion lives in a `test.use({ reducedMotion: "no-preference" })` block (T8), and the default-config test asserts the *static* behavior.
