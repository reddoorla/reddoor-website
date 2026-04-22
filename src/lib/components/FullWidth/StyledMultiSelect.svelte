<script lang="ts">
    import Select from 'svelte-select'
    import dropdownArrow from "$lib/assests/icons/dropdown-arrow-light.svg"

    export let activeFilters=[''];
    export let filters = ['']

    let selectHover=false;
</script>
<div class="max-w-[720px] w-full mx-auto cursor-pointer relative" role="separator" on:mouseover={()=> selectHover=true} on:focus={()=> selectHover=true} on:mouseout={()=> selectHover=false} on:blur={()=> selectHover=false} >
    <Select items={filters} bind:value={activeFilters} placeholder="Type of Project" multiple={true} searchable={false} class="svelte-select" />
    <div class="absolute h-full aspect-square right-0 top-0 flex items-center justify-center pointer-events-none">
        <img src={dropdownArrow} alt="" aria-hidden="true" class:opacity-55={selectHover}  class=" transition-all pointer-events-none"/>

    </div>
</div>

