<script lang="ts">
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import DefaultButton from "$lib/components/Buttons/DefaultButton.svelte";
  import { fade, fly } from "svelte/transition";
  import { onMount } from "svelte";
  import stJames from '$lib/assets/images/openingBgs/stJamesBg.jpg?as=run';
  import enzos from '$lib/assets/images/openingBgs/enzosBg.jpg?as=run';
  import fyf from '$lib/assets/images/openingBgs/fyfBg.jpg?as=run';
  import sonder from '$lib/assets/images/openingBgs/sonderBg.jpg?as=run';

  import printedReddoorLogo from '$lib/assets/icons/logos/reddoor_logo.png'
  import { isTop } from "$lib/stores/isTop";
  import Img from "@zerodevx/svelte-img";
  import PillButton from "./Buttons/PillButton.svelte";
  import AnimateInTriggered from "./AnimateInTriggered.svelte";

  
  let viewportHeight: number;
  let viewportWidth: number;
  let transitioning = true;
  let openingSection: HTMLElement;
  let percentageScrolled = 0;
  let maskScale = 0.2; // Start with a very small mask
  let showCompelling = false;
  let showButtons = false;

  const backgrounds = [
    {name: "St James' School" ,
    src: stJames,
    media: 'Branding, Print'},
    {name: 'Enzo\'s Hand Wash',
    src: enzos,
    media: 'Branding, Print, Digital'},
    {name: 'Freedom Youth Foundation',
    src: fyf,
    media: 'Branding, Print'},
    {name: 'Gallery Sonder',
    src: sonder,
    media: 'Branding, Print, Digital'},
  ];
  
  let currentImageIndex = 0;
  const changeBackgroundImage = () => {
    currentImageIndex = (currentImageIndex + 1) % backgrounds.length;
  };

  let hideTopImage = false;

  $: {
    currentImageIndex;
    hideTopImage = false;
    setTimeout(() => {
      
        hideTopImage = true;
    }, 5000);

    console.log('currentImageIndex', currentImageIndex);
  }
  const handleScroll = () => {
    const containerRect = openingSection.getBoundingClientRect();
    percentageScrolled = 100 - (containerRect.bottom - viewportHeight) / (containerRect.height - viewportHeight) * 100;
    percentageScrolled = Math.min(Math.max(percentageScrolled, 0), 100);

    maskScale = 0.2 + (percentageScrolled / 100) * 10; 
    if(percentageScrolled<99){
      isTop.set(true)
    }else{
      isTop.set(false)
    }

    if (percentageScrolled > 30) {
      showCompelling = true;
      showButtons = true;
    } else {
      showCompelling = false;
      showButtons = false;
    }

    console.log('percentageScrolled', percentageScrolled);
  };
  
  onMount(() => {
    isTop.set(true)
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    setTimeout(() => transitioning = false, 100);
    const rotateImageInterval = setInterval(changeBackgroundImage, 5000); // Change image every 7 seconds
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearInterval(rotateImageInterval);
    };
  });
 </script>
 
 <svelte:head>
   <title>Reddoor Creative | Home</title>
 </svelte:head>
 
 <svelte:window bind:innerWidth={viewportWidth} bind:innerHeight={viewportHeight} />
 
 {#if transitioning}
   <div class="bg-white w-screen h-lvh fixed top-0 left-0 z-50" transition:fade/>
 {/if}
 
 <div class="w-screen" bind:this={openingSection}>
   <div class="h-lvh w-screen fixed bottom-0 left-0 bg-paper-red">
     <ContentWidth class="flex flex-col justify-center items-center h-full z-10 relative {percentageScrolled > 30 ? "opacity-0 ": 'opacity-100'}">  
       <div class="absolute w-fit lg:w-1/2 right-0 top-1/2 lg:-translate-x-12 translate-y-20 h-full">
         <h1 class="text-white text-left w-fit">Arm your brand with</h1>
         <h1 class="text-white text-left w-fit">a clear story...</h1>
         
       </div>
       <i class="fa-light fa-arrow-down fa-2xl opacity-50 absolute bottom-12 text-white bob-always" />
     </ContentWidth>
     
     <div class="fixed top-0 left-0 w-screen h-lvh overflow-hidden z-20">
       <div
         class="fixed top-0 left-0 w-full h-full z-20"
         style="clip-path: url(#mask-path);"

       >

       {#each backgrounds as background, index}
          <Img
              src={background.src}
              alt="Background"
              class="absolute h-full w-full object-cover will-change-contents transition-opacity duration-1000 ease-fast-slow {index === currentImageIndex ? 'opacity-100' : ' delay-1000 opacity-0'}"
          />
        {/each}
      
          <!-- <Img
              src={backgrounds[(currentImageIndex+1)%backgrounds.length].src}
              alt="Background"
              class="absolute h-full w-full object-cover will-change-contents"
          />
   
          {#if !hideTopImage}
          <div out:fade>
         <Img
           src={backgrounds[currentImageIndex].src}
           alt="Background"
           class="absolute h-full w-full object-cover will-change-contents"
         />
      
          </div>
           
          {/if} -->
          <div class='w-screen h-lvh bg-black opacity-25 fixed'></div>
 
          {#key currentImageIndex}
          <div class='hidden lg:block h-lvh w-screen fixed top-0 left-0' in:fly={{y:'100%', duration: 800}} out:fade>
           <ContentWidth class="flex flex-col items-start justify-end h-full pb-4 lg:pb-16">
             <p class='text-white text-left underline underline-offset-4'>{backgrounds[currentImageIndex].name}</p>
             <p class='text-white text-left'>{backgrounds[currentImageIndex].media}</p>
 
           </ContentWidth>
           </div>
           {/key}


           {#if $isTop}
            <img src={printedReddoorLogo} alt="reddoor logo" class="absolute top-8 left-8 w-12" in:fade={{delay:400}} out:fade/>
          {/if}
         

         <ContentWidth class="flex flex-col justify-center items-center h-full z-20 relative">
          <div class="absolute w-fit lg:w-1/2 right-0 top-1/2 lg:-translate-x-12 translate-y-20 h-full">
            <h1 class="text-white text-left md:translate-x-[14.5px] lg:translate-x-[7.5px]">Arm your brand with</h1>
            <h1 class="text-white text-left md:translate-x-[14.5px] lg:translate-x-[7.5px] transition duration-1000 ease-fast-slow {showCompelling? "opacity-100 translate-y-0":"opacity-0 translate-y-[50%]"}">compelling design</h1>
            <div class="w-full flex flex-col md:flex-row md:gap-4 mt-8 transition duration-1000 ease-fast-slow {showButtons? "opacity-100 translate-y-0 delay-1000":"opacity-0 translate-y-[50%]"}">
              <DefaultButton
                filled={false}
                class='border-1 border-white text-primary bg-white hover:bg-primary hover:text-white'
                href="/contact"
                text="Meet With Us"
                red={false}
                />
              <DefaultButton
                filled={true}
                bold={true}
                href="/portfolio"
                text="View Our Work"

              />
            </div>
            <!-- {#key currentImageIndex}
          <div class='w-fit {hideTopImage?'opacity-0':''}' in:fly={{y:'100%', duration: 500}}>
           
             <p class='text-white text-left underline underline-offset-4'>{backgrounds[currentImageIndex].name}</p>
             <p class='text-white text-left'>{backgrounds[currentImageIndex].media}</p>

           </div>
          {/key} -->
          </div>
          <div>
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
   <div class="h-lvh w-screen"></div>
   <div class="h-lvh w-screen"></div>
   <div class="md:h-lvh w-screen"></div>
   <div class="md:h-lvh w-screen"></div>
 </div>