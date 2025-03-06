
<script lang="ts">
    import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";

    import DefaultButton from "$lib/components/Buttons/DefaultButton.svelte";
    import { fade } from "svelte/transition";

    import { onMount } from "svelte";

    import printedReddoorLogo from "$lib/assets/icons/logos/printedReddoor.png"

  
        let viewportHeight:number;
        let viewportWidth:number;
  
    
       
        let transitioning = true;
  
        let openingSection:HTMLElement;
        let door:HTMLElement;
        let initialContent:HTMLElement;
        let percentageScrolled = 0;
        let doorScale = 1;
        let doorOriginLeft = 0;
        let doorOriginTop = 0;
        let doorOriginBottom = 0;
        let doorTranslateLeft = 0;
        let doorTranslateTop = 0;
        let doorWidth=0;
        let doorRotate = 0;
        
  
        $: {
            
            console.log(percentageScrolled)

            if(door){
                doorTranslateLeft = translateDoorLeft()
                doorScale=1+percentageScrolled*2
                if(percentageScrolled>30)
                    doorRotate=-90*(percentageScrolled-20)/80
            }

            
        }

        const translateDoorLeft = () => {

    const doorCenterX = doorOriginLeft + (doorWidth / 2);

    const centerShiftX = (doorScale - 1) * (doorWidth / 2);
    let calculatedTranslation = -centerShiftX;
    
    // Check if left edge would go off-screen
    const leftEdge = doorOriginLeft + calculatedTranslation;
    if (leftEdge < 0) {
        // Pin to left edge of screen
        calculatedTranslation = -doorOriginLeft;
    }
    
    return calculatedTranslation;
};

  
        const handleScroll = () => {
  
            const containerRect = openingSection.getBoundingClientRect();  
            const doorRect = door.getBoundingClientRect();
        
            percentageScrolled = 100-(containerRect.bottom-viewportHeight)/(containerRect.height-viewportHeight)*100;
            
            percentageScrolled = Math.min(Math.max(percentageScrolled, 0), 100);

        }

        const placeDoor = () => {
            const contentRect = initialContent.getBoundingClientRect();
            const doorRect = door.getBoundingClientRect();
            doorOriginLeft = contentRect.left;
            doorOriginTop = contentRect.top;
            doorOriginBottom = doorOriginTop+doorRect.height
            doorWidth = doorRect.width;

        }
          
  
        onMount(() => {

    
    // CorcontainerRectly add event listener and store the function reference
    window.addEventListener('scroll', handleScroll);
    placeDoor();
    window.addEventListener('resize', placeDoor);
    setTimeout(()=>transitioning=false, 100);
    
    // Return cleanup function that removes both interval and event listener
    return () => {

      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize',placeDoor)
    }
  });
      </script>

      <style>
         .rotatable{
            -webkit-transform-style: preserve-3d;
            -moz-transform-style: preserve-3d;
            transform-style: preserve-3d;
         }
        </style>

  
  <svelte:head>
      <title>Reddoor Creative | Home</title>
  </svelte:head>
  <svelte:window bind:innerWidth={viewportWidth} bind:innerHeight={viewportHeight} />

{#if transitioning}
<div class="bg-white w-screen h-screen fixed top-0 left-0 z-50" transition:fade/>
{/if}


<div class="w-screen" bind:this={openingSection}>
    <div class="h-screen w-screen fixed bottom-0 left-0 bg-paper">
        <img src={printedReddoorLogo} bind:this={door} alt="reddoor logo" 
            style="transform:scale({doorScale}) translate({doorTranslateLeft}px,{doorTranslateTop}px) rotate3d(0,1,0,{doorRotate}deg);
              -moz-transform: scale({doorScale}) translate({doorTranslateLeft}px,{doorTranslateTop}px) rotate3d(0,1,0,{doorRotate}deg);  
              -webkit-transform: scale({doorScale}) translate({doorTranslateLeft}px,{doorTranslateTop}px) rotate3d(0,1,0,{doorRotate}deg);
            left:{doorOriginLeft}px; top:{doorOriginTop}px; " 
            class="origin-left absolute w-full h-fit md:w-1/5  max-w-24 max-h-[67.67px] mt-3"
        />
    <ContentWidth class="flex flex-col justify-center h-full -z-10">
      <div class="flex flex-col md:flex-row justify-between" bind:this={initialContent}>
    
        <div class="w-full h-full md:w-1/5"></div>
      
      <div class="w-full md:w-4/5 flex flex-col items-start">
        <h3 class="text-primary w-full ">Arm your brand with a clear story and compelling design.</h3>
        <div class="flex flex-row gap-6 mt-12">
          <a href="/contact">
          <DefaultButton bold filled text="MEET WITH US"/>
          </a>
          <a href="/portfolio">
          <DefaultButton filled={false} class="border-1 border-dark text-dark hover:bg-mid hover:bg-opacity-20" text="VIEW WORK"/>
          </a>
          </div>
      </div>
      </div>
    </ContentWidth>
    </div>
    <div class="h-screen w-screen"></div>
    <div class="h-screen w-screen"></div>
    <div class="h-screen w-screen"></div>
  </div>