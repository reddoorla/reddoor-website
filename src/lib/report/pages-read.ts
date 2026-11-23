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
 *  made from. `floor` says the site total is "at least" (a truncated sitemap).
 *  `from` says where the site total came from: only a sitemap, present and not
 *  truncated, may carry an "all" claim. "links" is a count of pages the home page
 *  links to; "found" is the union of those links and the sitemap's URLs, which
 *  outgrows the sitemap. Neither is "your pages". */
export type PagesDenominator = {
  read: number;
  site: number | null;
  floor: boolean;
  from: "sitemap" | "links" | "found" | null;
};

const pages = (n: number): string => `${numberWord(n)} ${n === 1 ? "page" : "pages"}`;

/** The site total is the sitemap's, complete and untruncated: the one total an
 *  "all of your pages" may rest on. A floor is never complete, whatever its count. */
export function completeOf(d: PagesDenominator): boolean {
  return d.site !== null && d.site <= d.read && d.from === "sitemap" && !d.floor;
}

/** The whole site is one page, and a complete sitemap says so: the only case that
 *  may read "your one page". One page of a larger site is counted, never named. */
function onePageWhole(d: PagesDenominator): boolean {
  return completeOf(d) && d.read === 1 && d.site === 1;
}

/** "all of your pages", or "both of your pages" for two: never "all two". */
const allOfYourPages = (n: number): string =>
  n === 2 ? "both of your pages" : `all ${numberWord(n)} of your pages`;

/** The crawl's own count: every page it read, against the site's total. */
export function crawlDenominator(view: ReportView): PagesDenominator | null {
  const p = view.pagesRead;
  if (!p) return null;
  return { read: p.read, site: p.site, floor: p.siteIsFloor === true, from: p.siteFrom ?? null };
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
      from: view.pagesRead.siteFrom ?? null,
    };
  const sitemap = view.sitemapUrlCount;
  const known = sitemap !== null && sitemap > acc.pagesRead;
  return {
    read: acc.pagesRead,
    site: known ? sitemap : null,
    floor: known && view.sitemapIsFloor === true,
    from: known ? "sitemap" : null,
  };
}

/** "20 of your 95 pages", "20 of at least 50,000 pages on your site", "your one
 *  page", "all 7 of your pages", "7 of the 7 pages we found linked from your home
 *  page". Null when nothing was read. */
export function phraseOf(d: PagesDenominator | null): string | null {
  if (!d || d.read < 1) return null;
  if (d.site === null) return pages(d.read);
  if (d.floor)
    return d.site > d.read
      ? `${numberWord(d.read)} of at least ${numberWord(d.site)} pages on your site`
      : pages(d.read);
  if (onePageWhole(d)) return "your one page";
  if (completeOf(d)) return allOfYourPages(d.read);
  if (d.from === "sitemap")
    return d.read === 1
      ? `one page of your ${numberWord(d.site)}`
      : `${numberWord(d.read)} of your ${pages(d.site)}`;
  // Every page we found was read: name them once, with no "of the" count to repeat.
  if (d.from === "found")
    return d.site === d.read
      ? `the ${pages(d.read)} we found`
      : `${numberWord(d.read)} of the ${numberWord(d.site)} pages we found`;
  if (d.site === d.read) return `the ${pages(d.read)} we found linked from your home page`;
  return `${numberWord(d.read)} of the ${numberWord(d.site)} pages we found linked from your home page`;
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
  if (d.floor)
    return d.site > d.read
      ? `in the ${pages(d.read)} we read, out of at least ${numberWord(d.site)} pages on your site`
      : `in the ${pages(d.read)} we read`;
  if (onePageWhole(d)) return "in your one page, which we read";
  if (completeOf(d)) return `in any of your ${numberWord(d.read)} pages (we read them all)`;
  if (d.from === "sitemap")
    return d.read === 1
      ? `in the one page we read, of your ${numberWord(d.site)}`
      : `in the ${numberWord(d.read)} of your ${pages(d.site)} we read`;
  // Every page we found was read: "which we read" says so, after a negative too.
  if (d.from === "found")
    return d.site === d.read
      ? `in the ${pages(d.read)} we found, which we read`
      : `in the ${pages(d.read)} we read, of the ${numberWord(d.site)} we found`;
  if (d.site === d.read)
    return `in the ${pages(d.read)} we found linked from your home page, which we read`;
  return `in the ${pages(d.read)} we read, of the ${numberWord(d.site)} we found linked from your home page`;
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

/**
 * The scope a measurement over the crawl's pages states, for a health row that
 * says what it measured over: "across the 20 of your 95 pages we read", "on your
 * one page, which we read". Null when no count is known. Never "all" unless a
 * sitemap says so (see `completeOf`).
 */
export function acrossPagesRead(view: ReportView): string | null {
  const d = crawlDenominator(view);
  if (!d || d.read < 1) return null;
  if (onePageWhole(d)) return "on your one page, which we read";
  if (completeOf(d)) return `across ${allOfYourPages(d.read)} we read`;
  const clause = clauseOf(d);
  return clause ? clause.replace(/^in /, "across ") : null;
}
