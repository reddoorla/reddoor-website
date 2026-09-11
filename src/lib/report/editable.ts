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

/** A rendered leaf, paired with whatever the caller uses to identify it.
 *  Generic over that identifier so this module stays DOM-free and testable. */
export type Candidate<T> = { id: T; text: string };

/** A leaf that maps to exactly one target, and that target. */
export type Resolved<T> = { id: T; target: EditTarget };

/**
 * Match rendered leaves against targets, keeping only what resolves uniquely.
 *
 * Ambiguity runs in BOTH directions and both are refused:
 *
 *  - one string naming several targets — the same sentence is overridable
 *    under two different keys, so we cannot tell which the operator means;
 *  - one target rendered in several places — we know the key, but not which
 *    of the elements on screen the operator is looking at.
 *
 * Either way the answer is to skip and count, never to guess. An edit landing
 * on a line the operator was not looking at is worse than an edit that never
 * lands: the first is a wrong claim in a document sent to a stranger, the
 * second is a line they retype somewhere else.
 *
 * Extracted from the component so the rule above is unit-testable. It is the
 * whole safety argument for click-to-edit, and a browser test that is skipped
 * without a live token is not where it should be proven.
 */
export function resolveTargets<T>(
  candidates: Candidate<T>[],
  targets: EditTarget[],
): { resolved: Resolved<T>[]; ambiguous: number } {
  const byText = new Map<string, EditTarget[]>();
  for (const t of targets) {
    const list = byText.get(t.text) ?? [];
    list.push(t);
    byText.set(t.text, list);
  }

  // Counted once up front rather than re-scanned per candidate: the obvious
  // per-candidate version is a document-wide query inside the loop, which is
  // quadratic on a report carrying several hundred targets.
  const renderCount = new Map<string, number>();
  for (const c of candidates) renderCount.set(c.text, (renderCount.get(c.text) ?? 0) + 1);

  const resolved: Resolved<T>[] = [];
  let ambiguous = 0;

  for (const c of candidates) {
    const matches = byText.get(c.text);
    if (!matches) continue;
    if (matches.length > 1 || (renderCount.get(c.text) ?? 0) > 1) {
      ambiguous++;
      continue;
    }
    resolved.push({ id: c.id, target: matches[0]! });
  }

  return { resolved, ambiguous };
}
