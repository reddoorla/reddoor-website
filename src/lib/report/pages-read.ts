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

/** "two", "ten", then digits with a thousands separator ("11", "50,000") — the
 *  reader's register, not the instrument's. */
export function numberWord(n: number): string {
  return WORDS[n] ?? n.toLocaleString("en-US");
}

/** True when the crawl read no page at all. There is then no count to state,
 *  and no absence may be worded as resting on a page we read. */
export function readNothing(view: ReportView): boolean {
  return view.pagesRead !== null && view.pagesRead.read < 1;
}

/** A count of pages read against the site's, the one shape every phrase below is
 *  made from. `floor` says the site total is "at least" (a truncated sitemap). */
export type PagesDenominator = { read: number; site: number | null; floor: boolean };

const pages = (n: number): string => `${numberWord(n)} ${n === 1 ? "page" : "pages"}`;

/** The crawl's own count: every page it read, against the site's total. */
export function crawlDenominator(view: ReportView): PagesDenominator | null {
  const p = view.pagesRead;
  if (!p) return null;
  return { read: p.read, site: p.site, floor: p.siteIsFloor === true };
}

/**
 * The source check's count: the pages IT read (it skips empty pages and stops at
 * a character budget, so fewer than the crawl), against the same site total the
 * crawl uses. The line above the source check and its footnote both state this,
 * so they cannot disagree.
 *
 * A crawl stored without its pages has no crawl count, so the sitemap's count is
 * the total only when it is more than the pages the check read. A smaller
 * sitemap says nothing about the site, and "all 12 of your pages" over a 9-URL
 * sitemap was the claim this guards against.
 */
export function sourceCheckDenominator(view: ReportView): PagesDenominator | null {
  const acc = view.accuracy;
  if (!acc) return null;
  if (view.pagesRead)
    return {
      read: acc.pagesRead,
      site: view.pagesRead.site,
      floor: view.pagesRead.siteIsFloor === true,
    };
  const sitemap = view.sitemapUrlCount;
  return {
    read: acc.pagesRead,
    site: sitemap !== null && sitemap > acc.pagesRead ? sitemap : null,
    floor: false,
  };
}

/** "20 of your 95 pages", "20 of at least 50,000 pages on your site", "your one
 *  page", "all 7 of your pages". Null when nothing was read. */
export function phraseOf(d: PagesDenominator | null): string | null {
  if (!d || d.read < 1) return null;
  if (d.site === null) return pages(d.read);
  if (d.site <= d.read)
    return d.read === 1 ? "your one page" : `all ${numberWord(d.read)} of your pages`;
  if (d.floor) return `${numberWord(d.read)} of at least ${numberWord(d.site)} pages on your site`;
  return `${numberWord(d.read)} of your ${pages(d.site)}`;
}

/**
 * The clause an absence carries, from a denominator. Read as the negative it
 * always is ("not in ...", "not found in ..."): "in any of your seven pages"
 * means in none of them, and "(we read them all)" says why the reader can rely
 * on that. A floor reads "out of at least", which works after "not found" and
 * after "not in place" alike.
 */
export function clauseOf(d: PagesDenominator | null): string | null {
  if (!d || d.read < 1) return null;
  if (d.site === null) return `in the ${pages(d.read)} we read`;
  if (d.site <= d.read)
    return d.read === 1
      ? "in your one page, which we read"
      : `in any of your ${numberWord(d.read)} pages (we read them all)`;
  if (d.floor)
    return `in the ${pages(d.read)} we read, out of at least ${numberWord(d.site)} pages on your site`;
  return `in the ${numberWord(d.read)} of your ${pages(d.site)} we read`;
}

/** How much of the site the crawl read, as a phrase. See `phraseOf`. */
export function pagesReadPhrase(view: ReportView): string | null {
  return phraseOf(crawlDenominator(view));
}

/** "in the 20 of your 95 pages we read", the clause an absence carries. See `clauseOf`. */
export function inPagesRead(view: ReportView): string | null {
  return clauseOf(crawlDenominator(view));
}

/** The same clause, for the pages the SOURCE CHECK read. See `sourceCheckDenominator`. */
export function inSourceCheckPages(view: ReportView): string | null {
  return clauseOf(sourceCheckDenominator(view));
}
