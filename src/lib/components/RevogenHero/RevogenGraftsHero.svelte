<script lang="ts">
  // Interactive port of Revogen's homepage grafts hero (the third section of
  // revogen). Self-contained: the themed animated gradient background + the
  // three grafts with their hover/tap reveal. Ported from the live Revogen site;
  // the global `gradientTheme` store is replaced by local `theme` state, and the
  // navigating `DelayedLink`s are replaced by non-navigating buttons ("unlinked").
  // The Rive code in the original was dead (targeted a #puttycanvas that never
  // rendered) so it is intentionally omitted.
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import SvelteImg from "@zerodevx/svelte-img";
  import { fade, slide } from "svelte/transition";
  import { ChevronRight, Plus } from "@lucide/svelte";
  import surgical from "$lib/assets/images/revogen/surgical.png?as=run";
  import surgicalBefore from "$lib/assets/images/revogen/surgical-before.png?as=run";
  import woundCare from "$lib/assets/images/revogen/woundCare.png?as=run";
  import woundBefore from "$lib/assets/images/revogen/wound-before.png?as=run";
  import ocular from "$lib/assets/images/revogen/ocular.png?as=run";
  import ocularBefore from "$lib/assets/images/revogen/ocular-before.png?as=run";

  // theme: 0 = blue (default) · 1 = pink (surgical) · 2 = deep blue (wound) · 3 = teal (ocular)
  let theme = $state(0);
  // Pause the ambient gradient drift when the hero scrolls out of view (perf).
  let paused = $state(true);
  let rootEl: HTMLElement | undefined = $state();

  const grafts = [
    {
      key: 1,
      img: surgical,
      before: surgicalBefore,
      title: "Surgical Grafts",
      desc: "Surgical allografts, derived from human donor tissue or synthetic sources, are used to repair, replace, or protect damaged tissues and organs such as bone, skin, tendons, ligaments, and cartilage.",
    },
    {
      key: 2,
      img: woundCare,
      before: woundBefore,
      title: "Wound Care Grafts",
      desc: "RevoGen Biologics provides high-quality allograft grafts for chronic or acute wound care, serving as protective barriers and scaffolds for tissue reconstruction.",
    },
    {
      key: 3,
      img: ocular,
      before: ocularBefore,
      title: "Ocular Grafts",
      desc: "RevoGen Biologics offers customizable ocular amnion grafts in a variety of cuts and sizes to support diverse ocular applications.",
    },
  ];

  $effect(() => {
    const el = rootEl;
    if (!el) return;
    // Only run the ambient drift while the hero is on-screen.
    const io = new IntersectionObserver((entries) => {
      paused = !entries.some((e) => e.isIntersecting);
    });
    io.observe(el);
    return () => io.disconnect();
  });
</script>

<div
  bind:this={rootEl}
  class="revogen-hero relative w-full md:aspect-video overflow-hidden bg-[hsl(210,100%,50%)]"
  class:paused
>
  <!-- Ambient themed gradient background: four themes cross-fade on hover/tap. -->
  <div class="pointer-events-none absolute inset-0 overflow-hidden">
    {#each [0, 1, 2, 3] as opt (opt)}
      <div
        class="add-noise absolute -inset-[12%] transition-opacity duration-[2400ms] {theme === opt
          ? 'opacity-100'
          : 'opacity-0'}"
      >
        <div class="graft-layer absolute inset-0 option-{opt}-layer1"></div>
        <div class="graft-layer absolute inset-0 option-{opt}-layer2"></div>
        <div class="graft-layer absolute inset-0 option-{opt}-layer3"></div>
      </div>
    {/each}
  </div>

  <!-- Grafts -->
  <ContentWidth
    class="relative z-10 h-full flex flex-col gap-10 py-14 md:gap-0 md:py-0 md:flex-row items-center justify-evenly text-white"
  >
    {#each grafts as g (g.key)}
      {@const active = theme === g.key}
      <button
        type="button"
        class="graft-btn group md:w-1/4 flex flex-col items-center justify-start text-center"
        onmouseenter={() => (theme = g.key)}
        onmouseleave={() => (theme = 0)}
        onclick={() => (theme = active ? 0 : g.key)}
      >
        <div class="relative w-44 md:w-full aspect-square">
          <SvelteImg
            src={g.before}
            alt=""
            sizes="(min-width: 768px) 25vw, 45vw"
            class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          />
          <SvelteImg
            src={g.img}
            alt={g.title}
            sizes="(min-width: 768px) 25vw, 45vw"
            class="{active
              ? ''
              : 'opacity-10 brightness-0 invert'} transition duration-700 ease-out absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          />
        </div>
        <p class="type-graft mt-2">{g.title}</p>
        {#if active}
          <p transition:slide class="type-graft-desc mt-3 max-w-[20rem]">{g.desc}</p>
        {/if}
        <div
          class="w-8 h-8 border-[1.5px] border-white rounded-full relative mt-4 transition-opacity group-hover:opacity-80"
        >
          {#if active}
            <span
              in:fade={{ delay: 400 }}
              out:fade
              class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            >
              <ChevronRight class="size-[1.25em]" strokeWidth={1.5} aria-hidden="true" />
            </span>
          {:else}
            <span
              in:fade={{ delay: 400 }}
              out:fade
              class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            >
              <Plus class="size-[1.25em]" strokeWidth={1.5} aria-hidden="true" />
            </span>
          {/if}
        </div>
      </button>
    {/each}
  </ContentWidth>
</div>

<style>
  /* Graft label + reveal copy sized to the site's small-screen UI scale: the
     label matches `.nav-link` (16px) and sits a step above the body, which
     matches `.label` (14px). Both are declared here (scoped, 0-1-0 class beats
     the global unlayered `p { font-size: 18px }` that Tailwind text utilities
     lose to) so the label is never smaller than its own body copy. */
  /* The grafts are intentionally non-navigating, so keep the default arrow
     cursor — not the link/pointer cursor. Tailwind's `cursor-default` utility
     loses to app.css's unlayered `button { cursor: pointer }` (unlayered beats
     @layer utilities), so pin it with this scoped class. */
  .graft-btn {
    cursor: default;
  }

  .type-graft {
    font-family: "pragmatica", "helvetica", sans-serif;
    font-size: 16px;
    font-weight: 300;
    line-height: 1.3;
  }
  .type-graft-desc {
    font-size: 14px;
    font-weight: 200;
    line-height: 1.6;
  }

  /* svelte-img bakes a blurred low-quality placeholder into each <img>'s inline
     `background`. These graft PNGs are transparent cut-outs, so that placeholder
     bleeds through as fuzzy pixelation around each graft — suppress it. */
  .revogen-hero :global(img) {
    background: none !important;
  }

  /* Pause the ambient drift when the hero is off-screen (perf). */
  .revogen-hero.paused .graft-layer {
    animation-play-state: paused;
  }

  .graft-layer {
    -webkit-transform-style: preserve-3d;
    -webkit-backface-visibility: hidden;
    transform-style: preserve-3d;
    backface-visibility: hidden;
    will-change: transform;
  }

  /* ── Option 0 · Blue ─────────────────────────────────────────────────────── */
  .option-0-layer1 {
    background: radial-gradient(
      ellipse 115% 115% at 75% 5%,
      hsl(210, 100%, 95%) 0%,
      hsl(210, 100%, 85%) 15%,
      hsl(210, 100%, 80%) 25%,
      hsl(210, 100%, 70%) 35%,
      hsl(210, 100%, 60%) 50%,
      hsl(210, 100%, 50%) 65%,
      hsl(210, 100%, 40%) 80%,
      hsl(210, 100%, 24%) 100%
    );
    animation: circling 5s linear infinite;
  }
  .option-0-layer2 {
    background: radial-gradient(
      circle 90% at 5% 70%,
      hsla(210, 100%, 60%, 0.3) 0%,
      hsla(210, 100%, 45%, 0.4) 30%,
      hsla(210, 100%, 40%, 0.5) 50%,
      transparent 100%
    );
    animation: circling 12s linear infinite;
    opacity: 0.6;
  }
  .option-0-layer3 {
    background: radial-gradient(
      ellipse 100% 100% at 85% 85%,
      hsla(210, 100%, 95%, 0.4) 0%,
      hsla(210, 100%, 80%, 0.3) 25%,
      hsla(209, 28%, 67%, 0.3) 50%,
      transparent 100%
    );
    animation: circlingOpposite 8s linear infinite;
    opacity: 0.4;
  }

  /* ── Option 1 · Pink ─────────────────────────────────────────────────────── */
  .option-1-layer1 {
    background: radial-gradient(
      ellipse 110% 110% at 65% 85%,
      hsl(333, 25%, 92%) 0%,
      hsl(333, 20%, 82%) 15%,
      hsl(333, 25%, 75%) 25%,
      hsl(333, 30%, 65%) 35%,
      hsl(333, 35%, 55%) 50%,
      hsl(333, 45%, 50%) 65%,
      hsl(333, 35%, 55%) 80%,
      hsl(333, 25%, 65%) 100%
    );
    animation: circling 5s linear infinite;
  }
  .option-1-layer2 {
    background: radial-gradient(
      circle 100% at 30% 30%,
      hsla(333, 45%, 52%, 0.4) 0%,
      hsla(333, 30%, 58%, 0.4) 30%,
      hsla(333, 25%, 65%, 0.5) 65%,
      transparent 100%
    );
    animation: circling 12s linear infinite;
    opacity: 0.5;
  }
  .option-1-layer3 {
    background: radial-gradient(
      ellipse 95% 95% at 2% 50%,
      hsla(333, 25%, 92%, 0.5) 0%,
      hsla(333, 20%, 82%, 0.4) 35%,
      hsla(333, 20%, 75%, 0.4) 60%,
      transparent 100%
    );
    animation: circlingOpposite 8s linear infinite reverse;
    opacity: 0.6;
  }

  /* ── Option 2 · Deep Blue ────────────────────────────────────────────────── */
  .option-2-layer1 {
    background: radial-gradient(
      ellipse 130% 130% at 5% 25%,
      hsl(211, 100%, 89%) 0%,
      hsl(210, 60%, 75%) 10%,
      hsl(210, 85%, 65%) 20%,
      hsl(210, 90%, 55%) 30%,
      hsl(210, 85%, 40%) 50%,
      hsl(234, 53%, 32%) 73%,
      hsl(234, 85%, 30%) 100%
    );
    animation: circling 5s linear infinite;
  }
  .option-2-layer2 {
    background: radial-gradient(
      circle 90% at 80% 60%,
      hsla(210, 85%, 40%, 0.3) 0%,
      hsla(234, 53%, 42%, 0.4) 30%,
      hsla(234, 53%, 32%, 0.5) 55%,
      transparent 100%
    );
    animation: circling 12s linear infinite;
    opacity: 1;
  }
  .option-2-layer3 {
    background: radial-gradient(
      ellipse 110% 110% at 40% 2%,
      hsla(209, 100%, 88%, 0.299) 0%,
      hsla(234, 85%, 45%, 0.3) 25%,
      hsla(234, 85%, 30%, 0.3) 45%,
      transparent 100%
    );
    animation: circling 8s linear infinite reverse;
    opacity: 1;
  }

  /* ── Option 3 · Teal ─────────────────────────────────────────────────────── */
  .option-3-layer1 {
    background: radial-gradient(
      ellipse 125% 125% at 5% 65%,
      hsl(190, 40%, 80%) 0%,
      hsl(185, 35%, 68%) 8%,
      hsl(185, 45%, 60%) 15%,
      hsl(185, 60%, 50%) 25%,
      hsl(185, 100%, 37%) 40%,
      hsl(188, 60%, 25%) 73%,
      hsl(193, 40%, 22%) 100%
    );
    animation: circling 5s linear infinite;
  }
  .option-3-layer2 {
    background: radial-gradient(
      circle 95% at 50% 80%,
      hsla(185, 100%, 37%, 0.4) 0%,
      hsla(188, 80%, 30%, 0.4) 30%,
      hsla(188, 60%, 25%, 0.5) 60%,
      transparent 100%
    );
    animation: circling 12s linear infinite;
    opacity: 0.5;
  }
  .option-3-layer3 {
    background: radial-gradient(
      ellipse 100% 100% at 90% 40%,
      hsla(190, 40%, 80%, 0.5) 0%,
      hsla(190, 35%, 65%, 0.4) 25%,
      hsla(193, 40%, 22%, 0.4) 50%,
      transparent 100%
    );
    animation: circlingOpposite 8s linear infinite reverse;
    opacity: 0.6;
  }

  .add-noise::after {
    content: "";
    position: absolute;
    inset: 0;
    background-image: radial-gradient(circle, rgba(255, 255, 255, 0.05) 0.5px, transparent 0.5px);
    background-size: 1px 1px;
    opacity: 0.4;
    pointer-events: none;
    filter: blur(0.5px);
  }

  @keyframes circling {
    0% {
      transform: translate(0, -5%);
    }
    6.25% {
      transform: translate(2%, -5%);
    }
    12.5% {
      transform: translate(4%, -4%);
    }
    18.75% {
      transform: translate(5%, -2%);
    }
    25% {
      transform: translate(5%, 0);
    }
    31.25% {
      transform: translate(5%, 2%);
    }
    37.5% {
      transform: translate(4%, 4%);
    }
    43.75% {
      transform: translate(2%, 5%);
    }
    50% {
      transform: translate(0, 5%);
    }
    56.25% {
      transform: translate(-2%, 5%);
    }
    62.5% {
      transform: translate(-4%, 4%);
    }
    68.75% {
      transform: translate(-5%, 2%);
    }
    75% {
      transform: translate(-5%, 0);
    }
    81.25% {
      transform: translate(-5%, -2%);
    }
    87.5% {
      transform: translate(-4%, -4%);
    }
    93.75% {
      transform: translate(-2%, -5%);
    }
    100% {
      transform: translate(0, -5%);
    }
  }

  @keyframes circlingOpposite {
    0% {
      transform: translate(0, -5%);
    }
    6.25% {
      transform: translate(-2%, -5%);
    }
    12.5% {
      transform: translate(-4%, -4%);
    }
    18.75% {
      transform: translate(-5%, -2%);
    }
    25% {
      transform: translate(-5%, 0);
    }
    31.25% {
      transform: translate(-5%, 2%);
    }
    37.5% {
      transform: translate(-4%, 4%);
    }
    43.75% {
      transform: translate(-2%, 5%);
    }
    50% {
      transform: translate(0, 5%);
    }
    56.25% {
      transform: translate(2%, 5%);
    }
    62.5% {
      transform: translate(4%, 4%);
    }
    68.75% {
      transform: translate(5%, 2%);
    }
    75% {
      transform: translate(5%, 0);
    }
    81.25% {
      transform: translate(5%, -2%);
    }
    87.5% {
      transform: translate(4%, -4%);
    }
    93.75% {
      transform: translate(2%, -5%);
    }
    100% {
      transform: translate(0, -5%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .graft-layer {
      animation: none !important;
    }
  }
</style>
