<script lang="ts">
    interface Social {
        platform: string;
        href: string;
    }

    interface Props {
        socials?: Social[];
    }

    let { socials = [{ platform: "", href: "" }] }: Props = $props();
</script>

        <div class="h-full flex flex-row items-center justify-center transition-opacity">
            {#each socials as social (social.platform + social.href)}

                <a href={social.href} class="mx-6 w-6 h-6 hover:opacity-75 transition-all bump">
                    {#if social.platform==='facebook'}
                        <i class="fa-brands fa-facebook fa-2x"></i>
                    {:else if social.platform=='twitter'}
                        <i class="fa-brands fa-twitter fa-2x"></i>
                    {:else if social.platform=='reddit'}
                        <i class="fa-brands fa-reddit fa-2x"></i>
                    {:else if social.platform=='instagram'}
                        <i class="fa-brands fa-instagram fa-2x"></i>
                    {:else if social.platform=='linkedin'}
                        <i class="fa-brands fa-linkedin fa-2x"></i>
                    {/if}

                </a>

            {/each}
        </div>
