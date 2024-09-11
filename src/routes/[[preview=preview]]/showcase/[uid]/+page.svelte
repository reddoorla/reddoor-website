<script>
	import { SliceZone } from '@prismicio/svelte';
	import { components } from '$lib/slices';
	import ContentWidth from '$lib/components/ContentWidth/ContentWidth.svelte';
	import DefaultButton from '$lib/components/Buttons/DefaultButton.svelte';
	import {PrismicImage} from '@prismicio/svelte';

	export let data;
</script>

<div class="w-screen h-[80vh] relative">
    <PrismicImage field={data.page.data.hero} class="w-full h-full absolute object-cover"/>
    <div class="w-full h-full absolute " style="background: linear-gradient(rgba(0, 0, 0, 0.42) 0%, rgba(215, 25, 32, 0.86) 100%); z-index: 0;"></div>
    <ContentWidth class="h-full flex flex-col justify-between items-start">
        <div />
        <h5 class="text-white md:w-3/5 md:pr-[10%] mx-auto z-10">{data.page.data.tagline||''}</h5>
        <div class=" text-white w-full z-10 mb-12 md:w-3/5 mx-auto">
            
            <h1 class="mt-4">{data.title.slice(0,-18)||''}</h1>
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