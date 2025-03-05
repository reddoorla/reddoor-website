<script lang="ts">
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import SquareImage from "$lib/components/FullWidth/SquareImage.svelte";
  import DefaultButton from "$lib/components/Buttons/DefaultButton.svelte";
  import AnimateIn from "$lib/components/AnimateIn.svelte";
  import { onMount } from "svelte";
  import { fade,slide } from "svelte/transition";
  import printedReddoorLogo from "$lib/assets/icons/logos/printedReddoor.png"
  import applause from "$lib/assets/images/applause.jpg"
  import graph from "$lib/assets/images/reddoorGraph.jpg"
  import wortheImage from "$lib/assets/images/worthe_homepage.png"
  import scfaImage from "$lib/assets/images/SCFA_hompage.png"
  import guildImage from "$lib/assets/images/guild_homepage.png"
  import progressLogo from "$lib/assets/icons/logos/progress.svg"
  import huluLogo from "$lib/assets/icons/logos/hulu.svg"
  import toyotaLogo from "$lib/assets/icons/logos/toyota.svg"
  import innoceanLogo from "$lib/assets/icons/logos/innocean.svg"
  import tosaLogo from "$lib/assets/icons/logos/tosa.svg"
  import worthLogo from "$lib/assets/icons/logos/worthe.svg"
  import compositionTestimonial from "$lib/assets/images/compositionTestimonial.jpg"
  import jeff from "$lib/assets/images/jeff.png"


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

  let scrollPosition:number;



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

  
      onMount(()=>{
         sliderInterval = setInterval(()=>slideLeft(), SLIDER_INTERVAL_IN_MS);
      });
  



</script>

<svelte:head>
	<title>Reddoor Creative | Home</title>
</svelte:head>
<svelte:window bind:innerWidth={viewportWidth} bind:innerHeight={viewportHeight} />
<div class="w-screen bg-paper">
  <ContentWidth class="flex flex-col md:flex-row md:py-40 justify-between">
    <img src={printedReddoorLogo} alt="reddoor logo" class="w-full h-fit md:w-1/5  max-w-24 max-h-[67.67px] my-20"/>
    <div class="w-full md:w-4/5 flex flex-col md:py-16 items-start">
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
  </ContentWidth>
</div>
<div class="relative w-screen">
  <div class='w-screen bg-paper pt-32 md:pt-0 pb-8 md:h-2/5'>
    <ContentWidth class="flex flex-row items-end">
      <div class="flex flex-col md:flex-row w-full">
        <div class="label w-1/5 pt-2"><span class="text-primary">01 </span>/ 03</div>
        <h3 class="text-primary w-4/5">Feel <br /> Confident</h3>
      </div>
    </ContentWidth>
  </div>
  <div class="bg-white xl:pb-32">
    <ContentWidth class="flex flex-col md:flex-row relative h-full items-start py-8">
      <div class="w-1/5" />
      <p class="w-4/5 md:w-2/5 md:pr-20">When you have a brand that is clear and compelling, you can't help but be confident in any sales situation. Your clients sense this and are attracted to your offering.</p>
    </ContentWidth>
    <img src={applause} alt="applause" class="aspect-[4/3] md:absolute top-0 right-0 md:w-2/5 object-cover"/>
  </div>
</div>
<div class="relative w-screen bg-white pb-16 z-10">
  <AnimateIn class='w-screen pt-32 md:pt-8 md:h-1/2 pb-8'>
    <ContentWidth class="flex flex-row items-end">
      <div class="flex flex-col md:flex-row w-full">
        <div class="label w-1/5 pt-2"><span class="text-primary">02 </span>/ 03</div>
        <h3 class="text-primary w-4/5">Catalyst <br /> for Sales</h3>
      </div>
    </ContentWidth>
  </AnimateIn>
  <AnimateIn class="h-1/2">
    <ContentWidth class="flex flex-col md:flex-row relative h-full items-start py-8">
      <div class="w-1/5" />
      <p class="w-4/5 md:w-2/5 md:pr-20">You have something great to offer and when your audience clearly understands how you can solve their problem, it will help you close more deals.</p>
    </ContentWidth>
    <img src={graph} alt="applause" class=" md:absolute top-1/2 right-0 md:-translate-y-1/2 md:w-2/5"/>
  </AnimateIn>
</div>
<div class="relative w-screen bg-white">
  <div class='w-screen bg-white pb-16'>
  
    <ContentWidth class="flex flex-row items-end" animateIn>
      <div class="flex flex-col md:flex-row w-full">
        <div class="label w-1/5 pt-2">03 / 03</div>
        <h3 class="text-primary w-4/5">Stand <br /> Out</h3>
      </div>
    </ContentWidth>
    
  </div>
</div>

<div class="w-screen relative bg-paper h-[155vh] lg:h-screen overflow-hidden">
  <div class="w-full h-full absolute">
      
    <ContentWidth class="flex flex-col lg:flex-row h-full">

        <div class="w-full lg:w-1/2 mt-8 lg:left-0 flex justify-center items-center">
          <h6 class="text-primary absolute top-8 left-[4%] md:left-[20%] ">Featured <br /> Design</h6>
            <div class="w-full h-full relative">
              <div class="absolute w-full h-full">
              {#key sliderIndex}
              <div class="w-full h-full min-h-[640px] absolute" out:fade={{duration:300}} in:fade={{delay:280, duration:400}}>
                {#if viewportWidth<=1024}
                <div out:fade={{duration:300}} in:fade={{delay:280, duration:400}}>
                  <SquareImage  src={projectArray[sliderIndex].image} />
                </div>
                {/if}
                <p  class="md:ml-[20%] lg:ml-[40%] mt-24" out:fade={{duration:300}} in:fade={{delay:280, duration:400}}>{projectArray[sliderIndex].bodyText}</p>
                <h1 out:fade={{duration:300}} in:fade={{delay:280, duration:400}} class="text-primary mt-24">{projectArray[sliderIndex].projectName}</h1>

            
                <div  out:fade={{duration:300}} in:fade={{delay:280, duration:400}} class="flex flex-row gap-3 md:ml-[20%] lg:ml-[40%] mt-24">
                  <a href={projectArray[sliderIndex].projectLink}>
                    <DefaultButton class="text-primary border-primary border-1 transition hover:bg-mid hover:bg-opacity-20" filled={false}  text="OPEN" />
                  </a>
                  <a href="/portfolio">
                    <DefaultButton class="text-mid border-mid border-1 transition hover:bg-mid hover:bg-opacity-20" filled={false} text="VIEW ALL" />
                  </a>
                </div>
              </div>
              {/key}
            </div>

        </div>
        </div>
        <div class="w-0 h-0 lg:w-1/2"></div>
    </ContentWidth>
    {#if viewportWidth>1024}
    <div class="w-2/5 absolute top-0 right-0 min-h-[640px]">
        {#key sliderIndex}
            <div out:fade={{duration:300}} in:fade={{delay:280, duration:300}}>
                {#each projectArray as project, i }
                    {#if i===sliderIndex%projectArray.length}
                        <SquareImage src={project.image} />
                    {/if}     
                {/each}
            </div>
        {/key}
        
    </div>
    {/if}
  </div>  
  </div>


  <div class="w-screen bg-paper">
   
    <ContentWidth class="my-0" animateIn>
      <h3 class="text-primary md:ml-[20%] w-fit py-32">Join these brands in <br /> fighting mediocrity.</h3>
    </ContentWidth>
  
  </div>
  <div class="bg-white">
    <ContentWidth class="flex gap-8 flex-row justify-around flex-wrap py-16">
      <AnimateIn transitionDelayMax={2400}>
      <img class="h-48 aspect-square object-contain" src={progressLogo} alt="progress lighting logo" />
      </AnimateIn>
      <AnimateIn transitionDelayMax={2400}>
      <img class="h-48 aspect-square object-contain" src={huluLogo} alt="hulu logo" />
      </AnimateIn>
      <AnimateIn transitionDelayMax={2400}>
      <img class="h-48 aspect-square object-contain" src={toyotaLogo} alt="toyota logo" />
      </AnimateIn>
      <AnimateIn transitionDelayMax={2400}>
      <img class="h-48 aspect-square object-contain" src={innoceanLogo} alt="innocean logo" />
      </AnimateIn>
      <AnimateIn transitionDelayMax={2400}>
      <img class="h-48 aspect-square object-contain" src={tosaLogo} alt="tosa logo" />
      </AnimateIn>
      <AnimateIn transitionDelayMax={2400}>
        <img class="h-48 aspect-square object-contain" src={worthLogo} alt="worthe logo" />
      </AnimateIn>
    </ContentWidth>

  </div>
  <section class="max-w-screen overflow-x-clip">
    <div class="right-0 max-h-screen aspect-video relative {viewportHeight * 16 > viewportWidth * 9 ? 'h-screen min-w-full' : 'w-screen min-h-full'}">

            <img src={compositionTestimonial} alt="ceo name tag" class="absolute h-full w-full max-w-screen object-cover object-left" />
    
        <div class="w-full max-w-[100vw] h-full max-h-screen relative">
        <ContentWidth class='{$$props.class || ''} h-full z-10 relative'>

      <h4 class="text-white absolute md:w-3/5 bottom-36 md:ml-[20%]">“I’ve depended on Reddoor Creative for the last four companies I’ve led. Is there a better testimonial than that?”</h4>
      <div class="absolute h-40 md:left-[20%] -bottom-24 flex flex-row justify-start items-end gap-8">
        <img src={jeff} alt="Jeff Luchonok" class="h-40 w-40 rounded-full">

        <div class="flex flex-col h-1/2">
          <div class="text-primary large-body font-thin">Jeff Luchonok</div>
          <p class="text-mid font-thin">COMPOSITION HOSPITALITY</p>
        </div>
      </div>


    </ContentWidth>
  </div>
  </div>
  </section>

  <div class="w-screen bg-paper pt-64 pb-16">
  
    <ContentWidth animateIn class="flex flex-row relative  pb-12 md:pb-36">
      <h3 class="text-primary w-4/5 md:ml-[20%]">Let’s Begin</h3>
    </ContentWidth>


    <ContentWidth class="flex flex-col md:flex-row justify-between relative">
      <AnimateIn maxTransitionDelay={1200} class="w-3/5 lg:w-1/5 pr-8 mb-8">
        <h6 class="text-primary">We have a plan to help your brand reach success.</h6>
      </AnimateIn>
      <div class="lg:w-4/5 flex flex-row flex-wrap justify-around items-center">
        <AnimateIn maxTransitionDelay={1200} class="h-[320px] w-[320px] flex flex-col pr-6">
          <div class="label"><span class="text-primary">01 </span>/ 03</div>
          <h5 class="text-primary mt-8">Call us, <br /> let’s talk</h5>
          <p class="mt-4">Everything we do starts and ends with you. Your problems, your goals, your story. We begin with a conversation to see how we can help you succeed.</p>

        </AnimateIn>
        <AnimateIn maxTransitionDelay={1200} class="h-[320px] w-[320px] flex flex-col pr-6">
          <div class="label"><span class="text-primary">02 </span>/ 03</div>
          <h5 class="text-primary mt-8">We help solve <br /> your problem</h5>
          <p class="mt-4">After establishing clear goals that solve your brand’s problem we get to work on establishing a clear story and developing a compelling design.</p>

        </AnimateIn>
        <AnimateIn maxTransitionDelay={1200} class="h-[320px] w-[320px] flex flex-col pr-6">
          <div class="label"><span class="text-primary">03 </span>/ 03</div>
          <h5 class="text-primary mt-8">Stand out <br /> from the noise.</h5>
          <p class="mt-4">You envisioned success and now you finally have confidence in your brand. We’ve equipped you to increase sales the way you’ve always hoped.</p>

        </AnimateIn>
      </div>
    </ContentWidth>
    
    <AnimateIn>
    <ContentWidth class="pt-32">
      <h1 class="text-primary">Better design <br/>means better <br/>business.</h1>
    </ContentWidth>
  </AnimateIn>
  </div>
  <div class="bg-white w-screen">
  
    <ContentWidth animateIn>
      <p class="md:mx-[20%] mt-32 large-body">You want your business to succeed. So do we. You have something unique and valuable to offer. We can help you tell the world about it in a way that stand out from the noise. It's proven, companies that utilize "design thinking" are some of the most successful companies in any market. </p>
      {#if isReadMoreOpen}
      <p class="md:mx-[20%] large-body" transition:slide>
        <br/>
        Typically clients approach us and we find that existing branding and marketing don't match the quality of the product or service you provide. If you utilize the do-it-yourself approach to design, you usually end up wasting time, feeling overwhelmed or end up with a less than stellar result. This choice will hold you back from doing your best work. We know what it feels like to have something special to offer, but no one is taking notice. Since 2006, we've helped hundreds of businesses, ones just like yours, tell better stories and find success through compelling design. <br/><br/>

Our plan to help is simple. We begin by clearly defining the objective, next we establish appropriate messaging and finally we use our time-tested creative process to create and communicate on your behalf. Our clients enjoy working with us because we're accessible and up front. We keep you informed along the way and we're always looking out for your best interests. We consider it a privilege to serve you and to partner with you in your business.<br/><br/>

Working with Reddoor Creative will finally give you confidence in your brand and the way you market yourself. You can go from flying under the radar to having a brand that is authentic to who you are and that leads to recognition, success, increased sales and customer loyalty. 
      </p>
      {/if}
      <div class="flex flex-row gap-3 md:mx-[20%] md:w-3/5 mt-8 mb-48">
        <DefaultButton class="{isReadMoreOpen?"text-mid border-mid":"text-primary border-primary"} border-1 hover:bg-mid hover:bg-opacity-10" filled={false}  text={isReadMoreOpen ? "READ LESS":"READ MORE"} click={()=>isReadMoreOpen=!isReadMoreOpen}/>
        <DefaultButton click={()=>window.location.href="/contact"} bold filled text="MEET WITH US"/>
      </div>
    </ContentWidth>

  </div>
  
  <div class="w-screen bg-white pb-8">
    <AnimateIn>
    <ContentWidth class="flex flex-col relative">
      <h3 class="text-primary md:w-4/5 md:ml-[20%]">Still not on board?</h3>
      <h5 class="md:w-3/5 md:mx-[20%] mt-8">You've made is this far. Here's what will probably happen if you continue with “business as usual:”</h5>
    </ContentWidth>
  </AnimateIn>
  </div>
<div class="w-screen bg-paper">

  <ContentWidth>
    
    <AnimateIn class="w-full flex flex-col md:flex-row py-16">
      <div class="label w-1/5 mt-1"><span class="text-primary">01 </span>/ 03</div>
      <h6 class="text-primary text-left mt-4 md:mt-0  md:w-1/5">Death by DIY</h6>
      <div class="mt-4 md:mt-0 md:w-2/5 flex flex-col">
        <p class="">Your valuable time has been wasted on design and branding yourself, instead of hiring a pro and focusing on the unique contribution you make to your business.</p>
        <a class=" text-primary mt-8 font-thin" href="/contact">{"Help! Save Me >"}</a>
      </div>
    </AnimateIn>
    <AnimateIn class="w-full flex flex-col md:flex-row py-16">
      <div class="label md:w-1/5 mt-1"><span class="text-primary">02 </span>/ 03</div>
      <h6 class="text-primary text-left md:w-1/5 mt-4 md:mt-0 ">Mediocrity</h6>
      <div class="md:w-2/5 flex flex-col mt-4 md:mt-0 ">
        <p class="">Doing things yourself often leads to unremarkable results. You continue to spend time (you don't have) working to get noticed by your customers.</p>
        <a class=" text-primary mt-8 font-thin" href="/contact">{"Hire a pro >"}</a>
      </div>
    </AnimateIn>
    <AnimateIn class="w-full flex flex-col md:flex-row py-16">
      <div class="label md:w-1/5 mt-1"><span class="text-primary">03 </span>/ 03</div>
      <h6 class="text-primary text-left md:w-1/5 mt-4 md:mt-0 ">"Shhhh."</h6>
      <div class="md:w-2/5 flex flex-col mt-4 md:mt-0 ">
        <p>
          Your product or service remains your industry's "best kept secret" (not in a good way). You're left with confusing messaging and marketing.</p>
        <a class="text-primary mt-8 font-thin" href="/contact">{"Stand Out, Be Heard >"}</a>
      </div>
    </AnimateIn>
  </ContentWidth>
</div>

<!-- footer -->
<div class="w-screen py-40 md:h-[80vh] bg-paper-red flex flex-col items-center justify-center">
  <AnimateIn>
  <ContentWidth class="flex flex-col md:flex-row items-start justify-between">
      <h3 class="text-white md:w-3/5">Isn’t it time to arm your brand with a clear story and compelling design?</h3>
      <AnimateIn transitionDelayMax={1600}>
      <a href="/contact">
      <DefaultButton class="mt-6 text-white border-white border-1 hover:bg-mid hover:bg-opacity-10" text="MEET WITH US" filled={false} />
      </a>
      </AnimateIn>
  </ContentWidth>
  </AnimateIn>
</div>
