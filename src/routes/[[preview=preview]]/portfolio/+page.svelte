<script lang='ts'>
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import AnimateIn from "$lib/components/AnimateIn.svelte";
  import ScreenWidthImage from "$lib/components/ScreenWidth/ScreenWidthImage.svelte";
  import FourByThreeImage from "$lib/components/FullWidth/FourByThreeImage.svelte";
  import ceoHeroDesktop from "$lib/assets/images/CEO_HERO_Badge_Lanyard 1.jpg"
  import ceoHeroMobile from "$lib/assets/images/ceoHeroMobile.jpg"
  import arrowButton from "$lib/assets/icons/arrowButton.svg"
  import bed from "$lib/assets/images/bed.jpg"
  import catalogs from "$lib/assets/images/catalogs.jpg"
  import longHollow from "$lib/assets/images/longHollow.png"
  import hq from "$lib/assets/images/headquarters.png"
  import screamer from "$lib/assets/images/screamer.jpg"
  import roadmap from "$lib/assets/images/roadmap.png"
  import stJames from "$lib/assets/images/stJames.jpg"
  import report from "$lib/assets/images/annualReport.png"
  import dentist from "$lib/assets/images/1800dentist.png"
  import type { ProjectDocument } from "../../../prismicio-types.js";
  import { flip } from "svelte/animate";
  import { fade, scale, slide } from "svelte/transition";
  import DefaultButton from "$lib/components/Buttons/DefaultButton.svelte";
  import { expoOut } from "svelte/easing";

  let { data }: { data: any } = $props();

  let projectsDiv: HTMLElement;

  let viewportWidth = $state(0);
  let viewportHeight = $state(0);
  let showAllProjectsButton = $state(true);

  const ceoHero = $derived(viewportWidth < 768 ? ceoHeroMobile : ceoHeroDesktop);

  let showBrand = $state(false);
  let showDigital = $state(false);
  let showEnvironmental = $state(false);
  let showProduct = $state(false);
  let showPackaging = $state(false);
  let showPrint = $state(false);
  let showWeb = $state(false);

  const showAll = $derived(
    !(showBrand || showDigital || showEnvironmental || showProduct || showPrint || showWeb || showPackaging)
  );

  let orderString = $state("Latest-Earliest");

  const isAlphabeticalDescending = $derived(orderString === "A-Z");
  const isAlphabeticalAscending = $derived(orderString === "Z-A");
  const isChronologicalDescending = $derived(orderString === "Latest-Earliest");
  const isChronologicalAscending = $derived(orderString === "Earliest-Latest");

  let isOrderSelectOpen = $state(false);

  $effect(() => {
    // close the order dropdown whenever filters or order change
    showBrand; showDigital; showEnvironmental; showProduct; showPrint; showWeb; showPackaging; orderString;
    isOrderSelectOpen = false;
  });

  const sortedProjects = $derived(
    [...data.allProjects].sort((a: ProjectDocument<string>, b: ProjectDocument<string>) => {
      switch (orderString) {
        case "A-Z":
          return (a.data.title || '').localeCompare(b.data.title || '');
        case "Z-A":
          return (b.data.title || '').localeCompare(a.data.title || '');
        case "Latest-Earliest":
          return new Date(b.first_publication_date).getTime() - new Date(a.first_publication_date).getTime();
        case "Earliest-Latest":
          return new Date(a.first_publication_date).getTime() - new Date(b.first_publication_date).getTime();
        default:
          return 0;
      }
    })
  );

  $effect(() => {
    const handleScroll = () => {
      if (projectsDiv) {
        const rect = projectsDiv.getBoundingClientRect();
        const isInView = rect.top <= window.innerHeight && rect.bottom >= 0;
        showAllProjectsButton = !isInView;
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  });

  function mediumString(project: ProjectDocument<string>) {
    const servicesArray = [
      project.data.branding,
      project.data.product,
      project.data.print,
      project.data.environmental,
      project.data.packaging,
      project.data.digital,
    ];
    return servicesArray.reduce<string>((acc, service, index) => {
      if (service) {
        if (acc) acc += ", ";
        acc += ["Brand", "Product", "Print", "Environmental", "Packaging", "Digital"][index];
      }
      return acc;
    }, "");
  }
</script>

<svelte:window bind:innerWidth={viewportWidth} bind:innerHeight={viewportHeight} />

<style>
    h4{

font-family: Pragmatica;
font-size: 60px;
font-style: normal;
font-weight: 250;
line-height: 125%; /* 75px */
    }

    h5{

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
        h5{
            font-size: 28px
        }
    }
</style>

<svelte:head>
    <title>
        Portfolio | Reddoor Creative
    </title>
</svelte:head>

{#if showAllProjectsButton}
<a
  class="fixed z-20 bottom-12 right-12 flex flex-col items-center justify-center gap-2 border-light hover:border-primary text-light hover:text-primary transition-opacity duration-300"
  href="#projectsDiv"
  transition:fade={{ duration: 300 }}
>
    <div class="text-[8px]">All Projects</div>
    <div class="w-12 h-12 rounded-full border-2 transition-colors duration-300 flex items-center justify-center">
        <i class="fa-solid fa-light fa-arrow-down fa-2xl" aria-hidden="true"></i>
    </div>
</a>
{/if}

<section class="w-screen max-h-[720px] flex flex-col justify-between lg:aspect-video pt-24 bg-paper">
    <div></div>
    <ContentWidth>
        <h5 class="w-4/5 max-w-(--breakpoint-lg) mr-0 ml-auto">We are honored to work with these amazing clients. Take a look and consider taking your place among them.</h5>
   </ContentWidth>
   <ContentWidth>
    <h1 class="text-primary w-full text-left">Portfolio</h1>
   </ContentWidth>

</section>
<section class="max-w-screen overflow-x-clip">
    <div class="right-0 max-h-screen aspect-video relative {viewportHeight * 16 > viewportWidth * 9 ? 'h-screen min-w-full' : 'w-screen min-h-full'}">

            <img src={ceoHero} alt="ceo name tag" class="absolute h-full w-full max-w-screen object-cover object-left" style="object-position:{viewportWidth<1440&&viewportWidth>768? viewportWidth-viewportHeight*16/9 + 240 :0}px center"/>

        <div class="w-full max-w-[100vw] h-full max-h-screen relative">
        <ContentWidth class="h-full z-10 relative">

    <h4 class="md:w-3/5 absolute left-0 top-20 text-white">
        The "buck stops here" with a branding system overhaul of LA County's CEO
    </h4>

    <div class="absolute bottom-20 flex justify-between w-full md:w-2/5">
        <div>
            <p class="text-white">COUNTY OF LOS ANGELES</p>
            <p class="text-light">brand, digital, print</p>
        </div>
        <a href="/portfolio/ceo-la" class="hover:brightness-200 transition bump" aria-label="Go to CEO LA project">
            <img src={arrowButton} alt="" class="h-full"/>
        </a>
    </div>
</ContentWidth>
</div>
</div>
</section>
<section class="my-24">
    <ContentWidth>
        <div class="w-full md:w-4/5 md:ml-[20%] flex flex-col">
            <AnimateIn>
                <img class="w-full aspect-4/3" src={bed} alt="a beautiful bed" loading="lazy"/>
            </AnimateIn>
            <div class="w-full flex flex-col-reverse lg:flex-row">
                <AnimateIn transitionDelayMax={0} class="bg-paper flex flex-col justify-between p-4 w-full lg:w-1/2  aspect-square">
                    <h5 class="font-sm text-primary" >A mission to create beautiful and affordable lighting for the home.</h5>
                    <div class="w-full flex flex-row justify-between">
                        <div>
                            <p class="text-primary">PROGRESS LIGHTING</p>
                            <p class="text-light">brand, environmental, packaging, print</p>
                        </div>
                        <a href="/portfolio/progress-lighting" class="hover:brightness-50 transition bump" aria-label="Go to Progress Lighting project">
                            <img src={arrowButton} alt="" class="h-full"/>
                        </a>
                    </div>
                </AnimateIn>
                <AnimateIn transitionDelayMax={0} class="w-full lg:w-1/2  aspect-square overflow-hidden">
                    <img class="h-full w-auto top-0 left-0 object-cover object-left" src={catalogs} alt="catalogs" loading="lazy">

                </AnimateIn>


            </div>
        </div>
    </ContentWidth>

</section>

<ScreenWidthImage src={longHollow} alt="longhollow ranch"/>
<section class="bg-paper pt-16 pb-60 -mb-56">
<ContentWidth>
    <div class="w-full md:w-4/5 md:ml-[20%]">
        <AnimateIn>
            <h4 class=" mb-20">An Authentic Texas Ranch <br /> Offering Resort-Quality Retreats.</h4>
        </AnimateIn>

        <AnimateIn class="w-full md:w-1/2 flex flex-row justify-between">
            <div>
                <p class="text-primary">LONEHOLLOW RANCH</p>
                <p class="text-light">brand, digital, environmental, print</p>
            </div>
            <a href="/portfolio/lonehollow-ranch" class="hover:brightness-50 transition bump" aria-label="Go to Lonehollow Ranch project">
                <img src={arrowButton} alt="" class="h-full"/>
            </a>
        </AnimateIn>
    </div>
</ContentWidth>
</section>
<ContentWidth animateIn>
    <div class="w-full md:w-4/5 md:ml-[20%]">
        <FourByThreeImage src={hq} alt="rustic headquarters sign"/>
    </div>
</ContentWidth>
<ContentWidth>
    <div class="w-full md:w-4/5 md:ml-[20%] flex flex-col-reverse md:flex-row">
        <AnimateIn transitionDelayMax={0} class="flex flex-col justify-between p-4 w-full lg:w-1/2  aspect-square relative" style="background-image: url({screamer}); background-size: 180%; background-position:35% 0">
            <div class="w-full h-full absolute top-0 left-0" style="background: linear-gradient(0deg, rgba(0, 0, 0, 0.25) 0%, rgba(0, 0, 0, 0.25) 100%)"></div>
            <div></div>
            <div class="w-full flex flex-row justify-between z-10" >
                <div>
                    <p class="text-white">YOUNGLIFE CONNECT</p>
                    <p class="text-white">digital</p>
                </div>
                <a href="/portfolio/young-life-connect" class="brightness-200 hover:brightness-50 transition bump" aria-label="Go to YoungLife Connect project">
                    <img src={arrowButton} alt="" class="h-full"/>
                </a>
            </div>
        </AnimateIn>
        <AnimateIn transitionDelayMax={0} class="w-full lg:w-1/2  aspect-square overflow-hidden">
            <img class="h-full object-cover" src={roadmap} alt="roadmap mockup on iphone" loading="lazy">

        </AnimateIn>
    </div>
</ContentWidth>
<section class="mt-16">
<ScreenWidthImage src={stJames} alt="st james' stairwell"/>
<ContentWidth>
    <div class="w-full mt-12 md:w-4/5 md:ml-[20%] flex flex-col">
        <div class="w-full flex flex-col-reverse lg:flex-row">
            <AnimateIn transitionDelayMax={0} class="bg-paper flex flex-col justify-between p-4 w-full lg:w-1/2  aspect-square">
                <h5 class="font-sm text-primary" >A diverse, joyful, and inclusive community of young learners.</h5>
                <div class="w-full flex flex-row justify-between">
                    <div>
                        <p class="text-primary uppercase">St. james' episcopal school</p>
                        <p class="text-light">brand, digital, environmental, print</p>
                    </div>
                    <a href="/portfolio/st-james-episcopal-school" class="hover:brightness-50 transition bump" aria-label="Go to St. James' project">
                        <img src={arrowButton} alt="" class="h-full"/>
                    </a>
                </div>
            </AnimateIn>
            <AnimateIn transitionDelayMax={0} class="w-full lg:w-1/2  aspect-square overflow-hidden">
                <img class="h-full object-cover" src={report} alt="annual reports" loading="lazy">

            </AnimateIn>


        </div>
    </div>
</ContentWidth>
</section>


    <ContentWidth animateIn>
        <div class="mt-24 w-full md:w-4/5 md:ml-[20%]">
            <FourByThreeImage src={dentist} alt="a dentist"/>
        </div>
    </ContentWidth>
    <section class="bg-paper pb-16 pt-60 -mt-56">
        <ContentWidth>
            <div class="w-full md:w-4/5 md:ml-[20%]">
                <AnimateIn>
                <h4 class=" mb-20">A dental referral service bridging the gap between patients and providers.</h4>
                </AnimateIn>
                <AnimateIn class="w-full md:w-1/2 flex flex-row justify-between">
                    <div>
                        <p class="text-primary">1-800-DENTIST</p>
                        <p class="text-light">digital</p>
                    </div>
                    <a href="/portfolio/1-800-dentist" class="hover:brightness-50 transition bump" aria-label="Go to 1-800-Dentist project">
                        <img src={arrowButton} alt="" class="h-full"/>
                    </a>
                </AnimateIn>
            </div>
        </ContentWidth>
        </section>
        <section>
            <div class="w-screen py-40 md:h-[80vh] bg-paper-red flex flex-col items-center justify-center">
                <ContentWidth class="flex flex-col md:flex-row items-start justify-between">
                    <AnimateIn>
                    <h3 class="text-white md:w-3/5">Isn't it time to arm your brand with a clear story and compelling design?</h3>
                    </AnimateIn>
                    <AnimateIn>
                    <a href="/contact">
                        <DefaultButton class="mt-6 text-white border-white border-1 hover:bg-mid/10" text="MEET WITH US" filled={false} />
                    </a>
                    </AnimateIn>
                </ContentWidth>
            </div>


        </section>

<div class="py-24 bg-paper" bind:this={projectsDiv} id='projectsDiv'>
    <ContentWidth>
        <AnimateIn class="w-full">
            <div class="archive-title text-primary w-full text-left mb-12">But wait, there's more!</div>
        </AnimateIn>
        <div class="flex flex-row justify-between w-full">
            <AnimateIn class="flex flex-row gap-4 mb-24 flex-wrap max-w-full">
                <button class="px-5 py-[10px] transition-colors duration-500 border-1  {showBrand ? "border-primary bg-primary  hover:text-light text-white":"border-light text-light hover:border-primary hover:text-primary"}" onclick={()=>showBrand=!showBrand}>BRAND</button>
                <button class="px-5 py-[10px] transition-colors duration-500 border-1  {showPrint ? "border-primary bg-primary  hover:text-light text-white":"border-light text-light hover:border-primary hover:text-primary"}" onclick={()=>showPrint=!showPrint}>PRINT</button>
                <button class="px-5 py-[10px] transition-colors duration-500 border-1  {showEnvironmental ? "border-primary bg-primary  hover:text-light text-white":"border-light text-light hover:border-primary hover:text-primary"}" onclick={()=>showEnvironmental=!showEnvironmental}>ENVIRONMENTAL</button>
                <button class="px-5 py-[10px] transition-colors duration-500 border-1  {showProduct ? "border-primary bg-primary  hover:text-light text-white":"border-light text-light hover:border-primary hover:text-primary"}" onclick={()=>showProduct=!showProduct}>PRODUCT</button>
                <button class="px-5 py-[10px] transition-colors duration-500 border-1  {showDigital ? "border-primary bg-primary  hover:text-light text-white":"border-light text-light hover:border-primary hover:text-primary"}" onclick={()=>showDigital=!showDigital}>DIGITAL</button>
            </AnimateIn>
            <AnimateIn class="relative z-10">
                <div class="w-48 h-12 bg-paper absolute z-20"></div>
                {#if isOrderSelectOpen}
                    <button class="pl-5 py-[10px] w-48 h-12 transition-colors duration-500 border-1  border-t-0 mb-24 flex flex-row items-center justify-between absolute top-0 left-0 translate-y-full {isAlphabeticalDescending ? "border-primary bg-primary  hover:text-light text-white":"border-light text-light  bg-white hover:text-primary"}" transition:slide onclick={()=>orderString="A-Z"}>A-Z</button>
                    <button class="pl-5 py-[10px] w-48 h-12 transition-colors duration-500 border-1 border-t-0 mb-24 flex flex-row items-center justify-between absolute top-0 left-0 translate-y-[200%] {isAlphabeticalAscending ? "border-primary bg-primary  hover:text-light text-white":"border-light text-light  bg-white hover:text-primary"}" transition:slide onclick={()=>orderString="Z-A"}>Z-A</button>
                    <button class="pl-5 py-[10px] w-48 h-12 transition-colors duration-500 border-1 border-t-0 mb-24 flex flex-row items-center justify-between absolute top-0 left-0 translate-y-[300%] {isChronologicalDescending ? "border-primary bg-primary  hover:text-light text-white":"border-light text-light  bg-white hover:text-primary"}" transition:slide onclick={()=>orderString="Latest-Earliest"}>Latest-Earliest</button>
                    <button class="pl-5 py-[10px] w-48 h-12 transition-colors duration-500 border-1 border-t-0 mb-24 flex flex-row items-center justify-between absolute top-0 left-0 translate-y-[400%] {isChronologicalAscending ? "border-primary bg-primary  hover:text-light text-white":"border-light text-light  bg-white hover:text-primary"}" transition:slide onclick={()=>orderString="Earliest-Latest"}>Earliest-Latest</button>
                    {/if}
                <button class="relative z-20  pl-5 py-[10px] w-48 h-12 transition-colors duration-500 border-1 mb-24 flex flex-row items-center justify-between {isOrderSelectOpen ? "border-primary bg-primary  hover:text-light text-white":"border-light bg-paper text-light hover:border-primary hover:text-primary"}" onclick={()=>isOrderSelectOpen=!isOrderSelectOpen}>
                    <div>{orderString}</div>
                    <div class="h-12 w-12 relative">
                    {#if !isOrderSelectOpen}
                        <i class="fa-solid fa-sharp fa-chevron-down absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" transition:scale={{duration:300}}></i>
                    {/if}
                    {#if isOrderSelectOpen}
                        <i class="fa-solid fa-sharp fa-dash absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" transition:scale={{duration:300}}></i>
                    {/if}
                    </div>
                </button>


            </AnimateIn>
        </div>
        <div class="w-full md:ml-[20%] md:w-4/5 flex flex-row flex-wrap" >
        {#each sortedProjects as project (project.uid)}
        <div animate:flip={{ duration:4500, easing: expoOut}}  class="md:pr-6 pb-6 w-full lg:w-1/2 aspect-4/3 transition-opacity duration-700 {showAll||(project.data.branding&&showBrand)||(project.data.digital&&showDigital)||(project.data.environmental&&showEnvironmental)||(project.data.print&&showPrint)||(project.data.product&&showProduct)||(project.data.packaging&&showPackaging)? "relative": "absolute top-1/2 left-1/2 opacity-0 pointer-events-none"}">

                <a href={"/portfolio/"+project.uid} class="h-full w-full flex flex-col justify-end relative">
                    <img src={project.data.hero.url||''} alt={project.data.title  + " Hero Image"} class="absolute w-full h-full object-cover" loading="lazy"/>
                    <div class="w-full h-full absolute top-0 left-0 hover:opacity-60 transition-opacity duration-700" style="background: linear-gradient(180deg, rgba(12, 19, 35, 0.15) 0%, rgba(12, 19, 35, 0.80) 81.09%) 50% / cover no-repeat;"></div>


                    <AnimateIn class="w-full flex flex-row justify-between p-6 z-10" transitionDelayMax={800}>
                        <div>
                            <p class="text-white uppercase">{project.data.title}</p>
                            <p class="text-light">{mediumString(project)||''}</p>
                        </div>
                        <a href={"/portfolio/"+project.uid} class="brightness-200 hover:brightness-50 transition bump" aria-label="Go to {project.data.title}">
                            <img src={arrowButton} alt="" class="h-full"/>
                        </a>
                    </AnimateIn>

                </a>

        </div>
        {/each}
    </div>
    </ContentWidth>
</div>


<!-- footer -->
<div class="w-screen py-40 md:h-[80vh] bg-paper-red flex flex-col items-center justify-center">
    <ContentWidth class="flex flex-col md:flex-row items-start justify-between">
        <AnimateIn>
        <h3 class="text-white md:w-3/5">It's time to arm your brand with a clear story and compelling design</h3>
        </AnimateIn>
        <AnimateIn>
        <a href="/contact">
        <DefaultButton class="mt-6 text-white border-white border-1 hover:bg-mid/10" text="MEET WITH US" filled={false} />
        </a>
        </AnimateIn>
    </ContentWidth>
</div>
