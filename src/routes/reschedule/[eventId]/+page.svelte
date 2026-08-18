<script lang="ts">
  import { onMount, tick } from "svelte";
  import { page } from "$app/state";
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import SlotPicker from "$lib/components/SlotPicker.svelte";
  import SendingDots from "$lib/components/SendingDots.svelte";
  import { groupByDay, resolveTimeZone, formatFullSlot, type SlotDay } from "$lib/schedule/slots";

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
   */

  const eventId = page.params.eventId ?? "";

  let timeZone = $state<string | undefined>(undefined);
  /** The booking itself: loading it is the first thing that can fail. */
  let lookup = $state<"loading" | "ready" | "missing" | "error">("loading");
  let current = $state<string | null>(null);
  let gone = $state(false);

  let slotStatus = $state<"loading" | "ready" | "error">("loading");
  let slotsError = $state("");
  let days = $state<SlotDay[]>([]);
  let selectedKey = $state("");
  let selectedSlot = $state<string | null>(null);

  let botField = $state("");
  let openedAt = 0;
  let submitting = $state(false);
  let formError = $state("");
  let moved = $state<string | null>(null);

  let confirmEl = $state<HTMLButtonElement>();
  let doneEl = $state<HTMLElement>();

  onMount(() => {
    timeZone = resolveTimeZone();
    openedAt = Date.now();
    loadAppointment();
    loadSlots();
  });

  async function loadAppointment() {
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
    slotStatus = "loading";
    slotsError = "";
    try {
      const res = await fetch("/api/slots");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        slotStatus = "error";
        slotsError = data?.error ?? "We couldn't load available times.";
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
      slotsError = "We couldn't load available times.";
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
    if (submitting || !selectedSlot) return;
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
        formError = data?.error ?? "We couldn't move that booking. Please try again.";
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
        You're all set.
      {:else}
        Let's find a better time.
      {/if}
    </h1>
  </ContentWidth>
</div>

<div class="w-screen bg-white py-16">
  <ContentWidth class="flex flex-col md:flex-row gap-8 mb-32">
    <h2 class="type-kicker md:w-1/5 text-primary shrink-0">
      {moved ? "What happens next" : "Reschedule your call"}
    </h2>

    <div class="w-full md:w-4/5 max-w-2xl">
      {#if moved}
        <!-- role="status" alone would not announce: the element is inserted
             already holding its text, and a live region only speaks for text
             added after it exists. Focus is moved here as well. -->
        <div class="done" role="status" tabindex="-1" bind:this={doneEl}>
          <p class="done-when">{formatFullSlot(moved, timeZone)}</p>
          <p class="done-body">
            We've sent an updated confirmation, and the calendar invite has moved with it — the same
            Zoom link still works.
          </p>
        </div>
      {:else if lookup === "loading"}
        <p class="muted" role="status">Finding your booking…</p>
      {:else if lookup === "missing"}
        <p class="lede">We couldn't find that booking.</p>
        <p class="muted">
          The link may have expired, or the call may already have happened. You can
          <a class="text-primary underline" href="/schedule">book a new time</a>
          or email
          <a class="text-primary underline" href="mailto:info@reddoorla.com">info@reddoorla.com</a>.
        </p>
      {:else if lookup === "error"}
        <p class="form-error" role="alert">We couldn't load that booking.</p>
        <button type="button" class="ghost mt-4" onclick={loadAppointment}>Try again</button>
      {:else if gone}
        <p class="lede">That call is no longer on the calendar.</p>
        <p class="muted">
          It's been cancelled, or it has already passed. <a
            class="text-primary underline"
            href="/schedule">Book a new time</a
          > whenever suits.
        </p>
      {:else}
        {#if current}
          <p class="current">
            <span class="type-eyebrow current-label">Currently booked for</span>
            <span class="current-when">{formatFullSlot(current, timeZone)}</span>
          </p>
        {/if}
        <p class="lede">Choose a new time and we'll move it. Nothing else changes.</p>

        {#if slotStatus === "loading"}
          <p class="muted" role="status">Loading available times…</p>
        {:else if slotStatus === "error"}
          <p class="form-error" role="alert">{slotsError}</p>
          <button type="button" class="ghost mt-4" onclick={loadSlots}>Try again</button>
        {:else if days.length === 0}
          <p class="muted">
            There's nothing open in the next couple of weeks. Email
            <a class="text-primary underline" href="mailto:info@reddoorla.com">info@reddoorla.com</a
            > and we'll find you a time.
          </p>
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
                <span class="type-eyebrow">Moving to</span>
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
                  {#if submitting}Moving<SendingDots />{:else}Move my call{/if}
                </button>
                <button type="button" class="ghost" onclick={() => (selectedSlot = null)}>
                  Pick another
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
  .lede {
    margin: 0 0 28px;
    font-size: 18px;
    font-weight: 200;
    line-height: 1.6;
    color: #000;
  }
  .muted {
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
  .done-body {
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
