<script lang="ts">
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import { animateIn as anim } from "$lib/actions/animateIn";
  import { enhance } from "$app/forms";
  import type { PageData, ActionData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();
  let submitting = $state(false);
</script>

<svelte:head>
  <title>Contact | Reddoor Creative</title>
</svelte:head>

<div class="w-screen h-[50vh] max-h-96 relative bg-paper">
  <ContentWidth class="h-full flex flex-col justify-evenly items-start">
    <div class="h-32"></div>
    <h4 class="text-primary z-10 md:ml-[20%]">We're excited to hear from you.</h4>
  </ContentWidth>
</div>
<div class="w-screen bg-white py-12">
  <ContentWidth class="flex flex-col md:flex-row mb-48" animateIn>
    <h6 class="md:w-1/5 text-primary my-4">Via Phone</h6>
    <div class="w-full md:w-4/5 flex flex-col">
      <h5>Give us a ring to set something up:</h5>
      <div class="w-full flex flex-col md:flex-row">
        <div use:anim class="flex flex-col md:w-1/2">
          <div class="large-body text-primary my-8">California Office</div>
          <p>
            Tim Holmes <br />
            Creative Director <br />
            +1 310-341-3571
          </p>
        </div>
        <div use:anim class="flex flex-col w-1/2">
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
  <ContentWidth class="flex flex-col md:flex-row mb-48" animateIn>
    <h6 class="md:w-1/5 text-primary my-4">Via Email</h6>
    <div class="w-full md:w-4/5 flex flex-col gap-8">
      <h5>Complete this form and we'll get back to you.</h5>
      {#if form?.success}
        <p class="text-primary mt-2">
          Thanks — your message is on its way. We'll be in touch shortly.
        </p>
      {:else}
        <form
          class="h-full w-full mt-8 md:mt-0 md:w-2/3 flex flex-col gap-2 items-start md:pr-24"
          method="POST"
          use:enhance={() => {
            submitting = true;
            return async ({ update }) => {
              await update({ reset: true });
              submitting = false;
            };
          }}
        >
          <input type="hidden" name="ts" value={data.formTs} />
          <p class="hidden" aria-hidden="true">
            <label
              >Don't fill this out if you're human: <input
                name="bot-field"
                tabindex="-1"
                autocomplete="off"
              /></label
            >
          </p>
          <div use:anim class="w-full">
            <p>Name</p>
            <input
              type="text"
              name="name"
              required
              placeholder="first and last name"
              class="w-full border-1 border-mid p-2 mb-4"
            />
          </div>
          <div use:anim class="w-full">
            <p>Company Name</p>
            <input
              type="text"
              name="company"
              placeholder="company name"
              class="w-full border-1 border-mid p-2 mb-4"
            />
          </div>
          <div use:anim class="w-full">
            <p>Phone</p>
            <input
              type="phone"
              name="phone"
              required
              placeholder="000-000-0000"
              class="w-full border-1 border-mid p-2 mb-4"
            />
          </div>
          <div use:anim class="w-full">
            <p>Email</p>
            <input
              type="email"
              name="email"
              required
              placeholder="you@domain.com"
              class="w-full border-1 border-mid p-2 mb-4"
            />
          </div>
          <div use:anim class="w-full">
            <p>Message</p>
            <textarea
              name="message"
              required
              placeholder="how can we help?"
              class="min-h-24 w-full border-1 border-mid p-1 mb-4"
            ></textarea>
          </div>
          <div use:anim>
            <input
              type="submit"
              value={submitting ? "SENDING…" : "LET'S CONNECT"}
              disabled={submitting}
              class="text-primary border-b-2 hover:bg-primary hover:text-white p-3 font-bold border-primary bump cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
          {#if form?.error}
            <p role="alert" class="text-primary mt-2">{form.error}</p>
          {/if}
        </form>
      {/if}
    </div>
  </ContentWidth>
</div>

<!-- footer -->
<div class="w-screen py-40 md:h-[80vh] bg-paper-red flex flex-col items-center justify-center">
  <ContentWidth class="flex flex-col md:flex-row items-start justify-between">
    <div use:anim>
      <h3 class="text-white md:w-3/5">
        Isn’t it time to arm your brand with a clear story and compelling design?
      </h3>
    </div>
  </ContentWidth>
</div>
