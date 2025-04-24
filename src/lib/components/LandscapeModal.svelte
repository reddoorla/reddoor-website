<script lang='ts'>
    import { onMount } from "svelte";
    import { fade } from "svelte/transition";

    let showLandscapeModal = false;

    onMount(() => {
  	const checkScreenOrientation = () => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isLandscape = window.innerWidth > window.innerHeight;
    const isNotPortrait = screen.orientation.type !== 'portrait-primary';


    if (isMobile && isLandscape && isNotPortrait) {
    	console.log("Please switch to portrait mode");
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
    <div transition:fade class="w-screen h-screen fixed bg-black flex justify-center items-center top-0 left-0 z-50">
        <h3 class="text-white">
            Please Switch to Portrait Mode
        </h3>

    </div>
{/if}