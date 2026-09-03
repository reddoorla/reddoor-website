<script lang="ts">
  import { page } from "$app/state";
  import { imgixSrc } from "$lib/utils/imgix";
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import { animateIn as anim } from "$lib/actions/animateIn";
  import { flip } from "svelte/animate";
  import { expoOut } from "svelte/easing";
  import arrowButton from "$lib/assets/icons/arrowButton.svg";
  import { mediumString } from "$lib/utils/projectServices";
  import type { LayoutData } from "./$types";

  // The one error boundary.
  //
  // The designed 404 used to live under the `[uid]` routes, in three identical
  // copies, and rendered only when one of those routes matched the URL and its
  // loader threw — so `/nope` got it and `/nope/deeper` got this file's old
  // plain "Error 404 / Back to home" text. No route matches a two-segment miss,
  // which lands on the root boundary, and the root boundary renders inside the
  // same layout with the same data (the four latest projects come from the root
  // layout load). One page here covers every 404 the site can produce.

  let { data }: { data: LayoutData } = $props();

  const notFound = $derived(page.status === 404);
  const projects = $derived(data.latestFourProjects.results);
  const title = $derived(notFound ? "Page not found" : "Something went wrong");
</script>

<svelte:head>
  <title>{"Reddoor Creative | " + title}</title>
  <meta name="robots" content="noindex" />
</svelte:head>

{#if notFound}
  <!-- The giant "404" is a watermark — a 20% tint of the brand red, which no
       text can pass a contrast check at. It is pure decoration, which WCAG
       exempts from contrast, so it is not text: CSS-generated content inside
       an aria-hidden wrapper. The page's real heading is the visually-hidden
       h1 below it. -->
  <div class="fixed top-0 left-0 h-screen w-screen" aria-hidden="true">
    <ContentWidth class="flex flex-row py-24 md:py-64">
      <p class="watermark text-primary/20"></p>
    </ContentWidth>
  </div>
  <section class="">
    <ContentWidth class="flex flex-col items-end py-24 md:py-48">
      <h1 class="sr-only">Page not found</h1>
      <h4 class="md:w-4/5">
        Nothing to see here...<br />Let’s get you back on track.
      </h4>

      <h6 class="mt-24 w-full text-primary md:mt-48 md:w-4/5">Enjoy our most recent work</h6>
      <div class="mt-12 flex w-full flex-row flex-wrap md:ml-[20%] md:w-4/5">
        {#each projects as project (project.uid)}
          <div
            animate:flip={{ duration: 4500, easing: expoOut }}
            class="relative aspect-4/3 w-full pb-6 transition-opacity duration-700 md:pr-6 lg:w-1/2"
          >
            <a
              href={"/portfolio/" + project.uid}
              class="relative flex h-full w-full flex-col justify-end"
            >
              <img
                src={imgixSrc(project.data.hero.url)}
                alt={project.data.title + " Hero Image"}
                class="absolute h-full w-full object-cover"
              />
              <div
                class="absolute top-0 left-0 h-full w-full transition-opacity duration-700 hover:opacity-60"
                style="background: linear-gradient(180deg, rgba(12, 19, 35, 0.15) 0%, rgba(12, 19, 35, 0.80) 81.09%) 50% / cover no-repeat;"
              ></div>

              <div
                use:anim={{ delayMax: 800 }}
                class="z-10 flex w-full flex-row justify-between p-6"
              >
                <div>
                  <p class="uppercase text-white">{project.data.title}</p>
                  <p class="text-light">{mediumString(project) || ""}</p>
                </div>
                <span class="bump transition brightness-200 hover:brightness-50" aria-hidden="true">
                  <img src={arrowButton} alt="" class="h-full" />
                </span>
              </div>
            </a>
          </div>
        {/each}
      </div>
    </ContentWidth>
  </section>
{:else}
  <section
    class="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 py-32 text-center text-black"
  >
    <h2>Error {page.status}</h2>
    <h1>Something went wrong</h1>
    <p class="max-w-150">
      {page.error?.message ?? "An unexpected error occurred. Please try again."}
    </p>
    <a href="/" class="underline">Back to home</a>
  </section>
{/if}

<style>
  .watermark::before {
    content: "404";
  }

  .watermark {
    margin: 0;
    font-family: Pragmatica;
    font-size: 200px;
    font-style: normal;
    font-weight: 400;
    line-height: 100%; /* 200px */
  }

  @media only screen and (max-width: 1024px) {
    h4 {
      font-size: 36px;
    }
  }
</style>
