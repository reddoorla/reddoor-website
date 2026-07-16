// Pure slice-planning logic for the portfolio-intro migration, extracted so it
// can be unit-tested (scripts/portfolio-intro/lib.test.mjs) without touching
// the Prismic API. migrate.mjs is the I/O shell around this.

export const INTRO_TYPES = new Set(["lead_text", "text_columns", "accordion"]);

export const textOf = (rt) =>
  Array.isArray(rt)
    ? rt
        .map((b) => b.text)
        .filter(Boolean)
        .join(" ")
    : "";

const norm = (s) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");

// Does `candidate` duplicate one of the new intro's texts? Same prefix
// heuristic the original batch migration used to classify the dropExistingLead
// docs: normalized 60-char prefix containment, in either direction, with a
// 30-char floor. Honest scope: this matches only text that BEGINS with the
// same ~60 normalized characters as the intro copy — i.e., re-pasted intro
// text (possibly with an edited tail). A paragraph that opens with the intro's
// exact first sentence would also match; anything else won't.
export function duplicatesIntro(candidate, introTexts) {
  const n = norm(candidate);
  if (n.length <= 30) return false;
  return introTexts
    .map(norm)
    .some((t) => t.length > 30 && (t.startsWith(n.slice(0, 60)) || n.startsWith(t.slice(0, 60))));
}

// Plan the updated slice array for one doc.
//
// "The intro" is identified POSITIONALLY against the intro we are writing:
// starting at slice 0, consume at most one existing slice per intro slot, and
// only while each matches its slot's slice_type (lead_text, then text_columns,
// then the optional accordion). This is what a previous run of this migration
// wrote — and nothing else:
//   • an editor-added intro-type slice DEEPER in the doc is never reached;
//   • an editor accordion sitting directly AFTER the intro's accordion is the
//     4th slice against a 3-slot intro — not consumed (the naive "leading
//     contiguous run of intro types" scan absorbed and deleted it);
//   • a never-migrated doc that happens to OPEN with an editor accordion
//     doesn't match slot 0 (lead_text) — nothing is consumed.
//
// When `dropExistingLead` is set, the slice immediately after the consumed
// intro is dropped ONLY if it is a rich_text whose copy prefix-duplicates the
// new lead/accordion (`duplicatesIntro` above).
//
// Idempotent by construction: a re-run consumes exactly the intro it wrote
// (same slot types), rewrites it, and the duplicate paragraph (if any) is
// already gone — planSlices(planSlices(x).slices) returns identical slices.
export function planSlices({ existing, intro, dropExistingLead = false, introTexts = [] }) {
  let run = 0;
  while (
    run < existing.length &&
    run < intro.length &&
    existing[run].slice_type === intro[run].slice_type
  ) {
    run++;
  }
  let kept = existing.slice(run);

  let dropped = null;
  if (dropExistingLead && kept[0]?.slice_type === "rich_text") {
    const candidate = textOf(kept[0].primary?.content);
    if (duplicatesIntro(candidate, introTexts)) {
      dropped = candidate;
      kept = kept.slice(1);
    }
  }

  return { slices: [...intro, ...kept], dropped, replacedIntroCount: run };
}
