import type { AuditReport } from "./fetch";

/**
 * The shape the report components consume.
 *
 * The stored payload is a pipeline result: every stage is wrapped in a
 * `StageResult` (`{ok:true,data}` or `{ok:false,error}`) because any stage may
 * legitimately fail without failing the audit. Unwrapping that in each
 * component would spread the same defensive branching across the whole page and
 * make "not measured" easy to render as "zero" by accident — which is the
 * difference between an honest report and a wrong one.
 *
 * So it is unwrapped once, here. A missing or failed stage becomes `null`, and
 * the page says plainly that it could not be measured.
 */

export type Answered = "yes" | "partial" | "no";

export type BuyerQuestion = {
  question: string;
  answered: Answered;
  quotable: boolean;
  page: string | null;
  evidence: string | null;
};

export type Fix = {
  title: string;
  why: string;
  impact: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  tier: "crawl" | "content" | "technical";
};

export type ProbeAnswer = {
  engine: string;
  query: string;
  kind: "branded" | "category" | "competitor";
  domainCited: boolean;
  brandMentioned: boolean;
  /** The scorer's own verdict on this answer, recorded upstream so nothing has
   *  to re-derive it. Re-deriving is exactly what went wrong: the audit only
   *  counts an unprompted brand mention when the name could not be a
   *  coincidence, and this file's looser `domainCited || brandMentioned` counted
   *  it always — so a business called "Creative Studio" could be shown as named
   *  in an answer that referenced nobody, above a score of zero derived from the
   *  stricter rule. Optional: reports stored before it existed lack it, and the
   *  loose rule remains their only available fallback. */
  countedAsVisible?: boolean;
  citedDomains: string[];
  snippet: string;
  truncated: boolean;
  askedAt: string;
};

export type CitedDomain = { domain: string; count: number };

export type SourceCount = { domain: string; count: number; share: number };

/**
 * How the engine answers this category, as opposed to how the prospect scored.
 *
 * The visibility score cannot carry a report on its own. Across the audits run
 * so far it is zero for two thirds of sites and takes four distinct values in
 * total, so most prospects cannot be told apart by it — and a bare zero invites
 * the one question the audit cannot honestly answer.
 *
 * Two zeros can mean opposite things. A category answered by Stryker, Arthrex
 * and the FDA is one no website work reaches, and the honest advice is to spend
 * the money elsewhere. A category answered by five local practices the
 * prospect's own size is plainly reachable, and they are simply not in it. The
 * fields below are what let the page tell those apart instead of printing the
 * same zero for both.
 *
 * Declared structurally rather than imported: the real type ships as part of
 * `@reddoorla/maintenance/audit`, and this repo cannot take that dependency
 * bump yet — see the note in `fetch.ts`.
 */
export type AnswerSpace = {
  answersWithCitations: number;
  queriesAsked: number;
  citationsTotal: number;
  distinctDomains: number;
  topSources: SourceCount[];
  domainsToHalf: number | null;
  medianWidthPerAnswer: number | null;
  ownDomainRank: number | null;
  ownDomainCount: number;
  topRival: SourceCount | null;
};

/**
 * The three checks that measure whether the site WORKS, as opposed to whether
 * it can be found and read.
 *
 * Lighthouse audits one page and scores it. It does not crawl, so it never sees
 * the link that 404s three pages in, and it reports a performance number
 * without naming the image that caused it. "Your performance is 60" is a grade.
 * "This one photograph is 2.25 MB and it is on every page" is a job.
 *
 * Declared structurally for the same reason as `AnswerSpace` — see `fetch.ts`
 * for why this repo cannot yet import the real types.
 */
export type Journey = {
  affordances: { kind: "form" | "tel" | "mailto"; page: string; detail: string }[];
  pages: { url: string; clicksToContact: number | null; internalLinks: number }[];
  deadEnds: string[];
  worstClicksToContact: number | null;
  pagesExamined: number;
};

export type ContactVariant = {
  normalized: string;
  seenAs: string[];
  pages: string[];
  /** Written as a `tel:`/`mailto:` link anywhere on the site? Absent on reports
   *  stored before it was recorded — which must read as "not measured", not as
   *  "not a link". */
  linked?: boolean;
};

export type Consistency = {
  phones: ContactVariant[];
  emails: ContactVariant[];
  copyrightYears: number[];
  newestCopyrightYear: number | null;
  pagesOffTemplate: string[];
  sharedNavLinks: number;
  pagesExamined: number;
};

/** One reachability answer. `measured: false` means the request itself failed —
 *  which is ours or the network's, never reportable as the site's defect. */
export type Reachability = {
  measured: boolean;
  url: string;
  ok: boolean;
  landedOn: string | null;
  error: string | null;
};

/**
 * The things a stranger would check first.
 *
 * This section used to be four findings and a copyright year, which meant that
 * on a healthy site the loudest row in "Does it work" was one reading
 * "2026 — current". A row that says nothing is wrong should not be the same size
 * as a row that says eleven links are broken, and a heading that promises "does
 * it work" should cover more than whether the footer is up to date.
 *
 * Three of these cost requests; the rest come free out of the crawl. Declared
 * structurally for the same reason as `AnswerSpace` — see `fetch.ts`.
 */
export type Basics = {
  insecureEntry: Reachability;
  hostVariant: Reachability & { host: string };
  notFound: Reachability & { status: number | null; linksBackToSite: boolean };
  mixedContent: { measured: boolean; imageUrls: string[]; imagesSeen: number };
  altText: { imagesTotal: number; imagesWithAlt: number; pagesExamined: number };
  duplicateTitles: { title: string; pages: string[] }[];
};

export type ProbedUrl = {
  url: string;
  status: number | null;
  bytes: number | null;
  error: string | null;
  referencedBy: string[];
};

export type Assets = {
  brokenLinks: ProbedUrl[];
  brokenImages: ProbedUrl[];
  heaviestImages: ProbedUrl[];
  imageBytesMeasured: number | null;
  imagesWithKnownSize: number;
  linksFound: number;
  linksChecked: number;
  imagesFound: number;
  imagesChecked: number;
};

export type ReportView = {
  url: string;
  businessName: string | null;
  generatedAt: string;
  scores: {
    findability: number | null;
    readability: number | null;
    answers: number | null;
    aiVisibility: number | null;
  };
  /** The honest denominator behind the AI Visibility score. A bare 0 invites an
   *  argument; "named in 0 of 3 searches" invites a question. Null when the
   *  probe stage did not run at all — which is not the same as scoring zero. */
  visibility: { named: number; total: number } | null;
  /** The shape of the answer the prospect is absent from. Null for a report
   *  stored before the audit measured it — the page says "not measured" rather
   *  than reconstructing it here, so there is one implementation of this
   *  arithmetic and it is the one that has tests. */
  answerSpace: AnswerSpace | null;
  /** Can a visitor reach a way of contacting you from where they landed? */
  journey: Journey | null;
  /** Does the site tell the same story on every page? */
  consistency: Consistency | null;
  /** What is broken, and what is heavy. Null when the stage did not run — the
   *  page says "not measured" rather than "nothing broken", which are opposite
   *  claims and only one of them is ours to make. */
  assets: Assets | null;
  /** The things a stranger checks first. Null when the stage did not run. */
  basics: Basics | null;
  /** Does every page carry a viewport meta? Read off `checks` rather than
   *  recomputed, so there is one implementation and it is the one with tests.
   *  Null when checks did not run. */
  viewportOk: boolean | null;
  brandedRecognized: boolean | null;
  categoryProbes: ProbeAnswer[];
  brandedProbes: ProbeAnswer[];
  citedDomains: CitedDomain[];
  /** A cited domain whose name closely matches the business's own. The single
   *  most valuable finding of the first real audit rendered as an anonymous row
   *  in a competitor list; it is surfaced here so the page can name it. */
  namesake: CitedDomain | null;
  fixes: Fix[];
  buyerQuestions: BuyerQuestion[];
  questionTally: { yes: number; partial: number; no: number };
  narrative: { findability: string; readability: string; answers: string } | null;
};

/** `{ok:true,data:T}` → T; anything else → null. */
function stage<T>(value: unknown): T | null {
  if (!value || typeof value !== "object") return null;
  const s = value as { ok?: unknown; data?: unknown };
  return s.ok === true && s.data !== undefined ? (s.data as T) : null;
}

/** The registrable label of a hostname: "reddoorcreative.com" → "reddoorcreative". */
function domainLabel(domain: string): string {
  const host = domain.replace(/^www\./i, "").toLowerCase();
  return (host.split(".")[0] ?? "").replace(/[^a-z0-9]/g, "");
}

/** Letters and digits only, so "Reddoor Creative" and "reddoorcreative.com"
 *  become comparable. */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** The prospect's own registrable label, or "" when the url is unparseable —
 *  in which case nothing is excluded and every cited domain stays eligible,
 *  which is the safe direction: we would rather surface a candidate a human
 *  dismisses than silently skip the real one. */
function ownDomainLabel(url: string): string {
  try {
    return domainLabel(new URL(url).hostname);
  } catch {
    return "";
  }
}

/**
 * Find a cited domain that is trading on the prospect's own name.
 *
 * Matched on the registrable label rather than the full host, and only when one
 * side contains the other — so "reddoorcreative" matches a business called
 * "Reddoor Creative" while "clutch" does not.
 *
 * A short name would match far too much ("ace" appears inside plenty of
 * domains), so a floor applies: below it, a coincidence is likelier than a
 * collision, and asserting a collision to a prospect who then checks is worse
 * than staying quiet.
 *
 * The prospect's own domain is excluded — it is not a namesake of itself.
 */
export function findNamesake(
  businessName: string | null,
  ownUrl: string,
  cited: CitedDomain[],
): CitedDomain | null {
  if (!businessName) return null;
  const name = normalizeName(businessName);
  if (name.length < 8) return null;

  const own = ownDomainLabel(ownUrl);

  for (const entry of cited) {
    const label = domainLabel(entry.domain);
    if (!label || label === own) continue;
    if (label.includes(name) || name.includes(label)) return entry;
  }
  return null;
}

export function toReportView(raw: AuditReport): ReportView {
  const r = raw as Record<string, unknown>;

  const analyze = stage<{
    buyerQuestions?: BuyerQuestion[];
    fixes?: Fix[];
    narrative?: { findability: string; readability: string; answers: string };
  }>(r.analyze);

  const probes = stage<{
    answers?: ProbeAnswer[];
    visibilityScore?: number | null;
    brandedRecognized?: boolean;
    competitorsSeen?: CitedDomain[];
    categoryProbes?: { attempted: number; answered: number };
    answerSpace?: AnswerSpace;
  }>(r.probes);

  // `checks` carries the two pure site checks; `assets` is its own stage
  // because it is the only one that makes requests. Both unwrap through the
  // same `stage()` helper, so a failure becomes null and the page says so.
  const checks = stage<{ journey?: Journey; consistency?: Consistency; viewportOk?: boolean }>(
    r.checks,
  );
  const assets = stage<Assets>(r.assets);
  const basics = stage<Basics>(r.basics);

  const scoresRaw = (r.scores ?? {}) as Record<string, number | null>;
  const answers = probes?.answers ?? [];
  const categoryProbes = answers.filter((a) => a.kind === "category");
  // Prefer what the run says it attempted; fall back to what answered for a
  // report stored before the audit recorded attempts.
  const visibilityTotal = probes?.categoryProbes?.attempted ?? categoryProbes.length;
  const buyerQuestions = analyze?.buyerQuestions ?? [];
  const citedDomains = probes?.competitorsSeen ?? [];
  const businessName = (r.businessName as string | null) ?? null;
  const url = (r.url as string) ?? "";

  return {
    url,
    businessName,
    generatedAt: (r.generatedAt as string) ?? "",
    scores: {
      findability: scoresRaw.findability ?? null,
      readability: scoresRaw.readability ?? null,
      answers: scoresRaw.answers ?? null,
      aiVisibility: scoresRaw.aiVisibility ?? null,
    },
    // The denominator is what was ASKED, not what came back.
    //
    // This used to read `total: categoryProbes.length` and call it "the number
    // of searches actually run" — but that array holds the probes that ANSWERED.
    // A probe the engine errored on was dropped upstream and disappeared from
    // the denominator too, so three dead probes out of five turned 1-of-5 into
    // "named in 1 of 2" and a flakier run showed better. `categoryProbes.attempted`
    // is the honest figure; the array length is the fallback for reports stored
    // before that field existed, which is the best those reports can offer.
    //
    // `named` reads the scorer's own verdict for the same reason: the looser
    // `domainCited || brandMentioned` here ignored the distinctive-name gate the
    // score applies, so this line could claim the business was named in answers
    // that contributed zero to the score printed beside it.
    visibility: visibilityTotal
      ? {
          named: categoryProbes.filter(
            (a) => a.countedAsVisible ?? (a.domainCited || a.brandMentioned),
          ).length,
          total: visibilityTotal,
        }
      : null,
    answerSpace: probes?.answerSpace ?? null,
    journey: checks?.journey ?? null,
    consistency: checks?.consistency ?? null,
    assets,
    basics,
    viewportOk: checks?.viewportOk ?? null,
    brandedRecognized: probes ? (probes.brandedRecognized ?? null) : null,
    categoryProbes,
    brandedProbes: answers.filter((a) => a.kind === "branded"),
    citedDomains,
    namesake: findNamesake(businessName, url, citedDomains),
    fixes: analyze?.fixes ?? [],
    buyerQuestions,
    questionTally: {
      yes: buyerQuestions.filter((q) => q.answered === "yes").length,
      partial: buyerQuestions.filter((q) => q.answered === "partial").length,
      no: buyerQuestions.filter((q) => q.answered === "no").length,
    },
    narrative: analyze?.narrative ?? null,
  };
}
