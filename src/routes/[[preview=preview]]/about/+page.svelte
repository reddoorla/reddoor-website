<script lang="ts">
  import beach from "$lib/assets/images/beach.jpg";
  import hills from "$lib/assets/images/hills.jpg";
  import lake from "$lib/assets/images/alpineLake.jpg";
  import tim from "$lib/assets/images/tim.jpg";
  import erik from "$lib/assets/images/erik.jpg";
  import car from "$lib/assets/images/reddoorcar.png";
  import monotoneCar from '$lib/assets/images/RD_CarOnly.png'
  import applause from "$lib/assets/images/applause.jpg";
  import key from "$lib/assets/icons/RD_Keys-04.png";
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import DefaultButton from "$lib/components/Buttons/DefaultButton.svelte";
  import AnimateIn from "$lib/components/AnimateIn.svelte";
  import ScreenWidthImage from "$lib/components/ScreenWidth/ScreenWidthImage.svelte";
  import { onDestroy, onMount } from 'svelte'
  import LogoSoup from "$lib/components/LogoSoup.svelte";
  import {fade} from 'svelte/transition'
  import { browser } from '$app/environment';

  let targetCarTranslation = 0;
  let targetMonoCarTranslation = 0;
  let carTranslationInVW = 0;
  let monoCarTranslationInVW = 0;
  let viewportHeight = 1024;
  let viewportWidth = 1024;
  let carRef:HTMLImageElement;
  let monoCarDivRef:HTMLDivElement;
  let animationFrameId: number;
  let isMobile = false;
  
 
  const lerp = (start: number, end: number, factor: number) => {
    return start + (end - start) * factor;
  };
  
  // (0.02 = slow and smooth, 0.2 = faster)
  const LERP_FACTOR = 0.02;

  const handleScroll = () =>{
    if (!browser || typeof window === 'undefined') return;
    if (!carRef||!monoCarDivRef) return;

    const carRect = carRef.getBoundingClientRect();
    const monoCarDivRect = monoCarDivRef.getBoundingClientRect();
    const y = window.pageYOffset || document.documentElement.scrollTop;

    targetMonoCarTranslation = 100 * (y/(monoCarDivRect.bottom));
    targetCarTranslation = 100*(carRect.top-carRect.height/2)/viewportHeight;
    
  }
  

  const animate = () => {
    carTranslationInVW = lerp(carTranslationInVW, targetCarTranslation, LERP_FACTOR);
    monoCarTranslationInVW = lerp(monoCarTranslationInVW, targetMonoCarTranslation, LERP_FACTOR);
    animationFrameId = requestAnimationFrame(animate);
  };

  let popupText = "";
  let popupX = 0;
  let popupY = 0;
  let showMobilePopup = false;
  let mobilePopupTarget: HTMLElement | null = null;

  const handleMouseMove = (e:MouseEvent) => {
    if (!browser || typeof window === 'undefined') return;
    if(!popupText || isMobile)return;
    popupX = e.x
    popupY = e.y
  }

  const handleMobilePopupOpen = (text: string, target: HTMLElement) => {
    if (!isMobile) return;
    popupText = text;
    showMobilePopup = true;
    mobilePopupTarget = target;
    setTimeout(() => {
      const closeBtn = document.querySelector('[data-popup-close]') as HTMLElement;
      closeBtn?.focus();
    }, 50);
  }

  const closeMobilePopup = () => {
    showMobilePopup = false;
    popupText = "";
    if (mobilePopupTarget) {
      mobilePopupTarget.focus();
      mobilePopupTarget = null;
    }
  }

  const handleClickOutside = (e: MouseEvent) => {
    if (showMobilePopup && mobilePopupTarget && !mobilePopupTarget.contains(e.target as Node)) {
      closeMobilePopup();
    }
  }

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && (showMobilePopup || popupText)) {
      e.preventDefault();
      if (showMobilePopup) {
        closeMobilePopup();
      } else {
        popupText = "";
      }
    }
  }

  const handleTooltipKeydown = (e: KeyboardEvent, text: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (isMobile) {
        handleMobilePopupOpen(text, e.currentTarget as HTMLElement);
      } else {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        popupX = rect.left + rect.width / 2;
        popupY = rect.top;
        popupText = text;
      }
    }
  }

  const handleTooltipFocus = (text: string, e: FocusEvent) => {
    if (!isMobile) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      popupX = rect.left + rect.width / 2;
      popupY = rect.top;
      popupText = text;
    }
  }

  const handleTooltipBlur = () => {
    if (!isMobile) {
      popupText = "";
    }
  }

  const checkIfMobile = () => {
    if (!browser) return;
    isMobile = window.innerWidth <= 768 || 'ontouchstart' in window;
  }

  let valuesIndex = 1;
  let isValuesTransitioning = false;

  const incrementValues = () => {
    if(isValuesTransitioning)return;
    if(valuesIndex<3){valuesIndex++;}
    else{valuesIndex=1}
    isValuesTransitioning =true;
    setTimeout(()=>isValuesTransitioning=false, 1000)
  }

  const decrementValues = () => {
    if(isValuesTransitioning)return;
    if(valuesIndex>1){valuesIndex--;}
    else{valuesIndex=3}
    isValuesTransitioning =true;
    setTimeout(()=>isValuesTransitioning=false, 1000)
  }

  onMount(() => {
    if (browser && typeof window !== 'undefined') {
      checkIfMobile();
      window.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('resize', checkIfMobile);
      window.addEventListener('click', handleClickOutside);
      window.addEventListener('keydown', handleKeydown);
      
      animate();
      handleScroll();
    }
  });

  onDestroy(()=>{
    if (browser && typeof window !== 'undefined') {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', checkIfMobile);
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('keydown', handleKeydown);
      
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    }
  })

  export let data:any;
  
</script>

<style>
    h4{
        
font-family: Pragmatica;
font-size: 60px;
font-style: normal;
font-weight: 250;
line-height: 125%; /* 75px */
    }

    h5.title{
      
font-family: Pragmatica;
font-size: 50px;
font-style: normal;
font-weight: 250;
line-height: 140%; /* 70px */
    }

    .archive-title{

font-size: 60px;
font-style: normal;
font-weight: 700;
line-height: 140%; /* 84px */
    }

    @media only screen and (max-width:768px) {
        h4{
            font-size: 40px
        }
        h5.title{
            font-size: 28px
        }
    }
</style>


<svelte:head>
  <title>About | Reddoor Creative</title>
</svelte:head>

<svelte:window bind:innerHeight={viewportHeight} bind:innerWidth={viewportWidth} />

{#if popupText && !isMobile}
    <h5 transition:fade  class="pointer-events-none -translate-y-full w-[360px] p-5 fixed z-20 bg-white/80 backdrop-blur text-primary" style="top:{popupY}px;left:{popupX}px">{popupText}</h5>
{/if}

<!-- Mobile Popup -->
{#if showMobilePopup && isMobile}
    <div transition:fade class="fixed inset-0 z-30 flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div class="fixed inset-0 bg-black/20" aria-hidden="true"></div>
        <!-- Popup -->
        <div 
            role="dialog"
            aria-label="Additional information"
            aria-modal="true"
            class="relative bg-white/95 backdrop-blur shadow-xl p-6 max-w-sm w-full border border-primary"
        >
            <button 
                data-popup-close
                on:click={closeMobilePopup}
                class="absolute top-3 right-3 text-primary hover:text-primary-dark transition-colors"
                aria-label="Close popup"
            >
                <i class="fa-solid fa-sharp fa-xmark fa-lg"></i>
            </button>
            <p class="text-primary pr-8">{popupText}</p>
        </div>
    </div>
{/if}

<div class="w-screen relative bg-paper">
  <ContentWidth class="h-full flex justify-center items-center py-48">
    <h5 class="w-full md:w-4/5 max-w-[800px] z-10 title">
      We save you from drowning in an ocean of noise by arming you with a clear story and compelling design.
    </h5>
  </ContentWidth>
</div>
<div class="w-screen bg-paper pb-8 relative overflow-x-clip" bind:this={monoCarDivRef}>
  <ContentWidth class="flex ">
    <h3 class="text-primary z-10 relative">About</h3>
  </ContentWidth>
  <img src={monotoneCar}  alt="moving car" class="absolute -right-48 bottom-0 w-64 will-change-transform" style="transform:translate3d({-monoCarTranslationInVW}vw,0,0)"/>
</div>
<ScreenWidthImage src={applause} />
<div class="w-screen bg-paper pb-12 md:pb-48">
  <ContentWidth class="flex relative border-primary border-b-1">
    <img src={key} alt="keys" class="lg:w-1/5 md:w-1/3 w-2/3" />
    <h2 class="text-primary absolute left-0 bottom-2 md:bottom-8">
      Our Promises
    </h2>
  </ContentWidth>
  <ContentWidth class="flex flex-row justify-end">
    <div class=" w-full md:w-3/5 h-72 relative">

    {#if valuesIndex === 1}
      <div class="flex flex-col gap-4 absolute" in:fade={{duration:400, delay:420}} out:fade={{duration:400}}>
        <p class="mt-8">01/03</p>
        <h5 class="text-primary">
          We will
          <span 
            role="button"
            tabindex="0"
            aria-label="act on your behalf - more information"
            on:mouseleave={()=> !isMobile && (popupText="")} 
            on:mouseenter={()=> !isMobile && (popupText="by using our creative expertise to serve.")}
            on:click={(e) => handleMobilePopupOpen("by using our creative expertise to serve.", e.currentTarget)}
            on:keydown={(e) => handleTooltipKeydown(e, "by using our creative expertise to serve.")}
            on:focus={(e) => handleTooltipFocus("by using our creative expertise to serve.", e)}
            on:blur={handleTooltipBlur}
            class="underline underline-offset-[25%] {isMobile ? 'cursor-pointer' : 'cursor-default'} focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm">
            act on your behalf
        </span>
        <br /> by choosing to
          <span 
            role="button"
            tabindex="0"
            aria-label="work hard and smart - more information"
            on:mouseleave={()=> !isMobile && (popupText="")} 
            on:mouseenter={()=> !isMobile && (popupText="in order to efficiently deliver excellence.")}
            on:click={(e) => handleMobilePopupOpen("in order to efficiently deliver excellence.", e.currentTarget)}
            on:keydown={(e) => handleTooltipKeydown(e, "in order to efficiently deliver excellence.")}
            on:focus={(e) => handleTooltipFocus("in order to efficiently deliver excellence.", e)}
            on:blur={handleTooltipBlur}
            class="underline underline-offset-[25%] {isMobile ? 'cursor-pointer' : 'cursor-default'} focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-sm">
             work hard and smart
        </span>
        <br /> so you can 
          <span 
            role="button"
            tabindex="0"
            aria-label="feel relief - more information"
            on:mouseleave={()=> !isMobile && (popupText="")} 
            on:mouseenter={()=> !isMobile && (popupText="because you have a partner committed to your success.")}
            on:click={(e) => handleMobilePopupOpen("because you have a partner committed to your success.", e.currentTarget)}
            on:keydown={(e) => handleTooltipKeydown(e, "because you have a partner committed to your success.")}
            on:focus={(e) => handleTooltipFocus("because you have a partner committed to your success.", e)}
            on:blur={handleTooltipBlur}
            class="underline underline-offset-[25%] {isMobile ? 'cursor-pointer' : 'cursor-default'} focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-sm">
                feel relief.
            </span>
        </h5>
      </div>
      
      {:else if valuesIndex===2}

       <div class="flex flex-col gap-4 absolute" in:fade={{duration:400, delay:420}} out:fade={{duration:400}}>
        <p class="mt-8">02/03</p>
        <h5 class="text-primary">
          We will
          <span 
            role="button"
            tabindex="0"
            aria-label="create compelling design - more information"
            on:mouseleave={()=> !isMobile && (popupText="")} 
            on:mouseenter={()=> !isMobile && (popupText="since we define ourselves as enemies of mediocrity.")}
            on:click={(e) => handleMobilePopupOpen("since we define ourselves as enemies of mediocrity.", e.currentTarget)}
            on:keydown={(e) => handleTooltipKeydown(e, "since we define ourselves as enemies of mediocrity.")}
            on:focus={(e) => handleTooltipFocus("since we define ourselves as enemies of mediocrity.", e)}
            on:blur={handleTooltipBlur}
            class="underline underline-offset-[25%] {isMobile ? 'cursor-pointer' : 'cursor-default'} focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-sm">
            create compelling design
        </span>
        <br /> by choosing to
          <span 
            role="button"
            tabindex="0"
            aria-label="take risks - more information"
            on:mouseleave={()=> !isMobile && (popupText="")} 
            on:mouseenter={()=> !isMobile && (popupText="because exceptional work requires it.")}
            on:click={(e) => handleMobilePopupOpen("because exceptional work requires it.", e.currentTarget)}
            on:keydown={(e) => handleTooltipKeydown(e, "because exceptional work requires it.")}
            on:focus={(e) => handleTooltipFocus("because exceptional work requires it.", e)}
            on:blur={handleTooltipBlur}
            class="underline underline-offset-[25%] {isMobile ? 'cursor-pointer' : 'cursor-default'} focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-sm">
             take risks
        </span>
        <br /> so you can 
          <span 
            role="button"
            tabindex="0"
            aria-label="feel confident - more information"
            on:mouseleave={()=> !isMobile && (popupText="")} 
            on:mouseenter={()=> !isMobile && (popupText="in the way you share your story with the world.")}
            on:click={(e) => handleMobilePopupOpen("in the way you share your story with the world.", e.currentTarget)}
            on:keydown={(e) => handleTooltipKeydown(e, "in the way you share your story with the world.")}
            on:focus={(e) => handleTooltipFocus("in the way you share your story with the world.", e)}
            on:blur={handleTooltipBlur}
            class="underline underline-offset-[25%] {isMobile ? 'cursor-pointer' : 'cursor-default'} focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-sm">
                feel confident.
            </span>
        </h5>
      </div>

      {:else if valuesIndex===3}

       <div class="flex flex-col gap-4 absolute" in:fade={{duration:400, delay:420}} out:fade={{duration:400}}>
        <p class="mt-8">03/03</p>
        <h5 class="text-primary">
          We will
          <span 
            role="button"
            tabindex="0"
            aria-label="do meaningful work - more information"
            on:mouseleave={()=> !isMobile && (popupText="")} 
            on:mouseenter={()=> !isMobile && (popupText="so we may care deeply about it.")}
            on:click={(e) => handleMobilePopupOpen("so we may care deeply about it.", e.currentTarget)}
            on:keydown={(e) => handleTooltipKeydown(e, "so we may care deeply about it.")}
            on:focus={(e) => handleTooltipFocus("so we may care deeply about it.", e)}
            on:blur={handleTooltipBlur}
            class="underline underline-offset-[25%] {isMobile ? 'cursor-pointer' : 'cursor-default'} focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-sm">
            do meaningful work
        </span>
        <br /> by choosing to
          <span 
            role="button"
            tabindex="0"
            aria-label="seek order - more information"
            on:mouseleave={()=> !isMobile && (popupText="")} 
            on:mouseenter={()=> !isMobile && (popupText="because reducing noise and obstacles allows us to connect with purpose.")}
            on:click={(e) => handleMobilePopupOpen("because reducing noise and obstacles allows us to connect with purpose.", e.currentTarget)}
            on:keydown={(e) => handleTooltipKeydown(e, "because reducing noise and obstacles allows us to connect with purpose.")}
            on:focus={(e) => handleTooltipFocus("because reducing noise and obstacles allows us to connect with purpose.", e)}
            on:blur={handleTooltipBlur}
            class="underline underline-offset-[25%] {isMobile ? 'cursor-pointer' : 'cursor-default'} focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-sm">
             seek order
        </span>
        <br /> so you can 
          <span 
            role="button"
            tabindex="0"
            aria-label="feel energized - more information"
            on:mouseleave={()=> !isMobile && (popupText="")} 
            on:mouseenter={()=> !isMobile && (popupText="by finding clarity and focus in what you do.")}
            on:click={(e) => handleMobilePopupOpen("by finding clarity and focus in what you do.", e.currentTarget)}
            on:keydown={(e) => handleTooltipKeydown(e, "by finding clarity and focus in what you do.")}
            on:focus={(e) => handleTooltipFocus("by finding clarity and focus in what you do.", e)}
            on:blur={handleTooltipBlur}
            class="underline underline-offset-[25%] {isMobile ? 'cursor-pointer' : 'cursor-default'} focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-sm">
                feel energized.
            </span>
        </h5>
      </div>

      {/if}
      <div class="absolute left-0 bottom-0 flex gap-6 text-primary">
        <button on:click={decrementValues} class="{isValuesTransitioning?"cursor-default":""}"
          ><i
            class="fa-solid fa-light fa-arrow-left fa-xl hover:text-primary-dark transition-colors duration-300"
          ></i></button
        >
        <button
            on:click={incrementValues}
            class="{isValuesTransitioning?"cursor-default":""}"
          ><i
            class="fa-solid fa-light fa-arrow-right fa-xl hover:text-primary-dark transition-colors duration-300"
          ></i></button
        >
      </div>
    </div>
  </ContentWidth>
</div>

<!-- Rest of the component remains the same... -->
<div class="w-screen flex flex-col lg:flex-row relative bg-paper">
  <AnimateIn
    class="w-full md:w-1/3 aspect-square relative flex items-center justify-center"
  >
    <img
      class="w-full h-full absolute z-0 object-cover"
      src={beach}
      alt="beach"
    />
    <h3 class="text-white z-10">CA</h3>
  </AnimateIn>
  <AnimateIn
    class="w-full md:w-1/3 aspect-square relative flex items-center justify-center"
  >
    <img
      class="w-full h-full absolute z-0 object-cover"
      src={hills}
      alt="hills"
    />
    <h3 class="text-white z-10">TX</h3>
  </AnimateIn>
  <AnimateIn
    class="w-full md:w-1/3 aspect-square relative flex items-center justify-center"
  >
    <img
      class="w-full h-full absolute z-0 object-cover"
      src={lake}
      alt="lake"
    />
    <h3 class="text-white z-10">ID</h3>
  </AnimateIn>
</div>
<div class="w-screen text-center py-20 bg-paper">
  <ContentWidth class="flex flex-col border-primary border-b-1 pb-8" animateIn>
    <h2 class="text-primary text-left">
      Serving our clients,<br /> near and far.
    </h2>
  </ContentWidth>
  <ContentWidth class="flex flex-col items-end" animateIn>
    <AnimateIn class="md:w-3/5">
      <p class="text-left md:w-2/3 mt-8">
        We work with clients across the US and occasionally around the globe. We
        have designers sprinkled across California, Texas and Idaho,
        conveniently located near the Los Angeles, San Antonio, and Boise metro
        areas. Regardless of your location, partnering with Reddoor Creative
        will give you the confidence in your brand that you've been needing.
      </p>
    </AnimateIn>
    <div class="md:w-3/5 flex flex-col items-center gap-6 md:gap-0 md:flex-row mt-16">
      <AnimateIn class="w-4/5 md:w-1/3 md:pr-4 flex flex-col">
        <img src={tim} alt="tim holmes" class="w-full aspect-square" />
        <div class="text-primary large-body font-thin mt-2">Tim Holmes</div>
        <p class="text-mid font-thin">CA+ID Creative Director</p>
      </AnimateIn>
      <AnimateIn class="w-4/5 md:w-1/3 md:pl-4 flex flex-col">
        <img src={erik} alt="Erik Svendsen" class="w-full aspect-square" />
        <p class="text-primary large-body mt-2 large-body">Erik Svendsen</p>
        <div class="font-thin">TX Creative Director</div>
      </AnimateIn>
    </div>
  </ContentWidth>
</div>

<div class="w-screen pt-16 bg-paper pb-16">
  <ContentWidth class="flex" animateIn>
    <h6 class="text-primary text-center">The Reddoor Story</h6>
  </ContentWidth>

  <ContentWidth class="flex flex-col justify-end items-end">
    <AnimateIn class="md:w-3/5">
      <h5 class="md:w-2/3">
        Because of unforeseen circumstances owner, Tim Holmes, found himself
        stuck in LA with a white Toyota and a seemingly unfortunate red door.
      </h5>
    </AnimateIn>
  </ContentWidth>
  
  <!-- Car in separate container outside ContentWidth -->
  <div class="w-full mt-8 relative overflow-x-hidden">
    <div class="will-change-transform" style="transform:translateX({carTranslationInVW}vw)">
      <img
        class="w-[150%] md:w-3/5"
        src={car}
        alt="a white car with a red door"
        bind:this={carRef}
      />
    </div>
  </div>

  <ContentWidth class="flex flex-col justify-end items-end">
    <div class="flex flex-col md:w-3/5 my-8 gap-8">
      <AnimateIn class="md:w-2/3">
        <p>
          The young designer soon realized that in city where "your wheels" are
          a part of your identity he had two choices: be embarrassed or embrace
          the moment. Choosing the latter he quickly told his friend how excited
          he was to get a red door since he always wanted a red sports car and
          thought he'd start with the driver's side door and just work his way
          around replacing one piece at a time.
        </p>
      </AnimateIn>
      <AnimateIn class="md:w-2/3">
        <p>
          The car soon became known as "reddoor" having its own personality
          because of the one thing that most people would see as unfortunate.
          With a proud owner it had no other reason than to be proud, too. What
          once was headed for the trash heap was now a gem of a story.
        </p>
      </AnimateIn>

      <AnimateIn class="md:w-2/3 border-t-1 border-t-primary pt-6">
        <h6 class="text-primary">
          The original "reddoor" taught us two things at Reddoor Creative:
        </h6>
      </AnimateIn>

      <div class="w-full flex flex-col md:flex-row">
        <AnimateIn class="flex flex-col w-2/3 md:w-1/3 pr-4">
          <p class="text-primary">01</p>
          <p class="mt-2">
            Find the unique quality within a business and tell that story in a
            compelling way.
          </p>
        </AnimateIn>
        <AnimateIn class="flex flex-col w-2/3 md:w-1/3 mt-6 md:mt-0 pr-4">
          <p class="text-primary">02</p>
          <p class="mt-2">
            Champion our clients and remember that we exist to serve them with
            our talents.
          </p>
        </AnimateIn>
      </div>
    </div>
  </ContentWidth>
</div>

<section class="w-screen py-16 bg-paper-red">
  <ContentWidth class="flex flex-col md:flex-row">
    <AnimateIn class="md:w-2/5 mb-6">
      <h6 class="text-white">Perspective</h6>
    </AnimateIn>
    <AnimateIn class="md:w-3/5 text-white">
      <h5 class=" md:w-2/3">
        "Time has taught me that true north is to not just focus on the work
        itself but also the people I'm working with."
      </h5>
      <div class="flex flex-row gap-5 mt-10">
        <img src={tim} alt="tim holmes" class="w-20" />
        <div class="flex flex-col">
          <div class="large-body">Tim Holmes</div>
          <p>CA+ID Creative Director</p>
        </div>
      </div>
    </AnimateIn>
  </ContentWidth>
</section>

<section class="bg-paper">
    <LogoSoup {data} />
</section>

<section class="relative w-screen bg-paper py-16 md:py-32">
  <ContentWidth class="flex flex-col" animateIn>
    <h2 class="text-primary md:w-3/5">
      Isn't it time to arm your brand with a clear story and compelling design?
    </h2>
    <div class="flex flex-row mt-16 gap-8">
      <DefaultButton red href="/contact">Meet with Us</DefaultButton>
      <DefaultButton red href="/portfolio">View Our Work</DefaultButton>
    </div>
  </ContentWidth>
</section>