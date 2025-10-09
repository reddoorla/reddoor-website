<script lang="ts">
  import beach from "$lib/assets/images/beach.jpg";
  import hills from "$lib/assets/images/hills.jpg";
  import lake from "$lib/assets/images/alpineLake.jpg";
  import tim from "$lib/assets/images/tim.jpg";
  import erik from "$lib/assets/images/erik.jpg";
  import car from "$lib/assets/images/reddoorcar.png";
  import applause from "$lib/assets/images/applause.jpg";
  import key from "$lib/assets/icons/RD_Keys-04.png";
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import DefaultButton from "$lib/components/Buttons/DefaultButton.svelte";
  import AnimateIn from "$lib/components/AnimateIn.svelte";
  import ScreenWidthImage from "$lib/components/ScreenWidth/ScreenWidthImage.svelte";
  import { onMount } from 'svelte'
  import LogoSoup from "$lib/components/LogoSoup.svelte";
  

  let carTranslationInVW = 0;
  let viewportHeight = 1024;
  let carRef:HTMLImageElement;

  const handleScroll = () =>{
    if(!carRef)return;

    const carRect = carRef.getBoundingClientRect();

    if(carRect.top>viewportHeight)return;

    console.log(carRect.top)

    carTranslationInVW = 100*(carRect.top-carRect.height/2)/viewportHeight
  }

  onMount(()=>{
    window.addEventListener('scroll', handleScroll)
  })

  export let data:any;
  
</script>

<svelte:head>
  <title>About | Reddoor Creative</title>
</svelte:head>

<svelte:window bind:innerHeight={viewportHeight} />

<div class="w-screen max-h-96 relative bg-paper">
  <ContentWidth class="h-full flex justify-center items-center py-48">
    <h5 class=" md:w-4/5 max-w-[800px] z-10">
      We design beautiful marketing <br /> materials that help you thrive.
    </h5>
  </ContentWidth>
</div>
<div class="w-screen bg-paper pb-8">
  <ContentWidth class="flex ">
    <h3 class="text-primary">About</h3>
  </ContentWidth>
</div>
<ScreenWidthImage src={applause} />
<div class="w-screen bg-paper pb-48">
  <ContentWidth class="flex relative border-primary border-b-1">
    <img src={key} alt="keys" class="lg:w-1/5 md:w-1/3 w-2/3" />
    <h2 class="text-primary absolute left-0 bottom-2 md:bottom-8">
      Our Values
    </h2>
  </ContentWidth>
  <ContentWidth class="flex flex-row justify-end">
    <div class="md:w-3/5 h-72 relative">
      <div class="flex flex-col gap-4">
        <p class="mt-8">01/03</p>
        <h5 class="text-primary">
          We value <span class="underline underline-offset-[25%] cursor-pointer"
            >acting on your behalf</span
          >,<br /> therefore
          <span class="underline underline-offset-[25%] cursor-pointer">we work hard and smart</span
          ><br /> so you can
          <span class="underline underline-offset-[25%] cursor-pointer">feel relief</span>
        </h5>
      </div>
      <div class="absolute left-0 bottom-0 flex gap-6 text-primary">
        <button
          ><i
            class="fa-solid fa-light fa-arrow-left fa-xl hover:text-primary-dark transition-colors duration-300"
          ></i></button
        >
        <button
          ><i
            class="fa-solid fa-light fa-arrow-right fa-xl hover:text-primary-dark transition-colors duration-300"
          ></i></button
        >
      </div>
    </div>
  </ContentWidth>
</div>

<div class="w-screen flex flex-col lg:flex-row relative bg-paper">
  <AnimateIn
    class="w-full md:w-1/3 aspect-square relative flex items-center justify-center"
  >
    <img
      class="w-full h-full absolute z-0 object-cover"
      src={beach}
      alt="beach"
    />
    <h3 class="text-white z-10">CA</h3>
  </AnimateIn>
  <AnimateIn
    class="w-full md:w-1/3 aspect-square relative flex items-center justify-center"
  >
    <img
      class="w-full h-full absolute z-0 object-cover"
      src={hills}
      alt="hills"
    />
    <h3 class="text-white z-10">TX</h3>
  </AnimateIn>
  <AnimateIn
    class="w-full md:w-1/3 aspect-square relative flex items-center justify-center"
  >
    <img
      class="w-full h-full absolute z-0 object-cover"
      src={lake}
      alt="lake"
    />
    <h3 class="text-white z-10">ID</h3>
  </AnimateIn>
</div>
<div class="w-screen text-center py-20 bg-paper">
  <ContentWidth class="flex flex-col border-primary border-b-1 pb-8" animateIn>
    <h2 class="text-primary text-left">
      Serving our clients,<br /> near and far.
    </h2>
  </ContentWidth>
  <ContentWidth class="flex flex-col items-end" animateIn>
    <AnimateIn class="md:w-3/5">
      <p class="text-left md:w-2/3 mt-8">
        We work with clients across the US and occasionally around the globe. We
        have designers sprinkled across California, Texas and Idaho,
        conveniently located near the Los Angeles, San Antonio, and Boise metro
        areas. Regardless of your location, partnering with Reddoor Creative
        will give you the confidence in your brand that you've been needing.
      </p>
    </AnimateIn>
    <div class="md:w-3/5 flex flex-col items-center gap-6 md:gap-0 md:flex-row mt-16">
      <AnimateIn class="w-4/5 md:w-1/3 md:pr-4 flex flex-col">
        <img src={tim} alt="tim holmes" class="w-full aspect-square" />
        <div class="text-primary large-body font-thin mt-2">Tim Holmes</div>
        <p class="text-mid font-thin">CA+ID Creative Director</p>
      </AnimateIn>
      <AnimateIn class="w-4/5 md:w-1/3 md:pl-4 flex flex-col">
        <img src={erik} alt="Erik Svendsen" class="w-full aspect-square" />
        <p class="text-primary large-body mt-2 large-body">Erik Svendsen</p>
        <div class="font-thin">TX Creative Director</div>
      </AnimateIn>
    </div>
  </ContentWidth>
</div>

<div class="w-screen pt-16 bg-paper pb-16">
  <ContentWidth class="flex" animateIn>
    <h6 class="text-primary text-center">The Reddoor Story</h6>
  </ContentWidth>

  <ContentWidth class="flex flex-col justify-end items-end">
    <AnimateIn class="md:w-3/5">
      <h5 class="md:w-2/3">
        Because of unforeseen circumstances owner, Tim Holmes, found himself
        stuck in LA with a white Toyota and a seemingly unfortunate red door.
      </h5>
    </AnimateIn>
    <div class="w-full overflow-hidden" style="transform:translateX({carTranslationInVW}vw)">
      <img
        class="w-[150%] md:w-3/5"
        src={car}
        alt="a white car with a red door"
        bind:this={carRef}
      />
    </div>
    <div class="flex flex-col md:w-3/5 my-8 gap-8">
      <AnimateIn class="md:w-2/3">
        <p>
          The young designer soon realized that in city where "your wheels" are
          a part of your identity he had two choices: be embarrassed or embrace
          the moment. Choosing the latter he quickly told his friend how excited
          he was to get a red door since he always wanted a red sports car and
          thought he'd start with the driver's side door and just work his way
          around replacing one piece at a time.
        </p>
      </AnimateIn>
      <AnimateIn class="md:w-2/3">
        <p>
          The car soon became known as "reddoor" having its own personality
          because of the one thing that most people would see as unfortunate.
          With a proud owner it had no other reason than to be proud, too. What
          once was headed for the trash heap was now a gem of a story.
        </p>
      </AnimateIn>

      <AnimateIn class="md:w-2/3 border-t-1 border-t-primary pt-6">
        <h6 class="text-primary">
          The original "reddoor" taught us two things at Reddoor Creative:
        </h6>
      </AnimateIn>

      <div class="w-full flex flex-col md:flex-row">
        <AnimateIn class="flex flex-col w-2/3 md:w-1/3 pr-4">
          <p class="text-primary">01</p>
          <p class="mt-2">
            Find the unique quality within a business and tell that story in a
            compelling way.
          </p>
        </AnimateIn>
        <AnimateIn class="flex flex-col w-2/3 md:w-1/3 mt-6 md:mt-0 pr-4">
          <p class="text-primary">02</p>
          <p class="mt-2">
            Champion our clients and remember that we exist to serve them with
            our talents.
          </p>
        </AnimateIn>
      </div>
    </div>
  </ContentWidth>
</div>

<section class="w-screen py-16 bg-paper-red">
  <ContentWidth class="flex flex-col md:flex-row">
    <AnimateIn class="md:w-2/5 mb-6">
      <h6 class="text-white">Perspective</h6>
    </AnimateIn>
    <AnimateIn class="md:w-3/5 text-white">
      <h5 class=" md:w-2/3">
        “Time has taught me that true north is to not just focus on the work
        itself but also the people I’m working with.”
      </h5>
      <div class="flex flex-row gap-5 mt-10">
        <img src={tim} alt="tim holmes" class="w-20" />
        <div class="flex flex-col">
          <div class="large-body">Tim Holmes</div>
          <p>CA+ID Creative Director</p>
        </div>
      </div>
    </AnimateIn>
  </ContentWidth>
</section>

<section class="bg-paper">
    <LogoSoup {data} />
</section>

<section class="relative w-screen bg-paper py-16 md:py-32">
  <ContentWidth class="flex flex-col" animateIn>
    <h2 class="text-primary md:w-3/5">
      Isn’t it time to arm your brand with a clear story and compelling design?
    </h2>
    <div class="flex flex-row mt-16 gap-8">
      <DefaultButton red href="/contact">Meet with Us</DefaultButton>
      <DefaultButton red href="/portfolio">View Our Work</DefaultButton>
    </div>
  </ContentWidth>
</section>
