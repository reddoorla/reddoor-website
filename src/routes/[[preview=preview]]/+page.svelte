<script>
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import printedReddoorLogo from "$lib/assets/icons/logos/printedReddoor.png"
  import applause from "$lib/assets/images/applause.jpg"
  import graph from "$lib/assets/images/reddoorGraph.jpg"
  import DefaultButton from "$lib/components/Buttons/DefaultButton.svelte";


</script>

<svelte:head>
	<title>Reddoor Creative | Home</title>
</svelte:head>
<div class="md:h-screen w-screen bg-paper">
  <ContentWidth class="flex flex-col md:flex-row md:py-40 justify-between">
    <img src={printedReddoorLogo} alt="reddoor logo" class="w-full h-fit md:w-1/5  max-w-24 my-20"/>
    <div class="w-full md:w-4/5 flex flex-col md:p-16 items-start">
      <h3 class="text-primary w-full ">Arm your brand with a clear story and compelling design.</h3>
      <div class="flex flex-row gap-6 mt-12">
        <DefaultButton click={()=>window.location.href="/contact"} bold filled text="MEET WITH US"/>
        <DefaultButton click={()=>window.location.href="/portfolio"} filled={false} class="border-1 border-dark text-dark hover:bg-mid hover:bg-opacity-20" text="VIEW WORK"/>
      </div>
    </div>
  </ContentWidth>
</div>
<div class="relative w-screen md:h-[40vw]">
  <div class='w-screen bg-paper pt-32 md:pt-8 md:h-1/2 pb-8'>
    <ContentWidth class="flex flex-row items-end">
      <div class="flex flex-col md:flex-row w-full">
        <div class="label w-1/5 pt-2"><span class="text-primary">01 </span>/ 03</div>
        <h3 class="text-primary w-4/5">Feel <br /> Confident</h3>
      </div>
    </ContentWidth>
  </div>
  <div class="h-1/2">
    <ContentWidth class="flex flex-col md:flex-row relative h-full items-start py-8">
      <div class="w-1/5" />
      <p class="w-4/5 md:w-2/5 pr-12">When you have a brand that is clear and compelling, you can't help but be confident in any sales situation. Your clients sense this and are attracted to your offering.</p>
    </ContentWidth>
    <img src={applause} alt="applause" class="aspect-[4/3] md:absolute top-1/2 right-0 md:-translate-y-1/2 md:w-2/5 object-cover"/>
  </div>
</div>
<div class="relative w-screen md:h-[40vw] bg-white">
  <div class='w-screen pt-32 md:pt-8 md:h-1/2 pb-8'>
    <ContentWidth class="flex flex-row items-end">
      <div class="flex flex-col md:flex-row w-full">
        <div class="label w-1/5 pt-2"><span class="text-primary">02 </span>/ 03</div>
        <h3 class="text-primary w-4/5">Catalyst <br /> for Sales</h3>
      </div>
    </ContentWidth>
  </div>
  <div class="h-1/2">
    <ContentWidth class="flex flex-col md:flex-row relative h-full items-start py-8">
      <div class="w-1/5" />
      <p class="w-4/5 md:w-2/5 pr-12">When you have a brand that is clear and compelling, you can't help but be confident in any sales situation. Your clients sense this and are attracted to your offering.</p>
    </ContentWidth>
    <img src={graph} alt="applause" class=" md:absolute top-1/2 right-0 md:-translate-y-1/2 md:w-2/5"/>
  </div>
</div>
<div class="relative w-screen bg-white">
  <div class='w-screen bg-white h-[20vw] py-8'>
    <ContentWidth class="flex flex-row items-end">
      <div class="flex flex-col md:flex-row w-full">
        <div class="label w-1/5 pt-2">03 / 03</div>
        <h3 class="text-primary w-4/5">Stand <br /> Out</h3>
      </div>
    </ContentWidth>
  </div>
</div>

