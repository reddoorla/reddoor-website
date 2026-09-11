import type { AuditReport, OverrideMap } from "./fetch";
import { openingSummary, type ReportView } from "./model";
import { headlineFinding, passes, collisionFix, healthFixes } from "./narrative";
import { healthRows } from "./health";

/** One line an operator can rewrite. */
export type EditTarget = {
  /** The override key. */
  key: string;
  /** What is on screen right now — already an override, if one applies. */
  text: string;
  /**
   * The GENERATED text this key replaces.
   *
   * Never the same thing as `text` once a line has been edited. Recording the
   * displayed text as `original` on a second edit would make the override stop
   * matching the payload, and plan A's guard would then silently withhold it —
   * a bug whose symptom is "my edit did nothing".
   */
  original: string;
};

/** The payload fields an operator may rewrite, as `[stage path, field names]`.
 *  Verbatim quotes are absent on purpose: `engineQuote` and `siteQuote` are
 *  verified substrings of somebody else's words, and editing one forges a
 *  receipt rather than rewording an opinion. */
const PAYLOAD_FIELDS: { path: string; fields: string[] }[] = [
  { path: "siteChecks.data", fields: ["label", "why", "evidence"] },
  { path: "analyze.data.fixes", fields: ["title", "why"] },
  { path: "accuracy.data.assertions", fields: ["claim", "unverifiedReason"] },
  { path: "goalFit.data.requirements", fields: ["label", "why", "evidence"] },
];

function at(obj: unknown, path: string): unknown {
  let node: unknown = obj;
  for (const seg of path.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[seg];
  }
  return node;
}

function originalFor(map: OverrideMap, key: string, displayed: string): string {
  return map[key]?.original ?? displayed;
}

function push(out: EditTarget[], map: OverrideMap, key: string, text: unknown): void {
  if (typeof text !== "string" || text.trim() === "") return;
  out.push({ key, text, original: originalFor(map, key, text) });
}

/**
 * Every line on this report an operator can rewrite, with its override key.
 *
 * Built from the view rather than from the DOM, so the edit layer never has to
 * guess what a piece of text means. The layer matches these strings against
 * what is rendered and wires up the ones that resolve uniquely; anything
 * ambiguous is left alone and counted.
 *
 * `raw` is the payload BEFORE overrides, which the edit page passes through
 * untouched. Payload targets are read from it so their text is the generated
 * text when nothing overrides them.
 *
 * ── Order is meaningful, and it is not alphabetical ─────────────────────────
 *
 * Health rows are enumerated BEFORE the sentences built from them. `healthRows`
 * is not a leaf: `passes` builds its items as `${row.label}: ${row.value}`,
 * `healthFixes` builds each `why` as `${spec.what} ${row.detail}`, and
 * `headlineFinding`'s site-check branch prints a row label. So an override on a
 * health row changes the GENERATED text of all three, which invalidates any
 * `original` already recorded against them.
 *
 * A consumer walking this array in order therefore meets a cause before its
 * effects. That does not make the problem go away — it cannot be fixed here,
 * and plan A's stale-original guard is what makes it detectable at all — but it
 * means a save that processes targets in order records the upstream edit first.
 */
export function editableTargets(view: ReportView, raw?: AuditReport): EditTarget[] {
  const out: EditTarget[] = [];
  const map = view.overrides;
  const source = raw ?? ({} as AuditReport);

  for (const { path, fields } of PAYLOAD_FIELDS) {
    const list = at(source, path);
    if (!Array.isArray(list)) continue;
    list.forEach((row, i) => {
      for (const f of fields) {
        const key = `${path}[${i}].${f}`;
        const generated = (row as Record<string, unknown>)[f];
        if (typeof generated !== "string" || generated.trim() === "") continue;
        // Withheld overrides show their generated text, exactly as the page
        // does: `map[key].original === generated` is the same comparison plan
        // A's `applyOverrides` makes, so an override the renderer is refusing
        // is one this list refuses too. The operator never sees a target whose
        // text is not what is on screen.
        const displayed = map[key]?.original === generated ? map[key]!.text : generated;
        out.push({ key, text: displayed, original: generated });
      }
    });
  }

  // Health rows first — see the ordering note above.
  healthRows(view).forEach((r) => {
    push(out, map, `composed:health[${r.key}].label`, r.label);
    push(out, map, `composed:health[${r.key}].value`, r.value);
    push(out, map, `composed:health[${r.key}].detail`, r.detail);
  });

  // Composed sentences. Each is read through its own function, so the text here
  // is exactly what the page renders.
  push(out, map, "composed:headlineFinding", headlineFinding(view).text);
  push(out, map, "composed:openingSummary", openingSummary(view));

  passes(view).forEach((g, i) => {
    push(out, map, `composed:passes[${i}].title`, g.title);
    g.items.forEach((item, j) => push(out, map, `composed:passes[${i}].items[${j}]`, item));
  });

  const collision = collisionFix(view);
  if (collision) {
    push(out, map, "composed:collisionFix.title", collision.title);
    push(out, map, "composed:collisionFix.why", collision.why);
  }

  healthFixes(view).forEach((f, i) => {
    push(out, map, `composed:healthFix[${i}].title`, f.title);
    push(out, map, `composed:healthFix[${i}].why`, f.why);
  });

  return out;
}
