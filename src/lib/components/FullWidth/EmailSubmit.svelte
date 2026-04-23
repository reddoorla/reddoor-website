<script lang='ts'>
    import DefaultButton from "../Buttons/DefaultButton.svelte";
</script>

<form class="w-full flex items-center justify-center">
    <div class="flex flex-col md:flex-row text-light items-center justify-center">
        <div class="flex items-center justify-center">
        <i class="fa-regular fa-envelope h-5 -mr-8 z-10" style="color:#ffffff"></i>
        <input class=" w-80 sm:w-[400px] border-2 rounded-[3px] text-dark border-light h-10 pl-10 pt-[2.5px]" placeholder="Email" type="text"/>
        </div>
        <DefaultButton text="submit" click={()=>SubmitEvent} class="mt-4 md:mt-0 ml-[-10px] md:ml-[-128px] xl:ml-[-152px]"/>
    </div>
</form>
