<script>
	import { PrismicImage, SliceZone } from '@prismicio/svelte';

	import { components } from '$lib/slices';
    import ContentWidth from '$lib/components/ContentWidth/ContentWidth.svelte';
  import { onMount } from 'svelte';

	export let data;

    $: pageData = data.page.data;


    $: servicesArray = [
  pageData.branding,
  pageData.product,
  pageData.print,
  pageData.environmental,
  pageData.packaging,
  pageData.digital,
  pageData.web,
  pageData.social

];


$: services = servicesArray.reduce((acc, service, index) => {
  if (service) {
    if (acc) acc += ", ";
    acc += ["Brand", "Product", "Print", "Environmental", "Packaging", "Digital", "Web","Social"][index];
  }
  return acc;
}, "");

        
</script>



<div class="w-screen h-[80vh] relative">
    <PrismicImage field={data.page.data.hero} class="w-full h-full absolute object-cover"/>
    <div class="w-full h-full absolute " style="background: linear-gradient(rgba(0, 0, 0, 0.42) 0%, rgba(215, 25, 32, 0.86) 100%); z-index: 0;"></div>
    <ContentWidth class="h-full flex flex-col justify-between items-start">
        <div />
        <h5 class="text-white md:w-4/5 md:pr-[30%] mx-auto z-10">{data.page.data.tagline||''}</h5>
        <div class=" text-white w-full z-10 mb-12 md:w-4/5 mx-auto">
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
