<script lang="ts">
  import { fade } from "svelte/transition";
  import { trapFocus } from "$lib/actions/trapFocus";

  let showLandscapeModal = $state(false);

  $effect(() => {
    const checkScreenOrientation = () => {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      );
      const isLandscape = window.innerWidth > window.innerHeight;
      // screen.orientation is undefined on some iOS Safari versions; reading
      // `.type` there throws, and a throw inside this $effect kills Svelte's
      // effect scheduler. Optional-chain it — when the API is absent we fall
      // back to the innerWidth/innerHeight landscape check above.
      const isNotPortrait = screen.orientation?.type !== "portrait-primary";

      if (isMobile && isLandscape && isNotPortrait) {
        showLandscapeModal = true;
      } else {
        showLandscapeModal = false;
      }
    };

    checkScreenOrientation();
    window.addEventListener("resize", checkScreenOrientation, false);
    return () => {
      window.removeEventListener("resize", checkScreenOrientation, false);
    };
  });
</script>

{#if showLandscapeModal}
  <div
    transition:fade
    class="w-screen h-screen fixed bg-black flex justify-center items-center top-0 left-0 p-12 z-50"
    role="alertdialog"
    aria-modal="true"
    aria-label="Rotate your device to portrait mode"
    tabindex="-1"
    use:trapFocus
  >
    <h3 class="text-white text-center">
      Please Flip <br /> to Portrait Mode
    </h3>
  </div>
{/if}
