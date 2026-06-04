<script lang="ts">
  import { fade } from "svelte/transition";

  let showLandscapeModal = $state(false);

  $effect(() => {
    const checkScreenOrientation = () => {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      );
      const isLandscape = window.innerWidth > window.innerHeight;
      const isNotPortrait = screen.orientation.type !== "portrait-primary";

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
  >
    <h3 class="text-white text-center">
      Please Flip <br /> to Portrait Mode
    </h3>
  </div>
{/if}
