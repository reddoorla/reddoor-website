import { readFileSync } from "node:fs";
import { dev } from "$app/environment";
import { unwrap, type AuditReport } from "$lib/report/fetch";

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
 *
 * Read through `unwrap` for the same reason fetchReport does: the obvious way
 * to make this file is to dump the API response, which is now the wrapped
 * `{ report, overrides, … }` shape. Handed to the renderer raw, that renders a
 * silently hollow report instead of failing.
 */
export const load = (): { sample: AuditReport | null } => {
  if (!dev) return { sample: null };
  try {
    return { sample: unwrap(JSON.parse(readFileSync(".audit-sample.json", "utf8"))).report };
  } catch {
    return { sample: null };
  }
};
