<script lang="ts">
    import profile_placeholder from "$lib/assets/images/profile_placeholder.jpeg"

    interface Social {
        platform: string;
        href: string;
    }

    interface Props {
        src?: string;
        alt?: string;
        href?: string;
        name?: string;
        title?: string;
        socials?: Social[];
    }

    let {
        src = profile_placeholder,
        alt = "profile picture placeholder",
        href = "",
        name = "",
        title = "",
        socials = [{ platform: "", href: "" }]
    }: Props = $props();
</script>

{#if href}
<div class="group w-full h-full relative">
    <a {href} class="block w-full h-full">
        <img {src} {alt} class="w-full h-full object-cover"/>
    </a>
    <div class="pointer-events-none w-full h-full absolute top-0 left-0 flex flex-col items-center justify-center bg-dark/75 opacity-0 group-hover:opacity-100 transition-all duration-500 ease-fast-slow">
        <div class="h-2"></div>
        <h5 class="text-white my-3">{name}</h5>
        <p class="text-light my-3">{title}</p>
        <div class="pointer-events-auto h-6 my-3 flex flex-row items-center justify-center transition-opacity">
            {#each socials as social (social.platform + social.href)}

                <a href={social.href} class="mx-6 w-6 h-6 hover:opacity-75 transition-all bump">
                    {#if social.platform==='facebook'}
                        <i class="fa-brands fa-facebook fa-inverse fa-2x"></i>
                    {:else if social.platform=='twitter'}
                        <i class="fa-brands fa-twitter fa-inverse fa-2x"></i>
                    {:else if social.platform=='reddit'}
                        <i class="fa-brands fa-reddit fa-inverse fa-2x"></i>
                    {:else if social.platform=='instagram'}
                        <i class="fa-brands fa-instagram fa-inverse fa-2x"></i>
                    {/if}

                </a>

            {/each}
        </div>
    </div>
</div>

 {:else}
<div class="w-full h-full relative">
    <img {src} {alt} class="w-full h-full object-cover"/>
    <div class="w-full h-full absolute top-0 left-0 flex flex-col items-center justify-center bg-dark/75 opacity-0 hover:opacity-100 transition-all duration-500 ease-fast-slow">
        <div class="h-2"></div>
        <h5 class="text-white my-3">{name}</h5>
        <p class="text-light my-3">{title}</p>
        <div class="h-6 my-3 flex flex-row items-center justify-center ">
            {#each socials as social (social.platform + social.href)}
            <a href={social.href} class="mx-6 w-6 h-6 hover:opacity-75 transition-all bump">
                {#if social.platform==='facebook'}
                    <i class="fa-brands fa-facebook fa-inverse fa-2x"></i>
                {:else if social.platform=='twitter'}
                    <i class="fa-brands fa-twitter fa-inverse fa-2x"></i>
                {:else if social.platform=='reddit'}
                    <i class="fa-brands fa-reddit fa-inverse fa-2x"></i>
                {:else if social.platform=='instagram'}
                    <i class="fa-brands fa-instagram fa-inverse fa-2x"></i>
                {/if}

            </a>

            {/each}
        </div>
    </div>
</div>
 {/if}
