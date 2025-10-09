<script lang="ts">
	import { PrismicPreview } from '@prismicio/svelte/kit';
	import { page } from '$app/stores';
	import { repositoryName } from '$lib/prismicio';

	import "../app.css";

	import { fly, fade } from "svelte/transition"
    import { afterNavigate, disableScrollHandling } from '$app/navigation';

	import ContentWidth from '$lib/components/ContentWidth/ContentWidth.svelte';
  import { onMount } from 'svelte';

  import { isTop } from '$lib/stores/isTop';
  import LandscapeModal from '$lib/components/LandscapeModal.svelte';

  import rotatingReddoor from '$lib/assets/icons/logos/drawnReddoors.gif'


    const NAV_LINKS=[
        {
            label:"Portfolio",
            href:"/portfolio"
        },
        {
            label:"About",
            href:"/about"
        },
        {
            label:"20 for 20",
            href:"/twenty-for-twenty"
        },
        {
            label:"Meet With Us",
            href:"/contact"
        },

    ];

    let showNav = false;
    let isNavTransparent = false;

    let isOverlayVisible = false;

    const toggleOverlayOn = () => isOverlayVisible = true;
    const toggleOverlayOff = () => isOverlayVisible = false;

    let scrollY:number;
    export let data;

    $: showNav = $page.status === 404 || scrollY > 300 || $page.url.pathname.includes('about');


    const handleScroll = () =>{
            showNav=$page.status === 404 ||scrollY>300 || $page.url.pathname.includes('about');
    }
    function disableScrollRestoration() {
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  
  window.scrollTo(0, 0);
}

    onMount(()=>{
 
        window.addEventListener('scroll', handleScroll);
        disableScrollRestoration();
    });


afterNavigate(() => {
    disableScrollHandling();
    setTimeout(() => {
        scrollTo({ top: 0, behavior: 'instant' });
    }, 600);
});

</script>
<svelte:window bind:scrollY={scrollY}/>

<svelte:head>
	<title>{$page.data.title}</title>
	{#if $page.data.meta_description}
		<meta name="description" content={$page.data.meta_description} />
	{/if}
	{#if $page.data.meta_title}
		<meta name="og:title" content={$page.data.meta_title} />
	{/if}
	{#if $page.data.meta_image}
		<meta name="og:image" content={$page.data.meta_image.url} />
		<meta name="twitter:card" content="summary_large_image" />
	{/if}
	<meta name="viewport" content="width=device-width, initial-scale=1.0 user-scalable=no">
</svelte:head>

{#if isOverlayVisible}
<div class="w-screen h-lvh fixed bg-paper-red flex flex-col items-center justify-center gap-12 z-30" transition:fly={{y:"-100%"}}>
    <a href="/" class="text-white text-2xl" on:click={()=>isOverlayVisible=false}>Home</a>
    {#each NAV_LINKS as item}
        <a href={item.href} class="text-white text-2xl" on:click={()=>isOverlayVisible=false}>{item.label}</a>
    {/each}

    <button class="absolute top-5 right-5 opacity-60 hover:opacity-100 transition z-40" on:click={toggleOverlayOff}>
        <div in:fade={{delay: 600}} out:fade class="text-white">
        <i class="fa-sharp fa-thin fa-xmark fa-2xl"  />
        </div>
      
    </button>
</div>
{/if}
<LandscapeModal />
{#key data.pathname}
<main out:fade={{duration:500}} in:fade={{delay:700, duration:700}}>
    {#if !showNav &&!$isTop}

    <div class="h-12 w-screen top-0 absolute z-20 bg-transparent {data.pathname.includes("portfolio/")||data.pathname.includes("about") ?"text-white":"text-black"}" transition:fly={{y:-64, delay:200}}>
        <ContentWidth class="flex flex-row justify-between items-center h-full">
            <a href="/" class="hover:opacity-80 transition-all duration-500 bump label ">
                Reddoor Creative
            </a>
            
            
            <div class="flex flex-row">
                <div class="hidden lg:flex flex-row justify-between items-center gap-10">
                    {#each NAV_LINKS as item, i}
          
                        <a class="label hover:opacity-80 transition-opacity " href={item.href} on:click={()=>isOverlayVisible=false}>{item.label}</a>
                      
                    {/each}
                </div>
           
            <button class="lg:hidden ml-6 opacity-60 hover:opacity-100 transition-all" on:click={toggleOverlayOn}>
               {#if !isOverlayVisible}
                <i class="fa-sharp fa-thi fa-bars fa-2xl"/>
                {/if}
            
            </button>
            </div>
    
        </ContentWidth>
    </div>
    {/if}
	<!-- nav #2 -->
{#if showNav &&!$isTop}
<div class="h-12 w-screen top-0 fixed z-20 {isNavTransparent ? "bg-transparent text-white" : "bg-white"} bg-opacity-80" transition:fly={{y:-64, delay:500}}>
    <ContentWidth class="flex flex-row justify-between items-center h-full">
        <a href="/" class="hover:opacity-80 transition-all duration-500 bump label">
            Reddoor Creative
        </a>
        
        
        <div class="flex flex-row">
            <div class="hidden lg:flex flex-row justify-between items-center gap-10">
                {#each NAV_LINKS as item, i}
                    {#if i<NAV_LINKS.length-1}
                    <a class="label" href={item.href} on:click={()=>isOverlayVisible=false}>{item.label}</a>
                    {:else}
                    <a class="text-primary label" href={item.href} on:click={()=>isOverlayVisible=false}>{item.label}</a>
                    {/if}
                {/each}
            </div>
       
        <button class="lg:hidden ml-6 opacity-60 hover:opacity-100 transition-all" on:click={toggleOverlayOn}>
           {#if !isOverlayVisible}
            <i class="fa-sharp fa-bars fa-2xl"/>
            {/if}
        
        </button>
        </div>

    </ContentWidth>
</div>
{/if}

	<slot />

<footer class='relative bg-paper'>
    <div class='w-full h-full absolute top-0 left-0 bg-paper'></div>

    <ContentWidth class="pb-4 flex flex-row justify-end items-end z-20 relative">
            
        <div class="flex flex-col tracking-wide label gap-8 w-full md:w-1/3 lg:w-1/5">
            
            <div class="flex flex-col gap-1">
                <a href="/" class="-translate-x-[8%] w-3/5 md:w-full"><img src={rotatingReddoor} alt='reddoor drawn in multiple styles'/></a>
                <a href="/portfolio" class="text-primary underline">Portfolio</a>
                <a href="/about" class="text-primary underline">About</a>
                <a href="/contact" class="text-primary underline">Meet with Us</a>
                <a href="https://www.linkedin.com/company/reddoor-creative" class="text-primary underline">LinkedIn</a>
                <a href="https://www.instagram.com/reddoorla/" class="text-primary underline">Instagram</a>
            </div>
            <div class="flex flex-col">
                <div>CONTACT</div>
                <a href="tel:3103413571" class="text-primary underline">+1 310-341-3571</a>
                <a href="mailto:info@reddoorla.com" class="text-primary underline">info@reddoorla.com</a>
            </div>
            <div class="flex flex-col">
                <div>HQ MAILING ADDRESS</div>
                <div>29027 Dapper Dan Dr.</div>
                <div>Fair Oaks Ranch, TX 78015</div>
            </div>
            <div class="label text-nowrap">
                {"© Reddoor Creative 2006-"+ new Date().getFullYear() + ", All Rights Reserved"}
            </div>
        
    </ContentWidth>

</footer>
</main>
{/key}

<PrismicPreview {repositoryName} />
