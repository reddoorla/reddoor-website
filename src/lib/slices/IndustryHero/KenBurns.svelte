<script lang="ts">
  import { PrismicImage } from "@prismicio/svelte";
  import type { ImageField } from "@prismicio/client";
  import { MAX_IMAGE_W } from "$lib/images";

  let {
    slides,
    playing,
    animate,
    interval = 3000,
    fadeMs = 1000,
  }: {
    slides: ImageField[];
    playing: boolean;
    animate: boolean;
    interval?: number;
    fadeMs?: number;
  } = $props();

  let active = $state(0);
  let previous = $state(-1);
  let cycles = $state<number[]>([]);
  let loaded = $state<boolean[]>([]);

  const running = $derived(animate && playing && slides.length > 1);

  let settleTimer: ReturnType<typeof setTimeout> | undefined;

  const nextLoaded = () => {
    for (let step = 1; step < slides.length; step++) {
      const candidate = (active + step) % slides.length;
      if (loaded[candidate]) return candidate;
    }
    return -1;
  };

  const advance = () => {
    const next = nextLoaded();
    if (next < 0) return;
    clearTimeout(settleTimer);
    previous = active;
    active = next;
    cycles[next] = (cycles[next] ?? 0) + 1;
    settleTimer = setTimeout(() => (previous = -1), fadeMs);
  };

  $effect(() => {
    if (!running) return;
    const timer = setInterval(advance, interval);
    return () => clearInterval(timer);
  });

  $effect(() => () => clearTimeout(settleTimer));

  const trackLoad = (node: HTMLElement, i: number) => {
    const img = node.querySelector("img");
    if (!img) return;
    const done = () => (loaded[i] = true);
    if (img.complete && img.naturalWidth > 0) done();
    else img.addEventListener("load", done, { once: true });
    return { destroy: () => img.removeEventListener("load", done) };
  };

  const layer = (i: number) =>
    i === active ? "z-[2] opacity-100" : i === previous ? "z-[1] opacity-100" : "z-0 opacity-0";

  const motion = (i: number) =>
    animate && (i === active || i === previous) ? `kb-${i % 2}-${(cycles[i] ?? 0) % 2}` : "";
</script>

<div class="absolute inset-0 isolate">
  {#each slides as field, i (i)}
    <div
      class="kb-slide absolute inset-0 overflow-hidden transition-opacity ease-linear motion-reduce:transition-none {layer(
        i,
      )}"
      style="transition-duration: {fadeMs}ms;"
      data-kb-slide={i}
      use:trackLoad={i}
      data-kb-active={i === active ? "" : undefined}
    >
      <div
        class="kb-motion h-full w-full {motion(i)}"
        style="animation-duration: {interval + fadeMs}ms; animation-play-state: {playing
          ? 'running'
          : 'paused'};"
      >
        <PrismicImage
          {field}
          fallbackAlt=""
          class="h-full w-full object-cover"
          imgixParams={{ auto: ["format", "compress"], fit: "max", w: MAX_IMAGE_W }}
          widths={[640, 828, 1080, 1280, 1920, 2560, 3058]}
          sizes="100vw"
          loading={i === 0 ? "eager" : "lazy"}
          fetchpriority={i === 0 ? "high" : "auto"}
          decoding="async"
        />
      </div>
    </div>
  {/each}
</div>

<style>
  .kb-motion {
    transform-origin: 50% 50%;
    animation-timing-function: linear;
    animation-fill-mode: both;
    will-change: transform;
  }
  .kb-0-0 {
    animation-name: kb-in-a;
  }
  .kb-0-1 {
    animation-name: kb-in-b;
  }
  .kb-1-0 {
    animation-name: kb-out-a;
  }
  .kb-1-1 {
    animation-name: kb-out-b;
  }
  @keyframes kb-in-a {
    from {
      transform: scale(1) translate(0, 0);
    }
    to {
      transform: scale(1.06) translate(-1%, -0.75%);
    }
  }
  @keyframes kb-in-b {
    from {
      transform: scale(1) translate(0, 0);
    }
    to {
      transform: scale(1.06) translate(-1%, -0.75%);
    }
  }
  @keyframes kb-out-a {
    from {
      transform: scale(1.06) translate(1%, 0.5%);
    }
    to {
      transform: scale(1) translate(0, 0);
    }
  }
  @keyframes kb-out-b {
    from {
      transform: scale(1.06) translate(1%, 0.5%);
    }
    to {
      transform: scale(1) translate(0, 0);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .kb-motion {
      animation: none;
    }
  }
</style>
