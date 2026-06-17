<script lang="ts">
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import DefaultButton from "$lib/components/Buttons/DefaultButton.svelte";
  import { animateIn as anim } from "$lib/actions/animateIn";
  import OpeningAnimation from "$lib/components/OpeningAnimation.svelte";
  import Img from "$lib/components/Img.svelte";
  import megaphone from "$lib/assets/icons/megaphone.png?as=run";
  import LogoSoup from "$lib/components/LogoSoup.svelte";
  // Higher quality than the ?as=run default (sharp's avif q50): the pencil is
  // fine line art and the default hardens its strokes. The painterly megaphone
  // is fine at the default, so this override is per-image.
  import pencil from "$lib/assets/icons/RD_TakeAction-02.png?as=run&quality=85";
  import ScreenWidthImage from "$lib/components/ScreenWidth/ScreenWidthImage.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Reddoor Creative | Home</title>
</svelte:head>
<OpeningAnimation slides={data.openingAnimation.data.slides} />

<div class="relative w-screen bg-paper">
  <section class="w-screen py-32">
    <ContentWidth class="flex flex-col relative">
      <Img
        src={megaphone}
        alt="megaphone"
        sizes="(min-width: 1024px) 20vw, (min-width: 768px) 25vw, 80vw"
        class="w-4/5 md:w-1/4 lg:w-1/5 mix-blend-multiply opacity-50"
      />
      <div use:anim class="-mt-24 w-4/5 md:w-2/5 text-primary">
        <h2>Better Design Means Better Business</h2>
      </div>
      <div use:anim class="h-px bg-primary w-full my-8"></div>
      <div class="w-full flex flex-col md:flex-row justify-end">
        <div use:anim class="w-full md:w-1/3 lg:w-1/5 pr-6 pb-6">
          <h3 class="text-primary heading-sub">Stand Out</h3>
          <p class="mt-2">
            The best brands have a story worth telling. With compelling design, you can stand out
            and succeed in this noisy world.
          </p>
        </div>
        <div use:anim class="w-full md:w-1/3 lg:w-1/5 pr-6 pb-6">
          <h3 class="text-primary heading-sub">Feel Confident</h3>
          <p class="mt-2">
            When you have a brand that is clear and compelling, you can't help but be confident in
            any situation. Your clients sense this and are attracted to your offering.
          </p>
        </div>
        <div use:anim class="w-full md:w-1/3 lg:w-1/5 pr-6 pb-6">
          <h3 class="text-primary heading-sub">Be Energized</h3>
          <p class="mt-2">
            You have something great to offer and when your audience clearly understands how you can
            solve their problem, it will help you close more deals.
          </p>
        </div>
      </div>
    </ContentWidth>
  </section>

  <LogoSoup {data} />

  <section class="w-screen pb-32">
    <ContentWidth class="flex flex-col relative">
      <Img
        src={pencil}
        alt="pencil"
        sizes="(min-width: 1024px) 20vw, (min-width: 768px) 25vw, 60vw"
        class="w-3/5 md:w-1/4 lg:w-1/5 mix-blend-multiply opacity-50"
      />

      <div class="w-full flex flex-row justify-end">
        <div use:anim class="md:mt-12 w-full md:w-2/5 text-primary">
          <h2>Let’s Begin</h2>
        </div>
        <div class="w-full lg:w-3/5 md:flex flex-row items-end hidden">
          <div use:anim class="w-1/3">
            <p><span class="text-primary">01</span> / 03</p>
          </div>
          <div use:anim class="w-1/3">
            <p><span class="text-primary">02</span> / 03</p>
          </div>
          <div use:anim class="w-1/3">
            <p><span class="text-primary">03</span> / 03</p>
          </div>
        </div>
      </div>
      <div use:anim class="h-px bg-primary w-full my-8"></div>
      <div class="w-full flex flex-col md:flex-row justify-end">
        <div use:anim class="w-full md:w-1/3 lg:w-1/5 pr-8 pb-8">
          <h3 class="text-primary heading-sub">Call us, <br /> let’s talk.</h3>
          <p class="mt-2">
            Everything we do starts and ends with you. Your problems, your goals, your story. We
            begin with a conversation to see how we can help you succeed.
          </p>
        </div>
        <div use:anim class="w-full md:w-1/3 lg:w-1/5 pr-8 pb-8">
          <h3 class="text-primary heading-sub">We help solve <br /> your problem.</h3>
          <p class="mt-2">
            After establishing clear goals that solve your brand’s problem we get to work on
            establishing a clear story and developing a compelling design.
          </p>
        </div>
        <div use:anim class="w-full md:w-1/3 lg:w-1/5 pr-8 pb-8">
          <h3 class="text-primary heading-sub">Stand out <br /> from the noise.</h3>
          <p class="mt-2">
            You envisioned success and now you finally have confidence in your brand. We’ve equipped
            you to increase sales the way you’ve always hoped..
          </p>
        </div>
      </div>
    </ContentWidth>
  </section>
</div>

<section class="w-screen bg-paper-red relative">
  <ContentWidth class="z-20 h-0" animateIn>
    <div class="absolute top-32 w-72 z-20">
      <p class="text-lg font-bold leading-7.5 text-white">
        We pride ourselves in a hands-on approach to producing compelling design that excites our
        clients.
      </p>
      <DefaultButton href="/about" class="mt-8">About Us</DefaultButton>
    </div>
  </ContentWidth>
  <ScreenWidthImage
    vimeoId="1082293395"
    altText="sonder brand drawing"
    lazy
    class="mix-blend-multiply opacity-60 pointer-events-none"
  ></ScreenWidthImage>
</section>

<section class="relative w-screen bg-paper py-16 md:py-32">
  <ContentWidth class="flex flex-col" animateIn>
    <h2 class="text-primary md:w-3/5">Feel confidence when you share your story with the world.</h2>
    <div class="flex flex-row mt-16 gap-8">
      <DefaultButton red href="/contact">Meet with Us</DefaultButton>
      <DefaultButton red href="/portfolio">View Our Work</DefaultButton>
    </div>
  </ContentWidth>
</section>

<style>
  /*
    These headings are semantically <h3> for correct heading order, but must
    visually match the previous <h5>. Replicate the exact h5 typography from
    app.css across every breakpoint so the rendered size is identical.
  */
  h3.heading-sub {
    font-size: 30px;
    font-style: normal;
    font-weight: 200;
    line-height: 46px;
  }

  @media only screen and (max-width: 1024px) {
    h3.heading-sub {
      font-size: 22px;
      line-height: 32px;
    }
  }

  @media only screen and (max-width: 480px) {
    h3.heading-sub {
      font-size: 22px;
      line-height: 32px;
    }
  }
</style>
