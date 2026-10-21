<script lang="ts">
  import { onMount, tick } from "svelte";
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import SlotPicker from "$lib/components/SlotPicker.svelte";
  import SendingDots from "$lib/components/SendingDots.svelte";
  import { groupByDay, resolveTimeZone, formatFullSlot, type SlotDay } from "$lib/schedule/slots";
  import { richHTML, type FunnelCopy } from "$lib/funnel-copy/copy";
  import type { ReschedulePreview } from "$lib/funnel-copy/preview";

  /**
   * Moving an existing intro call, reached from the reschedule link in the
   * CRM's confirmation email.
   *
   * The point of the page is that the link stops leaving reddoorla.com. It also
   * shows LESS than the page it replaces: /api/appointment returns a time and a
   * status and nothing else, so a forwarded email cannot be used to read the
   * Zoom link off a booking that is not yours.
   *
   * Everything is fetched from the browser, so nothing about a named person's
   * booking is ever rendered into HTML that a CDN could hold.
   *
   * The words come from Prismic's `funnel_copy` document (`copy`). `preview`
   * renders one state from sample data for /preview/funnel and turns every
   * network call off: a preview must never move anything.
   */
  let {
    copy,
    eventId,
    preview,
  }: { copy: FunnelCopy; eventId: string; preview?: ReschedulePreview } = $props();
  // svelte-ignore state_referenced_locally
  const sample = preview;
  const sampleDays = sample ? groupByDay(sample.slots, sample.timeZone) : [];

  let timeZone = $state<string | undefined>(sample?.timeZone);
  /** The booking itself: loading it is the first thing that can fail. */
  let lookup = $state<"loading" | "ready" | "missing" | "error">(
    sample ? (sample.state === "missing" ? "missing" : "ready") : "loading",
  );
  let current = $state<string | null>(sample?.slots[0] ?? null);
  let gone = $state(sample?.state === "gone");

  let slotStatus = $state<"loading" | "ready" | "error">(sample ? "ready" : "loading");
  let slotsError = $state("");
  let days = $state<SlotDay[]>(sampleDays);
  let selectedKey = $state(sampleDays[0]?.key ?? "");
  // The ready preview opens with a new time chosen, so the confirm step shows.
  let selectedSlot = $state<string | null>(
    sample?.state === "ready" ? (sample.slots[1] ?? null) : null,
  );

  let botField = $state("");
  let openedAt = 0;
  let submitting = $state(false);
  let formError = $state("");
  let moved = $state<string | null>(sample?.state === "moved" ? (sample.slots[1] ?? null) : null);

  let confirmEl = $state<HTMLButtonElement>();
  let doneEl = $state<HTMLElement>();

  onMount(() => {
    if (sample) return;
    timeZone = resolveTimeZone();
    openedAt = Date.now();
    loadAppointment();
    loadSlots();
  });

  async function loadAppointment() {
    if (sample) return;
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

  async function loadSlots() {
    if (sample) return;
    slotStatus = "loading";
    slotsError = "";
    try {
      const res = await fetch("/api/slots");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        slotStatus = "error";
        slotsError = data?.error ?? "We couldn’t load available times.";
        return;
      }
      const raw: unknown = data?.slots;
      days = groupByDay(
        Array.isArray(raw) ? raw.filter((s): s is string => typeof s === "string") : [],
        timeZone,
      );
      if (!days.some((d) => d.key === selectedKey)) selectedKey = days[0]?.key ?? "";
      slotStatus = "ready";
    } catch {
      slotStatus = "error";
      slotsError = "We couldn’t load available times.";
    }
  }

  async function chooseSlot() {
    formError = "";
    // The confirm button is the only thing left to do, and on a phone it sits
    // below the grid — revealing it silently would strand them.
    await tick();
    confirmEl?.focus();
  }

  async function confirm() {
    if (sample || submitting || !selectedSlot) return;
    submitting = true;
    formError = "";
    const chosen = selectedSlot;
    try {
      const res = await fetch(`/api/appointment/${encodeURIComponent(eventId)}/reschedule`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ startTime: chosen, botField, ts: openedAt }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        formError = data?.error ?? "We couldn’t move that booking. Please try again.";
        if (data?.gone) gone = true;
        if (data?.refreshSlots) {
          selectedSlot = null;
          await loadSlots();
        }
        return;
      }
      moved = typeof data?.startTime === "string" ? data.startTime : chosen;
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
      {#if moved}
        {copy.reschedule_done_heading}
      {:else}
        {copy.reschedule_heading}
      {/if}
    </h1>
  </ContentWidth>
</div>

<div class="w-screen bg-white py-16">
  <ContentWidth class="flex flex-col md:flex-row gap-8 mb-32">
    <h2 class="type-kicker md:w-1/5 text-primary shrink-0">
      {moved ? copy.reschedule_done_kicker : copy.reschedule_kicker}
    </h2>

    <div class="funnel-body w-full md:w-4/5 max-w-2xl">
      {#if moved}
        <!-- role="status" alone would not announce: the element is inserted
             already holding its text, and a live region only speaks for text
             added after it exists. Focus is moved here as well. -->
        <div class="done" role="status" tabindex="-1" bind:this={doneEl}>
          <p class="done-when">{formatFullSlot(moved, timeZone)}</p>
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          {@html richHTML(copy.reschedule_done_body, "done-body")}
        </div>
      {:else if lookup === "loading"}
        <p class="muted" role="status">Finding your booking…</p>
      {:else if lookup === "missing"}
        <p class="lede">{copy.reschedule_missing_lede}</p>
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html richHTML(copy.reschedule_missing_body, "muted")}
      {:else if lookup === "error"}
        <p class="form-error" role="alert">We couldn’t load that booking.</p>
        <button type="button" class="ghost mt-4" onclick={loadAppointment}>Try again</button>
      {:else if gone}
        <p class="lede">{copy.reschedule_gone_lede}</p>
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html richHTML(copy.reschedule_gone_body, "muted")}
      {:else}
        {#if current}
          <p class="current">
            <span class="type-eyebrow current-label">{copy.reschedule_current_label}</span>
            <span class="current-when">{formatFullSlot(current, timeZone)}</span>
          </p>
        {/if}
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html richHTML(copy.reschedule_lede, "lede")}

        {#if slotStatus === "loading"}
          <p class="muted" role="status">Loading available times…</p>
        {:else if slotStatus === "error"}
          <p class="form-error" role="alert">{slotsError}</p>
          <button type="button" class="ghost mt-4" onclick={loadSlots}>Try again</button>
        {:else if days.length === 0}
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          {@html richHTML(copy.schedule_no_times, "muted")}
        {:else}
          <SlotPicker
            {days}
            {timeZone}
            bind:selectedKey
            bind:selectedSlot
            onchoose={chooseSlot}
            ondaychange={() => (formError = "")}
          />

          <!-- Outside the confirm block on purpose: losing a slot race clears
               the selection, which unmounts that block, and an error rendered
               inside it would vanish in the same tick. -->
          {#if formError}
            <p class="form-error form-error--standalone" role="alert">{formError}</p>
          {/if}

          {#if selectedSlot}
            <div class="confirm">
              <p class="chosen">
                <span class="type-eyebrow">{copy.reschedule_moving_label}</span>
                {formatFullSlot(selectedSlot, timeZone)}
              </p>

              <!-- Honeypot: off-screen rather than display:none (some bots skip
                   hidden fields), and out of the tab order and the a11y tree. -->
              <div class="hp" aria-hidden="true">
                <label for="rs-company">Company</label>
                <input
                  id="rs-company"
                  type="text"
                  tabindex="-1"
                  autocomplete="off"
                  bind:value={botField}
                />
              </div>

              <div class="actions">
                <!-- aria-busy rather than disabled: disabling the button just
                     pressed drops focus to <body>, and on the error path they
                     never get it back. The guard in confirm() blocks re-submit. -->
                <button
                  type="button"
                  class="submit"
                  aria-busy={submitting}
                  bind:this={confirmEl}
                  onclick={confirm}
                >
                  {#if submitting}Moving<SendingDots />{:else}{copy.reschedule_button}{/if}
                </button>
                <button type="button" class="ghost" onclick={() => (selectedSlot = null)}>
                  {copy.reschedule_pick_another}
                </button>
              </div>
            </div>
          {/if}
        {/if}
      {/if}
    </div>
  </ContentWidth>
</div>

<style>
  /* Values, not tokens, matching /schedule — the two are the same flow.
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
    /* Struck through would be premature — nothing has moved yet. */
    color: #000;
  }

  .confirm {
    margin-top: 32px;
    padding-top: 28px;
    border-top: 1px solid #bbbdbf;
  }
  .chosen {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0 0 20px;
    font-size: 18px;
    font-weight: 200;
    color: #000;
  }
  .chosen :global(.type-eyebrow) {
    color: #6e6f72;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
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
  .ghost {
    padding: 12px 22px;
    border: 1px solid #bbbdbf;
    border-radius: 4px;
    background: #fff;
    color: #000;
    font-size: 15px;
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
    margin: 12px 0 0;
    font-size: 14px;
    line-height: 20px;
    /* primary-dark — 5.9:1 on white, where primary alone is 4.0:1. */
    color: #aa1419;
  }
  .form-error--standalone {
    margin-top: 20px;
  }

  .done-when {
    margin: 0 0 16px;
    font-size: 22px;
    font-weight: 200;
    color: #000;
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
