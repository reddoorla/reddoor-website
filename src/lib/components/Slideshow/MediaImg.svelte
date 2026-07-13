<script lang="ts">
  import { mediaImgAttrs } from "$lib/utils/mediaSrcset";

  let {
    url,
    alt = "",
    sizes = "(min-width: 1024px) 50vw, 100vw",
    class: className = "",
  }: {
    url: string;
    alt?: string;
    sizes?: string;
    class?: string;
  } = $props();

  const attrs = $derived(mediaImgAttrs(url, { sizes }));
</script>

<img
  src={attrs.src}
  srcset={attrs.srcset}
  sizes={attrs.sizes}
  {alt}
  loading="lazy"
  decoding="async"
  class="object-cover {className}"
/>
