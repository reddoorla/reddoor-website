import type { AuditReport, OverrideMap } from "./fetch";
import { CONFLATION_KEY, HIDEABLE, hiddenRowKeys } from "./overrides";
import {
  confirmedRows,
  contradictedRows,
  notSourcedFromSite,
  openingSummary,
  statements,
  toReportView,
  type Assertion,
  type ReportView,
} from "./model";
import {
  displayQuote,
  headlineFinding,
  passes,
  collisionBlock,
  collisionFix,
  healthFixEntries,
} from "./narrative";
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
 *  receipt rather than rewording an opinion. An assertion's `claim` is absent
 *  too (W2): the page prints the assistant's quote and never our paraphrase,
 *  so a rewording of `claim` would be an edit that changes nothing on the
 *  page, and on a row stored without a `topic` it could move the row out of
 *  the withheld count. */
const PAYLOAD_FIELDS: { path: string; fields: string[] }[] = [
  { path: "siteChecks.data", fields: ["label", "why", "evidence"] },
  { path: "analyze.data.fixes", fields: ["title", "why"] },
  { path: "accuracy.data.assertions", fields: ["unverifiedReason"] },
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

/** The generated text behind a line: the override's `original` only while
 *  that override is the one on screen. A withheld override (its line moved,
 *  for instance because a row above it was hidden) shows the generated text,
 *  and recording the stale `original` against it would store an edit that can
 *  never render (W1 review round 1). */
function originalFor(map: OverrideMap, key: string, displayed: string): string {
  const ov = map[key];
  return ov && ov.text === displayed ? ov.original : displayed;
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
  // A hidden row is not on the page, so none of its lines is a target (review
  // round 2): listed, a rewording on it read as in force, and its text could
  // make a visible line with the same words ambiguous.
  const hidden = hiddenRowKeys(source, map);

  for (const { path, fields } of PAYLOAD_FIELDS) {
    const list = at(source, path);
    if (!Array.isArray(list)) continue;
    list.forEach((row, i) => {
      if (hidden.has(`${path}[${i}]`)) return;
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

  const block = collisionBlock(view);
  if (block) {
    push(out, map, "composed:collision.heading", block.heading);
    push(out, map, "composed:collision.detail", block.detail);
  }

  const collision = collisionFix(view);
  if (collision) {
    push(out, map, "composed:collisionFix.title", collision.title);
    push(out, map, "composed:collisionFix.why", collision.why);
  }

  // Keyed by the row, as `healthFixes` looks them up (W1 review round 4).
  healthFixEntries(view).forEach(({ rowKey, fix }) => {
    push(out, map, `composed:healthFix[${rowKey}].title`, fix.title);
    push(out, map, `composed:healthFix[${rowKey}].why`, fix.why);
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

/** One row an operator can take off the report (W1). */
export type HideTarget = {
  key: string;
  /** The row's identifying text in the STORED payload; the hide entry's
   *  `original`, which the renderer checks before hiding. */
  original: string;
  /** What kind of row, for the list ("Fix", "Source", …). */
  noun: string;
  /** What the list shows, when it is not `original`: an accuracy row is named
   *  by the assistant's quote, which is what the reader sees on the page (R1 fix
   *  10). The identity stays `original`. */
  label?: string;
  hidden: boolean;
  /** False for the last visible row of its section (review round 2): an
   *  emptied section reads as a measurement ("we could not pull a checkable
   *  statement", "we could not judge any of it"). Withdraw the report instead. */
  canHide: boolean;
};

const ACCURACY_ROWS = "accuracy.data.assertions";

/**
 * R2. The accuracy statements the page prints, one target each, read from the
 * payload as stored (`raw`, before overrides). A target is keyed by the
 * statement's first stored row, so a hide entry names a row the page can find;
 * its label is the quote the page prints, and when two printed statements share
 * a label, both carry the question they answered. A statement the page withholds
 * or counts is not offered: hiding it changes nothing on the page.
 */
function accuracyTargets(raw: AuditReport, map: OverrideMap, noun: string): HideTarget[] {
  const list = at(raw, ACCURACY_ROWS);
  if (!Array.isArray(list)) return [];
  const view = toReportView(raw);
  const stored = view.accuracy?.assertions ?? [];
  // The rows the three printed lists hold: the same functions the page calls,
  // so an offered statement is one the page prints.
  const printed = new Set<Assertion>([
    ...notSourcedFromSite(view),
    ...contradictedRows(view),
    ...confirmedRows(view),
  ]);
  const found = statements(view)
    .filter((s) => printed.has(s.row))
    .map((s) => ({
      index: stored.indexOf(s.rows[0]!),
      label: `“${displayQuote(s.row.engineQuote)}”`,
      query: s.row.query,
    }))
    .filter((x) => x.index >= 0);

  const labelCount = new Map<string, number>();
  for (const f of found) labelCount.set(f.label, (labelCount.get(f.label) ?? 0) + 1);

  const out: HideTarget[] = [];
  for (const { index, label, query } of found) {
    const original = (list[index] as { claim?: unknown } | undefined)?.claim;
    if (typeof original !== "string" || original.trim() === "") continue;
    const key = `${ACCURACY_ROWS}[${index}]`;
    out.push({
      key,
      original,
      noun,
      label: (labelCount.get(label) ?? 0) > 1 ? `${label} (asked: ${query})` : label,
      hidden: map[key]?.hidden === true && map[key]!.original === original,
      canHide: true,
    });
  }
  return out;
}

/**
 * Every row on this report that can be hidden, read from the payload as stored
 * (`raw`, before overrides), so a hidden row is still listed and can be put
 * back. Rows with no identifying text are left out: there is nothing to show
 * the operator, and nothing for the stale-original guard to compare.
 */
export function hideTargets(raw: AuditReport, map: OverrideMap): HideTarget[] {
  const out: HideTarget[] = [];
  for (const { path, field, noun } of HIDEABLE) {
    const list = at(raw, path);
    if (!Array.isArray(list)) continue;
    if (path === ACCURACY_ROWS) out.push(...accuracyTargets(raw, map, noun));
    else
      list.forEach((row, i) => {
        const original = (row as Record<string, unknown> | null)?.[field];
        if (typeof original !== "string" || original.trim() === "") return;
        const key = `${path}[${i}]`;
        out.push({
          key,
          original,
          noun,
          hidden: map[key]?.hidden === true && map[key]!.original === original,
          canHide: true,
        });
      });
    const rows = out.filter((t) => t.key.startsWith(`${path}[`));
    const visible = rows.filter((t) => !t.hidden);
    if (visible.length === 1) visible[0]!.canHide = false;
  }
  const c = at(raw, "accuracy.data.conflation") as
    { detected?: unknown; settled?: unknown; engineQuote?: unknown } | undefined;
  // Offered only when the block is on the page: since #375 it renders only for
  // an answer that did not settle which business it means.
  if (c && c.detected === true && c.settled === false) {
    const original = typeof c.engineQuote === "string" ? c.engineQuote : "";
    out.push({
      key: CONFLATION_KEY,
      original,
      noun: "Name collision (the assistant is not sure which business you are)",
      hidden: map[CONFLATION_KEY]?.hidden === true && map[CONFLATION_KEY]!.original === original,
      canHide: true,
    });
  }
  return out;
}

/** One entry of the override map, as the changes list shows it. `stale` is a
 *  rewording the page is withholding, because the line it named no longer
 *  reads as it did (a hide above it moved it, or a row it was built from was
 *  reworded): listed so it can be reverted, never shown as in force. */
export type ChangeRow = {
  key: string;
  kind: "hidden" | "reworded" | "stale";
  before: string;
  after: string;
};

/** Every override on this report, for the changes list with its Revert.
 *  `targets` are the lines as rendered now (`editableTargets`), which is how a
 *  rewording is told apart from one the page withholds. */
export function changeList(map: OverrideMap, targets: EditTarget[] = []): ChangeRow[] {
  const shown = new Set(targets.map((t) => `${t.key}\u0000${t.text}`));
  return Object.entries(map).flatMap(([key, ov]): ChangeRow[] => {
    if (!ov || typeof ov.original !== "string") return [];
    if (ov.hidden === true) return [{ key, kind: "hidden", before: ov.original, after: "" }];
    if (typeof ov.text !== "string") return [];
    const kind = shown.has(`${key}\u0000${ov.text}`) ? "reworded" : "stale";
    return [{ key, kind, before: ov.original, after: ov.text }];
  });
}
