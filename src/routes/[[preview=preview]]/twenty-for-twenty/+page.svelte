<script lang='ts'>
    import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
    import AnimateIn from "$lib/components/AnimateIn.svelte";
    import DefaultButton from "$lib/components/Buttons/DefaultButton.svelte";
    import progressImage from "$lib/assets/images/progressImage.jpg"
</script>

<style>
    h1{
        font-size: 240px;
        font-style: normal;
        font-weight: 700;
        line-height: 100%; /* 247.555px */ 
    }
    h2{

font-family: Besley;
font-size: 55px;
font-style: normal;
font-weight: 400;
line-height: 125%; /* 68.75px */
    }

    .postcard-shadow{   
        box-shadow: 0 4px 4px 0 rgba(0, 0, 0, 0.15);
    }

    .inset-shadow::after {
  content: '';
  position: absolute;
  inset: 0;
  box-shadow: 0 2px 5px 0 rgba(0, 0, 0, 0.15) inset;
  pointer-events: none;
}
</style>

<section class="w-screen bg-paper pt-48 pb-24">
    <ContentWidth class="flex flex-row">
        <div class="w-1/2 flex flex-col">
            <h1 class="opacity-0">20</h1>
            <h2 class="opacity-0">for</h2>
            <h1 class="opacity-0 -mb-20">20</h1>
            <p class="w-4/5 max-w-md">As we step into our 20th year in business, our team has taken a moment to look back — revisiting the clients and projects that have shaped who we are today. From early partnerships to defining milestones, these 20 selections represent some of our favorite projects. The ones that refined our craft, deepened our client relationships, and shaped our approach to design and branding.</p>
            <div class="large-body text-primary w-4/5 max-w-md mt-8">Through it all, one constant has remained: clear stories brought to life through <span class="underline-offset-[25%] underline">compelling design.</span></div>
        </div>
        <div class="w-1/2 flex flex-col text-primary items-center">
            <div class="flex flex-col text-primary items-center relative">
                <h1>20</h1>
                <h2>for</h2>
                <iframe
                    title="background video"
                    src={`https://player.vimeo.com/video/1125997849?background=1&muted=1&loop=1&autoplay=1`}
                    class="aspect-square w-full mix-blend-multiply opacity-90 scale-110"
                    frameborder="0"
                    allowfullscreen
                ></iframe>
            </div>
        </div>
    </ContentWidth>
</section>

<section class="w-screen py-24">
    <ContentWidth class="flex flex-col md:flex-row">
        <div class="md:w-2/5">
            <p class="w-full max-w-sm">We’ll continue to build on this collection throughout the year, leading up to our 20th anniversary on October 2, 2026. Thanks for joining us on the journey!</p>
        </div>
        <div class="md:w-3/5 aspect-square p-10 pr-36">
            <div class="h-full w-full relative">
                <a href="/portfolio/progress-lighting" class="absolute top-0 left-12 w-full h-full bg-paper shadow-md shadow-black/20 hover:shadow-lg hover:shadow-black/40 p-9 hover:scale-[102%] hover:-translate-y-2 active:shadow-black/90 active:-translate-y-8 transition-all duration-200 ease-out -rotate-3">
                    <div class="w-full aspect-square relative inset-shadow">
                        <img src={progressImage} alt="stack of catalogs" class="w-full h-full object-cover " />
                        <h1 class="text-primary mix-blend-multiply absolute right-9 top-9">01</h1>
                    </div>
                    <div class="w-full flex flex-col gap-4 pt-6">
                        <h5 class="text-black">Progress Lightning</h5>
                        <div class="flex flex-row justify-between">
                            <p class="text-primary uppercase">Brand, Print, Packaging</p>
                            <p class="text-primary uppercase">2006-2022</p>
                        </div>
                    </div>
                </a>
            </div>
           
        </div>
    </ContentWidth>
</section>


<section class="w-screen py-48 md:h-[80vh] bg-paper-red flex flex-col items-center justify-center">
    <ContentWidth class="flex flex-col md:flex-row items-start justify-between">
        <AnimateIn>
        <h3 class="text-white md:w-3/5">It's time to arm your brand with a clear story and compelling design</h3>
        </AnimateIn>
        <AnimateIn>
        <a href="/contact">
            <DefaultButton class="mt-6 text-white border-white border-1 hover:bg-mid hover:bg-opacity-10" text="MEET WITH US" filled={false} />
        </a>
        </AnimateIn>
    </ContentWidth>
</section>