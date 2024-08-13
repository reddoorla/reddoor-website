<script>
	import { PrismicImage, SliceZone } from '@prismicio/svelte';

	import { components } from '$lib/slices';
    import ContentWidth from '$lib/components/ContentWidth/ContentWidth.svelte';

	export let data;

    const pageData = data.page.data;
let servicesArray = [];
servicesArray.push(pageData.branding);
servicesArray.push(pageData.product);
servicesArray.push(pageData.print);
servicesArray.push(pageData.environmental);
servicesArray.push(pageData.digital);
servicesArray.push(pageData.web);
console.log(servicesArray);

let services = "";
for (let i = 0; i < servicesArray.length; i++) {
  console.log(i);
  if (servicesArray[i] && services) {
    services += ", ";
  }
  switch (i) {
    case 0:
      if (servicesArray[i]) services += "Branding";
      break;
    case 1:
      if (servicesArray[i]) services += "Product";
      break;
    case 2:
      if (servicesArray[i]) services += "Print";
      break;
    case 3:
      if (servicesArray[i]) services += "Environmental";
      break;
    case 4:
      if (servicesArray[i]) services += "Digital";
      break;
    case 5:
      if (servicesArray[i]) services += "Web";
      break;
  }
}

console.log(services);
        
</script>

<div class="w-screen h-[80vh] relative">
    <PrismicImage field={data.page.data.hero} class="w-full h-full absolute object-cover"/>
    <div class="w-full h-full absolute " style="background: linear-gradient(rgba(0, 0, 0, 0.42) 0%, rgba(215, 25, 32, 0.86) 100%); z-index: 0;"></div>
    <ContentWidth class="h-full flex flex-col justify-between items-center">
        <div />
        <h4 class="text-white md:w-3/5 max-w-[800px] z-10">{pageData.tagline}</h4>
        <div class="md:w-3/5 text-white z-10 mb-12">
            <div class="w-full border-b-1 border-b-white flex justify-between pb-4">
                <div>{services}</div>
                <div class="h-6 w-20 flex flex-row justify-between text-white">
                    {#if data.prevProject}
                        <a href={"/portfolio/"+data.prevProject}> <i class="fa-solid fa-sharp fa-chevron-left"/></a>
                    {/if}
                    {#if data.nextProject}
                        <a href={"/portfolio/"+data.nextProject}> <i class="fa-solid fa-sharp fa-chevron-right"/></a>
                    {/if}
                </div>
            </div>
            <h1 class="mt-4">{data.title}</h1>
        </div>
    </ContentWidth>
</div>

<SliceZone slices={data.page.data.slices} {components} />
