<script lang="ts">
  import { onMount, tick } from "svelte";
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import SendingDots from "$lib/components/SendingDots.svelte";

  /**
   * Where GHL's unsubscribe view lands someone once it has taken them off the
   * list. Replaces go.reddoorla.com/unsubscribe.
   *
   * This page confirms; it does not unsubscribe. The suppression itself stays
   * with GHL's own tooling, which is the record of who asked us to stop — a
   * second home-grown way to suppress someone is a second thing to get wrong
   * about a legal obligation. The only thing here that writes is the recovery
   * form, and it only ever opts back IN.
   */

  let email = $state("");
  let botField = $state("");
  let openedAt = 0;
  let submitting = $state(false);
  let error = $state("");
  let done = $state(false);
  let doneEl = $state<HTMLElement>();

  onMount(() => {
    openedAt = Date.now();
  });

  async function resubscribe(e: SubmitEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      error = "Please provide a valid email address.";
      document.getElementById("resub-email")?.focus();
      return;
    }
    submitting = true;
    error = "";
    try {
      const res = await fetch("/api/email-preferences", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), botField, ts: openedAt }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        error = data?.error ?? "Something went wrong. Please try again.";
        return;
      }
      done = true;
      await tick();
      doneEl?.focus();
    } catch {
      error = "Something went wrong. Please try again or email info@reddoorla.com.";
    } finally {
      submitting = false;
    }
  }
</script>

<div class="w-screen h-[50vh] max-h-96 relative bg-paper">
  <ContentWidth class="h-full flex flex-col justify-evenly items-start">
    <div class="h-32"></div>
    <h1 class="type-hero text-primary z-10 md:ml-[20%]">
      {#if done}
        You're back on the list.
      {:else}
        You're unsubscribed.
      {/if}
    </h1>
  </ContentWidth>
</div>

<div class="w-screen bg-white py-16">
  <ContentWidth class="flex flex-col md:flex-row gap-8 mb-32">
    <h2 class="type-kicker md:w-1/5 text-primary shrink-0">
      {done ? "Thanks for coming back" : "Email preferences"}
    </h2>

    <div class="w-full md:w-4/5 max-w-2xl">
      {#if done}
        <!-- role="status" alone would not announce: the element is inserted
             already holding its text, and a live region only speaks for text
             added after it exists. Focus is moved here as well. -->
        <div class="done" role="status" tabindex="-1" bind:this={doneEl}>
          <p class="body">
            We've turned your emails back on. You'll hear from us the next time we have something
            worth sending.
          </p>
          <p class="body">
            <a class="text-primary underline" href="/">Back to the site</a>
          </p>
        </div>
      {:else}
        <p class="lede">
          That's done — you won't get marketing emails from us any more. Nothing else changes: if
          you've got a call booked, its confirmation and reminders still come through, and you can
          still reply to anything we've already sent.
        </p>

        <div class="recover">
          <h3 class="recover-title">Didn't mean to?</h3>
          <p class="body">Put the same address in and we'll turn them back on.</p>

          <form class="resub" onsubmit={resubscribe} novalidate>
            <!-- Honeypot: off-screen rather than display:none (some bots skip
                 hidden fields), and out of the tab order and the a11y tree. -->
            <div class="hp" aria-hidden="true">
              <label for="resub-company">Company</label>
              <input
                id="resub-company"
                type="text"
                tabindex="-1"
                autocomplete="off"
                bind:value={botField}
              />
            </div>

            <label class="field-label" for="resub-email">Email address</label>
            <div class="row">
              <input
                id="resub-email"
                class="input"
                type="email"
                inputmode="email"
                autocomplete="email"
                placeholder="you@domain.com"
                required
                bind:value={email}
                aria-invalid={error ? "true" : undefined}
                aria-describedby={error ? "resub-error" : undefined}
              />
              <!-- aria-busy rather than disabled: disabling the button just
                   pressed drops focus to <body>, and on the error path they
                   never get it back. The guard in resubscribe() blocks it. -->
              <button type="submit" class="submit" aria-busy={submitting}>
                {#if submitting}Turning them on<SendingDots />{:else}Resubscribe{/if}
              </button>
            </div>
            {#if error}
              <p id="resub-error" class="form-error" role="alert">{error}</p>
            {/if}
          </form>
        </div>
      {/if}
    </div>
  </ContentWidth>
</div>

<style>
  /* Values, not tokens, matching the rest of this flow. #d71920 primary,
     #aa1419 primary-dark, #bbbdbf light, #6e6f72 muted (4.6:1 on white). */
  .lede {
    margin: 0 0 32px;
    font-size: 18px;
    font-weight: 200;
    line-height: 1.6;
    color: #000;
  }
  .body {
    margin: 0 0 14px;
    font-size: 16px;
    font-weight: 200;
    line-height: 1.6;
    color: #000;
  }

  .recover {
    padding-top: 28px;
    border-top: 1px solid #bbbdbf;
  }
  .recover-title {
    margin: 0 0 8px;
    font-size: 18px;
    font-weight: 200;
    color: #000;
  }

  .resub {
    margin-top: 18px;
    max-width: 480px;
  }
  .field-label {
    display: block;
    margin-bottom: 6px;
    font-size: 13px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #6e6f72;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .input {
    flex: 1 1 220px;
    padding: 12px 14px;
    border: 1px solid #bbbdbf;
    border-radius: 4px;
    background: #fff;
    color: #000;
    font-size: 16px;
    font-weight: 200;
    transition: border-color 300ms;
  }
  .input::placeholder {
    color: #6e6f72;
  }
  .submit {
    padding: 12px 26px;
    border: 1px solid #d71920;
    border-radius: 4px;
    background: #d71920;
    color: #fff;
    font-size: 15px;
    cursor: pointer;
    transition: background-color 300ms;
  }
  .submit:hover:not([aria-busy="true"]) {
    background: #aa1419;
    border-color: #aa1419;
  }
  .submit[aria-busy="true"] {
    cursor: progress;
  }

  .submit:focus-visible,
  .input:focus-visible,
  .done:focus-visible {
    outline: 2px solid #d71920;
    outline-offset: 1px;
  }

  .form-error {
    margin: 12px 0 0;
    font-size: 14px;
    line-height: 20px;
    /* primary-dark — 5.9:1 on white, where primary alone is 4.0:1. */
    color: #aa1419;
  }

  .hp {
    position: absolute;
    left: -9999px;
    width: 1px;
    height: 1px;
    overflow: hidden;
  }

  @media (prefers-reduced-motion: reduce) {
    .submit,
    .input {
      transition: none;
    }
  }
</style>
