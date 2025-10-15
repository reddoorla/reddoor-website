<script lang="ts">
	import { page } from '$app/state';
  import ContentWidth from '$lib/components/ContentWidth/ContentWidth.svelte';
  import AnimateIn from '$lib/components/AnimateIn.svelte';
    import { flip } from "svelte/animate";
      import { expoOut } from "svelte/easing";
        import arrowButton from "$lib/assets/icons/arrowButton.svg"
        
  

  export let data;

  const projects = data.latestFourProjects.results;

  function mediumString (project:any) {
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
  
</script>
<svelte:head>
    <title>{"Reddoor Creative | " + page.error?.message}</title>
</svelte:head>
<div class="h-screen w-screen fixed top-0 left-0">
<ContentWidth class="flex flex-row py-24 md:py-64">
    <h1 class="text-primary/20">404</h1>
</ContentWidth>
</div>
<section class="">
    <ContentWidth class="py-24 md:py-48 flex flex-col items-end">
        <h4 class="md:w-4/5">Nothing to see here...<br/>Let’s get you back on track.</h4>
        
          <h6 class="text-primary w-full md:w-4/5  mt-24 md:mt-48">Enjoy our most recent work</h6>
        <div class="w-full md:ml-[20%] md:w-4/5 flex flex-row flex-wrap mt-12" >
        {#each projects as project, i (project.uid)}
        <div animate:flip={{ duration:4500, easing: expoOut}}  class="md:pr-6 pb-6 w-full lg:w-1/2 aspect-[4/3] transition-opacity duration-700 relative">
          
                <a href={"/portfolio/"+project.uid} class="h-full w-full flex flex-col justify-end relative">
                    <img src={project.data.hero.url||''} alt={project.data.title  + " Hero Image"} class="absolute w-full h-full object-cover"/>
                    <div class="w-full h-full absolute top-0 left-0 hover:opacity-60 transition-opacity duration-700" style="background: linear-gradient(180deg, rgba(12, 19, 35, 0.15) 0%, rgba(12, 19, 35, 0.80) 81.09%) 50% / cover no-repeat;" />
                   
                    
                    <AnimateIn class="w-full flex flex-row justify-between p-6 z-10" transitionDelayMax={800}>
                        <div>
                            <p class="text-white uppercase">{project.data.title}</p>
                            <p class="text-light">{mediumString(project)||''}</p>
                        </div>
                        <a href={"/portfolio/"+project.uid} class="brightness-200 hover:brightness-50 transition bump">
                            <img src={arrowButton} alt="go to page" class="h-full"/>
                        </a>
                    </AnimateIn>
                    
                </a>
           
        </div>
        {/each}
    </div>
      

    </ContentWidth>
    
</section>

<style>
    h1{
        font-family: Pragmatica;
        font-size: 200px;
        font-style: normal;
        font-weight: 400;
        line-height: 100%; /* 200px */
    }

    @media only screen and (max-width:1024px) {
        h4{
            font-size: 36px;
        }
    }
</style>