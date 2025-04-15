<script lang="ts">
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import DefaultButton from "$lib/components/Buttons/DefaultButton.svelte";
  import { fade } from "svelte/transition";
  import { onMount } from "svelte";
  import backgroundImageUrl from '$lib/assets/images/stJames.jpg'
  import printedReddoorLogo from '$lib/assets/icons/logos/printedReddoor.png'
  import { isTop } from "$lib/stores/isTop";
  
  let viewportHeight: number;
  let viewportWidth: number;
  let transitioning = true;
  let openingSection: HTMLElement;
  let percentageScrolled = 0;
  let maskScale = 0.1; // Start with a very small mask

  
  const handleScroll = () => {
    const containerRect = openingSection.getBoundingClientRect();
    percentageScrolled = 100 - (containerRect.bottom - viewportHeight) / (containerRect.height - viewportHeight) * 100;
    percentageScrolled = Math.min(Math.max(percentageScrolled, 0), 100);

    maskScale = 0.2 + (percentageScrolled / 100) * 20; 
    if(percentageScrolled<95){
      isTop.set(true)
    }else{
      isTop.set(false)
    }
  };
  
  onMount(() => {
    isTop.set(true)
    window.addEventListener('scroll', handleScroll);
    setTimeout(() => transitioning = false, 100);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  });
 </script>
 
 <svelte:head>
   <title>Reddoor Creative | Home</title>
 </svelte:head>
 
 <svelte:window bind:innerWidth={viewportWidth} bind:innerHeight={viewportHeight} />
 
 {#if transitioning}
   <div class="bg-white w-screen h-screen fixed top-0 left-0 z-50" transition:fade/>
 {/if}
 
 <div class="w-screen" bind:this={openingSection}>
   <div class="h-screen w-screen fixed bottom-0 left-0 bg-paper-red">
     <ContentWidth class="flex flex-col justify-center items-center h-full z-10 relative">
       <div class="absolute w-full h-full flex justify-center items-center">
         <h4 class="text-white text-right absolute" style="transform: translate(calc(-50% - 64px), 0)">Arm your brand with</h4>
         <h4 class="text-white text-left absolute" style="transform: translate(calc(50% + 64px), 0)">a clear story</h4>
       </div>
     </ContentWidth>
     
     <div class="fixed top-0 left-0 w-screen h-screen overflow-hidden z-20">
       <div
         class="fixed top-0 left-0 w-full h-full z-20"
         style="clip-path: url(#mask-path);"
       >
        <img
            src={backgroundImageUrl}
            alt="Background"
            class="absolute h-full w-full object-cover"
        />
         <img
           src={backgroundImageUrl}
           alt="Background"
           class="absolute h-full w-full object-cover"
         />
         <div class="w-96 bg-paper-red h-96 absolute -top-[280px] -left-32 rotate-[-30deg]">

         </div>

         <img src={printedReddoorLogo} alt="reddoor logo" class="absolute top-8 left-8 w-16 opacity-20" />
         

         <ContentWidth class="flex flex-col justify-center items-center h-full z-10 relative">
           <div class="absolute w-full h-full flex justify-center items-center">
             <h4 class="text-white text-right absolute" style="transform: translate(calc(-50% - 56px), 0)">Arm your brand with</h4>
             <h4 class="text-white text-left absolute" style="transform: translate(calc(50% + 72px), 0)">and compelling design.</h4>
           </div>
         </ContentWidth>
       </div>
       
       <!-- SVG with clip path definition -->
       <svg class="pointer-events-none w-0 h-0">
         <defs>
           <clipPath id="mask-path">
             <path
               d="M 0,183.85 V 78.73 L 126.46,0 H 290.72 V 183.85 Z"
               transform="translate({viewportWidth/2}, {viewportHeight/2}) scale({maskScale}) translate(-145.36, -91.93)"
             />
           </clipPath>
         </defs>
       </svg>
     </div>
   </div>
   
   <!-- Scrollable space to enable scrolling -->
   <div class="h-screen w-screen"></div>
   <div class="h-screen w-screen"></div>
   <div class="h-screen w-screen"></div>
   <div class="h-screen w-screen"></div>
 </div>