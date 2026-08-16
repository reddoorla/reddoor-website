<script lang="ts">
  import { SliceZone } from "@prismicio/svelte";
  import type { PageData } from "./$types";

  import { components } from "$lib/slices";
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import DefaultButton from "$lib/components/Buttons/DefaultButton.svelte";
  import InquiryModal from "$lib/components/InquiryModal.svelte";
  import { animateIn as anim } from "$lib/actions/animateIn";

  let { data }: { data: PageData } = $props();
</script>

<!-- The band rhythm for industry landing pages is a property of the PAGE TYPE,
     not of each document: the Figma board fixes the vertical spacing between
     bands, and an editor should not be able to get it wrong (or have to get it
     right) one slice at a time. `data-band-rhythm` hands that context to the
     rules in app.css, which derive each band's padding from the slice type and
     its neighbours — see "Industry landing-page band rhythm" there.

     `display: contents` so this wrapper is invisible to layout: the slices'
     own `w-screen` / `w-full` sections keep resolving against the same parent
     they did before, and nothing shifts on `page` documents. -->
<div class="contents" data-band-rhythm={data.docType}>
  <SliceZone slices={data.page.data.slices} {components} />
</div>

{#if data.docType === "industry"}
  <!-- Industry landing pages route every CTA into one email-capture modal rather
       than off to /contact (MED-16 follow-up). Mounted once here and driven by
       delegation: any link whose href is `#inquire` opens it, so no slice needs
       to know the modal exists and content controls which CTAs use it. -->
  <InquiryModal />
{/if}

{#if data.docType === "page"}
  <!-- footer CTA (marketing pages only — industry landing pages carry their own cta_banner slice) -->
  <div class="w-screen py-40 md:h-[80vh] bg-paper-red flex flex-col items-center justify-center">
    <ContentWidth class="flex flex-col md:flex-row items-start justify-between">
      <h3 class="text-white md:w-3/5">
        Isn’t it time to arm your brand with a clear story and compelling design?
      </h3>
      <div use:anim={{ delayMax: 1600 }}>
        <a href="/contact">
          <DefaultButton
            class="mt-6 text-white border-white border-1 hover:bg-mid/10"
            text="MEET WITH US"
            filled={false}
          />
        </a>
      </div>
    </ContentWidth>
  </div>
{/if}
