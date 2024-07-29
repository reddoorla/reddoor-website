<script>
	import { PrismicPreview } from '@prismicio/svelte/kit';
	import { page } from '$app/stores';
	import { repositoryName } from '$lib/prismicio';
	import "../app.css";

	import { fly, fade } from "svelte/transition"

	import ContentWidth from '$lib/components/ContentWidth/ContentWidth.svelte';

    const NAV_LINKS=[
        {
            label:"ABOUT",
            href:"/"
        },
        {
            label:"PORTFOLIO",
            href:"/"
        },
        {
            label:"RESOURCES",
            href:"/"
        },
        {
            label:"BLOG",
            href:"/"
        },
        {
            label:"CONTACT",
            href:"/"
        },

    ];



    let isOverlayVisible = false;

    const toggleOverlayOn = () => isOverlayVisible = true;
    const toggleOverlayOff = () => isOverlayVisible = false;
</script>

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
<div class="w-screen h-screen fixed bg-dark flex flex-col items-center justify-center gap-12 z-30" transition:fly={{y:"-100%"}}>
    {#each NAV_LINKS as item}
        <a href={item.href} class="text-white text-2xl">{item.label}</a>
    {/each}

    <button class="absolute top-5 right-5 opacity-60 hover:opacity-100 transition-all z-40" on:click={toggleOverlayOff}>
        <div in:fade={{delay: 600}} out:fade class="text-white">
        <i class="fa-sharp fa-thin fa-xmark fa-2xl"  />
        </div>
      
    </button>
</div>
{/if}
<main>
	<!-- nav #2 -->

<div class="h-16 w-screen">
    <ContentWidth class="flex flex-row justify-between items-center h-full">
        <a href="/" class="hover:opacity-80 transition-all duration-500 bump">
            Reddoor LA
        </a>
        
        
        <div class="flex flex-row">
            <div class="hidden lg:flex flex-row justify-between items-center gap-10">
                {#each NAV_LINKS as item}
                    <a href={item.href}>{item.label}</a>
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




	<slot />
</main>
<PrismicPreview {repositoryName} />
