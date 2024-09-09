<script lang='ts'>
	import { PrismicImage, SliceZone } from '@prismicio/svelte';

	import { components } from '$lib/slices';
    import ContentWidth from '$lib/components/ContentWidth/ContentWidth.svelte';
  import { onMount } from 'svelte';
  import DefaultButton from '$lib/components/Buttons/DefaultButton.svelte';
  import type { ProjectDocument } from "../../../../prismicio-types.js";
    import arrowButton from "$lib/assets/icons/arrowButton.svg"

	export let data;

    $: pageData = data.page.data;


    $: servicesArray = [
  pageData.branding,
  pageData.product,
  pageData.print,
  pageData.environmental,
  pageData.packaging,
  pageData.digital,
 

];


$: services = servicesArray.reduce((acc, service, index) => {
  if (service) {
    if (acc) acc += ", ";
    acc += ["Brand", "Product", "Print", "Environmental", "Packaging", "Digital"][index];
  }
  return acc;
}, "");


function mediumString (project:ProjectDocument<string>) {
    let acc = "";

    let servicesArray = [
  project.data.branding,
  project.data.product,
  project.data.print,
  project.data.environmental,
  project.data.packaging,
  project.data.digital,

];
    return servicesArray.reduce((acc, service, index) => {
  if (service) {
    if (acc) acc += ", ";
    acc += ["Brand", "Product", "Print", "Environmental", "Packaging", "Digital"][index];
  }
  return acc;
}, "");
  }

       //TODO: related projects 
</script>



<div class="w-screen h-[80vh] relative">
    <PrismicImage field={data.page.data.hero} class="w-full h-full absolute object-cover"/>
    <div class="w-full h-full absolute " style="background: linear-gradient(rgba(0, 0, 0, 0.42) 0%, rgba(215, 25, 32, 0.86) 100%); z-index: 0;"></div>
    <ContentWidth class="h-full flex flex-col justify-between items-start">
        <div />
        <h5 class="text-white md:w-3/5 md:pr-[10%] mx-auto z-10">{data.page.data.tagline||''}</h5>
        <div class=" text-white w-full z-10 mb-12 md:w-3/5 mx-auto">
            <div class="w-full border-b-1 border-b-white flex justify-between pb-4">
                <div class="font-extralight">{services}</div>
                <div class="h-6 w-20 flex flex-row justify-between text-white">
                    {#if data.prevProject}
                        <a href={"/portfolio/"+data.prevProject.uid}> <i class="fa-thin fa-sharp fa-chevron-left fa-2xl bump hover:text-light"/></a>
                    {/if}
                    {#if data.nextProject}
                        <a href={"/portfolio/"+data.nextProject.uid}> <i class="fa-thin fa-sharp fa-chevron-right fa-2xl bump hover:text-light"/></a>
                    {/if}
                </div>
            </div>
            <h1 class="mt-4">{data.heroHeading||''}</h1>
        </div>
    </ContentWidth>
</div>

<SliceZone slices={data.page.data.slices} {components} />


<!-- footer -->
<div class="w-screen py-40 md:h-[80vh] bg-paper-red flex flex-col items-center justify-center">
  <ContentWidth class="flex flex-col md:flex-row items-start justify-between">
      <h3 class="text-white md:w-3/5">Isn’t it time to arm your brand with a clear story and compelling design?</h3>
      <a href="/contact">
      <DefaultButton class="mt-6 text-white border-white border-1 hover:bg-mid hover:bg-opacity-10" text="MEET WITH US" filled={false} />
      </a>
  </ContentWidth>
</div>

<div class="bg-paper w-screen py-24">
  <ContentWidth>
    <h4 class="text-primary text-left w-full">Related Projects</h4>
    <div class="w-full mt-12 flex flex-col md:flex-row">
      <div class="w-1/5" />
      <div class="w-full md:w-2/5 md:pr-2 aspect-[4/3] relative">
        <a href={"/portfolio/"+(data.relatedProjectOne.uid||'')} class="h-full w-full flex flex-col justify-end relative">
          <img src={data.relatedProjectOne.data.hero.url||''} alt={data.relatedProjectOne.data.title||''  + " Hero Image"} class="absolute w-full h-full object-cover"/>
          <div class="w-full h-full absolute top-0 left-0 hover:opacity-0 transition duration-700" style="background: linear-gradient(0deg, rgba(0, 0, 0, 0.25) 0%, rgba(0, 0, 0, 0.25) 100%)" />
          <div class="w-full flex flex-row justify-between p-6 z-10" >
              <div>
                  <p class="text-white uppercase">{data.relatedProjectOne.data.title||''}</p>
                  <p class="text-light">{mediumString(data.relatedProjectOne)||''}</p>
              </div>
              <a href={"/portfolio/"+(data.relatedProjectOne.uid||'')} class="brightness-200 hover:brightness-50 transition bump">
                  <img src={arrowButton} alt="go to page" class="h-full"/>
              </a>
          </div>  
        </a>
      </div>
      <div class="w-full md:w-2/5 md:pl-2 aspect-[4/3] relative">
        <a href={"/portfolio/"+data.relatedProjectTwo.uid} class="h-full w-full flex flex-col justify-end relative">
          <img src={data.relatedProjectTwo.data.hero.url||''} alt={data.relatedProjectTwo.data.title||''  + " Hero Image"} class="absolute w-full h-full object-cover"/>
          <div class="w-full h-full absolute top-0 left-0 hover:opacity-0 transition duration-700" style="background: linear-gradient(0deg, rgba(0, 0, 0, 0.25) 0%, rgba(0, 0, 0, 0.25) 100%)" />
          <div class="w-full flex flex-row justify-between p-6 z-10" >
              <div>
                  <p class="text-white uppercase">{data.relatedProjectTwo.data.title||''}</p>
                  <p class="text-light">{mediumString(data.relatedProjectTwo)||''}</p>
              </div>
              <a href={"/portfolio/"+data.relatedProjectTwo.uid||''} class="brightness-200 hover:brightness-50 transition bump">
                  <img src={arrowButton} alt="go to page" class="h-full"/>
              </a>
          </div>  
        </a>
      </div>
    </div>
  </ContentWidth>
</div>