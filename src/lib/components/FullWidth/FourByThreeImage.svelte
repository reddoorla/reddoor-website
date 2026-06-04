<script lang="ts">
  import placeholder from "$lib/assets/images/image_placeholder.svg";
  import Img from "$lib/components/Img.svelte";

  // `img` is the object returned from `$lib/assets/images/...?as=run` imports.
  // Its type is generated at build time, so we intentionally accept `unknown`.
  interface Props {
    src?: string;
    img?: unknown;
    alt?: string;
    label?: string;
    class?: string;
  }

  let {
    src = placeholder,
    img,
    alt = "placeholder",
    label = "",
    class: className = "",
  }: Props = $props();

  const rotationAngle = "36.8";
  const crossLength = "125%";
  const isPlaceholder = $derived(!img && src === placeholder);
</script>

<div class="w-full my-8 relative {className}">
  <div
    class="w-full aspect-4/3 {isPlaceholder
      ? 'border-light border-2 bg-light/25'
      : ''}  rounded-xs flex items-center justify-center relative"
  >
    {#if img}
      <Img src={img} {alt} class="z-10 w-full" />
    {:else}
      <img {src} {alt} class="z-10 {isPlaceholder ? 'w-16 bg-[#F2F5F7]' : 'w-full'}" />
    {/if}
    <div
      class="absolute bg-light h-[2px] {isPlaceholder ? '' : 'hidden'}"
      style="transform: rotate({rotationAngle}deg); width:{crossLength}"
    ></div>
    <div
      class="absolute bg-light h-[2px] {isPlaceholder ? '' : 'hidden'}"
      style="transform: rotate(-{rotationAngle}deg); width:{crossLength}"
    ></div>
    <h6 class="absolute bottom-4 z-20">{label}</h6>
  </div>
</div>
