<script lang='ts'>
    import { fade } from "svelte/transition";
    import TestimonialBox from "./TestimonialBox.svelte";
    import type { ComponentProps } from "svelte";
    import arrow from "$lib/assets/icons/wireframe-link-arrow-right.svg"

    interface Props {
        testimonialBoxPropsArray?: ComponentProps<typeof TestimonialBox>[];
    }

    let {
        testimonialBoxPropsArray = [
            {
                icon: "",
                float: "left",
                testimonialText: "Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi.",
                attribution: "John Smith",
                attributionLabel: "a trustworthy person",
                image: "/"
            },
            {
                icon: "",
                float: "left",
                testimonialText: "Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi.",
                attribution: "Jane Baker",
                attributionLabel: "a knowledgable person"
            }
        ]
    }: Props = $props();

    let sliderIndex = $state(0);

    const slideLeft = () => {
        if (sliderIndex === testimonialBoxPropsArray.length - 1)
            sliderIndex = -1;
        sliderIndex++;
    };

    const slideRight = () => {
        if (sliderIndex == 0)
            sliderIndex = testimonialBoxPropsArray.length;
        sliderIndex--;
    };
</script>



  {#key sliderIndex}
  <div in:fade={{delay:400}} out:fade class="h-full md:py-12 z-0 w-full">

    <TestimonialBox {...testimonialBoxPropsArray[sliderIndex]} />
    <div class="h-6 w-full flex justify-between z-10 mt-12 mb-6">
      <button onclick={slideRight} class="h-6 w-6 rounded-full p-1 flex align-middle justify-center cursor-pointer transition-all duration-300 active:-translate-y-2  hover:bg-primary ">
        <img alt='chevron-left' src={arrow} class='-translate-x-px rotate-180 opacity-40 hover:opacity-100 ' />
      </button>
      <button onclick={slideLeft} class="h-6 w-6 rounded-full p-1 flex align-middle cursor-pointer transition-all duration-300 active:-translate-y-2 justify-center hover:bg-primary ">
        <img alt='chevron-right' src={arrow} class='opacity-40 hover:opacity-100 translate-x-px' />
      </button>
    </div>

    <img class="w-full aspect-4/3" src={testimonialBoxPropsArray[sliderIndex].image} alt="testimonial"/>
  </div>

  {/key}
