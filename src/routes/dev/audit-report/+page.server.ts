import { readFileSync } from "node:fs";
import { dev } from "$app/environment";
import type { AuditReport } from "$lib/report/fetch";

/**
 * Loads a real audit sample when one has been dumped, and nothing otherwise.
 *
 * DEV ONLY, and gated on `dev` rather than merely on the file being missing:
 * this reads an arbitrary JSON file off disk and hands it to the renderer, and
 * that is a thing to do on a laptop and never in a build.
 *
 * A parse failure returns null rather than throwing. The point of the page is
 * to see the renderer cope with imperfect input; taking the whole route down
 * because the input was malformed would defeat it.
 */
export const load = (): { sample: AuditReport | null } => {
  if (!dev) return { sample: null };
  try {
    return { sample: JSON.parse(readFileSync(".audit-sample.json", "utf8")) as AuditReport };
  } catch {
    return { sample: null };
  }
};
