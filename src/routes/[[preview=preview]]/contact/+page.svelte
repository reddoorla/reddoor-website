<script lang="ts">
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import { animateIn as anim } from "$lib/actions/animateIn";
  import { Turnstile } from "svelte-turnstile";
  import { fade } from "svelte/transition";

  let submitted = $state(false);
  let submitting = $state(false);
  let submitError: string | null = $state(null);

  const handleSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    if (submitting) return;

    const myForm = event.target as HTMLFormElement;
    const formData = new FormData(myForm);

    const formDataObject: Record<string, string> = {};
    formData.forEach((value, key) => {
      formDataObject[key] = value.toString();
    });

    submitting = true;
    submitError = null;

    try {
      const response = await fetch("/contact", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(formDataObject).toString(),
      });
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      myForm.reset();
      submitted = true;
    } catch {
      submitError =
        "Something went wrong sending your message. Please try again or email info@reddoorla.com.";
    } finally {
      submitting = false;
    }
  };
</script>

<svelte:head>
  <title>Contact | Reddoor Creative</title>
</svelte:head>

{#if submitted}
  <button
    class="h-screen w-screen fixed bg-black/20 z-50 flex justify-center items-center cursor-pointer"
    onclick={() => (submitted = false)}
    transition:fade
    aria-label="Close thank-you message"
  >
    <div class="w-[68vw] h-[68vh] bg-paper-red flex items-center justify-center p-32 relative">
      <i
        class="fa-solid fa-thin fa-close fa-2xl text-white hover:text-light transition absolute top-8 right-5"
        aria-hidden="true"
      ></i>
      <h4 class="text-white">
        Thanks for reaching out! <br /> <br />We'll get back to you as soon as we can.
      </h4>
    </div>
  </button>
{/if}

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
      <form
        class="h-full w-full mt-8 md:mt-0 md:w-2/3 flex flex-col gap-2 items-start md:pr-24"
        name="contact"
        method="POST"
        onsubmit={handleSubmit}
        data-netlify="true"
        data-netlify-honeypot="bot-field"
      >
        <Turnstile siteKey="0x4AAAAAAAh2fGW6xIcdsqNr" />

        <input type="hidden" name="form-name" value="contact" />
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
        <p class="hidden">
          <label>
            Don’t fill this out if you’re human: <input name="bot-field" />
          </label>
        </p>
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
        {#if submitError}
          <p role="alert" class="text-primary mt-2">{submitError}</p>
        {/if}
      </form>
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
