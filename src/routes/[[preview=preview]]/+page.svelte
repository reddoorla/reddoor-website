<script lang="ts">
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import DefaultButton from "$lib/components/Buttons/DefaultButton.svelte";
  import AnimateIn from "$lib/components/AnimateIn.svelte";
  import { onMount } from "svelte";

  import wortheImage from "$lib/assets/images/worthe_homepage.png"
  import scfaImage from "$lib/assets/images/SCFA_hompage.png"
  import guildImage from "$lib/assets/images/guild_homepage.png"

  import OpeningAnimation from "$lib/components/OpeningAnimation.svelte";
  import megaphone from "$lib/assets/icons/megaphone.png"
  import LogoSoup from "$lib/components/LogoSoup.svelte";
  import pencil from "$lib/assets/icons/RD_TakeAction-02.png"
  import ScreenWidthImage from "$lib/components/ScreenWidth/ScreenWidthImage.svelte";




  let innerWidth:number;  

  
  let projectArray = [
    {
      projectName:"Worthe",
      bodyText:"Burbank's largest collection of commercial real estate with a severe identity crisis. Seven legacy brands that had been developed over the last 30 years needing to come under one cohesive brand.",
      projectLink:"/portfolio/worthe",
      image: wortheImage
    },
    {
      projectName:"SoCal Food Allergy",
      bodyText:"Website/branding with an approachable visual language for a cutting edge allergy clinic providing children with food freedom.",
      projectLink:"/portfolio/scfai",
      image: scfaImage

    },
    {
      projectName: "The Guild Collective",
      bodyText: "The Guild Collective was formed in 2020 with a vision to unite skilled craftsmen to build things that improve the lives of their customers.",
      projectLink: "/portfolio/the-guild-collective",
      image: guildImage
    }
  ]

  let showImage=true;

  const SLIDER_TRANSITION_FUNCTION="cubic-bezier(.5,0,0,1)";
  const SLIDER_TRANSITION_LENGTH_IN_MS=2000;
  const SLIDER_INTERVAL_IN_MS = 5000;




  let sliderIndex = 0;

     
      const slideLeft = () => {

        if(sliderIndex==projectArray.length-1){
        sliderIndex=0;}else{
          sliderIndex++;
        }
          
          clearInterval(sliderInterval);
	    sliderInterval = setInterval(()=>slideLeft(), SLIDER_INTERVAL_IN_MS);
      

         
      }

  
      let sliderInterval:NodeJS.Timeout;
  
 
      let isReadMoreOpen = false;

      let viewportHeight:number;
      let viewportWidth:number;

      export let data;

      console.log(data.logoSoup)
     

        const logoSoup = data.logoSoup;

      onMount(() => {
  sliderInterval = setInterval(() => slideLeft(), SLIDER_INTERVAL_IN_MS);

  return () => {
    clearInterval(sliderInterval);

  }
});
    </script>

<svelte:head>
	<title>Reddoor Creative | Home</title>
</svelte:head>
<svelte:window bind:innerWidth={viewportWidth} bind:innerHeight={viewportHeight} />
<OpeningAnimation />

<div class="relative w-screen bg-paper">
  <section class='w-screen py-32'>
    <ContentWidth class="flex flex-col relative">
      <img src={megaphone} alt="megaphone" class="w-4/5 md:w-1/4 lg:w-1/5 mix-blend-multiply opacity-50" />
      
      <h2 class='-mt-24 w-4/5 md:w-2/5 text-primary'>Better Design Means Better Business</h2>
      <AnimateIn class='h-[1px] bg-primary w-full my-8'></AnimateIn>
      <div class='w-full flex flex-col md:flex-row justify-end'>
        <AnimateIn class='w-full md:w-1/3 lg:w-1/5 pr-6 pb-6'>
          <h5 class='text-primary'>Stand Out</h5>
          <p class='mt-2'>The best brands have a story worth telling. With compelling design, you can stand out and succeed in this noisy world.</p>
        </AnimateIn>
        <AnimateIn class='w-full md:w-1/3 lg:w-1/5 pr-6 pb-6'>
          <h5 class='text-primary'>Feel Confident</h5>
          <p class='mt-2'>When you have a brand that is clear and compelling, you can't help but be confident in any situation. Your clients sense this and are attracted to your offering.</p>
        </AnimateIn>
        <AnimateIn class='w-full md:w-1/3 lg:w-1/5 pr-6 pb-6'>
          <h5 class='text-primary'>Be Energized</h5>
          <p class='mt-2'>You have something great to offer and when your audience clearly understands how you can solve their problem, it will help you close more deals.</p>
        </AnimateIn>
      </div>
      
      
    </ContentWidth>
  </section>


    <LogoSoup {data} />

    <section class='w-screen pb-32'>
      <ContentWidth class="flex flex-col relative">
        <img src={pencil} alt="megaphone" class="w-3/5 md:w-1/4 lg:w-1/5 mix-blend-multiply opacity-50" />
        
        <div class='w-full flex flex-row justify-end'>
          <h2 class='md:mt-12 w-full md:w-2/5 text-primary'>Let’s Begin</h2>
          <div class='w-full lg:w-3/5 md:flex flex-row items-end hidden'>
            <p class='w-1/3'><span class='text-primary'>01</span> / 03</p>
            <p class='w-1/3'><span class='text-primary'>02</span> / 03</p>
            <p class='w-1/3'><span class='text-primary'>03</span> / 03</p>
          </div>
        </div>
        <AnimateIn class='h-[1px] bg-primary w-full my-8'></AnimateIn>
        <div class='w-full flex flex-col md:flex-row justify-end'>
          <AnimateIn class='w-full md:w-1/3 lg:w-1/5 pr-8 pb-8'>
            <h5 class='text-primary'>Call us, <br/> let’s talk.</h5>
            <p class='mt-2'>Everything we do starts and ends with you. Your problems, your goals, your story. We begin with a conversation to see how we can help you succeed.</p>
          </AnimateIn>
          <AnimateIn class='w-full md:w-1/3 lg:w-1/5 pr-8 pb-8'>
            <h5 class='text-primary'>We help solve <br/> your problem.</h5>
            <p class='mt-2'>After establishing clear goals that solve your brand’s problem we get to work on establishing a clear story and developing a compelling design.</p>
          </AnimateIn>
          <AnimateIn class='w-full md:w-1/3 lg:w-1/5 pr-8 pb-8'>
            <h5 class='text-primary'>Stand out <br/> from the noise.</h5>
            <p class='mt-2'>You envisioned success and now you finally have confidence in your brand. We’ve equipped you to increase sales the way you’ve always hoped..</p>
          </AnimateIn>
        </div>
        
        
      </ContentWidth>
    </section>
</div>

<section class="w-screen bg-paper-red relative">
  <ContentWidth class="h-0 z-20">
    <div class='absolute top-32 w-72 z-20'>
      <h6 class='text-white'>We pride ourselves in a hands-on approach to producing compelling design that excites our clients.</h6>
      <DefaultButton href='/about' class='mt-8' >About Us</DefaultButton>
    </div>
    
  </ContentWidth>
  <ScreenWidthImage vimeoId='1082293395' class='mix-blend-multiply opacity-60'>
    
  </ScreenWidthImage>
  

</section>

<section class="relative w-screen bg-paper py-16 md:py-32">
  <ContentWidth class='flex flex-col'>
    <h2 class='text-primary w-3/5'>Feel confidence when you share your story with the world.</h2>
    <div class='flex flex-row mt-16 gap-8'>
      <DefaultButton red href='/contact'>Meet with Us</DefaultButton>
      <DefaultButton red href='/portfolio'>View Our Work</DefaultButton>
    </div>
  </ContentWidth>

</section>



