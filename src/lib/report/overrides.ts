import type { AuditReport, Override, OverrideMap } from "./fetch";

export type { Override, OverrideMap };

/**
 * Operator edits, applied to a generated report.
 *
 * Two families of key, because rendered copy comes from two places:
 *
 *  - a JSON path into the stored payload, e.g. `siteChecks.data[0].why`. Note
 *    the `.data`: every pipeline stage is a StageResult, so the payload nests
 *    one level deeper than the view components see.
 *  - `composed:<name>`, for sentences this repo writes from data and which do
 *    not exist in the payload at all — the opening summary, the headline
 *    finding, the health rows.
 *
 * WHY POSITIONAL PATHS ARE SAFE HERE. Normally `fixes[2].why` is a fragile key,
 * because a regeneration reorders the list. A stored audit never changes:
 * `result_json` is written once, and re-auditing a site mints a NEW token with
 * no overrides at all. So there is no drift for a key to survive.
 *
 * The `original` check below guards that reasoning rather than the data. It
 * should never fire. That is exactly why it is tested with a deliberate
 * mismatch — a guard that has only ever passed is not a guard.
 */

/** Split `a.b[0].c` into ["a","b",0,"c"]. Returns null for anything that is not
 *  a payload path, which is how `composed:` keys are skipped. */
function parsePath(key: string): (string | number)[] | null {
  if (key.startsWith("composed:")) return null;
  const parts: (string | number)[] = [];
  for (const seg of key.split(".")) {
    const m = /^([A-Za-z_$][\w$]*)((?:\[\d+\])*)$/.exec(seg);
    if (!m) return null;
    parts.push(m[1]!);
    for (const idx of m[2]!.matchAll(/\[(\d+)\]/g)) parts.push(Number(idx[1]));
  }
  return parts;
}

/**
 * Replace payload-resident strings named by the map.
 *
 * Returns a structurally-shared copy: only the objects along an overridden path
 * are cloned, so a report with no overrides costs one shallow clone. Never
 * mutates its input, because `toReportView` is a `$derived` and must stay pure.
 */
export function applyOverrides(raw: AuditReport, map: OverrideMap): AuditReport {
  const entries = Object.entries(map);
  if (entries.length === 0) return raw;

  let out: AuditReport = raw;
  let cloned = false;

  for (const [key, ov] of entries) {
    const path = parsePath(key);
    if (!path || path.length === 0) continue;

    // Walk first WITHOUT cloning, so a path that does not resolve, or an
    // override that is withheld, costs nothing and changes nothing.
    let probe: unknown = out;
    for (const seg of path) {
      if (probe === null || typeof probe !== "object") {
        probe = undefined;
        break;
      }
      probe = (probe as Record<string | number, unknown>)[seg];
    }
    if (typeof probe !== "string" || probe !== ov.original) continue;

    if (!cloned) {
      out = { ...out };
      cloned = true;
    }
    // Clone each container on the way down, then write the leaf.
    let node = out as Record<string | number, unknown>;
    for (let i = 0; i < path.length - 1; i++) {
      const seg = path[i]!;
      const child = node[seg];
      node[seg] = Array.isArray(child) ? [...child] : { ...(child as object) };
      node = node[seg] as Record<string | number, unknown>;
    }
    node[path[path.length - 1]!] = ov.text;
  }

  return out;
}

/**
 * The override for one composed sentence, or the generated text.
 *
 * Called at the point a sentence is written rather than after, so the generated
 * value is available to compare against `original`.
 */
export function composed(map: OverrideMap, key: string, generated: string): string {
  const ov = map[key];
  if (!ov || ov.original !== generated) return generated;
  return ov.text;
}
