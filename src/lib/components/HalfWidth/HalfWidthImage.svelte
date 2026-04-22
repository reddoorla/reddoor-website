<script lang="ts">
    import placeholder from "$lib/assets/images/image_placeholder.svg"
    export let image = placeholder;


    let rotationAngle = "36.8";
    let crossLength = "125%";
</script>

<div class="w-full lg:w-1/2 my-8 {$$props.class || ''}">
    <div class="w-full aspect-4/3 {image===placeholder ? "border-light border-2 bg-light/25":""}  rounded-xs  flex items-center justify-center relative">
        <img src={image} alt="placeholder" class="z-10 {image==placeholder ? "w-16 bg-[#F2F5F7]" : "w-full"}"/>
        <div class="absolute bg-light h-[2px] {image===placeholder ? "":"hidden"}" style="transform: rotate({rotationAngle}deg); width:{crossLength}"></div>
        <div class="absolute bg-light h-[2px] {image===placeholder ? "":"hidden"}" style="transform: rotate(-{rotationAngle}deg); width:{crossLength}"></div>
    </div>
</div>