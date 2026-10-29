<script lang="ts">
  import arrowButton from "$lib/assets/icons/arrowButton.svg";
  import { imgixSrc, imgixSrcset } from "$lib/utils/imgix";

  /**
   * A portfolio tile: the project's hero under the navy wash, its name and
   * services, and the arrow. One link to /portfolio/<uid>. Shared by
   * /portfolio's grid and the booked page's "Check out Our Work", so the two
   * stay one design. Fills its parent; the parent sets the size.
   */
  interface Props {
    uid: string;
    title: string;
    heroUrl: string | null | undefined;
    services: string;
    sizes?: string;
  }

  let {
    uid,
    title,
    heroUrl,
    services,
    sizes = "(min-width: 1024px) 50vw, 100vw",
  }: Props = $props();
</script>

<a href={"/portfolio/" + uid} class="h-full w-full flex flex-col justify-end relative">
  <img
    src={imgixSrc(heroUrl)}
    srcset={imgixSrcset(heroUrl)}
    {sizes}
    alt={title + " Hero Image"}
    class="absolute w-full h-full object-cover"
    loading="lazy"
    decoding="async"
    fetchpriority="low"
  />
  <div
    class="w-full h-full absolute top-0 left-0 hover:opacity-60 transition-opacity duration-700"
    style="background: linear-gradient(180deg, rgba(12, 19, 35, 0.15) 0%, rgba(12, 19, 35, 0.80) 81.09%) 50% / cover no-repeat;"
  ></div>

  <div class="w-full flex flex-row justify-between p-6 z-10">
    <div>
      <p class="text-white uppercase">{title}</p>
      <p class="text-light">{services}</p>
    </div>
    <span class="brightness-200 hover:brightness-50 transition bump" aria-hidden="true">
      <img src={arrowButton} alt="" class="h-full" />
    </span>
  </div>
</a>
