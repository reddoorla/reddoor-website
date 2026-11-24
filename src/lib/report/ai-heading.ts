import type { ReportView } from "./model";

const OLD_HEADING = "What AI is saying about you";

/**
 * The AI section's heading. When every answer behind it came from a Claude
 * engine and carries its ask date, the heading names Claude and the earliest
 * of those dates, in Los Angeles time, so a reader knows which assistant and
 * which day. Anything else keeps the old heading: a mixed or unknown engine,
 * or an answer with no date, is not a claim this heading can make.
 */
export function aiSectionHeading(view: ReportView): string {
  const answers = [...view.categoryProbes, ...view.brandedProbes];
  if (answers.length === 0) return OLD_HEADING;
  const claude = answers.every((a) => /^claude/.test(a.engine) && Boolean(a.askedAt));
  if (!claude) return OLD_HEADING;
  const earliest = answers
    .map((a) => new Date(a.askedAt).getTime())
    .reduce((a, b) => Math.min(a, b));
  if (Number.isNaN(earliest)) return OLD_HEADING;
  const day = new Date(earliest).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  });
  return `What Claude said about you on ${day}`;
}
