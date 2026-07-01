<script lang="ts">
  // Revogen banner slot for the portfolio featured section. Renders the live
  // interactive grafts hero by default, and a static poster under
  // prefers-reduced-motion. The swap is pure CSS (Tailwind `motion-reduce:`
  // variant) so there is no hydration mismatch or layout shift. The grafts hero
  // lazy-loads its images and pauses its ambient animation off-screen, so the
  // page's initial load / Lighthouse budget is unaffected.
  import Img from "$lib/components/Img.svelte";
  import RevogenGraftsHero from "./RevogenGraftsHero.svelte";
  import revogenHero from "$lib/assets/images/revogenHero.jpg?as=run";
</script>

<section class="w-screen relative overflow-hidden">
  <!-- Interactive (default) -->
  <div class="motion-reduce:hidden">
    <RevogenGraftsHero />
  </div>

  <!-- Static fallback under prefers-reduced-motion -->
  <div
    class="hidden motion-reduce:block w-screen aspect-3/2 md:aspect-video relative overflow-hidden"
  >
    <Img
      src={revogenHero}
      alt="Revogen homepage featuring surgical, wound-care and ocular grafts"
      class="absolute inset-0 h-full w-full object-cover"
    />
  </div>
</section>
