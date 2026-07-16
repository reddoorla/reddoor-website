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
// 30-char floor so short strings can't false-positive.
export function duplicatesIntro(candidate, introTexts) {
  const n = norm(candidate);
  if (n.length <= 30) return false;
  return introTexts
    .map(norm)
    .some((t) => t.length > 30 && (t.startsWith(n.slice(0, 60)) || n.startsWith(t.slice(0, 60))));
}

// Plan the updated slice array for one doc.
//
// Only the LEADING CONTIGUOUS RUN of intro-type slices is treated as "the
// intro" and replaced — an editor-added lead_text/text_columns/accordion
// deeper in the document is content, not intro, and is preserved. When
// `dropExistingLead` is set, the slice immediately after the intro is dropped
// ONLY if it is a rich_text whose copy duplicates the new lead/accordion
// (`introTexts`); an organic editor paragraph never matches and is kept.
//
// Idempotent by construction: planSlices(planSlices(x).slices) === same
// slices — on a re-run the leading run is the freshly-written intro, and the
// duplicate paragraph (if any) is already gone.
export function planSlices({ existing, intro, dropExistingLead = false, introTexts = [] }) {
  let run = 0;
  while (run < existing.length && INTRO_TYPES.has(existing[run].slice_type)) run++;
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
