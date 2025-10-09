<script lang="ts">
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import DefaultButton from "$lib/components/Buttons/DefaultButton.svelte";
  import AnimateIn from "$lib/components/AnimateIn.svelte";
  import OpeningAnimation from "$lib/components/OpeningAnimation.svelte";
  import megaphone from "$lib/assets/icons/megaphone.png";
  import LogoSoup from "$lib/components/LogoSoup.svelte";
  import pencil from "$lib/assets/icons/RD_TakeAction-02.png";
  import ScreenWidthImage from "$lib/components/ScreenWidth/ScreenWidthImage.svelte";

  let viewportHeight: number;
  let viewportWidth: number;

  export let data;
</script>

<svelte:head>
  <title>Reddoor Creative | Home</title>
</svelte:head>
<svelte:window
  bind:innerWidth={viewportWidth}
  bind:innerHeight={viewportHeight}
/>
<OpeningAnimation />

<div class="relative w-screen bg-paper">
  <section class="w-screen py-32">
    <ContentWidth class="flex flex-col relative">
      <img
        src={megaphone}
        alt="megaphone"
        class="w-4/5 md:w-1/4 lg:w-1/5 mix-blend-multiply opacity-50"
      />
      <AnimateIn class="-mt-24 w-4/5 md:w-2/5 text-primary">
        <h2>Better Design Means Better Business</h2>
      </AnimateIn>
      <AnimateIn class="h-[1px] bg-primary w-full my-8"></AnimateIn>
      <div class="w-full flex flex-col md:flex-row justify-end">
        <AnimateIn class="w-full md:w-1/3 lg:w-1/5 pr-6 pb-6">
          <h5 class="text-primary">Stand Out</h5>
          <p class="mt-2">
            The best brands have a story worth telling. With compelling design,
            you can stand out and succeed in this noisy world.
          </p>
        </AnimateIn>
        <AnimateIn class="w-full md:w-1/3 lg:w-1/5 pr-6 pb-6">
          <h5 class="text-primary">Feel Confident</h5>
          <p class="mt-2">
            When you have a brand that is clear and compelling, you can't help
            but be confident in any situation. Your clients sense this and are
            attracted to your offering.
          </p>
        </AnimateIn>
        <AnimateIn class="w-full md:w-1/3 lg:w-1/5 pr-6 pb-6">
          <h5 class="text-primary">Be Energized</h5>
          <p class="mt-2">
            You have something great to offer and when your audience clearly
            understands how you can solve their problem, it will help you close
            more deals.
          </p>
        </AnimateIn>
      </div>
    </ContentWidth>
  </section>

  <LogoSoup {data} />

  <section class="w-screen pb-32">
    <ContentWidth class="flex flex-col relative">
      <img
        src={pencil}
        alt="pencil"
        class="w-3/5 md:w-1/4 lg:w-1/5 mix-blend-multiply opacity-50"
      />

      <div class="w-full flex flex-row justify-end">
        <AnimateIn class="md:mt-12 w-full md:w-2/5 text-primary">
          <h2>Let’s Begin</h2>
        </AnimateIn>
        <div class="w-full lg:w-3/5 md:flex flex-row items-end hidden">
          <AnimateIn class="w-1/3">
            <p><span class="text-primary">01</span> / 03</p>
          </AnimateIn>
          <AnimateIn class="w-1/3">
            <p><span class="text-primary">02</span> / 03</p>
          </AnimateIn>
          <AnimateIn class="w-1/3">
            <p><span class="text-primary">03</span> / 03</p>
          </AnimateIn>
        </div>
      </div>
      <AnimateIn class="h-[1px] bg-primary w-full my-8"></AnimateIn>
      <div class="w-full flex flex-col md:flex-row justify-end">
        <AnimateIn class="w-full md:w-1/3 lg:w-1/5 pr-8 pb-8">
          <h5 class="text-primary">Call us, <br /> let’s talk.</h5>
          <p class="mt-2">
            Everything we do starts and ends with you. Your problems, your
            goals, your story. We begin with a conversation to see how we can
            help you succeed.
          </p>
        </AnimateIn>
        <AnimateIn class="w-full md:w-1/3 lg:w-1/5 pr-8 pb-8">
          <h5 class="text-primary">We help solve <br /> your problem.</h5>
          <p class="mt-2">
            After establishing clear goals that solve your brand’s problem we
            get to work on establishing a clear story and developing a
            compelling design.
          </p>
        </AnimateIn>
        <AnimateIn class="w-full md:w-1/3 lg:w-1/5 pr-8 pb-8">
          <h5 class="text-primary">Stand out <br /> from the noise.</h5>
          <p class="mt-2">
            You envisioned success and now you finally have confidence in your
            brand. We’ve equipped you to increase sales the way you’ve always
            hoped..
          </p>
        </AnimateIn>
      </div>
    </ContentWidth>
  </section>
</div>

<section class="w-screen bg-paper-red relative">
  <ContentWidth class="z-20 h-0" animateIn>
    <div class="absolute top-32 w-72 z-20">
      <h6 class="text-white">
        We pride ourselves in a hands-on approach to producing compelling design
        that excites our clients.
      </h6>
      <DefaultButton href="/about" class="mt-8">About Us</DefaultButton>
    </div>
  </ContentWidth>
  <ScreenWidthImage
    vimeoId="1082293395"
    altText="sonder brand drawinf"
    class="mix-blend-multiply opacity-60 pointer-events-none"
  ></ScreenWidthImage>
</section>

<section class="relative w-screen bg-paper py-16 md:py-32">
  <ContentWidth class="flex flex-col" animateIn>
    <h2 class="text-primary md:w-3/5">
      Feel confidence when you share your story with the world.
    </h2>
    <div class="flex flex-row mt-16 gap-8">
      <DefaultButton red href="/contact">Meet with Us</DefaultButton>
      <DefaultButton red href="/portfolio">View Our Work</DefaultButton>
    </div>
  </ContentWidth>
</section>
