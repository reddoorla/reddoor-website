import type { AuditReport } from "./fetch";
import { applyOverrides, composed, type OverrideMap } from "./overrides";
import {
  checkDenominatorOf,
  completeOf,
  inPagesRead,
  phraseOf,
  readNothing,
  type PagesDenominator,
} from "./pages-read";
import { statementIdentity } from "./quote";

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

/** "unknown" is ours, not a verdict about the site: we asked a question from
 *  the fixed set and did not get an answer back for it. It is rendered, and it
 *  is excluded from every proportion — a gap in our measurement must never be
 *  counted as something their site failed to say. */
export type Answered = "yes" | "partial" | "no" | "unknown";

export type BuyerQuestion = {
  /** Key from the fixed set; absent on reports stored before the set existed. */
  id?: string;
  question: string;
  answered: Answered;
  quotable: boolean;
  page: string | null;
  evidence: string | null;
  /** Set when the model said `no` but the question's key words are on a page
   *  we crawled: the producer then made the verdict `unknown`. The word and the
   *  page, so the table can say where it looked. Absent on older reports. */
  notFound?: { term: string; page: string };
};

/**
 * One statement an engine made about this business, sorted by SOURCE.
 *
 * Never by truth. We cannot know whether a claim is right — the engine may be
 * perfectly correct about a fact the site simply never mentions — and telling a
 * client "the AI got this wrong" about something they know is true would
 * discredit every other line in the report. "Your site does not say this, and
 * here is who the engine read instead" is both the honest framing and the
 * stronger one, because it points at something they control.
 */
export type Assertion = {
  claim: string;
  verdict: "confirmed" | "contradicted" | "absent" | "unverified";
  engineQuote: string;
  siteQuote: string | null;
  unverifiedReason: string | null;
  /** Something related the site DOES say, on a claim we still call absent —
   *  the client's first objection, answered before it is raised. */
  nearbyMention: string | null;
  sourceDomains: string[];
  query: string;
  engine: string;
  /** Who the statement is about (W2). Absent on rows stored before
   *  2026-11-23, which are read as about the prospect: there is no other
   *  reading to fall back on, and the quote and the withhold below are what
   *  keep those rows honest. */
  subject?: "prospect" | "other" | "unclear";
  otherName?: string | null;
  /** What kind of fact it is (W2). Absent on older rows; `withheldTopic`
   *  reads the text instead. */
  topic?: AssertionTopic;
  /** The attribute and the two values, on a `contradicted` that survived the
   *  producer's value check. */
  contradiction?: { attribute: string; engineValue: string; siteValue: string } | null;
};

export type AssertionTopic =
  | "ratings_reviews"
  | "complaints"
  | "accreditation"
  | "legal_entity"
  | "ownership"
  | "named_person"
  | "revenue_headcount"
  | "street_address"
  | "other";

export type SourceVerdict = {
  domain: string;
  owner: "yours" | "platform" | "theirs" | "unknown";
  because: string;
};

export type Accuracy = {
  assertions: Assertion[];
  sources: SourceVerdict[];
  siteFullyRead: boolean;
  pagesRead: number;
  pagesTotal: number;
  /** URLs the site's own sitemap lists, or null when we never learned it.
   *  Absent on rows stored before the producer recorded it. */
  siteUrlCount?: number | null;
  /** Zero means we had no engine answer to read. The section must then say it
   *  was not measured — never "nothing wrong was found". */
  answersRead: number;
  /** The assistant gave this name to something else too. Only when it also
   *  did not settle which one this business is is that a finding: see
   *  `nameUnsettled`. Absent on reports stored before it was recorded, which
   *  read as not-detected. */
  conflation: Conflation;
};

export type Conflation = {
  detected: boolean;
  /**
   * Did the answer still say which one this business is, and keep the others
   * apart? Recorded by audits from 2026-11-23; absent before.
   *
   * Absent never reads as unsure. The audit's earlier verdict asked only
   * whether the answer named "more than one business under this name", a
   * definition written around a case where the answer really could not tell.
   * A stored answer that named the business first, with its city, its work and
   * its site, and then said two unrelated things shared its initials, was
   * recorded as detected, and the report led on "not sure which you are".
   */
  settled?: boolean;
  /** The other things the answer gave the name to, each with what it is in the
   *  answer's own words. Not necessarily businesses. */
  otherNames: string[];
  engineQuote: string | null;
};

const NO_CONFLATION: Conflation = { detected: false, otherNames: [], engineQuote: null };

/**
 * The assistant gave this business's name to something else too, and its own
 * verdict says it did not settle which one it meant. The only name collision
 * from the branded answers that the report states as a finding: the lead
 * finding, the "not sure which you are" block and its fix all ask this.
 */
export function nameUnsettled(acc: Accuracy | null | undefined): boolean {
  return Boolean(acc?.conflation.detected) && acc?.conflation.settled === false;
}

export type Fix = {
  title: string;
  why: string;
  impact: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  tier: "crawl" | "content" | "technical";
  /** "measured": code wrote it from a check that ran — a finding, printed
   *  first. "recommendation": the model wrote it — judgement, printed below
   *  and labelled as such. Reports stored before the split were all
   *  model-written and read as recommendations. */
  origin: "measured" | "recommendation";
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
/**
 * What they are running. NOT a check — see the module comment in the audit's
 * `stack.ts`. Nothing here passes or fails and nothing enters a denominator;
 * it opens the report so a reader knows we looked before they read a finding.
 *
 * `measured: false` means we could not see, which the page must render as "we
 * could not tell" rather than as an absence of technology.
 */
export type StackReadout = {
  measured: boolean;
  items: { layer: string; name: string; evidence: string }[];
  pagesExamined: number;
  headersExamined: boolean;
};

/**
 * One Tier 0 check — the things a careful person would check with a browser
 * and ten minutes. See `site-checks.ts` in the audit.
 *
 * FOUR states. `unmeasured` is our gap and `not-applicable` is a check this
 * site has nothing for; both must render as neither a pass nor a failure, and
 * both must stay out of any count the page prints.
 */
export type SiteCheck = {
  key: string;
  label: string;
  status: "pass" | "fail" | "unmeasured" | "not-applicable";
  evidence: string | null;
  why: string;
  scope: "quick" | "content" | "structural";
};

/**
 * What the axe rule set found, run against the rendered DOM.
 *
 * `measured: false` means the rules did not run — never that nothing was
 * found. `rulesPassed` is what had something to check and was fine, NOT the
 * size of the rule set: the default set is 90 rules and roughly half have
 * nothing to apply to on any given page, so `rulesInapplicable` is carried to
 * keep the arithmetic honest.
 */
export type Accessibility = {
  measured: boolean;
  pagesExamined: number;
  rulesPassed: number;
  rulesIncomplete: number;
  /** The undecided rules by name. Optional: reports stored before this was
   *  captured have the count and not the names, which reads as "we did not
   *  record which", never as "there were none". */
  incompleteIds?: string[];
  rulesInapplicable: number;
  violations: {
    id: string;
    impact: "minor" | "moderate" | "serious" | "critical" | null;
    help: string;
    helpUrl: string;
    nodes: number;
    sample: string | null;
    pages: string[];
  }[];
  violationsTotal: number;
};

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

/**
 * Can a visitor do the one thing this site needs them to do?
 *
 * Every other section grades the site against questions that are the same for
 * everyone. This one names a purpose and reads the findings through it, because
 * a dental practice's site succeeds when somebody books and a branding studio's
 * succeeds when a qualified enquiry arrives with a budget attached.
 *
 * `status` is deliberately three-valued. It was a boolean, and on real data
 * that turned checks we could not measure into defects we reported — see the
 * note in the audit's own `goals.ts`.
 *
 * Declared structurally for the same reason as `AnswerSpace` — see `fetch.ts`.
 */
export type RequirementStatus = "met" | "missing" | "unmeasured";

export type GoalRequirement = {
  key: string;
  label: string;
  status: RequirementStatus;
  evidence: string | null;
  why: string;
  scope: "quick" | "content" | "structural";
};

export type GoalFit = {
  goal: string;
  source: "inferred" | "operator";
  requirements: GoalRequirement[];
  met: number;
  total: number;
};

/** Mirrors GOAL_LABELS in the audit. Kept here rather than imported for the
 *  same dependency reason, and kept short — it completes the sentence "your
 *  site needs a visitor to …". */
export const GOAL_LABELS: Record<string, string> = {
  book: "book an appointment",
  enquire: "start a project or ask for a quote",
  call: "pick up the phone",
  visit: "come to you in person",
  buy: "buy something",
  demo: "talk to your sales team",
  partner: "ask about distribution or partnership",
  unknown: "do something we could not identify",
};

/**
 * The verdict sentence that opens the report.
 *
 * A pure function rather than markup because it is the first full sentence the
 * client reads about their own business, and it has to survive every count —
 * the template it replaced rendered "1 of the 6 things it needs are not".
 *
 * `judged` counts only what we could actually measure, so a site where half the
 * checks were unmeasured never has our own gaps folded into its denominator.
 */
const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

export function goalVerdict(missing: number, judged: number, where: string | null = null): string {
  // `where` is the clause an absence carries ("in the 20 of your 95 pages we
  // read"): an absence states the pages it rests on, or says nothing of them.
  const clause = where ? ` ${where}` : "";
  if (judged === 0) return "We could not judge any of what it needs to do that.";
  if (missing === 0) return "Everything it needs to do that is in place.";
  if (missing >= judged) return `None of what it needs to do that is in place${clause}.`;
  const word = NUMBER_WORDS[missing] ?? String(missing);
  const subject = word.charAt(0).toUpperCase() + word.slice(1);
  const verb = missing === 1 ? "is" : "are";
  const total = NUMBER_WORDS[judged] ?? String(judged);
  return `${subject} of the ${total} things it needs ${verb} not in place${clause}.`;
}

/**
 * Sites whose whole business is hosting listings about other businesses.
 *
 * Mirrors PLATFORMS in reddoor-maintenance's ownership.ts, and kept here rather
 * than imported for the same dependency reason as GOAL_LABELS: the report
 * renders from stored JSON and must not pull the audit toolchain in with it.
 *
 * It is used for one thing — telling the reader what KIND of thing the engine
 * reached for. A field of directories and a field of businesses the reader's own
 * size are the same number and opposite advice, and the number alone cannot
 * tell them apart.
 */
const COUNT_WORDS = [
  "no",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
];
const count = (n: number): string => COUNT_WORDS[n] ?? String(n);

/**
 * The first sentence of the report, derived from the same verdicts the
 * question table prints — so it cannot say an answer exists where the table
 * says No. The model still writes the fix rationales; it no longer writes the
 * summary of what it found. Questions we did not judge are left out of the
 * count and the list, the same way an unmeasured requirement leaves the goal
 * checklist's denominator.
 */
export function openingSummary(view: ReportView): string | null {
  const generated = openingSummaryText(view);
  if (generated === null) return null;
  return composed(view.overrides, "composed:openingSummary", generated);
}

function openingSummaryText(view: ReportView): string | null {
  const judged = view.buyerQuestions.filter((q) => q.answered !== "unknown");
  if (judged.length === 0) return null;
  const parts: string[] = [];
  if (view.goalFit && view.goalFit.goal !== "unknown") {
    parts.push(
      `Your site is built to get a visitor to ${GOAL_LABELS[view.goalFit.goal] ?? view.goalFit.goal}.`,
    );
  }
  const yes = judged.filter((q) => q.answered === "yes").length;
  const partial = judged.filter((q) => q.answered === "partial").length;
  const unanswered = judged
    .filter((q) => q.answered === "no")
    .map((q) =>
      q.question
        .trim()
        .replace(/[?.]$/, "")
        .replace(/^./, (c) => c.toLowerCase()),
    );
  const answered =
    yes === 0 && partial === 0
      ? "it answers none of them"
      : `it answers ${count(yes)} clearly${partial ? ` and ${count(partial)} partly` : ""}`;
  parts.push(`Of the ${count(judged.length)} questions buyers ask first, ${answered}.`);
  if (unanswered.length) {
    const list =
      unanswered.length === 1
        ? unanswered[0]
        : `${unanswered.slice(0, -1).join(", ")}, or ${unanswered.at(-1)}`;
    const where = inPagesRead(view);
    // Over zero pages read there is no absence to state: we never looked.
    parts.push(
      readNothing(view)
        ? `We could not read any of your pages, so we could not check whether it answers ${list}.`
        : `It does not answer${where ? `, ${where}` : ""}: ${list}.`,
    );
  }
  return parts.join(" ");
}

const bareHost = (d: string): string =>
  d
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");

/**
 * How many times the assistant cited the site itself across the branded
 * answers. The accuracy section lists what the assistant read INSTEAD, and
 * without this number a reader sees "reading your own site" over a list that
 * never names it. Subdomains count; a look-alike domain never does.
 */
export function ownSiteCitations(view: ReportView): number {
  return ownCitations(view, view.brandedProbes);
}

/** How many times these answers cited the site itself. */
function ownCitations(view: ReportView, probes: ProbeAnswer[]): number {
  let own: string;
  try {
    own = bareHost(new URL(view.url).hostname);
  } catch {
    return 0;
  }
  const isOwn = (d: string): boolean => {
    const h = bareHost(d);
    return h === own || h.endsWith(`.${own}`);
  };
  return probes.reduce((n, p) => n + p.citedDomains.filter(isOwn).length, 0);
}

const LISTING_SITES = [
  "yelp.com",
  "bbb.org",
  "yellowpages.com",
  "angi.com",
  "angieslist.com",
  "thumbtack.com",
  "houzz.com",
  "tripadvisor.com",
  "nextdoor.com",
  "foursquare.com",
  "mapquest.com",
  "trustpilot.com",
  "manta.com",
  "chamberofcommerce.com",
  "birdeye.com",
  "opentable.com",
  "zocdoc.com",
  "healthgrades.com",
  "vitals.com",
  "ratemds.com",
  "webmd.com",
  "patientconnect365.com",
  "carecredit.com",
  "sharecare.com",
  "wellness.com",
  "google.com",
  "bing.com",
  "apple.com",
  "duckduckgo.com",
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "youtube.com",
  "pinterest.com",
  "reddit.com",
  "crunchbase.com",
  "glassdoor.com",
  "indeed.com",
  "clutch.co",
  "g2.com",
  "capterra.com",
  "zoominfo.com",
  "dnb.com",
  "bloomberg.com",
  "wikipedia.org",
  "dribbble.com",
  "behance.net",
  "medium.com",
  "businesswire.com",
  "prnewswire.com",
];

/**
 * Everything the assistant said that our reading of the site does not account
 * for — `absent` and `unverified` in one list, under a heading that asserts
 * nothing.
 *
 * These were split into "not on your site" and "what we could not check" for a
 * day (#169), because the report had been printing `unverified` — the producer
 * explicitly declining to say — under "We did not find these on your site".
 * The split fixed that, and was still wrong: it assumed the two states are a
 * clean binary, a finding and a limit.
 *
 * The real cases are grey. "A man named Tim leads Reddoor Creative" is drawn
 * from LinkedIn, where he is the more active of two people the site's own team
 * page lists. Calling that "not on your site" is overblown — the site does
 * publish both names — and calling it "we could not check" undersells a claim
 * that genuinely misleads about who runs the business. It is neither, and no
 * verdict we store distinguishes "absent" from "implied by something adjacent".
 *
 * So the assertion moved out of the heading. "What the AI says about you" makes
 * no claim; the one hedged line under it — these SEEM not to be sourced from
 * your site — carries the whole thing, and is true across the grey. One list
 * can then hold the spectrum honestly, which two lists could not.
 *
 * `absent` first, then `unverified`: strongest first, and the order the report
 * has always used.
 */
export function notSourcedFromSite(view: ReportView): Assertion[] {
  const rows = printedRows(view, "notSourced");
  return [
    ...rows.filter((a) => a.verdict === "absent"),
    ...rows.filter((a) => a.verdict !== "absent"),
  ];
}

/**
 * R2. What a statement is, and what the page does with it. The page used to
 * decide per stored ROW, but a reader sees a SENTENCE, and one sentence is often
 * stored as several rows (the model splits it into claims). So every decision
 * is taken once per statement here, and every list, count and hide reads it.
 *
 * Each statement gets exactly one outcome, the first that applies:
 *  1. `unquoted`   its quote is empty: counted, never printed.
 *  2. `aboutOthers` one of its rows is not about the prospect: counted.
 *  3. `withheld`   one of its rows is on a withheld topic: counted, by topic.
 *  4. `contradicted` printed in the contradicted list.
 *  5. `confirmed`  printed in "What your site backs up", with a site quote.
 *  6. `notSourced` printed under "What the AI says about you".
 *
 * Rows are grouped by `statementIdentity` (quote.ts), in stored order, so `rows[0]` is the
 * row a hide targets. `row` is the one row the outcome prints from.
 */
export type StatementOutcome =
  "unquoted" | "aboutOthers" | "withheld" | "contradicted" | "confirmed" | "notSourced";

export type Statement = {
  key: string;
  rows: Assertion[];
  /** The row the statement prints from. */
  row: Assertion;
  outcome: StatementOutcome;
  /** For `withheld`: the first withheld topic, in TOPIC_ORDER. */
  topic: Exclude<AssertionTopic, "other"> | null;
  /** Every row is about the prospect. */
  about: boolean;
  /** R3 fix 1: one row is a contradiction about the prospect, whatever the
   *  other rows say. A mixed statement is not printed, but its contradiction
   *  still stands: the headline must not say all-clear over it. */
  prospectContradicted: boolean;
};

/** The words of a text, lower-cased, for whole-word comparison. */
const wordsOf = (s: string): string[] =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w !== "");

/** An empty quote has nothing to print, and `“”` is never a statement. */
function hasQuote(a: Assertion): boolean {
  return a.engineQuote.trim() !== "";
}

/**
 * A row stored before 2026-11-23 has no subject, and is read as about the
 * prospect unless its own quote names another business: the assistant's
 * "most likely match" hedge, or one of the names it gave to something else,
 * matched as whole words.
 */
function aboutProspect(a: Assertion, otherNames: string[] = []): boolean {
  if (a.subject !== undefined) return a.subject === "prospect";
  const quote = ` ${wordsOf(a.engineQuote).join(" ")} `;
  if (quote.includes(" most likely match ") || quote.includes(" likely match ")) return false;
  return !otherNames.some((n) => quote.includes(` ${wordsOf(n).join(" ")} `));
}

/**
 * The other names the answer gave this business, cut to the part before " (",
 * for matching the quote of a row stored without a subject. A short name (under
 * four letters) is skipped. A name is not another business when it is part of
 * this business's own name or contains it: "Acme (Dallas)" is this business's
 * own "Acme Roofing", not a second firm. Any other name is kept whole, and a row
 * with no subject is another firm's only when its quote holds that full name
 * (R5 fix 1: the first word of a name never matches on its own).
 */
export function otherNamesOf(view: ReportView): string[] {
  const own = wordsOf(view.businessName ?? "");
  const ownText = own.join(" ");
  const out: string[] = [];
  for (const raw of view.accuracy?.conflation?.otherNames ?? []) {
    const n = (raw.split(" (")[0] ?? "").trim();
    if (n.length < 4) continue;
    const w = wordsOf(n);
    if (w.length === 0) continue;
    if (own.length > 0) {
      const phrase = w.join(" ");
      const partOfOwn = ` ${ownText} `.includes(` ${phrase} `);
      const containsOwn = ` ${phrase} `.includes(` ${ownText} `);
      if (partOfOwn || containsOwn) continue;
    }
    out.push(n);
  }
  return out;
}

/**
 * Every statement on the check, decided once (see `Statement`). Not gated on
 * `sourceCheckMeasured`: each surface gates what it prints, as it always has.
 */
export function statements(view: ReportView): Statement[] {
  const names = otherNamesOf(view);
  const groups = new Map<string, Assertion[]>();
  for (const a of view.accuracy?.assertions ?? []) {
    const key = statementIdentity(a);
    const group = groups.get(key);
    if (group) group.push(a);
    else groups.set(key, [a]);
  }
  return [...groups.values()].map((rows) => decide(rows, names));
}

/** R4 fix 2: a row is a contradiction about the prospect when the engine said
 *  `contradicted`, or when it held the claim unverified on a withheld topic with
 *  a contradiction on record (maintenance#2256 stores that shape). */
function isProspectContradiction(a: Assertion, names: string[]): boolean {
  // R6 fix 6: a row the operator marked subject "unclear" is held as the client's
  // contradiction, not filed as another business's.
  return contradictsRow(a) && (a.subject === "unclear" || aboutProspect(a, names));
}

/** The engine said the site contradicts the claim: `contradicted`, or `unverified`
 *  with a contradiction on record (maintenance#2256 stores that shape). */
function contradictsRow(a: Assertion): boolean {
  return a.verdict === "contradicted" || (a.verdict === "unverified" && a.contradiction != null);
}

/** R4 fix 6: a contradiction with no words from the site has nothing to print
 *  as "your site says", so it is not a contradiction on the page. */
const hasSiteWords = (a: Assertion): boolean => (a.siteQuote ?? "").trim() !== "";

function decide(rows: Assertion[], names: string[]): Statement {
  const first = rows[0]!;
  const about = rows.every((a) => aboutProspect(a, names));
  // R3 fix 1: any row's contradiction about the prospect counts, not the first
  // row's subject alone.
  const prospectContradicted = rows.some((a) => isProspectContradiction(a, names));
  const withheld = rows
    .map((a) => withheldTopic(a))
    .filter((t): t is Exclude<AssertionTopic, "other"> => t !== null);
  const topic = TOPIC_ORDER.find((t) => withheld.includes(t)) ?? null;
  const contradicted = rows.find((a) => a.verdict === "contradicted" && hasSiteWords(a));
  // R4 fix 7: a confirmed row with no site quote is still backed up; it prints
  // under "What your site backs up" without the site line.
  const confirmed = rows.find((a) => a.verdict === "confirmed");
  const absent = rows.find((a) => a.verdict === "absent");
  // R6 fix 6: an unclear-subject contradiction is held as withheld: it prints nowhere
  // and the headline gives the withheld-contradiction wording, never the all-clear.
  const unclearHeld = rows.some((a) => a.subject === "unclear" && contradictsRow(a));

  let outcome: StatementOutcome;
  let row: Assertion;
  if (!hasQuote(first)) {
    outcome = "unquoted";
    row = first;
  } else if (unclearHeld) {
    outcome = "withheld";
    row = first;
  } else if (!about) {
    outcome = "aboutOthers";
    row = first;
  } else if (topic !== null) {
    outcome = "withheld";
    row = first;
  } else if (contradicted) {
    outcome = "contradicted";
    row = contradicted;
  } else if (confirmed) {
    outcome = "confirmed";
    row = confirmed;
  } else {
    outcome = "notSourced";
    row = absent ?? first;
  }
  return {
    key: statementIdentity(first),
    rows,
    row,
    outcome,
    topic,
    about,
    prospectContradicted,
  };
}

/** R8 §2. A stored row with no subject (stored before 2026-11-23). Its statements
 *  are not read by sentence pattern: the accuracy section says the check must be
 *  run again, and prints, counts and headlines none of them. */
export function hasOldRows(view: ReportView): boolean {
  return (view.accuracy?.assertions ?? []).some((a) => a.subject === undefined);
}

/** The row each statement with this outcome prints, in statement order. */
function printedRows(view: ReportView, outcome: StatementOutcome): Assertion[] {
  if (hasOldRows(view)) return [];
  return statements(view)
    .filter((s) => s.outcome === outcome)
    .map((s) => s.row);
}

/** R5 fix 5: the confirmed statements that print a site passage. The proof
 *  sentence counts these only, since a confirmed statement with no passage
 *  prints with nothing to match. */
export function confirmedWithPassage(view: ReportView): Assertion[] {
  return confirmedRows(view).filter(hasSiteWords);
}

/** Confirmed statements, with both quotes, for the reader to judge (BR-09). */
export function confirmedRows(view: ReportView): Assertion[] {
  if (!sourceCheckMeasured(view)) return [];
  return printedRows(view, "confirmed");
}

/** Contradictions printed as about the prospect. */
export function contradictedRows(view: ReportView): Assertion[] {
  // Gated like the section: a statement out of an answer the report says it
  // did not read is not printed anywhere, the headline included.
  if (!sourceCheckMeasured(view)) return [];
  return printedRows(view, "contradicted");
}

/**
 * A contradiction about the prospect that the page withholds: on a withheld
 * topic, or with no quote to print. While one stands, the report must not
 * say everything checks out (narrative's headline asks this).
 */
export function withheldContradictionKind(
  view: ReportView,
): "unquoted" | "withheld" | "mixed" | null {
  if (!sourceCheckMeasured(view)) return null;
  // R8 §2: an old-row report draws nothing from its rows, held or not.
  if (hasOldRows(view)) return null;
  // R3 fix 1: a statement that prints nothing and carries a contradiction about
  // the prospect counts, whether it is withheld, unquoted, or mixed with another
  // business's row. Printed outcomes never count: those are on the page.
  const held = statements(view).filter(
    (s) =>
      s.prospectContradicted &&
      s.outcome !== "contradicted" &&
      s.outcome !== "confirmed" &&
      s.outcome !== "notSourced",
  );
  if (held.length === 0) return null;
  // R4 fix 3: precedence. A withheld topic wins; then a statement that also
  // describes another business ("mixed"); then "unquoted" (R3 fix 7), when every
  // such statement has no quote to print.
  if (held.some((s) => s.outcome === "withheld")) return "withheld";
  if (held.some((s) => s.outcome === "aboutOthers")) return "mixed";
  return "unquoted";
}

export function withheldContradiction(view: ReportView): boolean {
  return withheldContradictionKind(view) !== null;
}

/**
 * The topics withheld from the page unless a person has checked the source.
 * Each harms a business when it is wrong, and nobody has checked it: a rating,
 * a complaint or alert, accreditation, the legal entity, who owns it, a named
 * person, revenue or headcount, a street address. The report counts them
 * instead (LGL-01, B-17).
 */
const TOPIC_LABEL: Record<Exclude<AssertionTopic, "other">, string> = {
  ratings_reviews: "ratings",
  complaints: "complaints",
  accreditation: "accreditation",
  legal_entity: "registration",
  ownership: "ownership",
  named_person: "named people",
  revenue_headcount: "revenue or staff numbers",
  street_address: "addresses",
};

/** A case-insensitive spelling of each word, for a pattern that must also test
 *  a capital letter (a name, a street word), where the `i` flag cannot be used. */
const ci = (words: string[]): string =>
  `(?:${words
    .map((w) => w.replace(/[a-z]/gi, (c) => `[${c.toLowerCase()}${c.toUpperCase()}]`))
    .join("|")})`;

/** R4 fix 1: the platform names a rating or review can be read off. Google
 *  counts only in its platform sense, not "Google Ads" and the like; Maps and
 *  Business Profile are platforms, so a rating on them is withheld (R5 fix 3). */
const PLATFORM =
  "(?:glassdoor|yelp|trustpilot|bbb|charity navigator|clutch|houzz|angi|thumbtack|g2|google(?!\\s+(?:ads|analytics|partner|cloud|workspace)\\b))";
/** A figure that looks like a score: "4.9", "4/5", "3 stars", "37 reviews". */
const SCORE_FIGURE =
  "(?:\\d\\.\\d\\b|\\d\\s*\\/\\s*(?:5|10)\\b|\\d\\s*stars?\\b|(?<!\\d)\\d{1,7}\\s+reviews?\\b|(?<!\\d)\\d{1,7}\\s+ratings?\\b)";
/** A count word or a digit run, for "twelve employees" and "40 staff". */
const NUM =
  "(?:\\d[\\d,]{0,12}\\+?|(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundred)\\b)";

/** Read off the words, for rows stored before the producer recorded a topic
 *  and for a model that files one under `other`. Errs wide, but only on words
 *  that name the topic: a false match withholds a true sentence the page could
 *  have printed, so each pattern is one a business's own description would not
 *  use in an ordinary sense. A topic matches when any of its patterns does. */
const TOPIC_TEXT: [Exclude<AssertionTopic, "other">, RegExp[]][] = [
  [
    "ratings_reviews",
    [
      // A score out of five: "3.4/5", "4.2 out of 5", "rated 4.2 out of 5". Only
      // five: "9 out of 10 dentists" is not a rating.
      /\b\d(?:\.\d)?\s*(?:\/|out of)\s*5\b/i,
      /\brated (?:at )?\d/i,
      // "a 4.6 rating", "average rating of 4.6", "Google rating of 4.7".
      /\b\d(?:\.\d)?\s+(?:average\s+|google\s+|yelp\s+)?ratings?\b/i,
      /\bratings?\s+(?:of\s+)?\d(?:\.\d)?\b/i,
      // "4.8★", "4.9 stars", "4-star rating", "5 star reviews", "a star rating".
      /\b\d(?:\.\d)?\s*★/,
      /\b\d\.\d[- ]?stars?\b/i,
      /\b\d[- ]stars?\s+(?:ratings?|reviews?)\b/i,
      /\b\d+\s+(?:[a-z]+-)?stars?[- ]reviews?\b/i,
      /\bstar ratings?\b/i,
      // "a 4.9 on Google", "reviews on Glassdoor".
      new RegExp(`\\b\\d(?:\\.\\d)?\\s+on\\s+${PLATFORM}\\b`, "i"),
      new RegExp(`\\breviews? (?:on|from) ${PLATFORM}\\b`, "i"),
      // R4 fix 1c: "Google reviews", "Clutch reviewers", "37 reviews", "4.8 average".
      new RegExp(`\\b${PLATFORM}\\s+reviews?\\b`, "i"),
      /\b\d+\s+(?:customer\s+|client\s+|google\s+)?reviews?\b/i,
      /\b\d(?:\.\d)?\s+average\b/i,
      /\b\d(?:\.\d)?\s+overall\b/i,
      /\b(?:one|two|three|four|five)[- ]star\w*\s+(?:ratings?|reviews?)\b/i,
      /\b(?:one|two|three|four|five|\d(?:\.\d)?)\s+stars\b/i,
      /\b(?:highly|well|top|best)[- ]rated\b/i,
      /\brated\s+(?:highly|well)\b/i,
      // A survey share: "60% would recommend it", "60% of employees".
      /\bwould recommend\b/i,
      /\b\d+%\s+(?:would\s+)?recommend/i,
      /%\s+of (?:employees|reviewers)\b/i,
      // R3 fix 3, the phrasings a stored row uses with no topic recorded.
      // "Rating: 4.2", "a Glassdoor score of 3.9", "Rating:** 4.2". Bounded runs
      // of separators, so a long run of spaces cannot backtrack (R4 fix 1a).
      /\b(?:rating|score)s?[\s:*]{0,6}(?:(?:of|is|at)[\s:*]{0,4})?\d/i,
      // A platform within 30 characters of a score-shaped figure, either way
      // round: "Glassdoor: 3.4", "3.9 Glassdoor score". A bare figure does not
      // count: "Google Analytics 4" and "since 2015" are not ratings (R4 fix 1b).
      new RegExp(`\\b${PLATFORM}\\b[^.\\n]{0,30}?${SCORE_FIGURE}`, "i"),
      new RegExp(`${SCORE_FIGURE}[^.\\n]{0,30}?\\b${PLATFORM}`, "i"),
      // "Indeed" is a platform only when it is capitalised mid-sentence, or
      // followed by a rating word. A plain "indeed" is an adverb (R4 fix 1b).
      /(?<=\w\s)Indeed\b[^.\n]{0,30}?\d/,
      /\bindeed\s+(?:reviews?|ratings?|scores?)\b/i,
      // "(37 reviews)", "rated it five stars", "a rating of four stars".
      /\d(?:\.\d)?\s*\(\d+ reviews?\)/i,
      /\brated (?:it |them )?(?:one|two|three|four|five) stars?\b/i,
      /\brating (?:of )?(?:one|two|three|four|five) stars?\b/i,
      // "out of five" counts only after a score: a rating or review word nearby
      // ("rated three out of five"), or a decimal ("3.9 out of five"). "Three out
      // of five clients" is not one (R4 fix 1b).
      /\b(?:rated|rates|rating|reviews?|reviewers?|scores?|gives?|give it)\b[^.\n]{0,30}?\b(?:\d(?:\.\d)?|one|two|three|four|five|ten)\s+(?:stars?\s+)?out of (?:four|five|ten)\b/i,
      /\b\d\.\d\s+(?:stars?\s+)?out of (?:four|five|ten)\b/i,
      /\b(?:\d(?:\.\d)?|one|two|three|four|five|ten)\s+(?:stars?\s+)?out of (?:four|five|ten)\b[^.\n]{0,30}?\b(?:ratings?|reviews?|scores?|stars?)\b/i,
      // "3.9 overall rating", "3.4 rating".
      /\b\d(?:\.\d)?\s+(?:overall\s+)?(?:rating|score)s?\b/i,
      // "Employees give it 3.9", "Employee reviews average 3.2".
      /\b(?:employee|customer)s?\s+(?:reviews?\s+)?(?:average|give)\b/i,
      // "Senior management 2.9", and the other employer-review categories.
      /\b(?:senior management|work.life balance|culture & values|compensation)\s+\d/i,
    ],
  ],
  [
    "complaints",
    [
      /\bcomplaints? (?:filed|against)\b/i,
      // R4 fix 1c: "complaints about its customer service" (the old pattern ended
      // `it)\b`, and "its" fails that boundary), "complained about missed deadlines".
      /\bcomplaints?\s+about\b/i,
      /\bcomplain(?:ed|s)?\s+(?:about|of)\b/i,
      /\balerts? on file\b/i,
      /\b(?:lawsuits?|sued|litigation)\b/i,
      /\bscams?\b/i,
      /\bfraud (?:claims?|charges?|complaints?|allegations?)\b/i,
    ],
  ],
  ["accreditation", [/\b(?:accredit\w*|bbb|better business bureau)\b/i]],
  [
    "legal_entity",
    [
      /\b(?:llc|l\.l\.c)\b/i,
      /\blimited liability (?:company|partnership)\b/i,
      // "Example Studio, Inc." and "Example Corp.", a capitalised name before the
      // suffix. Not "an Inc. 5000 honoree": no capital name, and a number after.
      /\b[A-Z][\w&'-]{0,40},?\s+(?:Inc|Corp|Ltd)\b(?!\.?\s*\d)/,
      /\bsole proprietor\w*/i,
      /\b(?:dba|d\/b\/a|doing business as)\b/i,
      // "registered in Texas" is a legal-entity claim the page must not print
      // unchecked, so the narrowing does not drop the original's "in" and "with".
      /\b(?:registered (?:as|in|with)|incorporated in)\b/i,
      /\b(?:legal name|alternate name|legal entity|subsidiary|franchisee|franchisor)\b/i,
      /\bfranchise (?:agreement|owner|system|location)s?\b/i,
      /\b[Oo]perates as [A-Z]/,
    ],
  ],
  [
    "revenue_headcount",
    [
      /\b(?:revenue|turnover|valuation|headcount)\b/i,
      // Staff counts only in employment wording: "40 employees", "employs 40",
      // "employs around 40", "team of 25", "team of about 40", "staff of 12", "a
      // 12-person team", "It has about 40 staff". "2,000 staff at hospitals" is not one.
      new RegExp(`\\b${NUM}\\s+employees\\b`, "i"),
      /\bemploy(?:s|ing|ed)?\s+(?:(?:about|around|over|nearly|roughly)\s+)?\d[\d,]*\+?\b/i,
      /\bhas (?:about |around |roughly |nearly |over |some )?\d[\d,]*\+?\s+staff\b/i,
      /\b\d+-person\b/i,
      /\b(?:team|staff) of (?:about |around |roughly |nearly |over )?\d+/i,
      // Money is a figure only with a scale word or a revenue word near it:
      // "$5,000" is a price, and "annual" alone is not a figure.
      /\$\s?\d[\d,.]*\s*(?:million|billion|m\b)/i,
      /\b(?:revenue|turnover)\b[^.]{0,40}\$\s?\d|\$\s?\d[^.]{0,40}\b(?:revenue|turnover)\b/i,
      /\b(?:brings? in|earns|grosses)\b[^.]{0,20}\$\s?\d/i,
    ],
  ],
  [
    "street_address",
    [
      // A number, an optional direction or ordinal, a capitalised street word,
      // then a long suffix, or a short one with its dot optional ("St," "Ave in").
      // Case-sensitive on purpose: a lowercase word is not a street.
      new RegExp(
        "\\b\\d{1,6}\\s+(?:[NSEW]\\.?\\s+)?(?:(?:\\d{1,3}(?:st|nd|rd|th)|[A-Z][\\w'-]*)\\s+){1,4}" +
          "(?:(?:Street|Road|Avenue|Boulevard|Drive|Lane|Parkway|Highway|Court|Place)\\b|(?:St|Rd|Ave|Blvd)\\b\\.?)",
      ),
      /\bsuite\s+\d+/i,
      // "at 1200 Broadway", "located at 40 Oak": a number and a capitalised name
      // after "at", with no street suffix (R4 fix 1c).
      /\b(?:[Aa]t|[Ll]ocated at)\s+\d{1,6}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/,
    ],
  ],
];

/**
 * R8 (review round 8). The person and ownership patterns. A statement is held on
 * these topics only by its STORED topic (`withheldTopic`); the text is read here
 * only for whole excerpts that carry no model label (`withheldIn`, the collision
 * quote, the other-name blocks). The patterns are unchanged from round 7.
 */
export const PERSON_TEXT: [Exclude<AssertionTopic, "other">, RegExp[]][] = [
  [
    "named_person",
    [
      // "founded in 2001 by John Smith", "run by Dana Reyes", "led by designer
      // Dana Reyes" (up to two lowercase words before the name).
      new RegExp(
        `\\b${ci(["founded", "led", "run", "headed", "managed"])}\\b[^.]{0,30}?\\bby (?:[a-z]+ ){0,2}[A-Z][a-z]+`,
      ),
      // "CEO is Dana", "owner Jane Doe", "its founder, Jane Doe,".
      new RegExp(
        `\\b${ci(["ceo", "cfo", "coo", "cto", "president", "founder", "co-founder", "owner"])}s?,?\\s+(?:${ci(["is", "was"])}\\s+)?[A-Z][a-z]+`,
      ),
      // "A man named Tim leads Acme." A person noun before "named" (R6 fix 2): a
      // bare "was named Denver's Best Design Studio" is the business.
      // R7 fix 2: any "named <Capitalised>" is a person except after a passive
      // ("was named Denver's Best Design Studio", "has been named Best Agency"),
      // which is the award. Replaces the R6 fix 2 list of person nouns.
      /(?<!\b(?:was|were|is|are|been|being|be|got|gets?) )\b[Nn]amed [A-Z]/,
      // R7 fix 3: the two-word person verbs (leads, led, runs, founded) are matched
      // by `personVerbIn`, which skips the business's own name. "owns" is ownership.
      // The noun forms below are the person (R5 fix 2).
      // "Dana Reyes, the CEO".
      new RegExp(
        `\\b[A-Z][a-z]+ [A-Z][a-z]+,? (?:${ci(["the"])} )?${ci(["ceo", "founder", "owner", "president"])}\\b`,
      ),
      // "Creative director Dana Reyes oversees every project."
      /\b(?:director|designer|principal|manager|founder) [A-Z][a-z]+ [A-Z][a-z]+\b/,
      /\b(?:Dr|Mr|Mrs|Ms)\.\s+[A-Z]/,
      // "Dana Reyes is the founder of the studio", "Dana Reyes is its owner",
      // "Dana Reyes is the studio's founder".
      /\b[A-Z][a-z]+ [A-Z][a-z]+ is (?:the|its|our) (?:\w+['’]s )?(?:founder|co-founder|owner|ceo|president|principal)\b/,
      // "Founder: Dana Reyes", "Owner: Dana Reyes".
      new RegExp(
        `\\b${ci(["founder", "co-founder", "owner", "ceo", "principal", "president"])}s?\\s*:\\s*[A-Z]`,
      ),
      // "the studio's principal, Dana Reyes".
      new RegExp(
        `\\b${ci(["founder", "co-founder", "owner", "ceo", "principal", "president"])}s?,\\s*[A-Z][a-z]+ [A-Z]`,
      ),
    ],
  ],
  [
    "ownership",
    [
      /\b(?:owned by|owner is|owners are|parent company|acquired by|acquisition of)\b/i,
      // "woman-owned", "family-owned and operated".
      /\b(?:woman|women|minority|veteran|family|employee)[- ]owned\b/i,
      // "Northwind Group acquired it in 2019".
      /\bacquired (?:it|us|the (?:studio|business|company|firm|agency))\b/i,
      // "It is part of Northwind Group".
      /\bpart of (?:a |the )?[A-Z]\w*(?: [A-Z]\w*)* (?:Group|Holdings|Brands|Network)\b/,
      // R7 fix 3: "Northwind Holdings owns Example Studio" is ownership, not a person.
      /\b[A-Z][a-z]+ [A-Z][a-z]+ owns\b/,
    ],
  ],
];

/** The order topics are listed in, for a statement's topic and a text's topics. */
const TOPIC_ORDER: Exclude<AssertionTopic, "other">[] = [
  "ratings_reviews",
  "complaints",
  "accreditation",
  "legal_entity",
  "named_person",
  "ownership",
  "revenue_headcount",
  "street_address",
];

/** R7 fix 3: two capitalised words and a verb of leading or founding read as a
 *  person ("Dana Reyes founded the studio"). A match whose two words are both
 *  words of the business's own name is the business ("Example Studio runs
 *  workshops"), and is skipped. */
const PERSON_VERB = /\b([A-Z][a-z]+) ([A-Z][a-z]+) (?:leads|led|runs|founded)\b/g;

function personVerbIn(text: string, business: string): boolean {
  const own = new Set(wordsOf(business));
  for (const m of text.matchAll(PERSON_VERB)) {
    if (own.has(m[1]!.toLowerCase()) && own.has(m[2]!.toLowerCase())) continue;
    return true;
  }
  return false;
}

/** Does a topic's text carry it? `business` is the report's business name, used
 *  only by the person-verb check (R7 fix 3). */
function topicHits(
  topic: Exclude<AssertionTopic, "other">,
  patterns: RegExp[],
  text: string,
  business: string,
): boolean {
  if (patterns.some((re) => re.test(text))) return true;
  return topic === "named_person" && personVerbIn(text, business);
}

/**
 * The topic of one accuracy statement. R8 §1: a stored topic other than `other`
 * decides it. Otherwise only the stable topics are read from the words; a person
 * or an ownership claim is held by its stored topic alone.
 */
export function withheldTopic(a: Assertion): Exclude<AssertionTopic, "other"> | null {
  if (a.topic !== undefined && a.topic !== "other") return a.topic;
  const text = `${a.claim}\n${a.engineQuote}`;
  for (const [topic, patterns] of TOPIC_TEXT)
    if (topicHits(topic, patterns, text, "")) return topic;
  return null;
}

/** The first withheld topic a whole excerpt carries, or null. R3 fix 4: any topic,
 *  not only ratings. A branded answer's excerpt is printed whole, so a BBB rating,
 *  a named founder or a complaint in it is withheld as a rating would be. */
export function withheldIn(text: string, business = ""): Exclude<AssertionTopic, "other"> | null {
  return withheldTopicsIn(text, business)[0] ?? null;
}

/** Every withheld topic a whole excerpt carries, in TOPIC_ORDER (R5 fix 4). R8 §1:
 *  an excerpt has no stored label, so the person and ownership patterns are read
 *  too, with the business's own name (`business`) skipped by the person-verb check. */
export function withheldTopicsIn(text: string, business = ""): Exclude<AssertionTopic, "other">[] {
  const out: Exclude<AssertionTopic, "other">[] = [];
  for (const [topic, patterns] of [...TOPIC_TEXT, ...PERSON_TEXT])
    if (topicHits(topic, patterns, text, business)) out.push(topic);
  return out.sort((a, b) => TOPIC_ORDER.indexOf(a) - TOPIC_ORDER.indexOf(b));
}

/** Does this excerpt carry a withheld topic of any kind? */
export function textWithheld(text: string, business = ""): boolean {
  return withheldIn(text, business) !== null;
}

/**
 * A branded answer's excerpt, as the web page prints it. An answer that gave a
 * rating or a review score, from customers or employees, is not reprinted:
 * the "<name> reviews" query brought employee ratings onto a sales document in
 * front of the person who runs the staff (PR-09). R3 fix 4: an excerpt answering
 * a "… reviews" question is not reprinted either, and neither is one carrying
 * any withheld topic.
 */
export function brandedExcerpt(
  probe: Pick<ProbeAnswer, "snippet" | "truncated"> & { query?: string },
  business = "",
): string {
  const reviewsQuestion = /\sreviews$/.test((probe.query ?? "").trim());
  const topic = withheldIn(probe.snippet, business);
  if (reviewsQuestion || topic === "ratings_reviews") {
    return "This answer gave ratings or review scores, which we have not checked, so we have not repeated it here.";
  }
  if (topic !== null) {
    return "This answer said something we have not checked, so we have not repeated it here.";
  }
  return `${probe.snippet}${probe.truncated ? "…" : ""}`;
}

export type HeldBack = {
  /** Statements about the prospect on a withheld topic. */
  withheld: number;
  /** Their topics, as words, in first-seen order. */
  topics: string[];
  /** Statements the answer made about another business, or could not place. */
  aboutOthers: number;
  /** Statements whose quote is empty: the assistant's words are not on record,
   *  so there is nothing to print. Counted, never repeated. */
  unquoted: number;
};

/** What the page leaves out, counted, so leaving it out is said aloud. One
 *  count per statement, from `statements`, so a sentence split into several
 *  rows is one statement to the reader. */
export function heldBack(view: ReportView): HeldBack {
  const topics: string[] = [];
  let withheld = 0;
  let aboutOthers = 0;
  let unquoted = 0;
  // R8 §2: an old-row report counts nothing; its section says to re-run the check.
  for (const s of hasOldRows(view) ? [] : statements(view)) {
    if (s.outcome === "unquoted") unquoted += 1;
    else if (s.outcome === "aboutOthers") aboutOthers += 1;
    else if (s.outcome === "withheld" && s.topic !== null) {
      withheld += 1;
      if (!topics.includes(TOPIC_LABEL[s.topic])) topics.push(TOPIC_LABEL[s.topic]);
    }
    // R7 fix 1: an unclear-subject contradiction has no topic; it is held as the
    // client's, and counted under the other-business line.
    else if (s.outcome === "withheld") aboutOthers += 1;
  }
  return { withheld, topics, aboutOthers, unquoted };
}

/**
 * W2 (BR-07). `absent` is "your site does not say this", and it is ours to
 * say only of a site we read whole. Stored rows called a site read whole when
 * every CRAWLED page was read; the crawl stops at 20, so a site whose sitemap
 * lists 95 was "read whole" at 20. A stored row is re-read here: without a
 * sitemap count the pages read reach, each `absent` becomes `unverified`.
 */
function withCoverage(acc: Accuracy, d: PagesDenominator): Accuracy {
  // One rule with the sentences around it (W3's `pages-read.ts`): an absence
  // stands only where "we read them all" may print, a complete, untruncated
  // sitemap the source check's pages reach. A floor, a count of links, or no
  // count at all is not a site read whole.
  if (acc.siteFullyRead && completeOf(d)) return acc;
  const phrase = phraseOf(d);
  const reason =
    phrase === null
      ? "We could not read any of your pages for this check, so we cannot say this is absent from your site."
      : d.site === null
        ? `We read ${phrase} and could not learn how many your site has, so we cannot say this is absent from it.`
        : `We read ${phrase}, so we cannot say this is absent from your site.`;
  return {
    ...acc,
    siteFullyRead: false,
    assertions: acc.assertions.map((a) =>
      a.verdict === "absent" ? { ...a, verdict: "unverified", unverifiedReason: reason } : a,
    ),
  };
}

/**
 * What each row has to say about its own sources.
 *
 * - `show` — print this row's citation list.
 * - `carried` — this row came from the SAME answer as the row above AND cites
 *   the same domains, so its list is already on the page verbatim.
 * - `none` — we recorded no sources against this row's answer. It must say so,
 *   because silence here reads as `carried`.
 *
 * `none` is NOT "the assistant cited nothing", and no surface may print it that
 * way. `sourceDomains` has the prospect's own domain filtered out upstream (the
 * producer drops it before storing; see `ownSiteCitations` — this section lists
 * what the assistant read INSTEAD), so an empty list means "nothing outside your
 * own site". An answer grounded entirely on their own pages lands here, in a
 * section that says forty lines lower how often the assistant cited them: two
 * contradictory statements about one answer, on a document we send a prospect.
 * An empty list is also what an unattributable quote looks like — when the
 * producer cannot tie the quote back to an answer, `query`, `engine` and
 * `sourceDomains` all arrive empty — and that is our measurement gap, not the
 * assistant's behaviour. Hence the copy on both surfaces: "We recorded no other
 * sources for that answer."
 */
export type CitationRun = { row: Assertion; citations: "show" | "carried" | "none" };

/**
 * Collapse consecutive rows from one engine answer onto one printed citation
 * list — keyed on the ANSWER, never on the list itself.
 *
 * Every claim pulled out of one answer carries that answer's citations, so
 * consecutive rows from the same answer would print the identical list over and
 * over. The first version of this keyed the run on the sorted citation list,
 * which cannot tell "same as above" from "no citations at all": a row whose
 * answer cited nothing rendered exactly like a collapsed one, and inherited the
 * line above it in the reader's eye. That attributes a competitor's domain to
 * the wrong claim, inside the section whose whole argument is who the engine
 * read. `query + engine` is the answer's identity and `Assertion` carries both.
 *
 * A sourceless row also BREAKS the run: the next row re-prints its list rather
 * than letting a gap in the middle imply continuity.
 *
 * Two further conditions on `carried`, because it is a claim about the page
 * rather than a fact about the data:
 *
 * - The answer identity has to exist. When the producer cannot attribute a
 *   quote to an answer it stores `query: ""` and `engine: ""`, so every
 *   unattributed row keys identically — and "these came from the same answer"
 *   is precisely what we do not know about them. Such rows are also sourceless
 *   today, so they took the `none` branch before the key was ever compared, but
 *   that is luck rather than a rule and no test held it.
 * - The list has to match. `carried` says "the list above is this row's list
 *   too"; for two rows of one answer carrying different domains that is false,
 *   and it hands the first row's sources to the second inside the one section
 *   whose whole argument is who the engine read. The producer does not emit that
 *   pair today, nothing pins that it never will, and stored reports are
 *   re-rendered long after the run that made them.
 *
 * Neither condition may re-key the run on the list: two different ANSWERS that
 * happen to cite the same domains are still two runs, and both print.
 */
export function citationRuns(rows: Assertion[]): CitationRun[] {
  // The answer whose citation list is currently on the page, and that list.
  // Both null when the run has been broken.
  let printedFor: string | null = null;
  let printedList: string | null = null;
  return rows.map((row): CitationRun => {
    if (row.sourceDomains.length === 0) {
      printedFor = null;
      printedList = null;
      return { row, citations: "none" };
    }
    // JSON rather than joining on a separator: a separator has to be a
    // character neither field can contain, and the one that satisfies that is
    // an invisible control character. This key held a literal NUL, which was
    // correct and which also made `grep` treat this whole file as binary and
    // report no matches at all. An array is unambiguous and stays printable.
    const answer =
      row.query === "" && row.engine === "" ? null : JSON.stringify([row.query, row.engine]);
    // Order-insensitive: one answer's list is one list however it arrives.
    const list = JSON.stringify([...row.sourceDomains].sort());
    if (answer !== null && answer === printedFor && list === printedList) {
      return { row, citations: "carried" };
    }
    printedFor = answer;
    printedList = list;
    return { row, citations: "show" };
  });
}

export function isListingSite(domain: string): boolean {
  const d = domain.toLowerCase().replace(/^www\./, "");
  return LISTING_SITES.some((p) => d === p || d.endsWith(`.${p}`));
}

export type FieldShape = {
  /** Citations that went to a directory, review site or social profile. */
  listings: number;
  /** Citations that went anywhere else. */
  other: number;
  total: number;
};

/**
 * What kind of sources the engine reached for.
 *
 * This is the reformat that replaced the visibility score. The score said "0"
 * and stopped; a reader could do nothing with it but feel it. The same data says
 * something useful when asked a different question — is this a room of
 * directories, or a room of individual sites? — because that is what decides
 * whether being in it is reachable at all.
 *
 * It counts two buckets and no more. A first version also reported "the websites
 * of N businesses", and real data killed it inside a minute: Reddoor's own
 * non-directory citations included rocketreach.co and the US Patent Office, and
 * Beachfront's five "businesses" included dochopkins.com, which is Beachfront's
 * own former site. Calling a patent database a business is the kind of error
 * that ends a reader's trust in a page arguing that AI gets facts about them
 * wrong.
 *
 * So the sentence claims only what the list can support, and the chart
 * underneath it names every source. A reader recognises their own competitors
 * faster than any classifier we could write.
 */
export function fieldShape(domains: CitedDomain[]): FieldShape {
  let listings = 0;
  let other = 0;
  for (const d of domains) {
    if (isListingSite(d.domain)) listings += d.count;
    else other += d.count;
  }
  return { listings, other, total: listings + other };
}

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
  /** What they are running, named back to them. Null for a report stored
   *  before the stage existed — which the page renders as nothing at all
   *  rather than as "we found no technology". */
  stack: StackReadout | null;
  /** The Tier 0 battery. Null for a report stored before it existed; an empty
   *  array would read as "we ran no checks", which is a different claim. */
  siteChecks: SiteCheck[] | null;
  /** The axe rule set. Null for a report stored before it existed. */
  accessibility: Accessibility | null;
  /** Whether the site does the one job it exists to do. Null when no goal was
   *  supplied and none could be inferred — which is "not measured", and is
   *  different from a goal of `unknown`, which IS a measurement. */
  goalFit: GoalFit | null;
  accuracy: Accuracy | null;
  /** Does every page carry a viewport meta? Read off `checks` rather than
   *  recomputed, so there is one implementation and it is the one with tests.
   *  Null when checks did not run. */
  viewportOk: boolean | null;
  /**
   * Whether the AI crawlers can reach the pages at all — the one thing the
   * Findability score actually established, stated as a fact instead.
   *
   * As a bar it was decoration: 26 of the 29 sites audited to date score 88 or
   * above, because 40 of its 100 points are crawler access and almost every
   * site allows everything. A number that never varies is not a measurement of
   * the site, it is a measurement of our formula — and printing it beside
   * Readability and Answers told the reader all three were the same kind of
   * claim and equally worth moving.
   *
   * Null when the checks stage did not run at all.
   */
  crawlerReach: { measured: boolean; blocked: string[]; checked: number } | null;
  /** How many URLs the site's sitemap lists, when it has one. The crawl reads
   *  at most a fixed number of pages, so "we read 14 of your 20 pages" was
   *  the crawl cap presented as the site; this is the honest denominator. */
  sitemapUrlCount: number | null;
  /** True when `sitemapUrlCount` is a floor: the sitemap was truncated, or a
   *  legacy row stored no `truncated` flag (absent means unknown). Read by the
   *  source check's total when the crawl kept no pages to count. */
  sitemapIsFloor?: boolean;
  /**
   * The denominator every absence is stated against: `read` is how many pages
   * the crawl actually read (an extract came back), `site` how many pages of
   * the site we know exist, the largest of the sitemap's count, the pages the
   * crawl knew of before its cap, and `read` itself. `site` is null when there
   * is no sitemap and the report predates the crawl counting what it knew of.
   * Null when there is no crawl.
   */
  pagesRead: {
    read: number;
    site: number | null;
    siteIsFloor?: boolean;
    /** Where `site` came from: the sitemap (present), the pages the home page
     *  links to (no sitemap), or "found": the union of those links and the
     *  sitemap's URLs, when the union outgrows the sitemap. Only a sitemap total
     *  may be stated as "your pages" or "all". */
    siteFrom?: "sitemap" | "links" | "found" | null;
  } | null;
  /** Stages that RAN AND FAILED, in report order. A stage this era of the
   *  payload lacks, or one the producer skipped on purpose, is not here: both
   *  are "never ran", and only this list may say "ran and failed". */
  failedStages: StageKey[];
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
  questionTally: { yes: number; partial: number; no: number; unknown: number };
  narrative: { findability: string; readability: string; answers: string } | null;
  /** The operator's edits, carried on the view so every composed-sentence
   *  function already has them without a signature change. Payload-resident
   *  overrides are applied before the view is built and are NOT re-applied
   *  from here. Empty when the report has never been edited. */
  overrides: OverrideMap;
};

/**
 * The citation field for the category questions, and ONLY those.
 *
 * The stored `competitorsSeen` counts every answer of every kind, and the chart
 * rendered it under a caption promising "the questions a buyer types before they
 * have heard of you". Those are the category questions. Mixing the branded ones
 * in does not merely inflate the numbers, it changes who is at the top:
 * Beachfront's chart led with yelp.com at 16, of which 12 came from asking about
 * Beachfront BY NAME, and showed dochopkins.com at 7 — every one of them
 * branded, none from a category search at all.
 *
 * It also disagreed with the paragraph beneath it, which reads its spread from
 * `answerSpace` — already category-only. One section was reporting 145 citations
 * across 50 domains directly above a sentence saying 39 sources across 4
 * answers.
 *
 * Recomputed here rather than upstream because it is a rendering fault and every
 * stored report should be corrected on next load, with no re-audit.
 *
 * Falls back to the stored list when there are no category answers to count
 * from — a report from before per-answer citations were kept has nothing better,
 * and an empty chart would read as "nobody was cited", which is a different and
 * false claim.
 */
export function citationsFrom(
  categoryProbes: ProbeAnswer[],
  ownUrl: string,
  stored: CitedDomain[],
): CitedDomain[] {
  if (categoryProbes.length === 0) return stored;

  // A report can carry an unparseable url; an empty own-domain simply means
  // nothing is filtered out, which is better than dropping every citation.
  const own = ((): string => {
    try {
      return new URL(ownUrl).hostname.replace(/^www\./i, "").toLowerCase();
    } catch {
      return "";
    }
  })();

  const counts = new Map<string, number>();
  for (const probe of categoryProbes) {
    for (const raw of probe.citedDomains) {
      const d = raw.replace(/^www\./i, "").toLowerCase();
      if (!d) continue;
      // The prospect's own domain is charted separately, as their own row.
      if (own && (d === own || d.endsWith(`.${own}`))) continue;
      counts.set(d, (counts.get(d) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain));
}

/** `{ok:true,data:T}` → T; anything else → null. */
function stage<T>(value: unknown): T | null {
  if (!value || typeof value !== "object") return null;
  const s = value as { ok?: unknown; data?: unknown };
  return s.ok === true && s.data !== undefined ? (s.data as T) : null;
}

/** The stages the report reads, in the order it reads them. */
export const STAGE_KEYS = [
  "checks",
  "analyze",
  "probes",
  "stack",
  "assets",
  "basics",
  "siteChecks",
  "accessibility",
  "goalFit",
  "accuracy",
] as const;
export type StageKey = (typeof STAGE_KEYS)[number];

/**
 * The producer's own "never ran" messages: reddoor-maintenance
 * `src/prospect/pipeline.ts` exports each one so a consumer compares rather
 * than guesses. Copied, not imported: `AuditReport` is still untyped here (see
 * fetch.ts), and so is this dependency. A stage `{ok:false}` with one of these
 * was skipped on purpose; with any other error it ran and failed.
 */
const SKIPPED = new Set([
  "skipped (--no-probes)", // PROBES_SKIPPED
  "skipped (--technical)", // TECHNICAL_SKIPPED: analyze and probes on a technical-only run
  "skipped — the checks stage failed", // ANALYZE_SKIPPED, ASSETS_SKIPPED
  "skipped — no branded answers to check", // ACCURACY_SKIPPED
  "no goal supplied and none could be inferred", // GOAL_UNRESOLVED
]);

/** `{ok:false}` with an error that is not one of the producer's skips. */
function ranAndFailed(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const s = value as { ok?: unknown; error?: unknown };
  return s.ok === false && !(typeof s.error === "string" && SKIPPED.has(s.error));
}

/** Did any of these stages run and fail on this audit? */
export function stageFailed(view: ReportView, ...keys: StageKey[]): boolean {
  return keys.some((k) => view.failedStages.includes(k));
}

/**
 * The opening clause of a section with nothing to show: "ran on this audit and
 * failed" when one of its stages did, "did not run" otherwise. They are
 * different claims, and before #893 every section made the second one for
 * both, so a source check whose model call failed told the reader no answer
 * had been captured. No final full stop: each section ends the sentence its
 * own way.
 */
export function gapClause(
  view: ReportView,
  keys: StageKey[],
  subject: string,
  plural = false,
): string {
  return stageFailed(view, ...keys)
    ? `${subject} ran on this audit and failed before ${plural ? "they" : "it"} returned a result`
    : `${subject} did not run on this audit`;
}

export const STAGE_LABEL: Record<StageKey, string> = {
  checks: "the page checks",
  analyze: "the content analysis",
  probes: "the visibility test",
  stack: "the platform readout",
  assets: "the link and image checks",
  basics: "the basics checks",
  siteChecks: "the site checks",
  accessibility: "the accessibility scan",
  goalFit: "the goal check",
  accuracy: "the check of what the assistant says about you",
};

/**
 * One sentence for the method section naming every stage that ran and failed,
 * or null when none did. A failed stage leaves its section empty on the print
 * sheet, so this is the only place there that says the gap is ours.
 */
export function failedChecksSentence(view: ReportView): string | null {
  const names = view.failedStages.map((k) => STAGE_LABEL[k]);
  if (names.length === 0) return null;
  const list =
    names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return (
    `${list.charAt(0).toUpperCase()}${list.slice(1)} ran on this audit and failed before ` +
    `returning a result. That is a gap in our measurement, not a finding about your site.`
  );
}

/**
 * Public suffixes of two labels, so "reddoorcreative.co.uk" yields
 * "reddoorcreative" rather than "co".
 *
 * A short list rather than the public-suffix list: the report renders from
 * stored JSON and has no other use for a 200 KB table, and a suffix missing
 * here fails safe: the label read instead is the suffix's own ("co", "com"),
 * which never contains a business name, so a miss means no namesake, never a
 * false one.
 */
const TWO_LABEL_SUFFIXES = new Set([
  "co.uk",
  "org.uk",
  "ac.uk",
  "gov.uk",
  "com.au",
  "net.au",
  "org.au",
  "co.nz",
  "co.za",
  "co.in",
  "co.jp",
  "com.br",
  "com.mx",
  "com.cn",
  "com.sg",
  "com.hk",
  "com.tr",
  "com.ar",
  "co.il",
  "co.kr",
  "ltd.uk",
  "plc.uk",
]);

/** The registrable label of a hostname: "reddoorcreative.com" →
 *  "reddoorcreative", and "ca.linkedin.com" → "linkedin". It was the FIRST
 *  label until P1-77, which read "ca.linkedin.com" as "ca", found "ca" inside
 *  "abcascreening", and told that business that LinkedIn was answering to its
 *  name. */
function domainLabel(domain: string): string {
  const labels = domain
    .replace(/^www\./i, "")
    .toLowerCase()
    .split(".")
    .filter(Boolean);
  const suffix = TWO_LABEL_SUFFIXES.has(labels.slice(-2).join(".")) ? 2 : 1;
  const registrable = labels.length > suffix ? labels[labels.length - suffix - 1] : labels[0];
  return (registrable ?? "").replace(/[^a-z0-9]/g, "");
}

/** "Reddoor Creative, LLC" → "Reddoor Creative", "Acme Co., Ltd." → "Acme",
 *  "Bright Smiles Dental, PC" (or "P.C.") → "Bright Smiles Dental". A legal or
 *  professional form is how a business registers, rarely how its domain reads.
 *  Repeated, for a stacked form, and "& Co" goes whole: stripping "Co" alone
 *  left "Johnson &", which read as "johnsonand" and matched
 *  johnsonandjohnson.com in review. */
function withoutLegalSuffix(name: string): string {
  const form =
    /(?:[,\s]+(?:l\.?l\.?c|inc|corp|ltd|p\.?l\.?l\.?c|l\.?p|l\.?l\.?p|plc|co|p\.?c|p\.?a|dds|dmd|md|gmbh)\.?|(?:\s+and|\s*&)\s*co\.?)\s*$/i;
  // Capped, because the pattern backtracks over long runs of spaces and runs
  // once per stacked form: a 50 000-character name took a minute to render.
  // No business name is 200 characters long.
  let out = name.slice(0, 200).trim();
  for (let prev = ""; prev !== out;) {
    prev = out;
    out = out.replace(form, "").trim();
  }
  return out;
}

/** Letters and digits only, so "Reddoor Creative" and "reddoorcreative.com"
 *  become comparable. */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** The prospect's own registrable label, or "" when the url is unparseable —
 *  in which case nothing is excluded and every cited domain stays eligible. */
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
 * Matched on the registrable label rather than the full host, and only when the
 * label IS the name — so "reddoorcreative.com", ".co" and ".co.uk", the
 * Reddoor Creatives an assistant confuses with this one, match a business
 * called "Reddoor Creative", while "clutch" does not.
 *
 * Exact, because every looser rule tried in P1-77 claimed businesses that are
 * not namesakes. A label found inside the name: "ca" (ca.linkedin.com) inside
 * a screening company's name, "en" (en.wikipedia.org) inside a sensor maker's,
 * "organ" (organ.org) inside an organ-donation network's — the shape of the
 * nine false namesakes on the 72 stored reports, with the first host label
 * read as the name. A label that leads the
 * name: heart.org for "Heart & Vascular Institute", boston.com for "Boston
 * Scientific". A label that starts with the name: dentalgroupofmiami.com for
 * "Dental Group" — a competitor, named for its category and its city, which is
 * exactly what an assistant cites for a category question. No string rule
 * tells that apart from "reddoorcreativeva", so neither counts.
 *
 * The cost is a namesake spelled longer, shorter or differently
 * ("reddoorcreativeva.com", "reddoor.biz", "glendalestudiosla.com"), which goes
 * unreported; asserting a collision to a prospect who then checks is worse
 * than staying quiet. So is any namesake of a prospect whose own domain
 * spells its name: abcascreening.com's label is the name, so a cited
 * abcascreening.ca is skipped with it. That one is deliberate. Another
 * country's site under the same label is as likely the prospect's own as
 * someone else's, and the block says "a different company". The match above
 * therefore works for a prospect like Reddoor, whose domain (reddoorla.com)
 * is not its name.
 *
 * A short name would still match far too much, so a floor applies to the name.
 *
 * A listing site is never a namesake: a LinkedIn or Facebook page is a profile
 * ABOUT the business, which is a different finding. The prospect's own domain
 * is excluded too — it is not a namesake of itself.
 */
export function findNamesake(
  businessName: string | null,
  ownUrl: string,
  cited: CitedDomain[],
): CitedDomain | null {
  if (!businessName) return null;
  const name = normalizeName(withoutLegalSuffix(businessName).replace(/&/g, "and"));
  if (name.length < 8) return null;

  const own = ownDomainLabel(ownUrl);

  for (const entry of cited) {
    // A port or a trailing dot would slip past the listing-site match.
    const host = entry.domain.replace(/:\d+$/, "").replace(/\.$/, "");
    if (isListingSite(host)) continue;
    const label = domainLabel(host);
    if (!label || label === own) continue;
    if (label === name) return entry;
  }
  return null;
}

/**
 * Was the namesake cited more than every other source in the field? The
 * collision block said so of every namesake, unchecked; ABCA's "namesake" had
 * one citation against four for each of the most-cited sources. A tie is not
 * "more than any other".
 */
export function namesakeLeads(view: ReportView): boolean {
  const n = view.namesake;
  if (!n) return false;
  // The sentence prints this host's own count, so this host's count is what
  // has to lead. Summing the namesake's other hosts (review round 4) printed
  // "cited 3 times — more than any other source" above a source cited 4 times
  // (round 5). A namesake split across hosts may therefore not be said to
  // lead when together it does; that fails quiet, not false.
  //
  // The field leaves the prospect's own site out, so count it back in: a
  // namesake cited once is not "more than any other source" when the prospect
  // was cited three times.
  //
  // Without category answers the field is the stored list, which never counted
  // the prospect's own site and mixes in branded answers, so there is nothing
  // to rank against (review round 6).
  if (view.categoryProbes.length === 0) return false;
  if (ownCitations(view, view.categoryProbes) >= n.count) return false;
  return view.citedDomains.every((d) => d.domain === n.domain || d.count < n.count);
}

/**
 * Did the engine name this business in this answer? THE answer to that
 * question — every surface asks here rather than deciding for itself.
 *
 * `countedAsVisible` is the scorer's own verdict, recorded upstream. The looser
 * `domainCited || brandMentioned` ignores the distinctive-name gate the score
 * applies, so a business called "Creative Studio" reads as named in an answer
 * that referenced nobody. Three surfaces derived this independently and two used
 * the loose rule, which put "was not among them, in any of the 5 questions we
 * asked" and "Creative Studio appeared in this answer" on the same printed page.
 *
 * The loose rule survives only as the fallback for reports stored before the
 * verdict existed, where it is the best answer available rather than a choice.
 */
export function wasNamed(a: ProbeAnswer): boolean {
  return a.countedAsVisible ?? (a.domainCited || a.brandMentioned);
}

/**
 * Did we have an assistant answer to take apart? THE answer to that question —
 * every surface asks here rather than deciding for itself.
 *
 * `accuracy` is absent on the 53 reports stored before the stage existed, and
 * `answersRead === 0` means the stage ran and read nothing; both mean the same
 * thing to a reader, which is that this check did not happen. The lede above
 * the section used to assert it unconditionally — "We asked an AI assistant
 * about X and took its answer apart statement by statement" — directly above
 * the section's own "We could not check this on this audit". Two adjacent
 * paragraphs, one of them a claim about work we did not do.
 *
 * Never read as "nothing was wrong". We had nothing to read.
 */
export function sourceCheckMeasured(view: ReportView): boolean {
  return view.accuracy !== null && view.accuracy.answersRead > 0;
}

/**
 * Did the check come back holding a statement? The stricter of the two
 * questions, and the one the lede above the section actually promises.
 *
 * `sourceCheckMeasured` says only that there was an answer to read. Between
 * that and a section full of sorted statements sits a third state: answers were
 * read and nothing checkable came out of them. There the lede told the reader
 * we "took its answer apart statement by statement" and sorted "each one" by
 * where it came from — directly above the section's own "we read 3 answers
 * about you and could not pull a checkable statement out of them". The same
 * defect as the one this file already carries a note about, one state over.
 *
 * So: a surface that PROMISES statements asks this. A surface that only reports
 * whether the check happened at all asks `sourceCheckMeasured`.
 *
 * R1 fix 12: "statements" means the ones that PRINT. A check whose every
 * statement is withheld or about another business has none to sort, and the
 * lede must not say it sorted them. `sourceCheckHasRows` is the wider question,
 * for the section, which still says what it counted.
 */
export function sourceCheckHasStatements(view: ReportView): boolean {
  return (
    sourceCheckMeasured(view) &&
    contradictedRows(view).length + notSourcedFromSite(view).length + confirmedRows(view).length > 0
  );
}

/** The section has rows to report on, printed or counted. */
export function sourceCheckHasRows(view: ReportView): boolean {
  // R2: printed or counted, never the number of stored rows. A check whose
  // only statement is unquoted still has a count to say.
  return sourceCheckMeasured(view) && statements(view).length > 0;
}

/** A legacy crawl's sitemap total is a floor when it was truncated. One stored
 *  before the flag existed has no `truncated` key, and an absent flag is "we do
 *  not know", never "not truncated": so a present sitemap with no flag is a floor. */
function sitemapIsFloor(
  sitemap: { truncated?: boolean } | undefined,
  count: number | null,
): boolean {
  return sitemap?.truncated === true || (count !== null && typeof sitemap?.truncated !== "boolean");
}

/** See `ReportView.pagesRead`. A crawl stored before it counted what it knew
 *  of (no `selection`) gives a site count only when the sitemap lists more
 *  pages than were read: a smaller sitemap says nothing about the site, and
 *  "all 20 of your pages" over a 12-URL sitemap was the old report's claim. */
function pagesReadOf(
  crawl: {
    sitemap?: { present?: boolean; urlCount?: number; truncated?: boolean };
    pages?: { raw?: unknown; rendered?: unknown }[];
    selection?: { pagesConsidered?: number };
  } | null,
): ReportView["pagesRead"] {
  if (!crawl || !Array.isArray(crawl.pages)) return null;
  const read = crawl.pages.filter((p) => p && (p.raw || p.rendered)).length;
  const sitemap =
    crawl.sitemap?.present && typeof crawl.sitemap.urlCount === "number"
      ? crawl.sitemap.urlCount
      : null;
  const considered =
    typeof crawl.selection?.pagesConsidered === "number" ? crawl.selection.pagesConsidered : null;
  const known = [sitemap, considered].filter((n): n is number => n !== null);
  // A count below the pages read says nothing of the site's total: no total then.
  if (crawl.selection) {
    const largest = known.length ? Math.max(...known) : null;
    if (largest === null || largest < read)
      return { read, site: null, siteIsFloor: false, siteFrom: null };
    return {
      read,
      site: largest,
      // A truncated sitemap makes the site total a floor whichever count was used.
      siteIsFloor: crawl.sitemap?.truncated === true,
      // The union of the home page's links and the sitemap outgrows the sitemap:
      // it is pages we found, which a sitemap-less count of links also is not "your".
      siteFrom: largest === sitemap ? "sitemap" : sitemap !== null ? "found" : "links",
    };
  }
  // A crawl stored before it counted what it knew of has only the sitemap to go on.
  if (sitemap === null || sitemap <= read)
    return { read, site: null, siteIsFloor: false, siteFrom: null };
  return {
    read,
    site: sitemap,
    siteIsFloor: sitemapIsFloor(crawl.sitemap, sitemap),
    siteFrom: "sitemap",
  };
}

export function toReportView(raw: AuditReport, overrides: OverrideMap = {}): ReportView {
  const r = applyOverrides(raw, overrides) as Record<string, unknown>;

  const analyze = stage<{
    buyerQuestions?: BuyerQuestion[];
    fixes?: (Omit<Fix, "origin"> & { origin?: Fix["origin"] })[];
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
  const checks = stage<{
    journey?: Journey;
    consistency?: Consistency;
    viewportOk?: boolean;
    crawlerAccessMeasured?: boolean;
    crawlerAccess?: { blockedAi?: string[]; blockedClassical?: string[] };
  }>(r.checks);
  // `agentAccess` is on CRAWL — one entry per agent in crawl.ts's ALL_AGENTS.
  // It was read off `checks` here, against an optional field invented on the
  // checks type, so nothing objected and every report said "all 0 of the
  // crawlers we checked".
  const crawl = stage<{
    agentAccess?: { agent: string }[];
    sitemap?: { present?: boolean; urlCount?: number; truncated?: boolean };
    pages?: { raw?: unknown; rendered?: unknown }[];
    selection?: { pagesConsidered?: number };
  }>(r.crawl);
  const assets = stage<Assets>(r.assets);
  const basics = stage<Basics>(r.basics);
  const stack = stage<StackReadout>(r.stack);
  const siteChecks = stage<SiteCheck[]>(r.siteChecks);
  const accessibility = stage<Accessibility>(r.accessibility);
  const goalFit = stage<GoalFit>(r.goalFit);
  const accuracyRaw = stage<Omit<Accuracy, "conflation"> & { conflation?: Conflation }>(r.accuracy);
  const sitemapCount =
    crawl?.sitemap?.present && typeof crawl.sitemap.urlCount === "number"
      ? crawl.sitemap.urlCount
      : null;
  const pagesRead = pagesReadOf(crawl);
  const siteIsFloor = sitemapIsFloor(crawl?.sitemap, sitemapCount);
  const accuracy: Accuracy | null = accuracyRaw
    ? withCoverage(
        { ...accuracyRaw, conflation: accuracyRaw.conflation ?? NO_CONFLATION },
        checkDenominatorOf(
          accuracyRaw.pagesRead,
          pagesRead,
          // A row whose crawl kept no sitemap count still has the producer's.
          sitemapCount ?? accuracyRaw.siteUrlCount ?? null,
          sitemapCount === null ? true : siteIsFloor,
        ),
      )
    : null;

  const scoresRaw = (r.scores ?? {}) as Record<string, number | null>;
  const answers = probes?.answers ?? [];
  const categoryProbes = answers.filter((a) => a.kind === "category");
  // Prefer what the run says it attempted; fall back to what answered for a
  // report stored before the audit recorded attempts.
  const visibilityTotal = probes?.categoryProbes?.attempted ?? categoryProbes.length;
  const buyerQuestions = analyze?.buyerQuestions ?? [];
  const businessName = (r.businessName as string | null) ?? null;
  const url = (r.url as string) ?? "";
  const citedDomains = citationsFrom(categoryProbes, url, probes?.competitorsSeen ?? []);

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
          named: categoryProbes.filter(wasNamed).length,
          total: visibilityTotal,
        }
      : null,
    answerSpace: probes?.answerSpace ?? null,
    journey: checks?.journey ?? null,
    consistency: checks?.consistency ?? null,
    assets,
    basics,
    stack,
    siteChecks,
    accessibility,
    goalFit,
    accuracy,
    viewportOk: checks?.viewportOk ?? null,
    crawlerReach: checks
      ? {
          // An explicit true only. A robots.txt fetch that failed leaves the
          // blocked lists empty out of ignorance, and reading that as "nobody
          // is blocked" would print an all-clear we never verified.
          measured: checks.crawlerAccessMeasured === true,
          blocked: checks.crawlerAccess?.blockedAi ?? [],
          checked: crawl?.agentAccess?.length ?? 0,
        }
      : null,
    sitemapUrlCount: sitemapCount,
    sitemapIsFloor: siteIsFloor,
    pagesRead,
    failedStages: STAGE_KEYS.filter((k) => ranAndFailed(r[k])),
    brandedRecognized: probes ? (probes.brandedRecognized ?? null) : null,
    categoryProbes,
    brandedProbes: answers.filter((a) => a.kind === "branded"),
    citedDomains,
    namesake: findNamesake(businessName, url, citedDomains),
    fixes: (analyze?.fixes ?? []).map((f) => ({ ...f, origin: f.origin ?? "recommendation" })),
    buyerQuestions,
    questionTally: {
      yes: buyerQuestions.filter((q) => q.answered === "yes").length,
      partial: buyerQuestions.filter((q) => q.answered === "partial").length,
      no: buyerQuestions.filter((q) => q.answered === "no").length,
      unknown: buyerQuestions.filter((q) => q.answered === "unknown").length,
    },
    narrative: analyze?.narrative ?? null,
    overrides,
  };
}
