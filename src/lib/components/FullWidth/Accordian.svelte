<script lang='ts'>
    import { slide } from 'svelte/transition';
    import chevronRight from "$lib/assets/icons/chevron-right.svg"

    const LOREM = "Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat m dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor inc."

    interface Props {
        labels?: string[];
        contents?: string[];
    }

    let {
        labels = ["Is this thing on?", "It could be why don't you check"],
        contents = [LOREM, LOREM]
    }: Props = $props();

    const activeAccordians = $state(new Set<number>());

    const toggle = (i: number) => {
        if (activeAccordians.has(i)) activeAccordians.delete(i);
        else activeAccordians.add(i);
    };
  </script>

  <div class="w-full flex flex-col border-light border-b-2 cursor-pointer">
    {#each labels as label, i (label + i)}
      <button class="w-full border-t-2 border-light cursor-pointer" onclick={() => toggle(i)}>
        <div class="h-20 p-8 w-full flex flex-row justify-between items-center">
          <p class="text-left">{label}</p>
          <img src={chevronRight} alt="chevron right" class="transition-transform duration-300 ease-in-out h-5 opacity-80 hover:opacity-100 {activeAccordians.has(i) ? 'rotate-90' : ''}"/>
        </div>
        {#if activeAccordians.has(i)}
          <div transition:slide="{{ duration: 500 }}">
            <p class="text-left p-8 pt-0">{contents[i]}</p>
          </div>
        {/if}
      </button>
    {/each}
  </div>
