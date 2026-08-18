<script lang="ts">
  import { formatTime, formatZone, formatDayLabel, type SlotDay } from "$lib/schedule/slots";

  /**
   * Choosing a day and a time, in the VISITOR's timezone.
   *
   * Extracted from /schedule when /reschedule needed the same thing: the
   * calendar's hours are Mountain and this is an LA-facing business, so the
   * conversion and the named zone are load-bearing rather than decorative, and
   * two copies of that would be two chances to get it wrong.
   *
   * Deliberately presentational — it holds no fetch, no error state and no
   * submit. The pages differ in what a chosen slot MEANS (a new booking, or
   * moving an existing one), and that difference belongs to them.
   */

  let {
    days,
    timeZone,
    selectedKey = $bindable(),
    selectedSlot = $bindable(),
    /** Called after a time is chosen, for whatever the page does next (focus). */
    onchoose,
    /** Called after the day changes, which also clears the chosen time. */
    ondaychange,
    /** Rendered under the times — the reschedule page marks the current slot. */
    children,
  }: {
    days: SlotDay[];
    timeZone?: string;
    selectedKey: string;
    selectedSlot: string | null;
    onchoose?: (iso: string) => void;
    ondaychange?: () => void;
    children?: import("svelte").Snippet;
  } = $props();

  const selectedDay = $derived(days.find((d) => d.key === selectedKey));
  /** Taken from a real slot so it lands on the right side of any DST boundary
   *  inside the booking window. */
  const zoneLabel = $derived(days[0]?.slots[0] ? formatZone(days[0].slots[0], timeZone) : "");
</script>

<p class="zone-note">
  Times shown in your local time{zoneLabel ? ` (${zoneLabel})` : ""}.
</p>

<!-- Buttons with aria-pressed rather than a tablist: there is one panel, it is
     always visible, and real tabs would promise an arrow-key model the layout
     does not need. -->
<div class="days" role="group" aria-label="Choose a day">
  {#each days as day (day.key)}
    {@const label = formatDayLabel(day, timeZone)}
    <button
      type="button"
      class="day"
      class:is-selected={day.key === selectedKey}
      aria-pressed={day.key === selectedKey}
      onclick={() => {
        selectedKey = day.key;
        selectedSlot = null;
        ondaychange?.();
      }}
    >
      <span class="day-weekday">{label.weekday}</span>
      <span class="day-date">{label.date}</span>
    </button>
  {/each}
</div>

{#if selectedDay}
  {@const dayLabel = formatDayLabel(selectedDay, timeZone)}
  <div
    class="times"
    role="group"
    aria-label="Available times on {dayLabel.weekday} {dayLabel.date}"
  >
    {#each selectedDay.slots as slot (slot)}
      <button
        type="button"
        class="time"
        class:is-selected={slot === selectedSlot}
        aria-pressed={slot === selectedSlot}
        onclick={() => {
          selectedSlot = slot;
          onchoose?.(slot);
        }}
      >
        {formatTime(slot, timeZone)}
      </button>
    {/each}
  </div>
{/if}

{@render children?.()}

<style>
  /* Values, not tokens, matching InquiryModal and /schedule — these screens are
     read back to back. #d71920 primary, #bbbdbf light, #6e6f72 muted. */
  .zone-note {
    margin: 0 0 12px;
    font-size: 14px;
    font-weight: 200;
    color: #6e6f72;
  }

  .days {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 22px;
  }
  .day {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 72px;
    padding: 10px 14px;
    border: 1px solid #bbbdbf;
    border-radius: 4px;
    background: #fff;
    color: #000;
    cursor: pointer;
    transition:
      border-color 300ms,
      background-color 300ms,
      color 300ms;
  }
  .day:hover {
    border-color: #6e6f72;
  }
  .day.is-selected {
    border-color: #d71920;
    background: #d71920;
    color: #fff;
  }
  .day-weekday {
    font-size: 13px;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .day-date {
    font-size: 15px;
    font-weight: 200;
  }

  .times {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
    gap: 8px;
  }
  .time {
    padding: 12px 10px;
    border: 1px solid #bbbdbf;
    border-radius: 4px;
    background: #fff;
    color: #000;
    font-size: 15px;
    font-weight: 200;
    /* The grid is a column of numerals; proportional digits make it ragged. */
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    transition:
      border-color 300ms,
      background-color 300ms,
      color 300ms;
  }
  .time:hover {
    border-color: #6e6f72;
  }
  .time.is-selected {
    border-color: #d71920;
    background: #d71920;
    color: #fff;
  }

  .day:focus-visible,
  .time:focus-visible {
    outline: 2px solid #d71920;
    outline-offset: 1px;
  }

  @media (prefers-reduced-motion: reduce) {
    .day,
    .time {
      transition: none;
    }
  }
</style>
