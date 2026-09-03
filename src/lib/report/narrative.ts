import { healthRows } from "./health";
import { GOAL_LABELS, type ReportView } from "./model";

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
  | "absent"
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

  const absent = acc?.assertions.filter((a) => a.verdict === "absent") ?? [];
  if (absent.length > 0) {
    return {
      kind: "absent",
      text:
        `The assistant describes you from other people's pages: ${numberWord(absent.length)} ` +
        `${absent.length === 1 ? "statement" : "statements"} it made about you ${absent.length === 1 ? "is" : "are"} ` +
        `not on your site.`,
    };
  }

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
  return text
    .replace(/(\*\*|__)(?=\S)([\s\S]+?)(?<=\S)\1/g, "$2")
    .replace(/(?<!\S)\*(?=\S)([^*\n]+?)(?<=\S)\*(?!\S)/g, "$1");
}
