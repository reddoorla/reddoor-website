import type { ReportView } from "./model";

const OLD_HEADING = "What AI is saying about you";

/**
 * The AI section's heading. When every answer behind it came from a Claude
 * engine and carries its ask date, the heading names Claude and the day
 * they were asked (or the first and last day), in Los Angeles time, so a reader knows which assistant and
 * which day. Anything else keeps the old heading: a mixed or unknown engine,
 * or an answer with no date, is not a claim this heading can make.
 */
export function aiSectionHeading(view: ReportView): string {
  const answers = [...view.categoryProbes, ...view.brandedProbes];
  if (answers.length === 0) return OLD_HEADING;
  const claude = answers.every((a) => /^claude/.test(a.engine) && Boolean(a.askedAt));
  if (!claude) return OLD_HEADING;
  const times = answers.map((a) => new Date(a.askedAt).getTime());
  if (times.some((t) => Number.isNaN(t))) return OLD_HEADING;
  const day = (t: number): string =>
    new Date(t).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      timeZone: "America/Los_Angeles",
    });
  const first = day(Math.min(...times));
  const last = day(Math.max(...times));
  // One day only when every ask fell on it; a run that crossed midnight
  // names both ends rather than claiming one day for all of it.
  return first === last
    ? `What Claude said about you on ${first}`
    : `What Claude said about you between ${first} and ${last}`;
}
