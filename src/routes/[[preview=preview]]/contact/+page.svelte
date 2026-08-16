<script lang="ts">
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import { animateIn as anim } from "$lib/actions/animateIn";
  import { enhance } from "$app/forms";
  import { env } from "$env/dynamic/public";
  import { loadTurnstile } from "$lib/turnstile";
  import type { PageData, ActionData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();
  let submitting = $state(false);

  // Optional Cloudflare Turnstile. Dark until PUBLIC_TURNSTILE_SITE_KEY is set;
  // trimmed so a stray-whitespace value stays dark. Rendered explicitly by the
  // effect below (works on full load AND SPA nav). Its hidden `cf-turnstile-response`
  // input is forwarded to the central ingest by +page.server.ts.
  const turnstileSiteKey = env.PUBLIC_TURNSTILE_SITE_KEY?.trim();
  let turnstileEl = $state<HTMLDivElement>();

  $effect(() => {
    const el = turnstileEl;
    if (!turnstileSiteKey || !el) return;
    let widgetId: string | undefined;
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !el.isConnected) return;
        widgetId = turnstile.render(el, { sitekey: turnstileSiteKey });
      })
      .catch((err) => {
        // Offline / blocked / CSP / misconfigured sitekey: central ingest is
        // fail-open, so a missing token degrades to honeypot + timing + heuristic
        // scoring, never a dropped lead. Warn so an operator can triage.
        console.warn("[turnstile] widget did not render:", err);
      });
    return () => {
      cancelled = true;
      if (widgetId !== undefined) {
        try {
          window.turnstile?.remove(widgetId);
        } catch {
          // Widget already torn down (e.g. by navigation) — nothing to clean up.
        }
      }
    };
  });
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
        <!-- role="status": announces the confirmation to screen readers (and is
             the success signal the fleet form-e2e probe waits for). -->
        <p role="status" class="text-primary mt-2">
          Thanks — your message is on its way. We'll be in touch shortly.
        </p>
      {:else}
        <!-- `inquire` is the no-JS destination for the industry landing pages'
             CTAs: they link to /contact#inquire, and the inquiry modal
             intercepts that click when JS is available. Without JS the link
             still lands on a real, working form instead of doing nothing. -->
        <form
          id="inquire"
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
          <!-- Real <label for> elements (fields were named by adjacent <p> +
               placeholder only — invisible to AT). The utility classes replicate
               the base <p> typography so nothing moves visually. -->
          <div use:anim class="w-full">
            <label for="contact-name" class="block text-[18px] font-extralight leading-7.5">
              Name
            </label>
            <input
              type="text"
              id="contact-name"
              name="name"
              required
              autocomplete="name"
              placeholder="first and last name"
              class="w-full border-1 border-mid p-2 mb-4"
            />
          </div>
          <div use:anim class="w-full">
            <label for="contact-company" class="block text-[18px] font-extralight leading-7.5">
              Company Name
            </label>
            <input
              type="text"
              id="contact-company"
              name="company"
              autocomplete="organization"
              placeholder="company name"
              class="w-full border-1 border-mid p-2 mb-4"
            />
          </div>
          <div use:anim class="w-full">
            <label for="contact-phone" class="block text-[18px] font-extralight leading-7.5">
              Phone
            </label>
            <!-- type="tel", not the invalid type="phone" — mobile keyboards get the tel keypad. -->
            <input
              type="tel"
              id="contact-phone"
              name="phone"
              required
              autocomplete="tel"
              placeholder="000-000-0000"
              class="w-full border-1 border-mid p-2 mb-4"
            />
          </div>
          <div use:anim class="w-full">
            <label for="contact-email" class="block text-[18px] font-extralight leading-7.5">
              Email
            </label>
            <input
              type="email"
              id="contact-email"
              name="email"
              required
              autocomplete="email"
              placeholder="you@domain.com"
              class="w-full border-1 border-mid p-2 mb-4"
            />
          </div>
          <div use:anim class="w-full">
            <label for="contact-message" class="block text-[18px] font-extralight leading-7.5">
              Message
            </label>
            <textarea
              id="contact-message"
              name="message"
              required
              placeholder="how can we help?"
              class="min-h-24 w-full border-1 border-mid p-1 mb-4"></textarea>
          </div>
          {#if turnstileSiteKey}
            <div class="w-full mb-4">
              <!-- Cloudflare Turnstile mount point; the effect renders it explicitly
                   and injects a hidden `cf-turnstile-response` input the action forwards. -->
              <div class="cf-turnstile" bind:this={turnstileEl}></div>
            </div>
          {/if}
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
