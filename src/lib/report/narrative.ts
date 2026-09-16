import { healthRows, type HealthRow } from "./health";
import { GOAL_LABELS, type Fix, type ReportView } from "./model";
import { composed } from "./overrides";

/**
 * The narrative layer: one sentence the page leads with, and one list of
 * everything that passed.
 *
 * Both are pure functions of the view, and both are deterministic on purpose.
 * The headline used to be whichever finding a section happened to print first,
 * which on the first real run led with the AI being right about us — true,
 * reassuring, and the least useful thing on the page. The priority below is
 * fixed and written down, so the headline is always the finding a reader
 * would most regret not knowing, in the order a reader would rank them.
 *
 * Honesty rules carried over from the rest of the report: an unmeasured stage
 * is never a pass, an absent statement is never called wrong (the assistant
 * may be right about something the site never says), and nothing here
 * predicts what an engine will do.
 */
export type HeadlineKind =
  | "crawlers-blocked"
  | "name-collision"
  | "goal-unknown"
  | "goal-missing"
  | "contradicted"
  | "unanswered"
  | "partial"
  | "site-check"
  | "all-clear"
  | "unmeasured";

export type Headline = { kind: HeadlineKind; text: string };

const WORDS = [
  "zero",
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

/** "two", "ten", then digits — the reader's register, not the instrument's. */
export function numberWord(n: number): string {
  return WORDS[n] ?? String(n);
}

/** "a, b and c" — a list a sentence can carry. */
function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/**
 * First letter down, trailing full stop or question mark off, so a label or a
 * question can sit inside a sentence of ours.
 *
 * TWO LEADING CAPITALS ARE LEFT ALONE. The labels and questions this repo
 * generates are curated to survive that lowercasing. An operator's override is
 * not, and arbitrary operator wording is the whole point of the override
 * layer — an edited health-row label reaches here through the headline's
 * `site-check` branch, where "HTTPS is not enforced" came out as "hTTPS is not
 * enforced". Two capitals in a row is an acronym (HTTPS, SSL, DNS, URL) rather
 * than an ordinary word, so leaving it alone is safe, and it reads better on
 * the generated labels too.
 *
 * What this does NOT fix, deliberately: a SINGLE leading capital is genuinely
 * ambiguous. "Acme Co pages are broken" still becomes "acme Co pages are
 * broken" — correct for an ordinary sentence-initial word, wrong for a proper
 * noun. This function cannot tell the two apart and should not pretend to.
 */
function inline(text: string): string {
  const t = text.trim().replace(/[.?]$/, "");
  if (/^\p{Lu}\p{Lu}/u.test(t)) return t;
  return t.charAt(0).toLowerCase() + t.slice(1);
}

function headlineFindingGenerated(view: ReportView): Headline {
  const who = view.businessName ?? "your business";
  const reach = view.crawlerReach;
  const acc = view.accuracy;
  const fit = view.goalFit;
  const rows = healthRows(view);
  const tally = view.questionTally;

  if (reach?.measured && reach.blocked.length > 0) {
    return {
      kind: "crawlers-blocked",
      text:
        `Your robots.txt turns away ${joinList(reach.blocked)}. ` +
        `Nothing else in this report can help until that changes.`,
    };
  }

  if (acc?.conflation.detected) {
    const n = acc.conflation.otherNames.length;
    const others = n
      ? ` It described ${numberWord(n)} other ${n === 1 ? "business" : "businesses"} with a similar name.`
      : "";
    return {
      kind: "name-collision",
      text: `Asked about you by name, the assistant is not sure which ${who} you are.${others}`,
    };
  }

  if (fit?.goal === "unknown") {
    return {
      kind: "goal-unknown",
      text: `We read every page and could not tell what ${who} wants a visitor to do.`,
    };
  }

  if (fit) {
    const judged = fit.requirements.filter((r) => r.status !== "unmeasured");
    const missing = judged.filter((r) => r.status === "missing");
    if (missing.length > 0) {
      const count =
        missing.length === 1
          ? `one of the ${numberWord(judged.length)} things that needs is`
          : `${numberWord(missing.length)} of the ${numberWord(judged.length)} things that needs are`;
      return {
        kind: "goal-missing",
        text:
          `Your site is built to get a visitor to ${GOAL_LABELS[fit.goal] ?? fit.goal}, and ${count} ` +
          `not in place: ${joinList(missing.map((r) => inline(r.label)))}.`,
      };
    }
  }

  const contradicted = acc?.assertions.find((a) => a.verdict === "contradicted");
  if (contradicted) {
    return {
      kind: "contradicted",
      text: `The assistant says “${contradicted.claim}”, and your own site says otherwise.`,
    };
  }

  const judgedQuestions = tally.yes + tally.partial + tally.no;
  if (tally.no > 0) {
    const missing = view.buyerQuestions
      .filter((q) => q.answered === "no")
      .map((q) => inline(q.question));
    return {
      kind: "unanswered",
      text:
        `Your site does not answer ${numberWord(tally.no)} of the ${numberWord(judgedQuestions)} questions ` +
        `buyers ask first: ${joinList(missing)}.`,
    };
  }

  if (tally.partial > 0) {
    const partial = view.buyerQuestions
      .filter((q) => q.answered === "partial")
      .map((q) => inline(q.question));
    return {
      kind: "partial",
      text:
        `Your site answers all ${numberWord(judgedQuestions)} questions buyers ask first, but ` +
        `${numberWord(tally.partial)} of them only in passing: ${joinList(partial)}.`,
    };
  }

  // A statement the site does not make is deliberately NOT a finding. The
  // engine may be right about something the site never says — a Texas
  // registration, a revenue figure — and "your site does not say this" about a
  // true fact reads as an accusation. The page shows who was read instead.

  const problems = rows.filter((r) => r.alert);
  if (problems.length > 0) {
    return {
      kind: "site-check",
      text:
        `${numberWord(problems.length).replace(/^./, (c) => c.toUpperCase())} of the ${rows.length} checks on ` +
        `whether your site works ${problems.length === 1 ? "is" : "are"} worth your attention: ` +
        `${joinList(problems.map((r) => inline(r.label)))}.`,
    };
  }

  // All clear is a claim, so it needs something to have been measured. A
  // report where every stage failed has nothing to be clear about.
  const measuredAnything = Boolean(acc) || Boolean(fit) || rows.length > 0 || judgedQuestions > 0;
  if (!measuredAnything) {
    return {
      kind: "unmeasured",
      text:
        "Most of this audit could not run, so there is little here to report. " +
        "That is a gap in our measurement, not a finding about your site.",
    };
  }

  return {
    kind: "all-clear",
    text:
      "Everything we can measure on your site checks out. " +
      "What follows is where you stand in AI answers, and a few things worth knowing.",
  };
}

/**
 * The headline as the reader sees it: generated, then the operator's wording
 * if they wrote one.
 *
 * The `kind` is deliberately NOT overridable. It is not copy — it decides
 * which branch of the report renders and which section the hero points at. An
 * operator rewording the sentence must not silently move the reader into a
 * different part of the document, so the edit reaches the text and stops
 * there.
 */
export function headlineFinding(view: ReportView): Headline {
  const h = headlineFindingGenerated(view);
  return { ...h, text: composed(view.overrides, "composed:headlineFinding", h.text) };
}

export type PassGroup = { title: string; items: string[] };

/**
 * Everything that passed, grouped the way the page is, one line each.
 *
 * The page prints findings and nothing else; a reader who wants to know what
 * was checked and came back clean opens this. The lines are receipts for
 * breadth, not findings, so they are terse on purpose.
 */
function passesGenerated(view: ReportView): PassGroup[] {
  const acc = view.accuracy;
  const reach = view.crawlerReach;
  const rows = healthRows(view);

  const ai: string[] = [];
  if (acc) {
    const confirmed = acc.assertions.filter((a) => a.verdict === "confirmed").length;
    if (confirmed > 0) {
      ai.push(
        `${numberWord(confirmed).replace(/^./, (c) => c.toUpperCase())} ` +
          `${confirmed === 1 ? "statement" : "statements"} the assistant made match a passage on your own site`,
      );
    }
    // Knowing who you are is not a pass when it also thought you were someone else.
    if (view.brandedRecognized === true && !acc.conflation.detected) {
      ai.push("Asked about you by name, the assistant knew who you are");
    }
  }

  const works: string[] = [];
  if (reach?.measured && reach.blocked.length === 0) {
    works.push(
      reach.checked > 0
        ? `Your robots.txt turns away none of the ${reach.checked} AI crawlers we checked`
        : "Your robots.txt turns away no AI crawler we checked",
    );
  }
  for (const row of rows) if (!row.alert) works.push(`${row.label}: ${row.value}`);

  const job = (view.goalFit?.requirements ?? [])
    .filter((r) => r.status === "met")
    .map((r) => (r.evidence ? `${r.label} — ${r.evidence}` : r.label));

  const learn = view.buyerQuestions.filter((q) => q.answered === "yes").map((q) => q.question);

  return [
    { title: "What an AI says about you", items: ai },
    { title: "Does it work", items: works },
    { title: "Does your site do its job", items: job },
    { title: "What buyers can learn from your site", items: learn },
  ].filter((g) => g.items.length > 0);
}

/**
 * The passes, each line offered to the operator by position.
 *
 * Positional keys, for the reason the module doc in `overrides.ts` gives: a
 * stored audit never changes, so the list a key was written against is the
 * list it is read against. Groups with no items are already dropped by the
 * generator, so the indices here are the indices the page renders.
 */
export function passes(view: ReportView): PassGroup[] {
  return passesGenerated(view).map((g, i) => ({
    title: composed(view.overrides, `composed:passes[${i}].title`, g.title),
    items: g.items.map((item, j) =>
      composed(view.overrides, `composed:passes[${i}].items[${j}]`, item),
    ),
  }));
}

export function passCount(view: ReportView): number {
  return passes(view).reduce((n, g) => n + g.items.length, 0);
}

/**
 * An engine quote as the reader should see it.
 *
 * The stored quote is verified upstream as a real substring of the answer,
 * and the answer is markdown — so a quote can arrive as "**multiple,
 * unrelated companies**", which on a client document reads as a typo. The
 * emphasis markers are dropped for display only; the words are untouched, so
 * the quote still survives being checked against the answer.
 */
export function displayQuote(text: string): string {
  const unemphasised = text
    .replace(/(\*\*|__)(?=\S)([\s\S]+?)(?<=\S)\1/g, "$2")
    .replace(/(?<!\S)\*(?=\S)([^*\n]+?)(?<=\S)\*(?!\S)/g, "$1")
    .trim();
  // The page wraps every quote in its own marks, so a quote that arrives
  // already wrapped printed doubled: ""with $2 million in revenue"". One
  // outer pair goes; a quote mark inside the sentence is content and stays.
  const wrapped = unemphasised.match(/^["“]([\s\S]*)["”]$/);
  return wrapped && !/["“”]/.test(wrapped[1] ?? "") ? (wrapped[1] ?? "").trim() : unemphasised;
}

/**
 * The remedy for a name collision, as a fix in the list rather than an aside.
 *
 * The collision block used to carry its own three-step "what to do about it",
 * which broke the narrative: the reader was handed a plan in the middle of
 * the findings and then met the real plan a screen later. One fix, first in
 * the list, marked measured because it follows from a check rather than from
 * the model's judgement.
 */
function collisionFixGenerated(view: ReportView): Fix | null {
  const acc = view.accuracy;
  if (!acc?.conflation.detected && view.namesake === null) return null;
  const who = view.businessName ?? "your business";
  return {
    title: `Say which ${who} you are, in one sentence, on your own pages`,
    why:
      "Put the full name, the place and the work in one sentence at the top of the home page and the " +
      "About page, and in both page titles — that is the sentence an assistant quotes when it has to " +
      "say which one you are. Make the profiles it read instead say the same sentence. Then mark the " +
      "organisation up: a schema.org Organization block with the name, the address and links to the " +
      "profiles you own, so the connections are stated rather than guessed.",
    impact: "high",
    effort: "low",
    tier: "content",
    origin: "measured",
  };
}

/** The collision fix, with the operator's wording where they wrote one. Only
 *  the two strings a reader sees are editable; impact, effort and tier drive
 *  the ordering of the list rather than its copy. */
export function collisionFix(view: ReportView): Fix | null {
  const f = collisionFixGenerated(view);
  if (!f) return null;
  return {
    ...f,
    title: composed(view.overrides, "composed:collisionFix.title", f.title),
    why: composed(view.overrides, "composed:collisionFix.why", f.why),
  };
}

/**
 * A fix for every check under "Does it work" that came back with a finding.
 *
 * The audit writes measured fixes for some of these (a plain-text phone, a
 * broken link) and not others (a stale year, a page outside the template), and
 * it suppresses its own phone fix whenever the goal checklist judged the phone
 * — a row that reads "met" when any one number is tappable. So a finding could
 * alert two sections above the list and never reach it, which is exactly what
 * the first real report did. The rule now lives here, on the rendered rows:
 * alert → fix, one for one, unless the audit's own list already carries it.
 * Renderer-side, so every stored report gets it without a re-run.
 *
 * The reasoning on each fix is the row's own detail, after one sentence on
 * what to do — so the finding and its fix cannot drift apart.
 */
type HealthFixSpec = {
  title: (row: HealthRow, view: ReportView) => string;
  /** What to do, in a sentence. The row's detail follows it as the why. */
  what: string;
  impact: Fix["impact"];
  effort: Fix["effort"];
  tier: Fix["tier"];
  /** The title of a fix the audit may already have written for the same
   *  finding — one match and this row writes nothing. */
  covers: RegExp;
};

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

const HEALTH_FIXES: Record<string, HealthFixSpec> = {
  https: {
    title: () => "Redirect plain http to your secure site",
    what: "One redirect rule at the host: every http:// address should land on its https:// twin.",
    impact: "high",
    effort: "low",
    tier: "technical",
    covers: /plain http|https/i,
  },
  host: {
    title: (_, view) =>
      `Make ${view.basics?.hostVariant.host ?? "the other spelling of your address"} land on your site`,
    what:
      "Point the other spelling of your address at this one with a redirect, so both end up in the " +
      "same place.",
    impact: "high",
    effort: "low",
    tier: "technical",
    covers: /\bwww\b/i,
  },
  notfound: {
    title: () => "Answer a missing page with a real error page",
    what:
      "A page that does not exist should answer 404, on a page with your own navigation — not a " +
      "quiet redirect, and not an empty page that claims to be found.",
    impact: "medium",
    effort: "low",
    tier: "technical",
    covers: /\b404\b|missing page|error page/i,
  },
  viewport: {
    title: () => "Tell phones how wide the page is",
    what: "One viewport meta tag in the head of every page.",
    impact: "high",
    effort: "low",
    tier: "technical",
    covers: /viewport|phone screen/i,
  },
  tappable: {
    title: () => "Make your phone number tappable",
    what: "Wrap every number on the site in a tel: link.",
    impact: "medium",
    effort: "low",
    tier: "technical",
    covers: /phone number|\btap/i,
  },
  broken: {
    title: (_, view) => {
      const links = view.assets?.brokenLinks.length ?? 0;
      const images = view.assets?.brokenImages.length ?? 0;
      const parts = [
        ...(links > 0 ? [plural(links, "broken link", "broken links")] : []),
        ...(images > 0 ? [plural(images, "broken image", "broken images")] : []),
      ];
      return `Repair ${parts.join(" and ")}`;
    },
    what: "Each one is listed under Does it work with its address: fix the link or put the file back.",
    impact: "medium",
    effort: "low",
    tier: "technical",
    covers: /broken (link|image)/i,
  },
  mixed: {
    title: () => "Serve every image over https",
    what: "Change the image addresses from http:// to https://, or host the files on your own site.",
    impact: "medium",
    effort: "low",
    tier: "technical",
    covers: /insecure|over plain http|image.*https/i,
  },
  weight: {
    title: () => "Shrink your heaviest image",
    what: "Resize it to the size it is shown at and export it as WebP or AVIF — well under a megabyte.",
    impact: "medium",
    effort: "low",
    tier: "technical",
    covers: /heaviest|image weight|compress|resize/i,
  },
  contact: {
    title: () => "Give every page a way to reach you",
    what:
      "Put the phone number, the email or a contact link in the header or footer, so it is on every " +
      "page rather than only the contact page.",
    impact: "high",
    effort: "low",
    tier: "technical",
    covers: /reach you|route to you|way to (make )?contact|contact (link|route)/i,
  },
  alt: {
    title: () => "Describe your images",
    what:
      "Give every image that carries meaning an alt text saying what it shows, and an empty alt to " +
      "the decorative ones.",
    impact: "medium",
    effort: "medium",
    tier: "content",
    covers: /alt text|describ\w* (your |the )?images|image descriptions/i,
  },
  titles: {
    title: () => "Give each page its own title",
    what:
      "The title tag is the browser tab, the bookmark and the search result; write one that names " +
      "the page.",
    impact: "medium",
    effort: "low",
    tier: "technical",
    covers: /\btitles?\b/i,
  },
  copyright: {
    title: () => "Update the copyright year",
    what: "Print the current year in the footer, or drop the year altogether.",
    impact: "low",
    effort: "low",
    tier: "technical",
    covers: /copyright|\byear\b/i,
  },
  template: {
    title: (_, view) =>
      `Bring ${plural(view.consistency?.pagesOffTemplate.length ?? 0, "page", "pages")} back into ` +
      "your site's template",
    what:
      "Give them the same header and navigation as the rest of the site, or redirect them to the " +
      "page that replaced them.",
    impact: "medium",
    effort: "medium",
    tier: "technical",
    covers: /template|navigation/i,
  },
};

/**
 * The health fixes, with the operator's wording where they wrote one.
 *
 * Not split into a `…Generated` half and an override wrapper the way the rest
 * of this file is, because the override key comes from the ROW, which only
 * exists inside this loop. Each string is still built whole and named before
 * it is offered — `composed` compares against the text it is handed, so a
 * fragment here would match nothing.
 */
export function healthFixes(view: ReportView): Fix[] {
  const written = view.fixes.map((f) => f.title);
  const out: Fix[] = [];
  for (const row of healthRows(view)) {
    if (!row.alert) continue;
    const spec = HEALTH_FIXES[row.key];
    if (!spec || written.some((t) => spec.covers.test(t))) continue;
    const title = spec.title(row, view);
    const why = `${spec.what} ${row.detail}`.trim();
    out.push({
      // Keyed by the ROW's key, not by this fix's position in `out`. The two
      // lists are COMPACTED apart: a row that does not alert, and a row whose
      // fix the audit already wrote, are both skipped — so `healthFix[2]` is
      // not `health[2]`, and the offset shifts with the audit's own content.
      // An editing UI holding a row could not derive the positional key, while
      // `row.key` is stable and is already the join key between a row and its
      // fix spec. (Positional keys stay fine where the list is the list, as
      // `passes` is; see the module doc in `overrides.ts`.)
      title: composed(view.overrides, `composed:healthFix[${row.key}].title`, title),
      why: composed(view.overrides, `composed:healthFix[${row.key}].why`, why),
      impact: spec.impact,
      effort: spec.effort,
      tier: spec.tier,
      origin: "measured",
    });
  }
  return out;
}

/**
 * Every fix on the page, in the order the list prints them: the collision fix
 * first when there is one, then the audit's measured fixes, then the fixes
 * written here for whatever else failed under "Does it work", then the
 * audit's recommendations — each group in its own order.
 */
export function allFixes(view: ReportView): Fix[] {
  const collision = collisionFix(view);
  return [
    ...(collision ? [collision] : []),
    ...view.fixes.filter((f) => f.origin === "measured"),
    ...healthFixes(view),
    ...view.fixes.filter((f) => f.origin !== "measured"),
  ];
}

/**
 * The report's top-level sections, keyed by the id their `<section>` carries.
 * One table, used by the contents list, the anchors and the current-section
 * observer, so a renamed id fails a test rather than a jump.
 */
export const TOC_TARGETS = {
  about: "about",
  aiSays: "ai-says",
  control: "control",
  fixes: "fixes",
  passes: "passes",
  talk: "talk",
} as const;

export type TocEntry = {
  id: (typeof TOC_TARGETS)[keyof typeof TOC_TARGETS];
  label: string;
};

/**
 * The table of contents: the sections in page order, the primer first, minus
 * any the report does not render for this view. Labels are the section
 * titles without their dynamic parts — "3 things to fix, in order" lists as
 * "What to fix".
 *
 * The appendix (`passes`) is deliberately not listed. It is two closed
 * disclosures, less than a screen, and as an entry it was current for a
 * moment between "What to fix" and the closing band and then gone — a line in
 * the list that the eye skipped. It keeps its id: three in-page links land
 * there.
 */
export function tocEntries(fixes: Fix[]): TocEntry[] {
  return [
    { id: TOC_TARGETS.about, label: "What this report is" },
    { id: TOC_TARGETS.aiSays, label: "What an AI says about you" },
    { id: TOC_TARGETS.control, label: "What you control" },
    ...(fixes.length ? [{ id: TOC_TARGETS.fixes, label: "What to fix" }] : []),
    { id: TOC_TARGETS.talk, label: "Talk it through" },
  ];
}

/** "September 3, 2026": the day the audit ran, as the masthead prints it.
 *  Null when the report carries no date; the callers word around it. */
export function auditedOn(view: ReportView): string | null {
  return view.generatedAt
    ? new Date(view.generatedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;
}

export type Primer = {
  /** What the report is: the two routes a buyer takes, and that this is a measurement. */
  what: string;
  /** How it was made: the machinery first, the assistant last. */
  how: string;
  /** How to read it: receipts, what was not measured, where the passes and fixes sit. */
  receipts: string;
};

/**
 * The primer, "What this report is": three paragraphs before the first
 * finding, so the results read as the output of an instrument rather than an
 * assistant's opinion of the site. Composed here rather than in the template
 * because two of the three paragraphs change with what the audit measured,
 * and prose composed in code can be asserted exactly.
 *
 * Every number is the view's own, and every clause that names a measurement
 * is gated on the stage that made it. Where a stage did not run the clause is
 * dropped, not defaulted: a primer that says "we read your robots.txt" over a
 * report whose checks never ran is the exact overstatement the report exists
 * to avoid.
 */
export function primer(view: ReportView, fixes: Fix[]): Primer {
  const who = view.businessName ?? "your business";
  const day = auditedOn(view) ?? "one day";
  const what =
    "Someone checking you out before they call now has two routes: a search, or a question " +
    "to an AI assistant, which answers from whatever it can find. This report is what it " +
    "finds today and what on your own site shapes that. " +
    `It is a measurement taken on ${day}, not a promise about rankings or leads.`;

  // Checks that came back with a verdict, not the size of the battery. Every
  // check in it is named and shipped, but a given site never meets all of
  // them: on the sample fifteen of the seventy-six are "not-applicable" (no
  // form to test, no sitemap to read) or "unmeasured", and counting those as
  // work done is the overstatement this report exists to avoid — the honest
  // number is the forty-eight that passed plus the thirteen that failed.
  // Digits, not words: numberWord spells out only one to ten.
  const ran =
    view.siteChecks?.filter((c) => c.status === "pass" || c.status === "fail").length ?? 0;
  const machinery: string[] = [];
  if (view.accessibility?.measured) machinery.push("ran the accessibility rules");
  const reach = view.crawlerReach;
  if (reach?.measured && reach.checked > 0) {
    machinery.push(`read your robots.txt as ${numberWord(reach.checked)} AI crawlers would`);
  }
  if (view.journey && view.journey.pagesExamined > 0) {
    machinery.push("counted the clicks from any page to reaching you");
  }

  // Whole sentences joined by a single space, rather than splicing a comma or
  // "and" onto `about ${who}` — so no branch (an empty `machinery`, a missing
  // `categoryProbes`) can leave a double space or a stray space before
  // punctuation.
  // With nothing to report the clause goes rather than softening to "its
  // named checks": a count is the whole point of the sentence, and a report
  // whose battery never ran should not imply it did.
  const fetched =
    "Most of it is machinery, not an AI's opinion. It fetched every page twice, plain and " +
    "in a real browser" +
    (ran
      ? `, then ran ${ran} named checks on what came back, from dead links to structured ` +
        "data to whether a phone can fill in your forms."
      : ".");

  // The assistant, last, and only the parts that ran. The accuracy stage is
  // the "check each statement" claim — SourceCheck.svelte gates its section
  // on the same answersRead — the branded probes are the ask by name, and
  // the category probes are the buyer's questions. A report with none of the
  // three gets no sentence about an assistant, not a sentence about work
  // nobody did.
  const checked = view.accuracy !== null && view.accuracy.answersRead > 0;
  const byName = checked || view.brandedProbes.length > 0;
  const live = view.categoryProbes.length > 0;
  const asked = byName
    ? `Only then did we ask an assistant about ${who}` +
      (checked && live
        ? ", check each statement against your own pages, and put a buyer's questions to it " +
          "live, keeping every source it cited."
        : checked
          ? " and check each statement against your own pages."
          : live
            ? " and put a buyer's questions to it live, keeping every source it cited."
            : ".")
    : live
      ? "Only then did we put a buyer's questions to an assistant live, keeping every source it cited."
      : null;
  const how = [fetched, machinery.length ? `It ${joinList(machinery)}.` : null, asked]
    .filter((s): s is string => s !== null)
    .join(" ");

  const receipts =
    "Every finding carries its receipt. What we could not measure is marked, not scored " +
    "against you. What passed sits in one place near the end, " +
    (fixes.length ? "the fixes are in the order we would do them, " : "") +
    "and because an assistant's answers move, this is worth taking again.";

  return { what, how, receipts };
}
