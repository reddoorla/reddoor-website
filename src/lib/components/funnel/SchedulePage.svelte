<script lang="ts">
  import { onMount, tick } from "svelte";
  import { page } from "$app/state";
  import { stripQueryParams } from "$lib/url/stripQueryParams";
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import {
    groupByDay,
    resolveTimeZone,
    formatFullSlot,
    formatDuration,
    type SlotDay,
  } from "$lib/schedule/slots";
  import { readHandoff, clearHandoff } from "$lib/schedule/handoff";
  import SlotPicker from "$lib/components/SlotPicker.svelte";
  import SendingDots from "$lib/components/SendingDots.svelte";
  import BookedPage from "./BookedPage.svelte";
  import type { BookedProject } from "$lib/server/funnel-copy";
  import { asImageSrc } from "@prismicio/client";
  import { photoAlt, richHTML, type FunnelCopy } from "$lib/funnel-copy/copy";
  import type { SchedulePreview } from "$lib/funnel-copy/preview";

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
   *
   * The words come from Prismic's `funnel_copy` document (`copy`), with the
   * shipped wording as the fallback. `preview` renders one state from sample
   * data for /preview/funnel and turns every network call off.
   */
  let {
    copy,
    projects = [],
    preview,
  }: { copy: FunnelCopy; projects?: BookedProject[]; preview?: SchedulePreview } = $props();
  // A preview is fixed for the life of the component: it picks the starting
  // state, it is never toggled.
  // svelte-ignore state_referenced_locally
  const sample = preview;
  const sampleDays = sample ? groupByDay(sample.slots, sample.timeZone) : [];
  const sampleSlot = sample?.slots[0] ?? null;

  /** The shape the server also accepts, in one place: the summary below may
   *  only stand in for values the submit would have taken anyway. */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  let timeZone = $state<string | undefined>(sample?.timeZone);
  let status = $state<"loading" | "ready" | "error">(sample ? "ready" : "loading");
  let slotsError = $state("");
  let days = $state<SlotDay[]>(sampleDays);
  let selectedKey = $state(sampleDays[0]?.key ?? "");
  // The default and applied previews open with a time already chosen, so the
  // form and its labels are on screen to read.
  let selectedSlot = $state<string | null>(sample?.state === "booked" ? null : sampleSlot);

  /** Set once the questionnaire has been completed in this tab. */
  let applied = $state(sample?.state === "applied");
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
  let prefilled = $state(sample?.state === "applied");
  /** Flipped by "Use different details", and by any validation failure: an
   *  error message on an input that is not on screen is a dead end. Never
   *  flipped back — taking a correction off screen is worse than a long form. */
  let editing = $state(false);

  // The default preview is a cold visitor, so its fields start empty.
  let name = $state(sample && sample.state !== "default" ? sample.name : "");
  let email = $state(sample && sample.state !== "default" ? sample.email : "");
  let phone = $state(sample && sample.state !== "default" ? sample.phone : "");
  let botField = $state("");
  /** Planted on mount, not server-side: this page is prerendered, so there is
   *  no per-request timestamp to bake in. It still measures fill time. */
  let openedAt = 0;

  let submitting = $state(false);
  let formError = $state("");
  let fieldErrors = $state<{ name?: string; email?: string }>({});
  let booked = $state<string | null>(sample?.state === "booked" ? sampleSlot : null);
  // What the CRM said about the booking: its end, for the duration, and its id,
  // the same bearer id the confirmation email links the calendar, reschedule
  // and cancel routes by. A preview has a sample end and no id, so it shows the
  // buttons without anywhere to go. Its 30 minutes is the calendar's length as
  // configured in the CRM today, written here only so the sample has one.
  let bookedEnd = $state<string | null>(
    sample?.state === "booked" && sampleSlot
      ? new Date(Date.parse(sampleSlot) + 30 * 60_000).toISOString()
      : null,
  );
  let bookedId = $state<string | null>(null);
  const bookedDuration = $derived(booked ? formatDuration(booked, bookedEnd) : null);
  // Only an id the routes accept becomes a link; anything else would 404.
  const bookedBase = $derived(
    bookedId && /^[A-Za-z0-9_-]{10,64}$/.test(bookedId)
      ? `/calendar/${encodeURIComponent(bookedId)}`
      : null,
  );
  const bookedLinks = $derived(
    bookedBase && bookedId
      ? {
          google: `${bookedBase}/google`,
          ics: `${bookedBase}/event.ics`,
          outlook: `${bookedBase}/outlook`,
          reschedule: `/reschedule/${encodeURIComponent(bookedId)}`,
          cancel: `/cancel/${encodeURIComponent(bookedId)}`,
        }
      : sample
        ? {}
        : null,
  );

  let nameEl = $state<HTMLInputElement>();
  let submitEl = $state<HTMLButtonElement>();
  let bookedEl = $state<HTMLElement>();

  /**
   * The CRM's own entry point: its "Schedule Appointment" trigger link appends
   * `?first_name=…&last_name=…&email=…&phone=…` from the contact record.
   *
   * The sessionStorage handoff cannot serve that visitor — they arrive from an
   * email, in a browser that has never seen the modal — so without this they
   * would be asked for details the CRM already emailed them about. The handoff
   * still wins where both exist: it was written by this tab, seconds ago.
   *
   * The params are stripped from the URL immediately afterwards. An email
   * address in a URL is an email address in the history, in a screenshot, and
   * in anything that reads `location.href` later. Today that last one is not
   * hypothetical but not yet real either: gtag.js is deferred until the first
   * pointer/key/scroll event (see app.html), so it initialises AFTER this runs
   * and reads an already-clean URL. That ordering is the only reason a contact's
   * address never reaches analytics — if GA is ever moved back to load on
   * landing, this stops being sufficient and the trigger link has to stop
   * carrying the address.
   */
  const PREFILL_PARAMS = ["first_name", "last_name", "email", "phone"] as const;

  function prefillFromTriggerLink(): boolean {
    const p = page.url.searchParams;
    const first = (p.get("first_name") ?? "").trim();
    const last = (p.get("last_name") ?? "").trim();
    const fromLink = [first, last].filter(Boolean).join(" ");
    const linkEmail = (p.get("email") ?? "").trim();
    const linkPhone = (p.get("phone") ?? "").trim();
    if (!fromLink && !linkEmail && !linkPhone) return false;

    name = fromLink;
    email = linkEmail;
    phone = linkPhone;
    return true;
  }

  onMount(() => {
    if (sample) return;
    timeZone = resolveTimeZone();
    openedAt = Date.now();
    const handoff = readHandoff();
    if (handoff) {
      email = handoff.email;
      name = handoff.name;
      phone = handoff.phone;
      applied = handoff.applied;
    } else {
      prefillFromTriggerLink();
    }
    // Unconditional: a stale link opened in a tab that also holds a handoff must
    // not leave the address sitting in the URL either.
    stripQueryParams(PREFILL_PARAMS);
    prefilled = name.trim() !== "" && EMAIL_RE.test(email.trim());
    loadSlots();
  });

  async function loadSlots() {
    if (sample) return;
    status = "loading";
    slotsError = "";
    try {
      const res = await fetch("/api/slots");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        status = "error";
        slotsError = data?.error ?? "We couldn’t load available times.";
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
      slotsError = "We couldn’t load available times.";
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
    // A preview never books: there is no visitor, and /api/book makes a real
    // appointment on Tim's calendar.
    if (sample || submitting || !selectedSlot) return;

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
          // The same zone this page has been rendering every slot in. Sent so
          // the CRM's confirmation email and text agree with what the visitor
          // just read — without it the contact has no zone and GHL falls back
          // to the location's Mountain time.
          timezone: timeZone,
          botField,
          ts: openedAt,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        formError = data?.error ?? "We couldn’t confirm that booking. Please try again.";
        // The CRM rejected the slot because someone took it in the meantime —
        // drop the selection and refetch so they are not offered it again.
        if (data?.refreshSlots) {
          selectedSlot = null;
          await loadSlots();
        }
        return;
      }
      booked = typeof data?.startTime === "string" ? data.startTime : chosen;
      bookedEnd = typeof data?.endTime === "string" ? data.endTime : null;
      bookedId = typeof data?.eventId === "string" ? data.eventId : null;
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

{#snippet kicker()}
  {copy.schedule_kicker}
{/snippet}

<div class="w-screen h-[50vh] max-h-96 relative bg-paper">
  <ContentWidth class="h-full flex flex-col justify-evenly items-start">
    <div class="h-32"></div>
    <div class="z-10 md:ml-[20%]">
      <h1 class="type-hero text-primary">
        {#if booked}
          {copy.schedule_booked_heading}
        {:else if applied}
          {copy.schedule_applied_heading}
        {:else}
          {copy.schedule_heading}
        {/if}
      </h1>
      {#if booked}
        <p class="booked-subhead m-0 mt-2.5 text-black">{copy.booked_subhead}</p>
      {/if}
    </div>
  </ContentWidth>
</div>

{#if booked}
  <BookedPage
    {copy}
    {projects}
    when={formatFullSlot(booked, timeZone)}
    duration={bookedDuration}
    links={bookedLinks}
    bind:statusEl={bookedEl}
  />
{:else}
  <div class="w-screen bg-white py-16">
    <!-- No gap on desktop: the body starts on the 20% line the headline above
       sits on (as /contact does); the kicker keeps clear with its own pr-4. -->
    <ContentWidth class="flex flex-col md:flex-row gap-8 md:gap-0 mb-32">
      {#if copy.tim_photo}
        <!-- The Testimonial slice's headshot, the site's one portrait pattern:
           round, 72px then 100px. It sits under the kicker because that
           column is empty below it on desktop, so the form keeps its place;
           with no photo the markup is exactly what it was before. -->
        <div class="md:w-1/5 md:pr-4 shrink-0 flex flex-col gap-4">
          <h2 class="type-kicker text-primary">{@render kicker()}</h2>
          <img
            src={asImageSrc(copy.tim_photo, {
              w: 200,
              h: 200,
              fit: "crop",
              crop: ["faces"],
              auto: ["format", "compress"],
            })}
            alt={photoAlt(copy.tim_photo)}
            width="100"
            height="100"
            class="h-[72px] w-[72px] rounded-full object-cover md:h-[100px] md:w-[100px]"
          />
        </div>
      {:else}
        <h2 class="type-kicker md:w-1/5 md:pr-4 text-primary shrink-0">{@render kicker()}</h2>
      {/if}

      <div class="funnel-body w-full md:w-4/5 max-w-2xl">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html richHTML(applied ? copy.schedule_applied_lede : copy.schedule_lede, "lede")}

        {#if status === "loading"}
          <p class="muted" role="status">Loading available times…</p>
        {:else if status === "error"}
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
                <span class="type-eyebrow">{copy.form_time_label}</span>
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
                  <span class="type-eyebrow who-label">{copy.form_booking_as}</span>
                  <p class="who-name">{name}</p>
                  <p class="who-contact">
                    <span class="who-email">{email}</span>
                    {#if phone}<span>{phone}</span>{/if}
                  </p>
                  <button type="button" class="link-button" onclick={startEditing}>
                    {copy.form_different_details}
                  </button>
                </div>
              {:else}
                <div class="fields">
                  <div>
                    <label class="field-label" for="book-name">{copy.form_name_label}</label>
                    <input
                      id="book-name"
                      class="input"
                      type="text"
                      autocomplete="name"
                      placeholder={copy.form_name_placeholder}
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
                    <label class="field-label" for="book-email">{copy.form_email_label}</label>
                    <input
                      id="book-email"
                      class="input"
                      type="email"
                      inputmode="email"
                      autocomplete="email"
                      placeholder={copy.form_email_placeholder}
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
                      {copy.form_phone_label}
                      <span class="optional">{copy.form_phone_optional}</span>
                    </label>
                    <input
                      id="book-phone"
                      class="input"
                      type="tel"
                      inputmode="tel"
                      autocomplete="tel"
                      placeholder={copy.form_phone_placeholder}
                      aria-describedby="book-phone-hint"
                      bind:value={phone}
                    />
                    <p id="book-phone-hint" class="hint">{copy.form_phone_hint}</p>
                  </div>
                </div>
              {/if}

              <div class="actions">
                <!-- aria-busy rather than disabled: disabling the button the
                     visitor just pressed drops focus to <body>, and on the
                     error path they never get it back. The guard in book()
                     blocks the re-submit. -->
                <button type="submit" class="submit" aria-busy={submitting} bind:this={submitEl}>
                  {#if submitting}Booking<SendingDots />{:else}{copy.form_submit}{/if}
                </button>
                <button type="button" class="ghost" onclick={() => (selectedSlot = null)}>
                  {copy.form_pick_another}
                </button>
              </div>
            </form>
          {/if}
        {/if}
      </div>
    </ContentWidth>
  </div>
{/if}

<style>
  /* Values, not tokens, matching InquiryModal — this page is the frame after
     that one and the two are read back to back. #d71920 primary, #aa1419
     primary-dark, #bbbdbf light, #6e6f72 muted (4.6:1 on white). */
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

  /* Pragmatica Light 21/30 (18/26 on a phone), the board's Body 1, as the
     offer page's subhead. */
  .booked-subhead {
    font-family: pragmatica, helvetica, sans-serif;
    font-size: 18px;
    font-weight: 300;
    line-height: 26px;
  }
  @media (min-width: 768px) {
    .booked-subhead {
      font-size: 21px;
      line-height: 30px;
    }
  }
</style>
