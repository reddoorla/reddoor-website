<script lang="ts">
    import Select from 'svelte-select'
    import dropdownArrow from "$lib/assets/icons/dropdown-arrow-light.svg"

    export let items:string[]|{label:string,value:string}[];
    export let value="";
    export let placeholder="";



    let selectHover=false;
</script>

<div class="max-w-[720px] w-full mx-auto cursor-pointer relative {$$props.class || ''}" role="separator" on:mouseover={()=> selectHover=true} on:focus={()=> selectHover=true} on:mouseout={()=> selectHover=false} on:blur={()=> selectHover=false} >
    <Select {items} bind:value={value} {placeholder} searchable={false} class="svelte-select" />
    <div class="absolute h-full aspect-square right-0 top-0 flex items-center justify-center pointer-events-none">
        <img src={dropdownArrow} alt="" aria-hidden="true" class:opacity-55={selectHover}  class=" transition-all pointer-events-none"/>

    </div>
</div>

