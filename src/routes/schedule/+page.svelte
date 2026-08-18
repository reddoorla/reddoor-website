<script lang="ts">
  import { onMount, tick } from "svelte";
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import { groupByDay, resolveTimeZone, formatFullSlot, type SlotDay } from "$lib/schedule/slots";
  import { readHandoff, clearHandoff } from "$lib/schedule/handoff";
  import SlotPicker from "$lib/components/SlotPicker.svelte";
  import SendingDots from "$lib/components/SendingDots.svelte";

  /**
   * The booking step. Reached automatically on finishing the questionnaire —
   * the template's own copy is "while we are reviewing your inquiry, please
   * choose a time", so vetting and booking run in parallel — and reachable cold
   * from a signature or a DM, which is why nothing here assumes an application.
   *
   * Slots are fetched client-side (see /api/slots) and every label is rendered
   * in the VISITOR's timezone with the zone named. That is not a nicety: the
   * calendar's hours are Mountain and this is an LA-facing business, so a raw
   * "9:00 AM" would be an hour wrong for most of the people reading it.
   */

  /** The shape the server also accepts, in one place: the summary below may
   *  only stand in for values the submit would have taken anyway. */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  let timeZone = $state<string | undefined>(undefined);
  let status = $state<"loading" | "ready" | "error">("loading");
  let slotsError = $state("");
  let days = $state<SlotDay[]>([]);
  let selectedKey = $state("");
  let selectedSlot = $state<string | null>(null);

  /** Set once the questionnaire has been completed in this tab. */
  let applied = $state(false);
  /**
   * True when the handoff arrived with everything the booking needs, so the
   * three inputs collapse to a line naming who we are booking.
   *
   * Prefilling them is not enough: a filled field still reads as a field to
   * check, so the visitor re-reads their own name and email one screen after
   * typing them. What they actually need here is confirmation of where the
   * invite is going, and a way out if it is wrong.
   *
   * A snapshot taken at mount, deliberately NOT derived from the live values —
   * clearing the email while editing must not fold the form back up mid-edit.
   */
  let prefilled = $state(false);
  /** Flipped by "Use different details", and by any validation failure: an
   *  error message on an input that is not on screen is a dead end. Never
   *  flipped back — taking a correction off screen is worse than a long form. */
  let editing = $state(false);

  let name = $state("");
  let email = $state("");
  let phone = $state("");
  let botField = $state("");
  /** Planted on mount, not server-side: this page is prerendered, so there is
   *  no per-request timestamp to bake in. It still measures fill time. */
  let openedAt = 0;

  let submitting = $state(false);
  let formError = $state("");
  let fieldErrors = $state<{ name?: string; email?: string }>({});
  let booked = $state<string | null>(null);

  let nameEl = $state<HTMLInputElement>();
  let submitEl = $state<HTMLButtonElement>();
  let bookedEl = $state<HTMLElement>();

  onMount(() => {
    timeZone = resolveTimeZone();
    openedAt = Date.now();
    const handoff = readHandoff();
    if (handoff) {
      email = handoff.email;
      name = handoff.name;
      phone = handoff.phone;
      applied = handoff.applied;
      prefilled = name.trim() !== "" && EMAIL_RE.test(email.trim());
    }
    loadSlots();
  });

  async function loadSlots() {
    status = "loading";
    slotsError = "";
    try {
      const res = await fetch("/api/slots");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        status = "error";
        slotsError = data?.error ?? "We couldn't load available times.";
        return;
      }
      const raw: unknown = data?.slots;
      days = groupByDay(
        Array.isArray(raw) ? raw.filter((s): s is string => typeof s === "string") : [],
        timeZone,
      );
      // Keep the visitor's chosen day across a refresh when it still has slots;
      // otherwise fall to the first day that does.
      if (!days.some((d) => d.key === selectedKey)) selectedKey = days[0]?.key ?? "";
      status = "ready";
    } catch {
      status = "error";
      slotsError = "We couldn't load available times.";
    }
  }

  async function chooseSlot() {
    formError = "";
    // Land on the first thing they now have to act on — the form appears
    // below the fold on a phone, and silently revealing it strands them. With
    // the details already known, that is the confirm button rather than a field.
    await tick();
    if (prefilled && !editing) submitEl?.focus();
    else if (!name.trim()) nameEl?.focus();
  }

  async function startEditing() {
    editing = true;
    await tick();
    nameEl?.focus();
  }

  async function book(e: SubmitEvent) {
    e.preventDefault();
    if (submitting || !selectedSlot) return;

    const errs: typeof fieldErrors = {};
    if (!name.trim()) errs.name = "Please tell us your name.";
    if (!EMAIL_RE.test(email.trim())) errs.email = "Please provide a valid email address.";
    fieldErrors = errs;
    if (Object.keys(errs).length) {
      // Unreachable from a handoff this page accepted — but a corrupted one
      // must not put an error on an input the summary is hiding.
      editing = true;
      await tick();
      document.getElementById(errs.name ? "book-name" : "book-email")?.focus();
      return;
    }

    submitting = true;
    formError = "";
    const chosen = selectedSlot;
    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          phone: phone.trim(),
          startTime: chosen,
          // No `campaign`: the funnel and utm fields are written when the
          // application is submitted, where the landing page is actually known.
          // Sending a value from here would relabel a medtech lead "schedule".
          sourceUrl: location.href,
          botField,
          ts: openedAt,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        formError = data?.error ?? "We couldn't confirm that booking. Please try again.";
        // The CRM rejected the slot because someone took it in the meantime —
        // drop the selection and refetch so they are not offered it again.
        if (data?.refreshSlots) {
          selectedSlot = null;
          await loadSlots();
        }
        return;
      }
      booked = typeof data?.startTime === "string" ? data.startTime : chosen;
      // The prefill has done its job; leaving it would greet a second visit in
      // this tab with "your application is in" long after it stopped being news.
      clearHandoff();
      await tick();
      bookedEl?.focus();
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
      {#if booked}
        You're on the calendar.
      {:else if applied}
        Thanks — your application is in.
      {:else}
        Let's find a time.
      {/if}
    </h1>
  </ContentWidth>
</div>

<div class="w-screen bg-white py-16">
  <ContentWidth class="flex flex-col md:flex-row gap-8 mb-32">
    <h2 class="type-kicker md:w-1/5 text-primary shrink-0">
      {booked ? "What happens next" : "Book an intro call"}
    </h2>

    <div class="w-full md:w-4/5 max-w-2xl">
      {#if booked}
        <!-- role="status" alone would not announce: the element is inserted
             already holding its text, and a live region only speaks for text
             added after it exists. Focus is moved here as well. -->
        <div class="booked" role="status" tabindex="-1" bind:this={bookedEl}>
          <p class="booked-when">{formatFullSlot(booked, timeZone)}</p>
          <p class="booked-body">
            We've sent a confirmation to <strong>{email}</strong>, and the Zoom link is in the
            calendar invite. It's thirty minutes with Tim Holmes, our Creative Director.
          </p>
          <p class="booked-body">
            Come with the version of the problem you'd describe to a colleague, not the polished one
            — that's the conversation worth having. If you need to move it, the invite has a
            reschedule link, or just reply to it.
          </p>
        </div>
      {:else}
        <p class="lede">
          {#if applied}
            While we review your answers, pick a time for your intro call. Thirty minutes over Zoom
            — enough to tell you honestly whether we're a fit.
          {:else}
            Thirty minutes over Zoom with Tim Holmes, our Creative Director. Enough to hear where
            you're stuck and tell you honestly whether we're the right studio for it.
          {/if}
        </p>

        {#if status === "loading"}
          <p class="muted" role="status">Loading available times…</p>
        {:else if status === "error"}
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

          <!-- Outside the form on purpose. Losing a slot race clears the
               selection so the visitor cannot re-submit a dead time — which
               unmounts the form, and an error rendered inside it would vanish
               in the same tick, leaving the selection to disappear with no
               explanation at all. -->
          {#if formError}
            <p class="form-error form-error--standalone" role="alert">{formError}</p>
          {/if}

          {#if selectedSlot}
            <form class="details" onsubmit={book} novalidate>
              <p class="chosen">
                <span class="type-eyebrow">Your time</span>
                {formatFullSlot(selectedSlot, timeZone)}
              </p>

              <!-- Honeypot: off-screen rather than display:none (some bots skip
                   hidden fields), and out of the tab order and the a11y tree. -->
              <div class="hp" aria-hidden="true">
                <label for="book-company">Company</label>
                <input
                  id="book-company"
                  type="text"
                  tabindex="-1"
                  autocomplete="off"
                  bind:value={botField}
                />
              </div>

              {#if prefilled && !editing}
                <!-- Text, not three disabled inputs: a locked field still looks
                     like something to check, and the point of this block is
                     that there is nothing left to do but confirm. -->
                <div class="who">
                  <span class="type-eyebrow who-label">Booking as</span>
                  <p class="who-name">{name}</p>
                  <p class="who-contact">
                    <span class="who-email">{email}</span>
                    {#if phone}<span>{phone}</span>{/if}
                  </p>
                  <button type="button" class="link-button" onclick={startEditing}>
                    Use different details
                  </button>
                </div>
              {:else}
                <div class="fields">
                  <div>
                    <label class="field-label" for="book-name">Name</label>
                    <input
                      id="book-name"
                      class="input"
                      type="text"
                      autocomplete="name"
                      placeholder="Full Name"
                      required
                      bind:this={nameEl}
                      bind:value={name}
                      aria-invalid={fieldErrors.name ? "true" : undefined}
                      aria-describedby={fieldErrors.name ? "book-name-error" : undefined}
                    />
                    {#if fieldErrors.name}
                      <p id="book-name-error" class="form-error">{fieldErrors.name}</p>
                    {/if}
                  </div>

                  <div>
                    <label class="field-label" for="book-email">Email address</label>
                    <input
                      id="book-email"
                      class="input"
                      type="email"
                      inputmode="email"
                      autocomplete="email"
                      placeholder="you@domain.com"
                      required
                      bind:value={email}
                      aria-invalid={fieldErrors.email ? "true" : undefined}
                      aria-describedby={fieldErrors.email ? "book-email-error" : undefined}
                    />
                    {#if fieldErrors.email}
                      <p id="book-email-error" class="form-error">{fieldErrors.email}</p>
                    {/if}
                  </div>

                  <div>
                    <label class="field-label" for="book-phone">
                      Cell number <span class="optional">optional</span>
                    </label>
                    <input
                      id="book-phone"
                      class="input"
                      type="tel"
                      inputmode="tel"
                      autocomplete="tel"
                      placeholder="+1 (555) 000-0000"
                      aria-describedby="book-phone-hint"
                      bind:value={phone}
                    />
                    <p id="book-phone-hint" class="hint">So we can text you a reminder.</p>
                  </div>
                </div>
              {/if}

              <div class="actions">
                <!-- aria-busy rather than disabled: disabling the button the
                     visitor just pressed drops focus to <body>, and on the
                     error path they never get it back. The guard in book()
                     blocks the re-submit. -->
                <button type="submit" class="submit" aria-busy={submitting} bind:this={submitEl}>
                  {#if submitting}Booking<SendingDots />{:else}Confirm this time{/if}
                </button>
                <button type="button" class="ghost" onclick={() => (selectedSlot = null)}>
                  Pick another
                </button>
              </div>
            </form>
          {/if}
        {/if}
      {/if}
    </div>
  </ContentWidth>
</div>

<style>
  /* Values, not tokens, matching InquiryModal — this page is the frame after
     that one and the two are read back to back. #d71920 primary, #aa1419
     primary-dark, #bbbdbf light, #6e6f72 muted (4.6:1 on white). */
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
    color: #6e6f72;
  }
  .submit:focus-visible,
  .ghost:focus-visible,
  .link-button:focus-visible,
  .input:focus-visible {
    outline: 2px solid #d71920;
    outline-offset: 1px;
  }

  .details {
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

  .who {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    max-width: 420px;
  }
  .who-label {
    color: #6e6f72;
  }
  .who-name {
    margin: 0;
    font-size: 18px;
    font-weight: 200;
    line-height: 1.4;
    color: #000;
  }
  /* Where the invite is going, and how we would text a reminder — the details
     they are confirming rather than the person, so they sit under the name at
     the same weight as every other secondary line on this page. */
  .who-contact {
    display: flex;
    flex-direction: column;
    margin: 2px 0 0;
    font-size: 15px;
    font-weight: 200;
    line-height: 1.5;
    color: #6e6f72;
  }
  /* The one value with no break points of its own; a long address must wrap
     rather than push the column sideways on a narrow phone. */
  .who-email {
    overflow-wrap: anywhere;
  }
  .link-button {
    margin-top: 10px;
    padding: 0;
    border: 0;
    background: none;
    color: #6e6f72;
    font-size: 14px;
    font-weight: 200;
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
    transition: color 300ms;
  }
  .link-button:hover {
    color: #000;
  }

  .fields {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 420px;
  }
  .field-label {
    display: block;
    margin-bottom: 6px;
    font-size: 13px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #6e6f72;
  }
  .optional {
    text-transform: none;
    letter-spacing: 0;
    font-style: italic;
  }
  .input {
    width: 100%;
    padding: 12px 14px;
    border: 1px solid #bbbdbf;
    border-radius: 4px;
    /* Below 16px iOS Safari zooms the page on focus. */
    font-size: 16px;
    font-weight: 200;
    color: #000;
    background: #fff;
  }
  .input::placeholder {
    color: #6e6f72;
  }
  .hint {
    margin: 6px 0 0;
    font-size: 13px;
    font-weight: 200;
    color: #6e6f72;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 24px;
  }
  .submit {
    padding: 12px 22px;
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
    opacity: 0.7;
    cursor: default;
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
    border-color: #000;
  }

  /* The colour transitions above are decorative. Nothing depends on them, and a
     visitor who has asked for less motion should not get a quarter-second of
     interpolating red under their cursor. */
  @media (prefers-reduced-motion: reduce) {
    .submit,
    .ghost,
    .link-button,
    .input {
      transition: none;
    }
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

  .hp {
    position: absolute;
    left: -9999px;
    width: 1px;
    height: 1px;
    overflow: hidden;
  }

  .booked-when {
    margin: 0 0 18px;
    font-family: "Besley", serif;
    font-size: 28px;
    font-weight: 400;
    line-height: 1.3;
    color: #d71920;
  }
  .booked-body {
    margin: 0 0 14px;
    font-size: 18px;
    font-weight: 200;
    line-height: 1.6;
    color: #000;
  }
  .booked:focus {
    outline: none;
  }
  .booked:focus-visible {
    outline: 2px solid #d71920;
    outline-offset: 4px;
  }
</style>
