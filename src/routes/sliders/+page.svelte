<script lang='ts'>
    import Spacer from "$lib/components/Spacer.svelte";
    import ContentBox from "$lib/components/FullWidth/ContentBox.svelte";
    import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import ScreenWidthGallerySlider from "$lib/components/ScreenWidth/ScreenWidthGallerySliderSmall.svelte";
  import ContentWidthGallerySlider from "$lib/components/ContentWidth/ContentWidthGallerySlider.svelte";
  import SquareImage from "$lib/components/FullWidth/SquareImage.svelte";
  import placeholder from '$lib/assets/images/image_placeholder.svg'
  import chevronRight from '$lib/assets/icons/chevron-right.svg'
  import chevronLeft from '$lib/assets/icons/chevron-left.svg'
  import { onMount } from "svelte";
  import { swipe } from "svelte-gestures";
  import { fade } from "svelte/transition";
  import ScreenWidthImageSlider from "$lib/components/ScreenWidth/ScreenWidthImageSlider.svelte";
  
  let innerWidth:number;  
  
  let imageArray = [placeholder, placeholder, placeholder, placeholder];
  let showImage=true;

  const SLIDER_TRANSITION_FUNCTION="cubic-bezier(.5,0,0,1)";
  const SLIDER_TRANSITION_LENGTH_IN_MS=2000;
  const SLIDER_INTERVAL_IN_MS = 5000;


  let sliderIndex = 0;
      
      let isSlideAnimated = true;

      const resetSliderToStart = () => {
          setTimeout(()=>isSlideAnimated=false, SLIDER_TRANSITION_LENGTH_IN_MS)
          setTimeout(()=> sliderIndex=0, SLIDER_TRANSITION_LENGTH_IN_MS+20)
          setTimeout(()=>isSlideAnimated=true,SLIDER_TRANSITION_LENGTH_IN_MS+40)
      }

      const resetSliderToEnd = () => {
          setTimeout(()=>isSlideAnimated=false, SLIDER_TRANSITION_LENGTH_IN_MS)
          setTimeout(()=> sliderIndex=imageArray.length-1, SLIDER_TRANSITION_LENGTH_IN_MS+20)
          setTimeout(()=>isSlideAnimated=true,SLIDER_TRANSITION_LENGTH_IN_MS+40)
      }
  
      const slideRight = () => {
          sliderIndex--;
          clearInterval(sliderInterval);
	        sliderInterval = setInterval(()=>slideRight(), SLIDER_INTERVAL_IN_MS);
          if(sliderIndex<0)
              resetSliderToEnd();
          
          console.log(sliderIndex)
      }
      const slideLeft = () => {
          sliderIndex++;
          clearInterval(sliderInterval);
	    sliderInterval = setInterval(()=>slideLeft(), SLIDER_INTERVAL_IN_MS);
          if(sliderIndex==imageArray.length)
              resetSliderToStart();
      }
  
      const setSliderIndex = (index:number) => {
        clearInterval(sliderInterval);
            if(sliderIndex<index){
                sliderInterval = setInterval(()=>slideLeft(), SLIDER_INTERVAL_IN_MS);
            }
            else{
                sliderInterval = setInterval(()=>slideRight(), SLIDER_INTERVAL_IN_MS);
            }
          sliderIndex=index;        
      }

      const setSliderIndexWithDelay = (index:number) => {
            showImage=false;
            clearInterval(sliderInterval);
            sliderIndex=index;
            setTimeout(()=>{
                showImage=true;
            },300)
          
          
      }
  
      let sliderInterval:NodeJS.Timeout;
  
      const handleSwipe = (e:CustomEvent<{ direction: "left" | "top" | "right" | "bottom"; target: EventTarget; }>) => {
        if(e.detail.direction==="left") 
          slideLeft();
  
          if(e.detail.direction==="right") 
          slideRight();
      }

      let progressPosistion = 0;
      let progressWrapForwardPosition = -100;
      let progressWrapBackwardPosition = imageArray.length*100

  
      onMount(()=>{
         sliderInterval = setInterval(()=>slideLeft(), SLIDER_INTERVAL_IN_MS);
      });
  
      const tripledImages = imageArray.concat(imageArray).concat(imageArray)
</script>
<svelte:head>
    <title>Sliders | Reddoor Wireframer</title>
</svelte:head>
<svelte:window bind:innerWidth />

<!-- slider #1 -->
<ContentWidth>
    <div class=" w-full max-w-[564px] mx-auto -mb-16">
    <ContentBox 
        icon=""
        titleTag="h2"
        titleText="Image Gallery"
        paragraphText="Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi."
        float="center"
    />
    </div>

</ContentWidth>
<ScreenWidthGallerySlider 

/>

<Spacer color="#424B5A" />

<div class="w-full relative">
    
<ContentWidth class="flex flex-col lg:flex-row relative">
    {#if innerWidth<=768}
        <div use:swipe on:swipe={handleSwipe} class="w-full">
            <div style="width: {tripledImages.length*108}%; margin-left:-112%; transform:translateX({-(sliderIndex)/tripledImages.length*100}%);" class="flex flex-row justify-between flex-nowrap overflow-hidden {isSlideAnimated ? 'transition-transform duration-[2000ms]': ''}">
            {#each tripledImages as image }
                <div style="width: {92/tripledImages.length}%" class="mx-auto">
                    <SquareImage />
                </div>
            {/each}
            </div>
        </div>

        <div class="h-10 w-5/6 flex align-middle justify-center mt-6 mx-auto pr-4">
            <button class="h-[10px] mr-8" on:click={slideRight}>
                <img src={chevronLeft} alt="previous slide"/>
            </button>
            {#each  imageArray as image, i}
                <button class="h-[10px] w-[10px] border-2  rounded-full transition-colors duration-1000 cursor-pointer active:-translate-y-[0.5px] hover:opacity-60 mr-4 
								{(sliderIndex%imageArray.length>=0&&sliderIndex%imageArray.length===i)|| (sliderIndex%imageArray.length<=0&&imageArray.length+sliderIndex%imageArray.length===i) ? "bg-dark border-dark" : "border-light"}"
                    on:click={()=>setSliderIndex(i)}
                    aria-label="image {i} of {imageArray.length}"
                    aria-hidden
                ></button>
            {/each}
            <button class="h-[10px] ml-4" on:click={slideLeft}>
                <img src={chevronRight}  alt="next slide"/>
            </button>
        </div>
    {/if}
    <div class="w-full lg:w-1/2 lg:h-[50vw] my-8 lg:left-0 flex justify-center items-center">
        <div class="w-full flex flex-col justify-center items-center">
        <ContentBox 
            titleTag="h2"
            titleText="Image Gallery"
            paragraphText="Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi. Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi. Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi."
            buttonText="BUTTON"
            float="left"
            icon=""
        />
        {#if innerWidth>768}
        <div class="h-10 w-5/6 flex align-middle justify-center mt-6 -ml-8">
            <button class="h-[10px] mr-8" on:click={slideRight}>
                <img src={chevronLeft} alt="previous slide"/>
            </button>
            {#each  imageArray as image, i}
                <button class="h-[10px] w-[10px] border-2  rounded-full transition-colors duration-1000 cursor-pointer active:-translate-y-[0.5px] hover:opacity-60 mr-4 
								{(sliderIndex%imageArray.length>=0&&sliderIndex%imageArray.length===i)|| (sliderIndex%imageArray.length<=0&&imageArray.length+sliderIndex%imageArray.length===i) ? "bg-dark border-dark" : "border-light"}"
                    on:click={()=>setSliderIndex(i)}
                    aria-label="image {i} of {imageArray.length}"
                    aria-hidden
                ></button>
            {/each}
            <button class="h-[10px] ml-4" on:click={slideLeft}>
                <img src={chevronRight}  alt="next slide"/>
            </button>
        </div>
        {/if}
    </div>
    </div>
    <div class="w-0 h-0 lg:w-1/2"></div>
    {#if innerWidth<=1024&&innerWidth>768}
        <div use:swipe on:swipe={handleSwipe} class="w-full">
            <div style="width: {tripledImages.length*108}%; margin-left:-112%; transform:translateX({-(sliderIndex)/tripledImages.length*100}%);" class="flex flex-row justify-between flex-nowrap overflow-hidden {isSlideAnimated ? 'transition-transform duration-[2000ms]': ''}">
            {#each tripledImages as image }
                <div style="width: {92/tripledImages.length}%" class="mx-auto">
                    <SquareImage />
                </div>
            {/each}
            </div>
        </div>
    {/if}
</ContentWidth>
{#if innerWidth>1024}
<div use:swipe on:swipe={handleSwipe} class="w-1/2 absolute top-0 right-0 ">
    {#key sliderIndex}
        <div out:fade={{duration:300}} in:fade={{delay:500, duration:300}}>
            {#each tripledImages as image, i }
                {#if i===sliderIndex%imageArray.length}
                    <SquareImage />
                {/if}     
            {/each}
        </div>
    {/key}
    
</div>
{/if}
    
</div>



<Spacer color="#424B5A" />
<!-- slider #2 -->
 <ContentWidth class="my-16">
    <h6>Image Gallery</h6>
    <ContentWidthGallerySlider 

/>

 </ContentWidth>

<!-- slider #3 -->
<Spacer color="#424B5A" />
<ScreenWidthImageSlider hasArrows dotFloat="center" />
<ContentWidth class="my-16">

</ContentWidth>

<!-- slider #4 -->
<Spacer color="#424B5A" />
<ScreenWidthImageSlider hasArrows dotFloat="center">
    <ContentWidth class="my-16 h-full relative">
        <ContentBox 
            class="max-w-[768px] mx-auto absolute bottom-1/3 left-1/2 -translate-x-1/2"
            backgroundColor="white"
            titleTag="h3"
            titleText="Image Gallery"
            paragraphText="Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi."
            buttonText="button"
        />
    </ContentWidth>
</ScreenWidthImageSlider>


