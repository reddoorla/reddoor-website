<script>
	import { PrismicRichText } from '@prismicio/svelte';

  import ContentWidth from '$lib/components/ContentWidth/ContentWidth.svelte';

	/** @type {import("@prismicio/client").Content.RichTextSlice} */
	export let slice;

	let backgroundColorString = 'bg-'+slice.primary.backgroundcolor;
	const float = slice.primary.float;
	const width = slice.primary.width;


</script>


<section class="w-full {slice.primary.hasPadding? "py-12" : ""} text-{slice.primary.textColor} {backgroundColorString}">
	<ContentWidth class="flex flex-col 
		{float==="right"?"items-end":""}
		{float==="center"?"items-center":""}
		{float==="left"?"items-start":""}
	"
	animateIn
	>
	<div class="
		{width==="4/5"? "w-full md:w-4/5":""}
		{width==="3/5"? "w-full md:w-3/5":""}
		pr-6
		rich-text
	">
		
			<PrismicRichText
			field={slice.primary.content}
		/>
	</div>
		
	</ContentWidth>
</section>

