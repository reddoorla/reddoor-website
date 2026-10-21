/**
 * Sample data for /preview/funnel, the page that shows every state of the
 * booking funnel without making a booking.
 *
 * A page given one of these renders straight into the named state and never
 * calls an API: no slots are fetched, nothing is booked, cancelled or moved,
 * and the visitor's handoff and URL are left alone. Every value is visibly
 * fake, so a screenshot of the preview cannot be mistaken for a real booking.
 */
export type SampleVisitor = {
  name: string;
  email: string;
  phone: string;
  timeZone: string;
  /** ISO times, as /api/slots returns them. */
  slots: string[];
};

export type SchedulePreview = SampleVisitor & { state: "default" | "applied" | "booked" };
export type CancelPreview = SampleVisitor & { state: "ready" | "cancelled" | "gone" | "missing" };
export type ReschedulePreview = SampleVisitor & {
  state: "ready" | "moved" | "gone" | "missing";
};

/**
 * Three slots on each of the next two weekdays after `now`, 9am, 10:30am and
 * 2pm Mountain (the calendar's own hours, as the CRM sends them). Computed on
 * the server and passed down, so the server and the browser agree.
 */
export function sampleSlots(now: Date): string[] {
  const out: string[] = [];
  const day = new Date(now);
  while (out.length < 6) {
    day.setUTCDate(day.getUTCDate() + 1);
    const dow = day.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    const ymd = day.toISOString().slice(0, 10);
    for (const t of ["09:00", "10:30", "14:00"]) out.push(`${ymd}T${t}:00-06:00`);
  }
  return out;
}

export function sampleVisitor(now: Date): SampleVisitor {
  return {
    name: "Sample Visitor",
    email: "sample.visitor@example.com",
    phone: "+1 (555) 010-0199",
    timeZone: "America/Los_Angeles",
    slots: sampleSlots(now),
  };
}
