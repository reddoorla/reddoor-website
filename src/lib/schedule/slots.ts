/**
 * Turning the CRM's free slots into something a visitor can read.
 *
 * The whole module exists because of one mismatch: GHL buckets slots by the
 * LOCATION's calendar date (America/Boise — Mountain), and returns each slot as
 * an ISO string carrying that offset. A visitor reads dates in their own zone.
 * Rendering the CRM's day key beside a time converted to the visitor's zone
 * produces a header and a time that disagree — and for a visitor far enough east
 * or west, disagree by a whole day.
 *
 * So nothing here ever trusts the CRM's day key. Slots arrive flat and are
 * regrouped by the visitor's local date, and every label is derived from a real
 * instant rather than from a date string. That second rule matters more than it
 * looks: `new Date("2026-08-19")` parses as UTC midnight, so formatting it
 * anywhere west of Greenwich renders the day before.
 */

/** A day's slots, keyed by the VISITOR's local date. */
export type SlotDay = {
  /** YYYY-MM-DD in the visitor's zone. Identity only — never formatted. */
  key: string;
  /** Absolute ISO timestamps, ascending. */
  slots: string[];
};

/**
 * The visitor's IANA zone, or undefined where the platform won't say — in which
 * case every formatter below falls through to the system default, which is the
 * same answer by a different route.
 */
export function resolveTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/** en-CA is the shortest route to a YYYY-MM-DD in an arbitrary zone. */
function dayKey(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Regroup a flat slot list into the visitor's calendar days.
 *
 * Unparseable entries are dropped rather than rendered as "Invalid Date" — the
 * list is machine-generated, so a bad entry is a CRM change we have not caught
 * up with, and showing the visitor a broken button helps nobody.
 */
export function groupByDay(slots: string[], timeZone?: string): SlotDay[] {
  const byDay = new Map<string, { at: number; iso: string }[]>();
  for (const iso of slots) {
    const at = Date.parse(iso);
    if (Number.isNaN(at)) continue;
    const key = dayKey(new Date(at), timeZone);
    const bucket = byDay.get(key);
    if (bucket) bucket.push({ at, iso });
    else byDay.set(key, [{ at, iso }]);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entries]) => ({
      key,
      slots: entries.sort((a, b) => a.at - b.at).map((e) => e.iso),
    }));
}

/** "9:00 AM" — or the visitor locale's own 24-hour equivalent. */
export function formatTime(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/**
 * The zone's short name at that instant ("PDT"), which is why it takes an
 * instant and not just a zone: the abbreviation flips across a DST boundary,
 * and a booking five days out can sit on the far side of one.
 */
export function formatZone(iso: string, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "short",
  }).formatToParts(new Date(iso));
  return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
}

/**
 * A day's tab label, derived from one of its own slots rather than from its
 * key — see the header note about UTC midnight.
 */
export function formatDayLabel(day: SlotDay, timeZone?: string): { weekday: string; date: string } {
  const d = new Date(day.slots[0]);
  return {
    weekday: new Intl.DateTimeFormat(undefined, { timeZone, weekday: "short" }).format(d),
    date: new Intl.DateTimeFormat(undefined, { timeZone, month: "short", day: "numeric" }).format(
      d,
    ),
  };
}

/** "Tuesday, 19 August at 9:00 AM PDT" — the confirmation line. */
export function formatFullSlot(iso: string, timeZone?: string): string {
  const when = new Intl.DateTimeFormat(undefined, {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
  const zone = formatZone(iso, timeZone);
  return `${when} at ${formatTime(iso, timeZone)}${zone ? ` ${zone}` : ""}`;
}
