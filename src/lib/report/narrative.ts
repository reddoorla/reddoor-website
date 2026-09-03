import { healthRows, type HealthRow } from "./health";
import { GOAL_LABELS, type Fix, type ReportView } from "./model";

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

/** First letter down, trailing full stop or question mark off, so a label or a
 *  question can sit inside a sentence of ours. */
function inline(text: string): string {
  const t = text.trim().replace(/[.?]$/, "");
  return t.charAt(0).toLowerCase() + t.slice(1);
}

export function headlineFinding(view: ReportView): Headline {
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

export type PassGroup = { title: string; items: string[] };

/**
 * Everything that passed, grouped the way the page is, one line each.
 *
 * The page prints findings and nothing else; a reader who wants to know what
 * was checked and came back clean opens this. The lines are receipts for
 * breadth, not findings, so they are terse on purpose.
 */
export function passes(view: ReportView): PassGroup[] {
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
export function collisionFix(view: ReportView): Fix | null {
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

export function healthFixes(view: ReportView): Fix[] {
  const written = view.fixes.map((f) => f.title);
  const out: Fix[] = [];
  for (const row of healthRows(view)) {
    if (!row.alert) continue;
    const spec = HEALTH_FIXES[row.key];
    if (!spec || written.some((t) => spec.covers.test(t))) continue;
    out.push({
      title: spec.title(row, view),
      why: `${spec.what} ${row.detail}`.trim(),
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
