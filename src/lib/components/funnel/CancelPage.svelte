<script lang="ts">
  import { onMount, tick } from "svelte";
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import SendingDots from "$lib/components/SendingDots.svelte";
  import { resolveTimeZone, formatFullSlot } from "$lib/schedule/slots";
  import { richHTML, type FunnelCopy } from "$lib/funnel-copy/copy";
  import type { CancelPreview } from "$lib/funnel-copy/preview";

  /**
   * Cancelling an intro call, reached from the cancel link in the CRM's
   * confirmation email.
   *
   * Two things this page does NOT do, deliberately.
   *
   * It does not cancel on load. The id arrives in an email, and a GET that
   * cancelled would be fired by the first link scanner, spam filter or inbox
   * preview to touch the message — so it takes an explicit press.
   *
   * And it does not try to talk anyone out of it. Rescheduling is offered
   * because it is genuinely the more useful option for someone whose week just
   * moved, not as a dark pattern: the cancel button is the plain one, first,
   * and nothing here is hidden behind a second confirmation.
   *
   * The words come from Prismic's `funnel_copy` document (`copy`). `preview`
   * renders one state from sample data for /preview/funnel and turns every
   * network call off: a preview must never cancel anything.
   */
  let { copy, eventId, preview }: { copy: FunnelCopy; eventId: string; preview?: CancelPreview } =
    $props();
  // svelte-ignore state_referenced_locally
  const sample = preview;

  /**
   * The id is OPTIONAL in the route, so `/cancel` with nothing after it renders
   * this page in its "missing" state rather than 404ing.
   *
   * That URL is reachable in production. The CRM builds
   * `{{custom_values.sub_domain_url}}/cancel/{{appointment.id}}`, and an id can
   * arrive empty — a message composed outside appointment scope, a mail client
   * truncating the link, a forward that drops the last segment. SvelteKit 308s
   * the resulting trailing slash to `/cancel`, which had no route at all, so a
   * client trying to cancel met a 404 instead of a way through. Measured on the
   * sibling `/reschedule` path after a real send.
   *
   * Reschedule redirects to /schedule instead, because "find another time" is
   * the outcome that message wants. Cancelling has no such equivalent — sending
   * someone to a booking page when they came to cancel would be the dark
   * pattern this page is written to avoid — so it stays here and says so.
   */
  const rescheduleHref = $derived(
    eventId ? `/reschedule/${encodeURIComponent(eventId)}` : "/schedule",
  );

  let timeZone = $state<string | undefined>(sample?.timeZone);
  let lookup = $state<"loading" | "ready" | "missing" | "error">(
    sample ? (sample.state === "missing" ? "missing" : "ready") : "loading",
  );
  let current = $state<string | null>(sample?.slots[0] ?? null);
  /** Already cancelled, or already happened — there is nothing left to do. */
  let gone = $state(sample?.state === "gone");
  let cancelled = $state(sample?.state === "cancelled");

  let botField = $state("");
  let openedAt = 0;
  let submitting = $state(false);
  let formError = $state("");
  let doneEl = $state<HTMLElement>();

  onMount(() => {
    if (sample) return;
    timeZone = resolveTimeZone();
    openedAt = Date.now();
    load();
  });

  async function load() {
    if (sample) return;
    // No id, nothing to look up. Answered here rather than by asking the API
    // for `/api/appointment/`, which is a different route and a 404 that means
    // something else.
    if (!eventId) {
      lookup = "missing";
      return;
    }
    lookup = "loading";
    try {
      const res = await fetch(`/api/appointment/${encodeURIComponent(eventId)}`);
      const data = await res.json().catch(() => ({}));
      if (res.status === 404) {
        lookup = "missing";
        return;
      }
      if (!res.ok) {
        lookup = "error";
        return;
      }
      current = typeof data?.startTime === "string" ? data.startTime : null;
      gone = data?.actionable === false;
      lookup = "ready";
    } catch {
      lookup = "error";
    }
  }

  async function cancelBooking() {
    if (sample || submitting) return;
    submitting = true;
    formError = "";
    try {
      const res = await fetch(`/api/appointment/${encodeURIComponent(eventId)}/cancel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ botField, ts: openedAt }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        formError = data?.error ?? "We couldn’t cancel that booking. Please try again.";
        return;
      }
      cancelled = true;
      await tick();
      doneEl?.focus();
    } catch {
      formError = "Something went wrong. Please try again or email info@reddoorla.com.";
    } finally {
      submitting = false;
    }
  }
</script>

<div class="w-screen h-[50vh] max-h-96 relative bg-paper">
  <ContentWidth class="h-full flex flex-col justify-evenly items-start">
    <div class="h-32"></div>
    <h1 class="type-hero text-primary z-10 md:ml-[20%]">
      {#if cancelled}
        {copy.cancel_done_heading}
      {:else}
        {copy.cancel_heading}
      {/if}
    </h1>
  </ContentWidth>
</div>

<div class="w-screen bg-white py-16">
  <!-- No gap on desktop: the body starts on the 20% line the headline above
       sits on (as /contact does); the kicker keeps clear with its own pr-4. -->
  <ContentWidth class="flex flex-col md:flex-row gap-8 md:gap-0 mb-32">
    <h2 class="type-kicker md:w-1/5 md:pr-4 text-primary shrink-0">
      {cancelled ? copy.cancel_done_kicker : copy.cancel_kicker}
    </h2>

    <div class="funnel-body w-full md:w-4/5 max-w-2xl">
      {#if cancelled}
        <!-- role="status" alone would not announce: the element is inserted
             already holding its text, and a live region only speaks for text
             added after it exists. Focus is moved here as well. -->
        <div class="done" role="status" tabindex="-1" bind:this={doneEl}>
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          {@html richHTML(copy.cancel_done_body, "done-body")}
        </div>
      {:else if lookup === "loading"}
        <p class="muted" role="status">Finding your booking…</p>
      {:else if lookup === "missing"}
        <p class="lede">{copy.cancel_missing_lede}</p>
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html richHTML(copy.cancel_missing_body, "muted")}
      {:else if lookup === "error"}
        <p class="form-error" role="alert">We couldn’t load that booking.</p>
        <button type="button" class="ghost mt-4" onclick={load}>Try again</button>
      {:else if gone}
        <p class="lede">{copy.cancel_gone_lede}</p>
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html richHTML(copy.cancel_gone_body, "muted")}
      {:else}
        {#if current}
          <p class="current">
            <span class="type-eyebrow current-label">{copy.cancel_current_label}</span>
            <span class="current-when">{formatFullSlot(current, timeZone)}</span>
          </p>
        {/if}
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html richHTML(copy.cancel_lede, "lede")}

        <!-- Honeypot: off-screen rather than display:none (some bots skip hidden
             fields), and out of the tab order and the a11y tree. -->
        <div class="hp" aria-hidden="true">
          <label for="cx-company">Company</label>
          <input
            id="cx-company"
            type="text"
            tabindex="-1"
            autocomplete="off"
            bind:value={botField}
          />
        </div>

        <div class="actions">
          <!-- aria-busy rather than disabled: disabling the button just pressed
               drops focus to <body>, and on the error path they never get it
               back. The guard in cancelBooking() blocks a re-submit. -->
          <button type="button" class="submit" aria-busy={submitting} onclick={cancelBooking}>
            {#if submitting}Cancelling<SendingDots />{:else}{copy.cancel_button}{/if}
          </button>
          <a class="ghost" href={rescheduleHref}>{copy.cancel_reschedule_link}</a>
        </div>

        {#if formError}
          <p class="form-error" role="alert">{formError}</p>
        {/if}
      {/if}
    </div>
  </ContentWidth>
</div>

<style>
  /* Values, not tokens, matching /schedule — the same flow, later on.
     #d71920 primary, #aa1419 primary-dark, #bbbdbf light, #6e6f72 muted. */
  .funnel-body :global(.lede) {
    margin: 0 0 28px;
    font-size: 18px;
    font-weight: 200;
    line-height: 1.6;
    color: #000;
  }
  .funnel-body :global(.muted) {
    margin: 0;
    font-size: 16px;
    font-weight: 200;
    line-height: 1.6;
    color: #6e6f72;
  }

  .current {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0 0 20px;
    padding-bottom: 20px;
    border-bottom: 1px solid #bbbdbf;
  }
  .current-label {
    color: #6e6f72;
  }
  .current-when {
    font-size: 18px;
    font-weight: 200;
    color: #000;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
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
  /* An anchor, not a button — it navigates. Styled to match so the pair reads
     as two options rather than an action and a stray link. */
  .ghost {
    padding: 12px 22px;
    border: 1px solid #bbbdbf;
    border-radius: 4px;
    background: #fff;
    color: #000;
    font-size: 15px;
    line-height: 1;
    text-decoration: none;
    cursor: pointer;
    transition: border-color 300ms;
  }
  .ghost:hover {
    border-color: #6e6f72;
  }

  .submit:focus-visible,
  .ghost:focus-visible,
  .done:focus-visible {
    outline: 2px solid #d71920;
    outline-offset: 1px;
  }

  .form-error {
    margin: 16px 0 0;
    font-size: 14px;
    line-height: 20px;
    /* primary-dark — 5.9:1 on white, where primary alone is 4.0:1. */
    color: #aa1419;
  }

  .funnel-body :global(.done-body) {
    margin: 0 0 14px;
    font-size: 16px;
    font-weight: 200;
    line-height: 1.6;
    color: #000;
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
    .ghost {
      transition: none;
    }
  }
</style>
