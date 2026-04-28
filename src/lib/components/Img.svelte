<script lang="ts">
  import SvelteImg from "@zerodevx/svelte-img";

  type Props = {
    src: unknown;
    class?: string;
    [key: string]: unknown;
  };

  let { src, class: className = "", ...rest }: Props = $props();

  let imgEl: HTMLImageElement | undefined = $state();
  let loaded = $state(false);

  $effect(() => {
    const el = imgEl;
    if (!el) return;
    if (el.complete && el.naturalWidth > 0) {
      loaded = true;
      return;
    }
    const onDone = () => (loaded = true);
    el.addEventListener("load", onDone);
    el.addEventListener("error", onDone);
    return () => {
      el.removeEventListener("load", onDone);
      el.removeEventListener("error", onDone);
    };
  });
</script>

<SvelteImg
  {src}
  {...rest}
  bind:ref={imgEl}
  class={`progressive-img${loaded ? " progressive-img--loaded" : ""}${className ? " " + className : ""}`}
/>
