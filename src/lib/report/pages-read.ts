import type { ReportView } from "./model";

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

/**
 * How much of the site we read, as a phrase: "20 of your 95 pages", or "12
 * pages" when we know no total. Null when there is no crawl to count.
 *
 * Every absence this report prints is a statement about the pages we read,
 * not about the site, and a reader who knows their site has 95 pages can only
 * weigh "your site does not say" against the 20 it rests on if we say so. "We
 * read every page" was printed over crawls of 1 and 12 pages (the audit-system
 * review, LG-12).
 */
export function pagesReadPhrase(view: ReportView): string | null {
  const p = view.pagesRead;
  if (!p) return null;
  const pages = (n: number): string => `${numberWord(n)} ${n === 1 ? "page" : "pages"}`;
  if (p.site === null) return pages(p.read);
  if (p.site <= p.read)
    return p.read === 1 ? "your one page" : `all ${numberWord(p.read)} of your pages`;
  return `${numberWord(p.read)} of your ${p.siteIsFloor ? "at least " : ""}${pages(p.site)}`;
}

/** "in the 20 of your 95 pages we read", the clause an absence carries. */
export function inPagesRead(view: ReportView): string | null {
  const p = view.pagesRead;
  const phrase = pagesReadPhrase(view);
  if (!p || phrase === null) return null;
  if (p.site !== null && p.site <= p.read)
    return p.read === 1
      ? "in your one page, which we read"
      : `in each of your ${numberWord(p.read)} pages, all of which we read`;
  return `in the ${phrase} we read`;
}
