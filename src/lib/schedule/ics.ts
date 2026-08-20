/**
 * Calendar hand-off formats, built server-side.
 *
 * The point of building these on the server is that an intro call's DESCRIPTION
 * contains the Zoom join URL with its password in the query string. A page that
 * rendered "Add to Google Calendar" as a client-side link would put that URL in
 * our HTML, where a forwarded email turns into a joinable meeting. Instead the
 * routes redirect, and the join URL only ever exists in a `Location` header or
 * inside a downloaded file.
 *
 * Pure string work with fiddly escaping rules, so it lives apart from the routes
 * and is tested on its own.
 */

export type CalendarEvent = {
  title: string;
  /** ISO 8601 with offset, as the CRM returns it. */
  startTime: string;
  endTime: string;
  /** The Zoom join URL. Ends up in the description and the LOCATION field. */
  join: string;
};

/** `20260821T170000Z` — the only shape both Google and RFC 5545 accept. */
export function toUtcStamp(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) throw new RangeError(`unparseable time: ${iso}`);
  return new Date(t)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/**
 * RFC 5545 §3.3.11 text escaping: backslash first, or it doubles the escapes
 * added after it, then the characters that would otherwise end a value or start
 * a new one.
 */
export function escapeIcsText(v: string): string {
  return v
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Fold to 75 octets per RFC 5545 §3.1. Counted in BYTES, not characters — a
 * naive character count splits multi-byte glyphs across the fold and produces a
 * file that some clients reject and others render as mojibake.
 */
export function foldIcsLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;

  const out: string[] = [];
  let current = "";
  let bytes = 0;
  // Iterating the string yields whole code points, so a character is never cut.
  for (const ch of line) {
    const size = enc.encode(ch).length;
    // Continuation lines are one leading space plus 74 octets of content.
    const limit = out.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      out.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  if (current) out.push(current);
  return out.map((l, i) => (i === 0 ? l : ` ${l}`)).join("\r\n");
}

/** A single-event .ics. CRLF throughout — RFC 5545 requires it. */
export function buildIcs(event: CalendarEvent, uid: string, stamp: string): string {
  const description = `Join the call: ${event.join}`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Reddoor Creative//Intro Call//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(uid)}@reddoorla.com`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${toUtcStamp(event.startTime)}`,
    `DTEND:${toUtcStamp(event.endTime || event.startTime)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `LOCATION:${escapeIcsText(event.join)}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

/** Google Calendar's event-template URL. */
export function googleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toUtcStamp(event.startTime)}/${toUtcStamp(event.endTime || event.startTime)}`,
    details: `Join the call: ${event.join}`,
    location: event.join,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** Outlook on the web's compose-event deeplink. Takes plain ISO, not UTC stamps. */
export function outlookCalendarUrl(event: CalendarEvent): string {
  const iso = (v: string) => new Date(Date.parse(v)).toISOString();
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: iso(event.startTime),
    enddt: iso(event.endTime || event.startTime),
    body: `Join the call: ${event.join}`,
    location: event.join,
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params}`;
}
