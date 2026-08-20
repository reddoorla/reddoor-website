<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import { resolveTimeZone, formatFullSlot } from "$lib/schedule/slots";

  /**
   * Adding a booked call to whichever calendar someone actually uses.
   *
   * Replaces the CRM's `links.reddoorla.com/google/calendar/add-event/…`, which
   * is both unbranded and Google-only — this offers the three that cover almost
   * everyone, and the .ics catches the rest.
   *
   * Every option is a plain link to a SERVER route. That is not laziness: the
   * event description carries the Zoom join URL with its password, and building
   * these hand-offs in the browser would print that URL into the page source.
   * The redirects and the file are assembled server-side so it never gets there.
   */

  const eventId = page.params.eventId ?? "";
  const base = `/calendar/${encodeURIComponent(eventId)}`;

  let timeZone = $state<string | undefined>(undefined);
  let lookup = $state<"loading" | "ready" | "missing" | "error">("loading");
  let start = $state<string | null>(null);
  let gone = $state(false);

  onMount(() => {
    timeZone = resolveTimeZone();
    load();
  });

  async function load() {
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
      start = typeof data?.startTime === "string" ? data.startTime : null;
      gone = data?.actionable === false;
      lookup = "ready";
    } catch {
      lookup = "error";
    }
  }
</script>

<div class="w-screen h-[50vh] max-h-96 relative bg-paper">
  <ContentWidth class="h-full flex flex-col justify-evenly items-start">
    <div class="h-32"></div>
    <h1 class="type-hero text-primary z-10 md:ml-[20%]">Save the date.</h1>
  </ContentWidth>
</div>

<div class="w-screen bg-white py-16">
  <ContentWidth class="flex flex-col md:flex-row gap-8 mb-32">
    <h2 class="type-kicker md:w-1/5 text-primary shrink-0">Add to your calendar</h2>

    <div class="w-full md:w-4/5 max-w-2xl">
      {#if lookup === "loading"}
        <p class="muted" role="status">Finding your booking…</p>
      {:else if lookup === "missing"}
        <p class="lede">We couldn't find that booking.</p>
        <p class="muted">
          The link may have expired. You can
          <a class="text-primary underline" href="/schedule">book a time</a>
          or email
          <a class="text-primary underline" href="mailto:info@reddoorla.com">info@reddoorla.com</a>.
        </p>
      {:else if lookup === "error"}
        <p class="form-error" role="alert">We couldn't load that booking.</p>
        <button type="button" class="ghost mt-4" onclick={load}>Try again</button>
      {:else}
        {#if start}
          <p class="current">
            <span class="type-eyebrow current-label">Your intro call</span>
            <span class="current-when">{formatFullSlot(start, timeZone)}</span>
          </p>
        {/if}

        {#if gone}
          <p class="lede">This call is no longer on the calendar.</p>
          <p class="muted">
            It's been cancelled, or it has already passed.
            <a class="text-primary underline" href="/schedule">Book a new time</a> whenever suits.
          </p>
        {:else}
          <p class="lede">
            The Zoom link travels with the invite, so wherever you save it, it's there when you need
            it.
          </p>

          <div class="options">
            <a class="option" href="{base}/google">Google Calendar</a>
            <a class="option" href="{base}/outlook">Outlook</a>
            <!-- No `download` attribute: the server sets Content-Disposition,
                 which also works when the file is opened from a mail client. -->
            <a class="option" href="{base}/event.ics">Apple Calendar &amp; other (.ics)</a>
          </div>

          <p class="aside">
            Need to change it? <a class="text-primary underline" href="/reschedule/{eventId}"
              >Reschedule</a
            >
            or <a class="text-primary underline" href="/cancel/{eventId}">cancel</a>.
          </p>
        {/if}
      {/if}
    </div>
  </ContentWidth>
</div>

<style>
  /* Values, not tokens, matching /schedule — the same flow, later on.
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
    color: #000;
  }

  .options {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  .option {
    padding: 12px 22px;
    border: 1px solid #bbbdbf;
    border-radius: 4px;
    background: #fff;
    color: #000;
    font-size: 15px;
    line-height: 1;
    text-decoration: none;
    transition: border-color 300ms;
  }
  .option:hover {
    border-color: #6e6f72;
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

  .option:focus-visible,
  .ghost:focus-visible {
    outline: 2px solid #d71920;
    outline-offset: 1px;
  }

  .aside {
    margin: 28px 0 0;
    font-size: 15px;
    font-weight: 200;
    color: #6e6f72;
  }

  .form-error {
    margin: 12px 0 0;
    font-size: 14px;
    line-height: 20px;
    /* primary-dark — 5.9:1 on white, where primary alone is 4.0:1. */
    color: #aa1419;
  }

  @media (prefers-reduced-motion: reduce) {
    .option,
    .ghost {
      transition: none;
    }
  }
</style>
