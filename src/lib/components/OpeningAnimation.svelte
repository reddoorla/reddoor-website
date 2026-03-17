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
  import drawnLogo from '$lib/assets/icons/logos/staticReddoor.png'
  import ContentBox from "./FullWidth/ContentBox.svelte";

  let isOverlayVisible = false;

  
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
    media: 'Branding, Print',
    link: '/portfolio/st-james-episcopal-school'
  },
    {name: 'Enzo\'s Hand Wash',
    src: enzos,
    media: 'Branding, Print, Digital',
    link: '/portfolio/enzos'
  },
    {name: 'Freedom Youth Foundation',
    src: fyf,
    media: 'Branding, Print',
    link: '/portfolio/freedom-youth-foundation'
  },
    {name: 'Gallery Sonder',
    src: sonder,
    media: 'Branding, Print, Digital',
    link: '/portfolio/gallery-sonder'
  },
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


  }
  const handleScroll = () => {
    const containerRect = openingSection.getBoundingClientRect();
    percentageScrolled = 100 - (containerRect.bottom - viewportHeight) / (containerRect.height - viewportHeight) * 100;
    percentageScrolled = Math.min(Math.max(percentageScrolled, 0), 100);

    maskScale = 0.2 + (percentageScrolled / 100) * 14; 
    if(percentageScrolled<99){
      isTop.set(true)
    }else{
      isTop.set(false)
    }

    if (percentageScrolled > 30 ||  (percentageScrolled > 10 && viewportWidth < 768)) { 
      showCompelling = true;
      showButtons = true;
    } else {
      showCompelling = false;
      showButtons = false;
    }


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
   <div class="bg-white w-screen h-dvh fixed top-0 left-0 z-50" transition:fade/>
 {/if}

      {#if isOverlayVisible}
     <div class="w-screen h-lvh fixed bg-paper-red top-0 left-0 z-50" transition:fly={{y:"-100%"}}>
      <ContentWidth class="h-full flex flex-col items-center justify-center gap-12 relative">
        <a href="/" class="text-white text-2xl" on:click={()=>isOverlayVisible=false}>Home</a>
        <a href="/portfolio" class="text-white text-2xl" on:click={()=>isOverlayVisible=false}>Portfolio</a>
        <a href="/about" class="text-white text-2xl" on:click={()=>isOverlayVisible=false}>About</a>
        <a href="/twenty-for-twenty" class="text-white text-2xl" on:click={()=>isOverlayVisible=false}>20 for 20</a>
        <a href="/contact" class="text-white text-2xl" on:click={()=>isOverlayVisible=false}>Meet With Us</a>
        <button class="absolute top-12 right-0 opacity-60 hover:opacity-100 transition z-40" on:click={()=>isOverlayVisible=false}>
          <div in:fade={{delay: 600}} out:fade class="text-white">
            <i class="fa-sharp fa-thin fa-xmark fa-2xl" />
          </div>
        </button>
      </ContentWidth>
     </div>
     {/if}
 
 <div class="w-screen" bind:this={openingSection}>
   <div class="h-dvh w-screen fixed bottom-0 left-0 bg-paper-red">
    
     <ContentWidth class="flex flex-col justify-center items-center h-full z-10 relative {percentageScrolled > 30 ? "opacity-0 ": 'opacity-100'}">  
      
       <div class="absolute w-fit lg:w-1/2 right-0 top-1/2 lg:-translate-x-12 translate-y-20 h-full">
         <h1 class="text-white text-left w-fit opacity-0">Arm your brand with</h1>
         <h1 class="text-white text-left w-fit">a clear story...</h1>
         
       </div>
       <i class="fa-light fa-arrow-down fa-2xl opacity-50 absolute bottom-12 text-white bob-always" />
     </ContentWidth>
     


     <div class="fixed top-0 left-0 w-screen h-dvh overflow-hidden z-20">
      <ContentWidth class="h-32 flex justify-between items-center">
        <img src={drawnLogo} class='brightness-0 invert h-20' alt='reddoor'/>
        <button class="opacity-100 hover:opacity-60 transition " on:click={() => isOverlayVisible = true} in:fade={{delay:400}} out:fade>
          <i class="fa-sharp fa-bars fa-xl text-white"/>
        </button>
      </ContentWidth>
       <div
         class="fixed top-0 left-0 w-lvw h-dvh z-20"
         style="clip-path: url(#mask-path);"

       >

       {#each backgrounds as background, index}
          <Img
              src={background.src}
              alt={background.name}
              class="absolute h-full w-full object-cover will-change-contents transition-opacity duration-1000 ease-fast-slow {index === currentImageIndex ? 'opacity-100' : ' delay-1000 opacity-0'}"
          />
        {/each}

          <div class='w-screen h-dvh bg-black opacity-25 fixed'></div>
 
          {#key currentImageIndex}
          <div class='hidden lg:block h-dvh w-screen fixed top-0 left-0' in:fade={{delay:400}} out:fade>
           <ContentWidth class="flex flex-col items-start justify-end h-full pb-4 lg:pb-16">
             <a href={backgrounds[currentImageIndex].link}><p class='text-white text-left underline underline-offset-4'>{backgrounds[currentImageIndex].name}</p></a>
             <p class='text-white text-left'>{backgrounds[currentImageIndex].media}</p>
 
           </ContentWidth>
           </div>
           {/key}


           {#if $isTop}
           <ContentWidth class="flex flex-row justify-between items-center absolute top-8 left-0 right-0">
            <img src={printedReddoorLogo} alt="reddoor logo" class="w-12" in:fade={{delay:400}} out:fade/>

           </ContentWidth>
          {/if}
         

         <ContentWidth class="flex flex-col justify-center items-center h-full pointer-events-auto z-30">
          <div class="absolute w-fit lg:w-1/2 right-0 top-1/2 lg:-translate-x-12 translate-y-20 h-full z-20">
            <h1 class="text-white text-left md:translate-x-[14.5px] lg:translate-x-[7.5px] opacity-0">Arm your brand with</h1>
            <h1 class="text-white text-left transition duration-1000 ease-fast-slow {showCompelling? "opacity-100 translate-y-0":"opacity-0 translate-y-[50%]"}">compelling design</h1>
            <div class="w-full flex flex-col md:flex-row md:gap-4 mt-8 transition duration-1000 ease-fast-slow {showButtons? "opacity-100 translate-y-0 delay-1000":"opacity-0 translate-y-[50%]"}">
             
              <DefaultButton
                class=""
                href="/portfolio"
                text="View Our Work"

              />
            </div>

          </div>
          <div>
         </ContentWidth>
       </div>

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
   
   <div class="h-dvh w-screen fixed bottom-0 left-0 pointer-events-none">
    <ContentWidth class="flex flex-col justify-center items-center h-full relative">  
      <div class="absolute w-fit lg:w-1/2 right-0 top-1/2 lg:-translate-x-12 translate-y-20 h-full">
        <h1 class="text-white text-left w-fit ">Arm your brand with</h1>
       
        
      </div>
      <i class="fa-light fa-arrow-down fa-2xl opacity-50 absolute bottom-12 text-white bob-always" />
    </ContentWidth>
   </div>
   
   <!-- Scrollable space to enable scrolling -->
   <div class="h-dvh w-screen"></div>
   <div class="h-dvh w-screen"></div>
   <div class="h-dvh w-screen"></div>
   <div class="h-dvh w-screen"></div>
   <div class="lg:h-dvh w-screen"></div>
 </div>