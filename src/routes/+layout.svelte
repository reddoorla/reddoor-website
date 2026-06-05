<script lang="ts">
  import { PrismicPreview } from "@prismicio/svelte/kit";
  import { page } from "$app/state";
  import { repositoryName } from "$lib/prismicio";

  import "../app.css";

  import { fly, fade } from "svelte/transition";
  import { afterNavigate, disableScrollHandling } from "$app/navigation";

  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";

  import { isInHero } from "$lib/stores/isInHero.svelte";
  import LandscapeModal from "$lib/components/LandscapeModal.svelte";

  import rotatingReddoor from "$lib/assets/icons/logos/drawnReddoors.gif";
  import scriptReddoor from "$lib/assets/icons/logos/staticReddoor.png";
  import type { Snippet } from "svelte";

  const NAV_LINKS = [
    { label: "Portfolio", href: "/portfolio" },
    { label: "About", href: "/about" },
    { label: "20 for 20", href: "/twenty-for-twenty" },
    { label: "Meet With Us", href: "/contact" },
  ];

  interface Props {
    data: { pathname: string; [key: string]: unknown };
    children?: Snippet;
  }

  let { data, children }: Props = $props();

  let isOverlayVisible = $state(false);
  let scrollY = $state(0);

  const toggleOverlayOn = () => (isOverlayVisible = true);
  const toggleOverlayOff = () => (isOverlayVisible = false);

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Reddoor Creative",
    url: "https://www.reddoorla.com",
    sameAs: [
      "https://www.linkedin.com/company/reddoor-creative",
      "https://www.instagram.com/reddoorla/",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+1-310-341-3571",
      contactType: "customer service",
      email: "info@reddoorla.com",
      areaServed: "US",
    },
    address: {
      "@type": "PostalAddress",
      streetAddress: "29027 Dapper Dan Dr.",
      addressLocality: "Fair Oaks Ranch",
      addressRegion: "TX",
      postalCode: "78015",
      addressCountry: "US",
    },
  };

  const showNav = $derived(
    page.status === 404 || scrollY > 300 || page.url.pathname.includes("about"),
  );

  // Every load resolves meta_image to a URL string (Prismic URLs are absolute;
  // imported-asset paths are root-relative). OG/Twitter need an absolute URL.
  const metaImageUrl = $derived.by(() => {
    const img = page.data.meta_image;
    if (typeof img !== "string" || !img) return undefined;
    return img.startsWith("http") ? img : new URL(img, page.url.origin).href;
  });

  function disableScrollRestoration() {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    // Smooth-scroll CSS turns this into an animation that would fight any
    // hash-target scroll the page sets in its own $effect.
    if (typeof window !== "undefined" && window.location.hash) return;
    window.scrollTo(0, 0);
  }

  $effect(() => {
    disableScrollRestoration();
  });

  afterNavigate(() => {
    disableScrollHandling();
    if (typeof window !== "undefined" && window.location.hash) return;
    setTimeout(() => {
      scrollTo({ top: 0, behavior: "instant" });
    }, 600);
  });
</script>

<svelte:window bind:scrollY />

<svelte:head>
  <title>{page.data.title ?? "Reddoor"}</title>
  {#if page.data.meta_description}
    <meta name="description" content={page.data.meta_description} />
  {/if}
  {#if page.data.meta_title}
    <meta name="og:title" content={page.data.meta_title} />
  {/if}
  {#if metaImageUrl}
    <meta name="og:image" content={metaImageUrl} />
    <meta name="twitter:card" content="summary_large_image" />
  {/if}
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <!-- JSON-LD assembled via concatenation so the Svelte ESLint parser doesn't see a literal </script> tag -->
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html "<" +
    'script type="application/ld+json">' +
    JSON.stringify(organizationJsonLd) +
    "</" +
    "script>"}
</svelte:head>

{#if isOverlayVisible}
  <div
    class="w-screen h-lvh fixed inset-0 bg-paper z-30 overflow-hidden"
    transition:fly={{ y: "-100%" }}
  >
    <div class="flex items-start justify-between px-6 md:px-20 py-2.5">
      <a
        href="/"
        onclick={toggleOverlayOff}
        class="block w-30 md:w-37.75 mix-blend-multiply opacity-85"
        aria-label="Reddoor home"
      >
        <img src={scriptReddoor} alt="Reddoor" class="w-full h-auto block" />
      </a>
      <button
        class="text-black opacity-95 hover:opacity-100 transition mt-3"
        onclick={toggleOverlayOff}
        aria-label="Close menu"
      >
        <i class="fa-sharp fa-thin fa-xmark fa-2xl"></i>
      </button>
    </div>

    <div
      class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-8 md:gap-10 opacity-85"
    >
      {#each NAV_LINKS as item (item.href)}
        {@const isActive =
          item.href === "/"
            ? page.url.pathname === "/"
            : page.url.pathname === item.href || page.url.pathname.startsWith(item.href + "/")}
        <a
          href={item.href}
          onclick={toggleOverlayOff}
          class="relative text-primary py-2 whitespace-nowrap font-['Besley'] text-[40px] md:text-[60px] leading-tight after:content-[''] after:absolute after:left-0 after:right-0 after:bottom-0 after:h-[1.5px] after:bg-primary after:origin-left after:transition-transform after:duration-300 after:ease-out {isActive
            ? 'after:scale-x-100'
            : 'after:scale-x-0 hover:after:scale-x-100'}"
        >
          {item.label}
        </a>
      {/each}
    </div>
  </div>
{/if}
<LandscapeModal />
{#key data.pathname}
  <main out:fade={{ duration: 500 }} in:fade={{ delay: 700, duration: 700 }}>
    {#if !showNav && !isInHero.value}
      <div
        class="h-12 w-screen top-0 absolute z-20 bg-transparent {data.pathname.includes(
          'portfolio/',
        ) || data.pathname.includes('about')
          ? 'text-white'
          : 'text-black'}"
        transition:fly={{ y: -64, delay: 200 }}
      >
        <ContentWidth class="flex flex-row justify-between items-center h-full">
          <a href="/" class="hover:opacity-80 transition-all duration-500 bump label">
            Reddoor Creative
          </a>

          <div class="flex flex-row">
            <div class="hidden lg:flex flex-row justify-between items-center gap-10">
              {#each NAV_LINKS as item (item.href)}
                <a
                  class="label hover:opacity-80 transition-opacity"
                  href={item.href}
                  onclick={() => (isOverlayVisible = false)}>{item.label}</a
                >
              {/each}
            </div>

            <button
              class="lg:hidden ml-6 opacity-60 hover:opacity-100 transition-all"
              onclick={toggleOverlayOn}
              aria-label="Open menu"
            >
              {#if !isOverlayVisible}
                <i class="fa-sharp fa-thi fa-bars fa-2xl"></i>
              {/if}
            </button>
          </div>
        </ContentWidth>
      </div>
    {/if}
    <!-- nav #2 -->
    {#if showNav && !isInHero.value}
      <div
        class="h-12 w-screen top-0 fixed z-20 bg-white/80"
        transition:fly={{ y: -64, delay: 500 }}
      >
        <ContentWidth class="flex flex-row justify-between items-center h-full">
          <a href="/" class="hover:opacity-80 transition-all duration-500 bump label">
            Reddoor Creative
          </a>

          <div class="flex flex-row">
            <div class="hidden lg:flex flex-row justify-between items-center gap-10">
              {#each NAV_LINKS as item, i (item.href)}
                {#if i < NAV_LINKS.length - 1}
                  <a class="label" href={item.href} onclick={() => (isOverlayVisible = false)}
                    >{item.label}</a
                  >
                {:else}
                  <a
                    class="text-primary label"
                    href={item.href}
                    onclick={() => (isOverlayVisible = false)}>{item.label}</a
                  >
                {/if}
              {/each}
            </div>

            <button
              class="lg:hidden ml-6 opacity-60 hover:opacity-100 transition-all"
              onclick={toggleOverlayOn}
              aria-label="Open menu"
            >
              {#if !isOverlayVisible}
                <i class="fa-sharp fa-bars fa-2xl"></i>
              {/if}
            </button>
          </div>
        </ContentWidth>
      </div>
    {/if}

    {@render children?.()}

    <footer class="relative bg-paper">
      <div class="w-full h-full absolute top-0 left-0 bg-paper"></div>

      <ContentWidth class="pb-4 flex flex-row justify-end items-end z-20 relative">
        <div class="flex flex-col tracking-wide label gap-8 w-full md:w-1/3 lg:w-1/5">
          <div class="flex flex-col gap-1">
            <a href="/" class="translate-x-[-8%] w-3/5 md:w-full"
              ><img src={rotatingReddoor} alt="reddoor drawn in multiple styles" /></a
            >
            <a href="/portfolio" class="text-primary underline">Portfolio</a>
            <a href="/about" class="text-primary underline">About</a>
            <a href="/contact" class="text-primary underline">Meet with Us</a>
            <a
              href="https://www.linkedin.com/company/reddoor-creative"
              class="text-primary underline">LinkedIn</a
            >
            <a href="https://www.instagram.com/reddoorla/" class="text-primary underline"
              >Instagram</a
            >
          </div>
          <div class="flex flex-col">
            <div>CONTACT</div>
            <a href="tel:3103413571" class="text-primary underline">+1 310-341-3571</a>
            <a href="mailto:info@reddoorla.com" class="text-primary underline">info@reddoorla.com</a
            >
          </div>
          <div class="flex flex-col">
            <div>HQ MAILING ADDRESS</div>
            <div>29027 Dapper Dan Dr.</div>
            <div>Fair Oaks Ranch, TX 78015</div>
          </div>
          <div class="label text-nowrap">
            {"© Reddoor Creative 2006-" + new Date().getFullYear() + ", All Rights Reserved"}
          </div>
        </div>
      </ContentWidth>
    </footer>
  </main>
{/key}

<PrismicPreview {repositoryName} />
