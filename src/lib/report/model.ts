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
  citedDomains: string[];
  snippet: string;
  truncated: boolean;
  askedAt: string;
};

export type CitedDomain = { domain: string; count: number };

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
  }>(r.probes);

  const scoresRaw = (r.scores ?? {}) as Record<string, number | null>;
  const answers = probes?.answers ?? [];
  const categoryProbes = answers.filter((a) => a.kind === "category");
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
    // Counted from the probe answers rather than derived from the score, so the
    // denominator is always the number of searches actually run.
    visibility: categoryProbes.length
      ? {
          named: categoryProbes.filter((a) => a.domainCited || a.brandMentioned).length,
          total: categoryProbes.length,
        }
      : null,
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
