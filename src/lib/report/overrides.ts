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
 * The rows an operator may take off the report (W1, DES-11, BR-12): a list
 * item named by `<path>[<i>]`, identified by one of its own fields.
 *
 * An entry `{ "<path>[<i>]": { original, text: "", hidden: true } }` hides
 * that row when `row[field] === original` in the payload as STORED (before any
 * text override), the same stale-original guard the text overrides get.
 * Hiding removes the row from the list the view is built from, so everything
 * derived from it goes with it: a hidden site check takes its health row and
 * health fix too.
 */
export const HIDEABLE: { path: string; field: string; noun: string }[] = [
  { path: "siteChecks.data", field: "label", noun: "Check" },
  { path: "analyze.data.fixes", field: "title", noun: "Fix" },
  { path: "accuracy.data.assertions", field: "claim", noun: "What the assistant said" },
  { path: "accuracy.data.sources", field: "domain", noun: "Source" },
  { path: "goalFit.data.requirements", field: "label", noun: "Goal requirement" },
];

/** The name-collision block is one object, not a list item. Hiding it reads as
 *  "the assistant did not confuse you with anyone": the block, its headline
 *  and its fix come off when they came from this verdict. A namesake found
 *  among the cited domains is a separate finding and stays. Its identifying
 *  field is the quote it rests on (empty when it has none). */
export const CONFLATION_KEY = "accuracy.data.conflation";

/** An accuracy assertion's `claim`: the paraphrase, which no override may reword
 *  (R1 fix 9). */
const ASSERTION_CLAIM_KEY = /^accuracy\.data\.assertions\[\d+\]\.claim$/;

function getAt(root: unknown, path: (string | number)[]): unknown {
  let node: unknown = root;
  for (const seg of path) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string | number, unknown>)[seg];
  }
  return node;
}

/** Which entries of the map hide something, resolved against the STORED
 *  payload: list paths to the indices they hide, and whether the collision
 *  block is hidden. A malformed or stale entry hides nothing. */
function hiddenRows(
  raw: AuditReport,
  map: OverrideMap,
): { lists: Map<string, Set<number>>; conflation: boolean } {
  const lists = new Map<string, Set<number>>();
  let conflation = false;
  for (const [key, ov] of Object.entries(map)) {
    if (!ov || ov.hidden !== true || typeof ov.original !== "string") continue;
    if (key === CONFLATION_KEY) {
      const c = getAt(raw, ["accuracy", "data", "conflation"]) as
        { engineQuote?: unknown } | undefined;
      if (
        c &&
        typeof c === "object" &&
        (typeof c.engineQuote === "string" ? c.engineQuote : "") === ov.original
      )
        conflation = true;
      continue;
    }
    const m = /^(.+)\[(\d+)\]$/.exec(key);
    if (!m) continue;
    const spec = HIDEABLE.find((h) => h.path === m[1]);
    if (!spec) continue;
    const parts = parsePath(key);
    if (!parts) continue;
    const row = getAt(raw, parts) as Record<string, unknown> | undefined;
    if (!row || typeof row !== "object" || row[spec.field] !== ov.original) continue;
    const set = lists.get(spec.path) ?? new Set<number>();
    set.add(Number(m[2]));
    lists.set(spec.path, set);
  }
  return { lists, conflation };
}

/** Replace the value at `path` with `fn(old)`, cloning each container on the
 *  way down so the input is never mutated. */
function writeAt(
  root: AuditReport,
  path: (string | number)[],
  fn: (old: unknown) => unknown,
): AuditReport {
  const out: AuditReport = { ...root };
  let node = out as Record<string | number, unknown>;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = path[i]!;
    const child = node[seg];
    if (child === null || typeof child !== "object") return root;
    node[seg] = Array.isArray(child) ? [...child] : { ...(child as object) };
    node = node[seg] as Record<string | number, unknown>;
  }
  const last = path[path.length - 1]!;
  node[last] = fn(node[last]);
  return out;
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

  // Resolved against the stored payload BEFORE any text override, so a row
  // whose title was also reworded is still recognised by its stored title.
  const hidden = hiddenRows(raw, map);

  let out: AuditReport = raw;
  let cloned = false;

  for (const [key, ov] of entries) {
    // A hide entry names a row, not a string; it is applied after this loop.
    if (ov && (ov as { hidden?: unknown }).hidden === true) continue;
    // R1 fix 9: an assertion's `claim` is our paraphrase, and what a row is
    // withheld by reads it. An operator's rewording of it would change what the
    // page withholds, so it is not applied. The page prints the quote instead.
    if (ASSERTION_CLAIM_KEY.test(key)) continue;
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

  // Hides last, and by index against the stored order: the text overrides
  // above are positional, so removing rows first would shift their indices.
  for (const [listPath, indices] of hidden.lists) {
    const parts = parsePath(listPath)!;
    out = writeAt(out, parts, (list) =>
      Array.isArray(list) ? list.filter((_, i) => !indices.has(i)) : list,
    );
  }
  if (hidden.conflation) {
    out = writeAt(out, ["accuracy", "data", "conflation"], () => ({
      detected: false,
      otherNames: [],
      engineQuote: null,
    }));
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
  if (!ov || typeof ov.text !== "string") return generated;
  // W1 review round 5. An emptied sentence is not an override. The reader's
  // filter lists only lines with text, so an empty one rendered as gone for
  // the editor while the prospect read the generated sentence. To take a line
  // off the page, hide its row.
  if (ov.text.trim() === "") return generated;
  const matches =
    typeof ov.originalDigest === "string"
      ? ov.originalDigest === digest(generated)
      : ov.original === generated;
  return matches ? ov.text : generated;
}

/**
 * A short, synchronous, non-cryptographic digest of a sentence (cyrb53), used
 * to carry a composed override's stale-original guard to a reader WITHOUT
 * carrying the sentence it replaced (W1 review round 2). It only has to tell
 * "the sentence is still the one that was reworded" from "it changed", so
 * collision resistance against an adversary is not the property needed; the
 * page data must simply not contain the old words.
 */
export function digest(s: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** The keys of the rows the map hides, resolved against the stored payload
 *  (`<path>[<i>]`, or CONFLATION_KEY). The editor uses it to leave a hidden
 *  row's lines out of what it wires and lists as in force. */
export function hiddenRowKeys(raw: AuditReport, map: OverrideMap): Set<string> {
  const { lists, conflation } = hiddenRows(raw, map);
  const out = new Set<string>();
  for (const [path, idx] of lists) for (const i of idx) out.add(`${path}[${i}]`);
  if (conflation) out.add(CONFLATION_KEY);
  return out;
}
