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

const UNSAFE_SEGMENT = new Set(["__proto__", "constructor", "prototype"]);

/** Split `a.b[0].c` into ["a","b",0,"c"]. Returns null for anything that is not
 *  a payload path, which is how `composed:` keys are skipped. */
function parsePath(key: string): (string | number)[] | null {
  if (key.startsWith("composed:")) return null;
  const parts: (string | number)[] = [];
  for (const seg of key.split(".")) {
    const m = /^([A-Za-z_$][\w$]*)((?:\[\d+\])*)$/.exec(seg);
    if (!m) return null;
    // A payload path never legitimately names these. Rejecting them here makes
    // prototype pollution unreachable by construction rather than by the
    // accident that `typeof Object === "function"` fails the walk's object check.
    if (UNSAFE_SEGMENT.has(m[1]!)) return null;
    parts.push(m[1]!);
    for (const idx of m[2]!.matchAll(/\[(\d+)\]/g)) parts.push(Number(idx[1]));
  }
  return parts;
}

/**
 * Replace payload-resident strings named by the map.
 *
 * Returns a structurally-shared copy: only the objects along an overridden path
 * are cloned, so an empty map costs nothing at all and returns the input itself,
 * while each applied override costs the root clone plus one clone per level of
 * its path. Never mutates its input, because `toReportView` is a `$derived` and
 * must stay pure.
 */
export function applyOverrides(raw: AuditReport, map: OverrideMap): AuditReport {
  const entries = Object.entries(map);
  if (entries.length === 0) return raw;

  let out: AuditReport = raw;
  let cloned = false;

  for (const [key, ov] of entries) {
    const path = parsePath(key);
    if (!path) continue;

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
    // `ov` is defended before it is read, and `text` is checked, because
    // `OverrideMap` is a CAST at the fetch boundary and not a validated shape:
    // `unwrap` proves only that `overrides` is a non-array object. So an entry
    // is a claim about wire data, not a fact, and this module treats the map as
    // untrusted — a malformed entry is withheld exactly like a stale one. This
    // runs inside a `$derived` on the prospect-facing page, where a throw blanks
    // the report rather than degrading it.
    if (!ov || typeof ov.text !== "string" || typeof probe !== "string" || probe !== ov.original)
      continue;

    // `cloned` guards only the ROOT clone. Inner containers are re-cloned on
    // every override's walk, so two overrides under one parent clone it twice.
    // That redundancy is knowingly accepted: a report carries a handful of
    // overrides over a shallow payload, and the alternative is a path trie.
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
  // `typeof ov.text` is checked for the same reason `applyOverrides` checks it:
  // `OverrideMap` is a cast at the fetch boundary, not a validated shape, so the
  // declared `: string` return is only as true as the wire data. Without this,
  // a non-string `text` would be returned from a function TypeScript believes
  // cannot do that.
  if (!ov || typeof ov.text !== "string" || ov.original !== generated) return generated;
  return ov.text;
}
