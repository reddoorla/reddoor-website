<script lang="ts">
  import { onMount } from "svelte";
  import { animateIn } from "$lib/actions/animateIn";
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import RailRow from "$lib/components/RailRow.svelte";

  // Same hydration marker the other fixtures carry — see
  // `dev/a11y-fixtures/+page.svelte`. Interacting with the triggered demo below
  // before hydration races the click away.
  onMount(() => document.documentElement.setAttribute("data-hydrated", "true"));

  let triggered = $state(false);
</script>

<!--
  The animation harness the a11y audit names alongside `/dev/a11y-fixtures`
  (@reddoorla/maintenance, `src/audits/a11y.ts`). It had never existed here: the
  audit's route list is fleet-wide and the starter's copy was the only one, so
  until the route-status guard landed in 0.97 a 404 here scanned the error page
  and passed. Its subject is `$lib/actions/animateIn`, which this site drives
  through ten slices, every one of them via `RailRow` or `ContentWidth` rather
  than the bare action.

  Two reasons the fixture has to hold the mounted states rather than a
  screenshot's worth of markup. The action writes inline `opacity: 0` and a
  `translateY` at mount, so anything it drives is mid-transition when axe
  samples it — that is the "serious" colour-contrast flake the audit neutralises
  by snapping transitions to their resting state, and it only has something to
  neutralise if a real `use:animateIn` element is on the page. And the
  reduced-motion and `enabled: false` branches return before `applyHidden`,
  which is what makes them safe to ship; a fixture that only exercised the
  animating branch would leave both no-ops unscanned.
-->

<section class="bg-white px-8 py-16">
  <h1 class="text-black">use:animateIn harness</h1>
  <p class="text-black">
    Dev-only. Each block below mounts one branch of the action. Scroll to reveal the
    viewport-observed ones.
  </p>
</section>

<section class="bg-white px-8 pb-16">
  <h2 class="text-black">Default viewport reveal</h2>
  <div use:animateIn class="bg-paper p-8">
    <p class="text-black">
      <code>use:animateIn</code> — 2400ms fade and a 25% slide-up on first intersection, delayed by horizontal
      position.
    </p>
  </div>
</section>

<section class="bg-white px-8 pb-16">
  <h2 class="text-black">Position-based stagger</h2>
  <div class="grid grid-cols-3 gap-4">
    <div use:animateIn class="bg-paper p-6"><p class="text-black">Left (small delay)</p></div>
    <div use:animateIn class="bg-paper p-6"><p class="text-black">Centre</p></div>
    <div use:animateIn class="bg-paper p-6"><p class="text-black">Right (max delay)</p></div>
  </div>
</section>

<section class="bg-white px-8 pb-16">
  <h2 class="text-black">Custom duration and travel</h2>
  <div use:animateIn={{ duration: 800 }} class="bg-paper mb-4 p-8">
    <p class="text-black"><code>{`{ duration: 800 }`}</code> — a snappier reveal.</p>
  </div>
  <div use:animateIn={{ translateY: "24px" }} class="bg-paper p-8">
    <p class="text-black">
      <code>{`{ translateY: "24px" }`}</code> — a small slide, not a quarter height.
    </p>
  </div>
</section>

<section class="bg-white px-8 pb-16">
  <h2 class="text-black">No stagger</h2>
  <div class="grid grid-cols-3 gap-4">
    <div use:animateIn={{ delayMax: 0 }} class="bg-paper p-6"><p class="text-black">All</p></div>
    <div use:animateIn={{ delayMax: 0 }} class="bg-paper p-6"><p class="text-black">Reveal</p></div>
    <div use:animateIn={{ delayMax: 0 }} class="bg-paper p-6">
      <p class="text-black">Together</p>
    </div>
  </div>
</section>

<section class="bg-white px-8 pb-16">
  <h2 class="text-black">Disabled — the action is a no-op</h2>
  <!-- `enabled: false` returns before `applyHidden`, so this element never gets
       inline opacity and renders identically with JS off. It is the branch every
       slice takes when its `isAnimated` field is false. -->
  <div use:animateIn={{ enabled: false }} class="bg-paper p-8">
    <p class="text-black">
      <code>{`{ enabled: false }`}</code> — no inline opacity, nothing to reveal.
    </p>
  </div>
</section>

<section class="bg-white px-8 pb-16">
  <h2 class="text-black">Through ContentWidth</h2>
  <ContentWidth animateIn>
    <div class="bg-paper p-8">
      <p class="text-black">
        <code>&lt;ContentWidth animateIn&gt;</code> applies the action to its inner wrapper.
      </p>
    </div>
  </ContentWidth>
</section>

<section class="bg-white pb-16">
  <h2 class="text-black px-8">Through RailRow, with cascading items</h2>
  <RailRow label="Rail label" animateIn animateItems>
    <p class="text-black">First item — the rail cascades its children left to right.</p>
    <p class="text-black">Second item.</p>
    <p class="text-black">Third item.</p>
  </RailRow>
</section>

<div class="flex h-[40vh] items-center justify-center bg-white">
  <p class="text-black">(scroll gap, so the triggered demo starts off-screen)</p>
</div>

<section class="bg-white px-8 pb-32">
  <h2 class="text-black">Triggered mode</h2>
  <div class="flex flex-col items-start gap-4">
    <button
      type="button"
      onclick={() => (triggered = !triggered)}
      class="border border-black px-4 py-2 text-black"
    >
      Toggle trigger — currently {triggered}
    </button>
    <div use:animateIn={triggered} class="bg-paper w-full p-8">
      <p class="text-black">
        <code>{`use:animateIn={triggered}`}</code> — driven by the button, with no viewport observer.
      </p>
    </div>
  </div>
</section>
