<script lang='ts'>
	import placeholder from "../../assets/images/background_placeholder.svg";
	import ContentWidth from "../ContentWidth/ContentWidth.svelte";
	
	export let image = placeholder;
	export let altText = "background image"
	export let placeholderSide = "right"
	export let vimeoId = ""
	
	let viewportHeight:number;
	let viewportWidth:number;
	
	</script>
	
	<svelte:window bind:innerHeight={viewportHeight} bind:innerWidth={viewportWidth} />
	
	<section class="max-w-screen overflow-hidden">
		<div class="max-h-screen aspect-video relative {viewportHeight * 16 > viewportWidth * 9 ? 'h-screen min-w-full' : 'w-screen min-h-full'}">
			{#if vimeoId}
				
					<iframe 
					title="background video" 
					src={`https://player.vimeo.com/video/${vimeoId}?background=1`}
					class="aspect-video {viewportHeight * 16 > viewportWidth * 9 ? 'h-screen min-w-full' : 'w-screen min-h-full'} contrast-[1.15] {$$props.class || ''}"
					frameborder="0"
					allowfullscreen
					
				  ></iframe>
			
			{:else}
				<img src={image} alt={altText} class="absolute bottom-0 {placeholderSide}-0 h-full w-full max-w-screen object-cover {image===placeholder ? "lg:w-[45%] md:h-auto" : ""} {$$props.class || ''}"/>
			{/if}
			<div class="w-full max-w-[100vw] h-full max-h-screen relative">
			<ContentWidth class='{$$props.class || ''} h-full z-10 relative'>
				<slot />
			</ContentWidth>
			</div>
		</div>
	</section>