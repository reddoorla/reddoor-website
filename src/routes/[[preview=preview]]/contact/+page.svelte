<script lang="ts">
    import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
    import { Turnstile } from 'svelte-turnstile';
  import { fade } from "svelte/transition";

  import { page } from '$app/stores';

$: searchParams = $page.url.searchParams;


    </script>
<svelte:head>
    <title>Contact | Reddoor Creative</title>
</svelte:head>

{#if searchParams.get("submitted")||false}
<a class="h-screen w-screen fixed bg-black bg-opacity-20 z-50 flex justify-center items-center" href="/contact" transition:fade>
    


    <div class="w-[68vw] h-[68vh] bg-paper-red flex items-center justify-center p-32 relative">
        <i class="fa-solid fa-thin fa-close fa-2xl text-white hover:text-light transition absolute top-8 right-5" />
        <h4 class="text-white">Thanks for reaching out! <br/> <br/>We'll get back to you as soon as we can.</h4>
    </div>
</a>
{/if}

<div class="w-screen h-[50vh] max-h-96 relative bg-paper">
    <ContentWidth class="h-full flex flex-col justify-evenly items-start">

         <div class="h-32"/>
        <h4 class="text-primary z-10 md:ml-[20%]">We're excited to hear from you.</h4>
    </ContentWidth>
</div>
<div class="w-screen bg-white py-12">
    <ContentWidth class="flex flex-col md:flex-row mb-48">
        <h6 class="md:w-1/5 text-primary my-4">Via Phone</h6>
        <div class="w-full md:w-4/5 flex flex-col">
            <h5>Give us a ring to set something up:</h5>
            <div class="w-full flex flex-col md:flex-row">
                <div class="flex flex-col md:w-1/2">
                    <div class="large-body text-primary my-8">California Office</div>
                    <p>
                        Tim Holmes <br />
                        Creative Director <br />
                        +1  310-341-3571
                    </p>
                </div>
                <div class="flex flex-col w-1/2">
                    <div class="large-body text-primary my-8">Texas Office</div>
                    <p>
                        Erik Svendsen <br />
                        Creative Director <br />
                        +1 310-418-9976
                    </p>
                </div>

            </div>
        </div>
    </ContentWidth>
    <ContentWidth class="flex flex-col md:flex-row mb-48">
        <h6 class="md:w-1/5 text-primary my-4">Via Email</h6>
        <div class="w-full md:w-4/5 flex flex-col gap-8">
            <h5>Complete this form and we'll get back to you.</h5>
            <form class="w-full h-full flex flex-col md:flex-row px-8"  name="contact" method="POST" action="/contact?submitted=true" data-netlify="true"  data-netlify-honeypot="bot-field">
                <Turnstile siteKey="0x4AAAAAAAh2fGW6xIcdsqNr" />
                <input type="hidden" name="form-name" value="contact" />
                    <div class="h-full w-full mt-8 md:mt-0 md:w-2/3 flex flex-col gap-4 items-start">
                        <p>Name</p>
                        <input type="text" name="name" required placeholder="first and last name" class="w-full border-1 border-mid p-2" />
                        <p>Company Name</p>
                        <input type="text" name="company" placeholder="company name" class="w-full border-1 border-mid p-2" />
                        <p>Phone</p>
                        <input type="phone" name="phone" required placeholder="000-000-0000" class="w-full border-1 border-mid p-2" />
                        <p>Email</p>
                        <input type="email" name="email" required placeholder="you@domain.com" class="w-full border-1 border-mid p-2" />
                        <p class="hidden">
                            <label>
                              Don’t fill this out if you’re human: <input name="bot-field" />
                            </label>
                          </p>
                        <p>Message</p>
                        <textarea name="message" required placeholder="how can we help?" class="min-h-24 w-full border-1 border-mid p-1"/>
                        <input type="submit" value="LET'S CONNECT" class="text-primary border-b-2 hover:bg-primary hover:text-white p-3 font-bold border-primary bump cursor-pointer"/>
                    </div>
            
               </form>
           
        </div>
    </ContentWidth>

</div>