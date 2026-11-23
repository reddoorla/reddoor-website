import { toReportView, type ReportView } from "../model";
import type { AuditReport } from "../fetch";
import { readReleaseLines, type ReleaseLineReading } from "./release-lines";
import { crawlDenominator, phraseOf, readNothing } from "../pages-read";

/**
 * THE TECHNICAL REPORT: a second view of the same token, for the buyer who says
 * "it's slow, something is broken, is it secure" (W4; the design is the
 * 11-23 audit-system review, `04-technical.md` "The report").
 *
 * EVERY LINE HAS A RECEIPT. This view reads only the deterministic stages:
 * crawl, checks, assets, basics, stack, accessibility, dns, http and the
 * stored site checks. It never reads `analyze`, `probes`, `accuracy` or
 * `goalFit`, the stages a model wrote, so none of their errors can reach it.
 * `toReportView` is called for the deterministic projections it already
 * tests; the paid fields it also returns are dropped on the floor here, and a
 * test renders a row with those stages deleted and requires the same page.
 *
 * RE-CUT, NOT RE-RUN. Stored rows hold verdicts made before five checks were
 * corrected (TEC-04, 05, 06), so for those findings this view re-derives the
 * verdict from the raw field instead of trusting the stored row: DMARC from
 * the record, `noindex` from each page's robots meta, HubSpot from the stack
 * evidence, `{{` addresses as a template defect. The same rules now live in
 * reddoor-maintenance's `site-checks.ts` and `stack.ts` for new runs; this
 * copy exists because a stored row can only be corrected at render time.
 *
 * TWO INSTRUMENTS NOT YET PROVEN ON OLD ROWS. Script errors and the
 * accessibility scan were measured, before 11-23, in a browser that counted
 * styled `console.error` banners as errors, measured contrast on text still
 * fading in, and scanned inside other companies' video players. A row from
 * that crawl does not carry `vitals.scriptErrors`; for it, both sections say
 * a fresh scan is needed and print nothing from the old one.
 *
 * WORDING (the legal lens, LGL-05): an observation plus its ordinary
 * consequence. Never what "anyone can" do, never "vulnerable" or "insecure",
 * never "ADA", never a version string.
 */

/** How much a finding matters, which decides whether it reaches the first
 *  screen. 3: something a visitor hits today. 2: worth fixing this month.
 *  1: housekeeping, kept in the folded appendix. */
export type Weight = 1 | 2 | 3;

export type Finding = {
  id: string;
  weight: Weight;
  /** One sentence: what we saw and what it ordinarily means. */
  text: string;
  /** Where to look: a URL or the record, never a version string. */
  evidence: string | null;
};

export type Row = { label: string; text: string; ok: boolean | null };

export type TechnicalView = {
  host: string;
  generatedAt: string;
  /** "a WordPress site on an Apache server", or null when nothing was read. */
  runningOn: string | null;
  /** The headline about breakage: true when nothing a visitor hits is broken. */
  nothingBroken: boolean;
  /** Something a visitor meets is marked broken below, whatever its weight: a
   *  ✕ row in "Does the address work" or "Is anything broken", sideways
   *  scrolling, images dropped over plain http, or a serious or critical
   *  accessibility failure. The lede says "nothing broken that a visitor runs
   *  into" only when this is false. A ✕ on a header, a mail record or small
   *  text is a setting to change, and the lede does not claim otherwise. */
  anyRowBroken: boolean;
  /** A serious or critical accessibility failure is among the breakage: it
   *  can stop some visitors, so the lede may not say nothing stops a visitor. */
  accessFails: boolean;
  /** The scan itself did not finish: the crawl, assets or basics stage is
   *  missing or failed. The page then claims no all-clear. */
  incomplete: boolean;
  /** How many weight-3 and weight-2 findings there are in all; the first
   *  screen shows at most three of each. */
  brokenTotal: number;
  attentionTotal: number;
  /** Things a visitor hits today (weight 3), at most three on the first screen. */
  broken: Finding[];
  /** The next things worth attention (weight 2), at most three on the first screen. */
  attention: Finding[];
  /** Three to five repairs in order, for "What to fix first". */
  fixFirst: Finding[];
  /** Weight-3 and weight-2 findings the first screen and the fix list had no
   *  room for, so none is dropped from the page. */
  more: Finding[];
  /** Everything else, weight 1, for the appendix. */
  housekeeping: Finding[];
  sections: {
    running: { items: { layer: string; names: string[] }[]; releaseLines: ReleaseLineReading[] };
    address: Row[];
    brokenThings: Row[];
    weight: { rows: Row[]; heaviest: { url: string; bytes: number }[] };
    phone: Row[];
    safe: Row[];
    email: Row[];
    domain: Row | null;
    access: Access;
    /** `sentence` is the main report's own count of what we read (W3's
     *  `phraseOf`), so the two views of one token cannot disagree, and a
     *  truncated sitemap or a count of links is never "your pages". `pages`
     *  are the pages that came back, which is what `sentence` counts. */
    read: { sentence: string; pages: string[] };
  };
};

export type Access =
  | { state: "not-measured" }
  | { state: "needs-fresh-scan" }
  | {
      state: "measured";
      pagesExamined: number;
      /** `violationsTotal`: every failing rule, not only the stored list. */
      rulesFailed: number;
      /** How many of those the stored list carries. */
      rulesListed: number;
      byImpact: {
        impact: string;
        rules: { id: string; help: string; nodes: number; pages: number }[];
      }[];
    };

/** The crawl started recording thrown errors apart from console messages in
 *  the same change that set reduced motion and kept third-party frames out of
 *  axe. Its presence is the marker of a run measured with the fixed browser. */
function crawledWithCurrentSettings(pages: RawPage[]): boolean {
  return pages.some((p) => Array.isArray(p.vitals?.scriptErrors));
}

/** reddoor-maintenance#1959, 2026-11-05 17:29 UTC: before it, a blind resolver
 *  answered "no such record" for every domain, so a `null` record in an older
 *  row is unproven. A record that IS present is never doubted. */
const DNS_PROVEN_FROM = Date.parse("2026-11-05T17:29:00Z");

// ─── Raw shapes, read defensively ────────────────────────────────────────────

type RawVitals = {
  consoleErrors?: string[];
  scriptErrors?: string[];
  failedRequests?: { url: string; status: number | null; firstParty: boolean }[];
  overflowAt375?: number | null;
  tinyText?: { count: number; sample: string | null } | null;
  oversizedImages?: { src: string; naturalWidth: number; renderedWidth: number }[];
};
type RawExtract = { metas?: Record<string, string>; anchors?: { href: string }[] };
type RawPage = {
  url: string;
  status?: number | null;
  vitals?: RawVitals | null;
  rendered?: RawExtract | null;
  raw?: RawExtract | null;
};
type RawDns = {
  domain?: string | null;
  contactMx?: { domain: string; hasMx: boolean } | null;
  measured?: boolean;
  spf?: string | null;
  dmarc?: string | null;
  mx?: string[] | null;
  expiresAt?: string;
};
type RawHttp = {
  measured?: boolean;
  redirectChains?: { checked: number; chained: unknown[] } | null;
  sitemapUrls?: { checked: number; total: number; broken: { url: string }[] } | null;
  externalLinks?: { checked: number; total: number; broken: { url: string }[] } | null;
  favicon?: { verdict: string } | null;
};

const stageData = <T>(raw: AuditReport, key: string): T | null => {
  const s = (raw as Record<string, unknown>)[key];
  if (!s || typeof s !== "object") return null;
  const r = s as { ok?: unknown; data?: unknown };
  return r.ok === true && r.data && typeof r.data === "object" ? (r.data as T) : null;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const mb = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`;
const arr = <T>(x: T[] | null | undefined): T[] => (Array.isArray(x) ? x : []);

/** "none of the 60 we tested came back missing". Not "all answered": a probe
 *  that got no answer at all is counted as tested but never as broken. */
const noneMissing = (n: number) =>
  n === 0
    ? "none to test"
    : n === 1
      ? "the one we tested did not come back missing"
      : `none of the ${n} we tested came back missing`;

/**
 * An address as printed: version-like query parameters removed, because a
 * WordPress asset carries the core or plugin version as `?ver=6.4.2` and the
 * page never prints a version string (LGL-05).
 */
export function printableUrl(url: string): string {
  // Resolved against a dummy base so a relative address gets the same rules.
  let u: URL;
  try {
    u = new URL(url, "https://relative.invalid");
  } catch {
    return url;
  }
  // Only a script, stylesheet or font carries a version in its address. An image,
  // a PDF or a page does not, and stripping numbers there prints an address
  // that does not exist (a screenshot named "…-at-10.30.45.png").
  // Fonts too: a theme's font-awesome-4.7.0/…woff2?v=4.7.0 carries its version.
  // An SVG is an image unless its path says it is a font
  // (fonts/fontawesome-webfont.svg?v=4.7.0); an image's path is never rewritten.
  const svgFont = /\.svg$/i.test(u.pathname) && /(?:\/fonts?\/|webfont)/i.test(u.pathname);
  const asset = /\.(?:js|mjs|css|woff2?|ttf|otf|eot)$/i.test(u.pathname);
  // On an asset, a version can sit under any name (?rev=6.6.14), carry a
  // prerelease (6.6.14-beta), or be the whole query (?6.4.2, or ?ver%3D6.4.2,
  // which decodes to a bare key): any parameter whose value, or bare key, is a
  // dotted version goes, whatever it is called.
  const versionLike = /^v?\d+(?:\.\d+)+(?:[-+][\w.]+)?$/i;
  const bareVersion = (k: string) =>
    versionLike.test(k) || versionLike.test(k.replace(/^(?:v|ver|version)=/i, ""));
  for (const [k, v] of [...u.searchParams.entries()])
    if (
      /^(?:ver|version)$/i.test(k) ||
      ((asset || svgFont) && /^v$/i.test(k)) ||
      (asset && (versionLike.test(v) || (v === "" && bareVersion(k))))
    )
      u.searchParams.delete(k);
  if (asset) {
    // A whole version directory (cdnjs's /3.6.0/), then a version inside a
    // name: jquery-1.12.4.min.js, bootstrap-4.6.0/, lib@1.2.3/,
    // jquery-ui-1.12.1.custom.min.js, jquery-3.6.0-min.js.
    u.pathname = u.pathname
      .replace(/\/v?\d+(?:\.\d+)+(?=\/)/gi, "")
      .replace(/[-.@]v?\d+(?:\.\d+)+(?=[-./]|$)/gi, "");
  }
  const out = u.toString();
  return url.startsWith("http") ? out : out.replace("https://relative.invalid", "");
}

/** Pixels wider than a 375px screen before a page counts as scrolling
 *  sideways. Kept in step with maintenance's `mobile-overflow` check
 *  (`OVERFLOW_TOLERANCE` in site-checks.ts), so the two views of one token
 *  agree on the same page. */
const OVERFLOW_TOLERANCE = 4;

/** A stack name as printed. A WordPress theme or plugin is named by its folder,
 *  and a hand-installed one can carry its version there (some-plugin-2.3.1,
 *  plugin_2.3.1, "Some Plugin 2.3.1"). */
export function printableName(name: string): string {
  return name.replace(/[-._@ ]v?\d+(?:\.\d+)+(?:[-+][\w.]+)?$/i, "") || name;
}

/** The address a stored check's evidence starts with ("<url>: <snippet>"), or
 *  null when it does not start with one: the operator may have edited it into
 *  prose, and prose is not an address. */
function evidenceAddress(evidence: string | null | undefined): string | null {
  const head = evidence?.split(": ")[0]?.trim();
  if (!head) return null;
  try {
    const u = new URL(head);
    return u.protocol === "http:" || u.protocol === "https:" ? printableUrl(head) : null;
  } catch {
    return null;
  }
}

/** "Apache/2.4.18 (Ubuntu)" → "Apache". The product, never the build. */
export function productName(header: string | undefined): string | null {
  if (!header) return null;
  const name = header.split(/[\s/,(]/)[0]?.trim();
  return name && !/\d/.test(name) ? name : null;
}

const dmarcPolicy = (record: string) =>
  /(?:^|;)\s*p\s*=\s*([a-z]+)/i.exec(record)?.[1]?.toLowerCase() ?? null;

/** DMARC in three states (TEC-04). A record with no readable `p=` applies no
 *  policy, the same outcome as `p=none`, but is not worded as `p=none`. */
export function dmarcState(record: string | null): "missing" | "monitoring" | "enforcing" {
  if (record === null) return "missing";
  const p = dmarcPolicy(record);
  return p === "quarantine" || p === "reject" ? "enforcing" : "monitoring";
}

/** Paths where `noindex` is the owner's choice (TEC-05). Kept in step with
 *  reddoor-maintenance `isDeliberatelyHiddenPath`: the LAST path segment only,
 *  so `/legal/terms` is a legal page and `/search/boise-homes` is content. */
const DELIBERATE =
  /^(?:privacy(?:-policy|-notice|-statement)?|terms(?:-of-(?:use|service))?|terms-(?:and-)?conditions|legal|disclaimer|cookies?(?:-policy|-notice)?|thank-?you(?:-for-[a-z-]+|-page|-\d+)?|thanks|confirmation|search|login|log-in|signin|sign-in|wp-login|account|my-account)$/i;
export function isDeliberatelyHidden(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.searchParams.has("s") && u.pathname === "/") return true;
    const segs = u.pathname
      .split("/")
      .filter(Boolean)
      .map((x) => x.replace(/\.(?:html?|php|aspx?)$/i, ""));
    while (segs.length > 1 && /^(?:index|amp)$/i.test(segs[segs.length - 1]!)) segs.pop();
    const last = segs.pop();
    return last !== undefined && DELIBERATE.test(last);
  } catch {
    return false;
  }
}

/** Whether a content policy's frame-ancestors actually restricts framing:
 *  `*`, `http:` and `https:` allow every site. Kept in step with
 *  reddoor-maintenance `restrictsFraming`. */
function restrictsFraming(csp: string | undefined): boolean {
  if (!csp) return false;
  return csp.split(",").some((policy) =>
    policy.split(";").some((d) => {
      const [name, ...sources] = d.trim().split(/\s+/);
      if (name?.toLowerCase() !== "frame-ancestors" || sources.length === 0) return false;
      return !sources.some((x) => /^(?:\*|https?:|(?:https?:\/\/)?\*(?::\*)?\/?)$/i.test(x));
    }),
  );
}

/** Server headers that name a CDN in front of the site, not its server. */
const CDN_SERVERS = /^(?:cloudflare|cloudfront|akamaighost|fastly|varnish)$/i;
const article = (word: string) => (/^(?:[aeiou]|nginx)/i.test(word) ? "an" : "a");

const isPlaceholderUrl = (u: string) => /\{\{|%7B%7B/i.test(u);

/** HubSpot's tracking and banner hosts are not a CMS (TEC-06). */
const HUBSPOT_TRACKING = /(?:^|\/\/|\.)(?:hs-scripts|hs-banner|hs-analytics)\.(?:com|net)\//;

// ─── The view ────────────────────────────────────────────────────────────────

/**
 * @param today the render date, for the release-line table. A parameter so a
 *   test pins it; the routes pass `new Date()`.
 * @param hiddenChecks the site-check keys the operator hid on this report
 *   (W1). This view re-derives its findings from the raw fields, so removing
 *   the check from `siteChecks` alone would not take them off the page.
 */
export function toTechnicalView(
  raw: AuditReport,
  today: Date = new Date(),
  hiddenChecks: ReadonlySet<string> = new Set(),
): TechnicalView {
  // The deterministic projections only, from a copy with the stages a model
  // wrote removed: so they are never read, and a malformed one cannot throw
  // here and take the Technical page down with it.
  const {
    analyze: _a,
    probes: _p,
    accuracy: _c,
    goalFit: _g,
    ...deterministic
  } = raw as Record<string, unknown>;
  const base: ReportView = toReportView(deterministic as AuditReport);
  const crawl = stageData<{
    homeHeaders?: Record<string, string>;
    pages?: RawPage[];
    sitemap?: { urlCount?: number } | null;
  }>(raw, "crawl");
  const pages: RawPage[] = (crawl?.pages ?? []).filter((p) => p && typeof p.url === "string");
  const headers = crawl?.homeHeaders ?? {};
  const dns = stageData<RawDns>(raw, "dns");
  const http = stageData<RawHttp>(raw, "http");
  const current = crawledWithCurrentSettings(pages);
  const generated = Date.parse(base.generatedAt);
  const dnsProven = Number.isFinite(generated) && generated >= DNS_PROVEN_FROM;

  const findings: Finding[] = [];
  const add = (id: string, weight: Weight, text: string, evidence: string | null = null) =>
    findings.push({ id, weight, text, evidence });

  // ── What you are running ──
  const items = (base.stack?.items ?? []).map((i) =>
    i.layer === "cms" && i.name === "HubSpot CMS" && HUBSPOT_TRACKING.test(i.evidence)
      ? { ...i, layer: "analytics", name: "HubSpot tracking" }
      : i,
  );
  const layers = new Map<string, string[]>();
  for (const i of items) {
    const names = layers.get(i.layer) ?? [];
    const name = printableName(i.name);
    if (!names.includes(name)) names.push(name);
    layers.set(i.layer, names);
  }
  const cms = layers.get("cms") ?? [];
  const product = productName(headers["server"]);
  const cdn = product !== null && CDN_SERVERS.test(product);
  const server = cdn ? null : product;
  const runningOn =
    cms.length === 0 && !server && !cdn
      ? null
      : `${cms.length ? `${article(cms[0]!)} ${cms.join(" and ")} site` : "a site"}${server ? ` on ${article(server)} ${server} server` : cdn ? ` behind ${product}` : ""}`;

  const releaseLines = readReleaseLines(headers, today);
  for (const r of releaseLines) {
    if (r.unsupported) {
      add(
        `release-${r.header}`,
        2,
        `Your ${r.header === "server" ? "server" : "site's runtime"} reports ${r.line}, whose makers ended standard support in ${monthYear(r.supportEnds)}. Updates can still be applied to an old line, so this says how old it is, not whether it has been patched.`,
      );
    }
  }
  const versioned = ["server", "x-powered-by"].filter((h) => /\d+\.\d+/.test(headers[h] ?? ""));
  if (versioned.length) {
    add(
      "version-announced",
      1,
      "Your server announces which software version it runs. That costs nothing on its own, and most hosts switch it off.",
    );
  }

  // ── Does the address work ──
  const address: Row[] = [];
  const b = base.basics;
  // The stored `ok` needs both an https landing AND a page that loaded, so
  // read where it landed before saying plain http is served.
  const entryLanded = (b?.insecureEntry as { landedOn?: string | null } | undefined)?.landedOn;
  const entryHttps = typeof entryLanded === "string" && entryLanded.startsWith("https:");
  if (b?.insecureEntry.measured) {
    address.push({
      label: "Typing the address without https",
      text: b.insecureEntry.ok
        ? "lands on the secure site"
        : entryHttps
          ? "reaches the secure address, but the page did not load for us"
          : "does not reach the secure site",
      ok: b.insecureEntry.ok ? true : entryHttps ? null : false,
    });
    if (!b.insecureEntry.ok && !entryHttps)
      add(
        "insecure-entry",
        3,
        "Typing your address without https does not land on the secure site.",
      );
  }
  if (b?.hostVariant.measured) {
    address.push({
      label: `The address with or without www`,
      text: b.hostVariant.ok
        ? "both reach the site"
        : `${b.hostVariant.host} does not reach the site`,
      ok: b.hostVariant.ok,
    });
    if (!b.hostVariant.ok)
      add(
        "host-variant",
        3,
        `${b.hostVariant.host} does not reach your site.`,
        printableUrl(b.hostVariant.url),
      );
  }
  if (b?.notFound.measured) {
    // The stored `ok` folds two things together: whether a made-up address
    // answers 404, and whether that page links back into the site. Read apart,
    // because they mean different things to the owner.
    // Only a status under 400 is a soft 404, as health.ts reads it: a 403
    // from a firewall or a 5xx is not a page search engines list. A null
    // status is our missing answer, not theirs.
    const status = b.notFound.status;
    const soft = status !== null && status < 400;
    const answers404 = status === 404 || status === 410;
    address.push({
      label: "A page that does not exist",
      text:
        status === null
          ? "we could not get an answer for it"
          : soft
            ? "does not answer as not found"
            : !answers404
              ? `answered with an error (${status}) rather than a not-found page, so we could not judge it`
              : b.notFound.linksBackToSite
                ? "answers as not found, with a way back into the site"
                : "answers as not found, but the page has no link back into the site",
      ok:
        status === null || (!soft && !answers404) ? null : answers404 && b.notFound.linksBackToSite,
    });
    if (soft)
      add(
        "not-found",
        2,
        "A made-up address on your site does not answer as not found, so search engines can list pages that do not exist.",
      );
    else if (answers404 && !b.notFound.linksBackToSite)
      add(
        "not-found-dead-end",
        1,
        "Your not-found page has no link back into the site, so a visitor who follows a dead link has nowhere to go next.",
      );
  }
  if (http?.redirectChains) {
    const n = arr(http.redirectChains.chained).length;
    address.push({
      label: "Redirects",
      text:
        n === 0
          ? http.redirectChains.checked === 0
            ? "none to follow"
            : http.redirectChains.checked === 1
              ? "the one we followed does not chain"
              : `none of the ${http.redirectChains.checked} we followed chain`
          : `${plural(n, "address goes", "addresses go")} through more than one redirect`,
      ok: n === 0,
    });
    if (n)
      add(
        "redirect-chains",
        1,
        `${plural(n, "address goes", "addresses go")} through more than one redirect before arriving.`,
      );
  }
  if (http?.favicon) {
    const ok = http.favicon.verdict === "ok";
    address.push({ label: "The browser-tab icon", text: ok ? "loads" : "does not load", ok });
    if (!ok) add("favicon", 1, "The small icon browsers show in the tab does not load.");
  }

  // ── Is anything broken ──
  const brokenThings: Row[] = [];
  const a = base.assets;
  if (a) {
    // `{{` links are counted once, as template code below, not twice.
    const realBroken = a.brokenLinks.filter((l) => !isPlaceholderUrl(l.url));
    const bl = realBroken.length;
    const allBroken = a.brokenLinks.length;
    const bi = a.brokenImages.length;
    brokenThings.push({
      label: "Links on your pages",
      text:
        allBroken === 0
          ? noneMissing(a.linksChecked)
          : `${allBroken} of the ${a.linksChecked} we tested came back missing`,
      ok: allBroken === 0,
    });
    brokenThings.push({
      label: "Images",
      text:
        bi === 0
          ? noneMissing(a.imagesChecked)
          : `${bi} of the ${a.imagesChecked} we tested did not load`,
      ok: bi === 0,
    });
    for (const l of realBroken.slice(0, 1))
      add(
        "broken-links",
        3,
        `${plural(bl, "link on your pages leads", "links on your pages lead")} nowhere.`,
        printableUrl(l.url),
      );
    for (const i of a.brokenImages.slice(0, 1))
      add(
        "broken-images",
        3,
        `${plural(bi, "image does", "images do")} not load.`,
        printableUrl(i.url),
      );
  }
  if (http?.sitemapUrls) {
    const sb = arr(http.sitemapUrls.broken);
    const n = sb.length;
    brokenThings.push({
      label: "Addresses your sitemap lists",
      text:
        n === 0
          ? noneMissing(http.sitemapUrls.checked)
          : `${n} of the ${http.sitemapUrls.checked} we tested came back missing`,
      ok: n === 0,
    });
    if (n)
      add(
        "sitemap-broken",
        2,
        `${plural(n, "address", "addresses")} in your sitemap came back missing.`,
        printableUrl(sb[0]!.url),
      );
  }
  if (http?.externalLinks) {
    const eb = arr(http.externalLinks.broken);
    const n = eb.length;
    brokenThings.push({
      label: "Links to other sites",
      text:
        n === 0
          ? noneMissing(http.externalLinks.checked)
          : `${n} of the ${http.externalLinks.checked} we tested came back missing`,
      ok: n === 0,
    });
    if (n)
      add(
        "external-broken",
        2,
        `${plural(n, "link", "links")} to other sites came back missing.`,
        printableUrl(eb[0]!.url),
      );
  }
  const withVitals = pages.filter((p) => p.vitals);
  // One file that fails on every page is one file (a shared theme asset).
  const failedAll = withVitals.flatMap((p) =>
    (p.vitals!.failedRequests ?? [])
      .filter((r) => r.firstParty)
      .map((r) => ({ ...r, page: p.url })),
  );
  const failed = failedAll.filter((r, i) => failedAll.findIndex((x) => x.url === r.url) === i);
  if (withVitals.length) {
    brokenThings.push({
      label: "Files your pages ask for",
      text:
        failed.length === 0
          ? "every file your pages asked for came back"
          : `${plural(failed.length, "file", "files")} your own pages asked for did not come back`,
      ok: failed.length === 0,
    });
    if (failed.length)
      add(
        "failed-requests",
        3,
        `${plural(failed.length, "file", "files")} your own pages ask for did not come back.`,
        printableUrl(failed[0]!.url),
      );
  }
  if (current) {
    const throwing = withVitals.filter((p) => (p.vitals!.scriptErrors ?? []).length > 0);
    brokenThings.push({
      label: "Scripts",
      text:
        throwing.length === 0
          ? `no script stopped with an error on ${withVitals.length === 1 ? "the one page" : `the ${withVitals.length} pages`} we opened`
          : `a script stopped with an error on ${plural(throwing.length, "page", "pages")}`,
      ok: throwing.length === 0,
    });
    if (throwing.length)
      add(
        "script-errors",
        3,
        `A script stopped with an error on ${plural(throwing.length, "page", "pages")}, so whatever it ran stops working there.`,
        printableUrl(throwing[0]!.url),
      );
  } else if (withVitals.length) {
    brokenThings.push({
      label: "Scripts",
      text: "not checked: this scan ran before we separated real script errors from messages a script prints, so it needs a fresh scan",
      ok: null,
    });
  }
  const placeholder = pages
    .flatMap((p) =>
      (p.rendered?.anchors ?? p.raw?.anchors ?? []).map((x) => ({ page: p.url, href: x.href })),
    )
    .find((x) => isPlaceholderUrl(x.href));
  const leakage = base.siteChecks?.find((c) => c.key === "template-leakage");
  // Re-derived from the anchors. A stored fail that no anchor confirms may
  // have come from a link or a script template before the check was fixed,
  // so it is not repeated as a finding from an old crawl.
  if (placeholder) {
    brokenThings.push({ label: "Template code", text: "shows in a link", ok: false });
    add(
      "template-leakage",
      3,
      "A link on your site points to an address with unfilled template code in it, so a visitor who follows it lands on a missing page.",
      printableUrl(placeholder.page),
    );
  } else if (leakage?.status === "fail" && current) {
    brokenThings.push({ label: "Template code", text: "shows on a page", ok: false });
    add(
      "template-leakage",
      3,
      "Unfilled template code shows as text on a page.",
      evidenceAddress(leakage.evidence),
    );
  } else if (leakage?.status === "fail") {
    brokenThings.push({
      label: "Template code",
      text: "not checked: the stored result predates a fix to this check, so it needs a fresh scan",
      ok: null,
    });
  } else if (leakage?.status === "pass") {
    brokenThings.push({ label: "Template code", text: "none showing", ok: true });
  }

  // ── Weight and images ──
  const weightRows: Row[] = [
    {
      label: "Speed",
      text: "no timing measured for this report; what follows is what your pages make a visitor download",
      ok: null,
    },
  ];
  const heaviest = (a?.heaviestImages ?? [])
    .filter((i): i is typeof i & { bytes: number } => typeof i.bytes === "number")
    .slice(0, 3)
    .map((i) => ({ url: printableUrl(i.url), bytes: i.bytes }));
  if (a && a.imageBytesMeasured !== null && a.imagesWithKnownSize > 0) {
    weightRows.push({
      label: "Images we could weigh",
      text: `${plural(a.imagesWithKnownSize, "image", "images")}, ${mb(a.imageBytesMeasured)} together`,
      ok: null,
    });
  }
  const top = heaviest[0];
  if (top && top.bytes >= 1_000_000) {
    add(
      "heavy-image",
      2,
      `One image weighs ${mb(top.bytes)} as we downloaded it, which is heavy for a single picture.`,
      top.url,
    );
  }

  // ── On a phone ──
  const phone: Row[] = [];
  if (base.viewportOk !== null)
    phone.push({
      label: "Sized for phones",
      text: base.viewportOk ? "every page declares it" : "not every page declares it",
      ok: base.viewportOk,
    });
  // Overflow is measured while the page settles, so content that slides in
  // on load can overflow for a moment. Like the scripts and the scan, it is
  // printed only from a run whose browser asked for reduced motion.
  const overflowing = withVitals.filter((p) => (p.vitals!.overflowAt375 ?? 0) > OVERFLOW_TOLERANCE);
  if (withVitals.length) {
    phone.push({
      label: "Sideways scrolling on a phone",
      text: !current
        ? "not checked: this scan ran before we let content that animates in settle first, so it needs a fresh scan"
        : overflowing.length === 0
          ? "none on the pages we opened"
          : `${plural(overflowing.length, "page scrolls", "pages scroll")} sideways on a phone`,
      ok: current ? overflowing.length === 0 : null,
    });
    if (current && overflowing.length)
      add(
        "overflow",
        overflowing.length > 1 ? 3 : 2,
        `${plural(overflowing.length, "page scrolls", "pages scroll")} sideways on a phone screen.`,
        printableUrl(overflowing[0]!.url),
      );
    const tiny = withVitals.reduce((n, p) => n + (p.vitals!.tinyText?.count ?? 0), 0);
    phone.push({
      label: "Text under 12 pixels",
      text: tiny === 0 ? "none" : plural(tiny, "passage", "passages"),
      ok: tiny === 0,
    });
    if (tiny >= 10)
      add("tiny-text", 1, `${tiny} passages of text render under 12 pixels on your pages.`);
  }

  // ── Is it safe ──
  const safe: Row[] = [];
  if (b?.insecureEntry.measured)
    safe.push({
      label: "https",
      text: b.insecureEntry.ok
        ? "every visit ends up on https"
        : entryHttps
          ? "the address moves to https"
          : "plain http is still served",
      ok: b.insecureEntry.ok || entryHttps,
    });
  const has = (h: string) => headers[h] !== undefined;
  if (Object.keys(headers).length) {
    const hsts = has("strict-transport-security");
    safe.push({
      label: "Telling browsers to always use https",
      text: hsts ? "your server says so" : "your server does not say so",
      ok: hsts,
    });
    if (!hsts)
      add(
        "hsts",
        2,
        "Your server does not tell browsers to use https every time, so a visitor who types your address can start over plain http on any visit.",
      );
    const framing = has("x-frame-options") || restrictsFraming(headers["content-security-policy"]);
    safe.push({
      label: "Protection against framing",
      text: framing ? "set" : "not set",
      ok: framing,
    });
    if (!framing)
      add(
        "framing",
        1,
        /frame-ancestors/i.test(headers["content-security-policy"] ?? "")
          ? "Your content policy sets frame-ancestors, but to a value that allows any site to show yours inside a frame."
          : "Your server does not send X-Frame-Options or a frame-ancestors policy, the standard protection against another site showing yours inside a frame.",
      );
    // A policy with no script rule says nothing about where scripts come from.
    const csp = /(?:^|[;,])\s*(?:script-src|default-src)\s/i.test(
      `${headers["content-security-policy"] ?? ""} `,
    );
    safe.push({ label: "A content policy for scripts", text: csp ? "set" : "not set", ok: csp });
    if (!csp)
      add(
        "csp",
        1,
        "There is no content policy listing where your pages may load scripts from. Most small sites have none; it is a second line of defence, not a fault.",
      );
    const nosniff = has("x-content-type-options");
    safe.push({
      label: "File types declared, not guessed",
      text: nosniff ? "set" : "not set",
      ok: nosniff,
    });
    if (!nosniff)
      add(
        "nosniff",
        1,
        "Your server does not tell browsers to trust the file types it declares, which is the standard setting.",
      );
    safe.push({
      label: "Software version in headers",
      text: versioned.length ? "announced" : "not announced",
      ok: versioned.length === 0,
    });
  }
  if (b?.mixedContent.measured) {
    const n = b.mixedContent.imageUrls.length;
    safe.push({
      label: "Images loaded over plain http",
      text: n === 0 ? "none" : plural(n, "image", "images"),
      ok: n === 0,
    });
    if (n)
      add(
        "mixed-content",
        2,
        `${plural(n, "image is", "images are")} loaded over plain http on a secure page, so browsers show a warning or drop it.`,
        printableUrl(b.mixedContent.imageUrls[0]!),
      );
  }

  // ── Is your email safe ──
  const email: Row[] = [];
  const checks = stageData<{ consistency?: { emails?: { normalized?: string }[] } }>(raw, "checks");
  const publishesOwnAddress = arr(checks?.consistency?.emails).some(
    (e) =>
      typeof e.normalized === "string" &&
      !!dns?.domain &&
      e.normalized.toLowerCase().endsWith(`@${dns.domain.toLowerCase()}`),
  );
  if (dns?.measured) {
    const unproven = (v: string | null | undefined) =>
      v === undefined || (v === null && !dnsProven);
    if (unproven(dns.spf)) {
      email.push({
        label: "SPF, the list of servers allowed to send as you",
        text: "we could not confirm this; check at your DNS host",
        ok: null,
      });
    } else {
      const spf = dns.spf ?? null;
      // A bare `all` has the default qualifier, which is `+`.
      const open = spf !== null && /(?:^|\s)\+?all\b/i.test(spf);
      email.push({
        label: "SPF, the list of servers allowed to send as you",
        text:
          spf === null
            ? "not published"
            : open
              ? "published, but it allows any server"
              : "published",
        ok: spf !== null && !open,
      });
      if (spf === null)
        add(
          "spf",
          2,
          "Your domain publishes no SPF record, so receiving mail servers have less to go on and your own mail is more likely to be filed as spam.",
        );
      else if (open)
        add(
          "spf",
          2,
          'Your SPF record ends in an "all" rule that allows any server to send as your domain.',
        );
    }
    if (unproven(dns.dmarc)) {
      email.push({
        label: "DMARC, what receivers do with forged mail",
        text: "we could not confirm this; check at your DNS host",
        ok: null,
      });
    } else {
      const state = dmarcState(dns.dmarc ?? null);
      email.push({
        label: "DMARC, what receivers do with forged mail",
        text:
          state === "missing"
            ? "not published"
            : state === "monitoring"
              ? dmarcPolicy(dns.dmarc!) === "none"
                ? "published in watch-only mode (p=none)"
                : "published, but with no policy we can read, so receivers apply none"
              : "set to turn forged mail away",
        ok: state === "enforcing",
      });
      if (state === "missing")
        add(
          "dmarc",
          2,
          "Your domain publishes no DMARC policy, so a receiving mail server has no instruction from you about mail that fails its checks.",
        );
      if (state === "monitoring") {
        const reports = /(?:^|;)\s*rua\s*=/i.test(dns.dmarc!);
        const tail = reports
          ? "a message forged in your name is reported to you but still delivered"
          : "a message forged in your name is still delivered, and no report address is set";
        add(
          "dmarc",
          2,
          dmarcPolicy(dns.dmarc!) === "none"
            ? `Your email domain publishes DMARC in watch-only mode, so ${tail}.`
            : `Your DMARC record has no policy a receiver can read, so ${tail}.`,
        );
      }
    }
    const mx = Array.isArray(dns.mx) ? dns.mx : null;
    if (mx && (mx.length > 0 || dnsProven)) {
      email.push({
        label: "A mail server for your domain",
        text: mx.length ? "listed" : "none listed",
        ok: mx.length > 0,
      });
      if (!mx.length)
        add(
          "mx",
          // A visitor meets this only if the site publishes an address at
          // its own domain (read from the checks stage, as the pipeline's
          // DNS lookup is; `contactMx` covers only OTHER domains).
          publishesOwnAddress ? 3 : 2,
          "Your domain lists no mail server, so email sent to an address at it may not be delivered.",
        );
    }
  }
  const domain: Row | null =
    dns?.measured && dns.expiresAt
      ? {
          label: "Registered through",
          // Read against the render date: a stored date that has since
          // passed must not read as time still in hand.
          text:
            Date.parse(dns.expiresAt) < today.getTime()
              ? `${dayMonthYear(dns.expiresAt)}, as the registry listed it when we checked. That date has now passed, so confirm the renewal at your registrar.`
              : `${dayMonthYear(dns.expiresAt)}. Whether it renews automatically is not public; confirm it at your registrar.`,
          ok: null,
        }
      : null;

  // ── Can everyone use it ──
  let access: Access = { state: "not-measured" };
  const ax = base.accessibility;
  if (ax?.measured) {
    if (!current) access = { state: "needs-fresh-scan" };
    else {
      const order = ["critical", "serious", "moderate", "minor", "unknown"];
      access = {
        state: "measured",
        pagesExamined: ax.pagesExamined,
        rulesFailed: Math.max(ax.violationsTotal ?? 0, ax.violations.length),
        rulesListed: ax.violations.length,
        byImpact: order
          .map((impact) => ({
            impact,
            rules: ax.violations
              .filter((v) => (v.impact ?? "unknown") === impact)
              .map((v) => ({ id: v.id, help: v.help, nodes: v.nodes, pages: arr(v.pages).length })),
          }))
          .filter((g) => g.rules.length > 0),
      };
      // Serious counts as well as critical: the lede names both as failures
      // that can stop some visitors, so both must reach what to fix first.
      const failing = ax.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      ).length;
      if (failing)
        add(
          "a11y-critical",
          2,
          `An automated scan found ${plural(failing, "kind", "kinds")} of serious or critical accessibility failure on your pages.`,
        );
    }
  }

  // ── noindex, re-derived from each page's robots meta ──
  // Only pages that loaded: a robots meta on an error page says nothing.
  const hidden = pages.filter(
    (p) =>
      (typeof p.status !== "number" || (p.status >= 200 && p.status < 300)) &&
      /\bnoindex\b/i.test((p.rendered ?? p.raw)?.metas?.["robots"] ?? "") &&
      !isDeliberatelyHidden(p.url),
  );
  if (hidden.length)
    add(
      "noindex",
      3,
      hidden.length === 1
        ? "A page asks search engines to leave it out of their results."
        : `${hidden.length} pages ask search engines to leave them out of their results.`,
      printableUrl(hidden[0]!.url),
    );

  // ── What the operator hid ──
  // A hidden site check takes the finding read from the same fields with it.
  const hiddenFinding = (f: Finding) => hiddenChecks.has(FINDING_CHECK[f.id] ?? "");
  for (let i = findings.length - 1; i >= 0; i--)
    if (hiddenFinding(findings[i]!)) findings.splice(i, 1);
  const visibleRows = (rows: Row[]) =>
    rows.filter((r) => !hiddenChecks.has(ROW_CHECK[r.label] ?? ""));

  // ── Order ──
  // Within a weight, a fixed order: what a visitor meets first, then what a
  // forged email or an unsupported server costs, then the rest. Insertion
  // order would rank by where a section happens to sit in this function.
  const rank = (f: Finding) => {
    const i = PRIORITY.indexOf(f.id);
    return i === -1 ? PRIORITY.length : i;
  };
  const byWeight = (x: Finding, y: Finding) => y.weight - x.weight || rank(x) - rank(y);
  findings.sort(byWeight);
  const broken = findings.filter((f) => f.weight === 3);
  const attention = findings.filter((f) => f.weight === 2);
  const fixFirst = [...broken, ...attention].slice(0, 5);
  if (fixFirst.length < 3)
    fixFirst.push(...findings.filter((f) => f.weight === 1).slice(0, 3 - fixFirst.length));
  const shown = new Set([...broken.slice(0, 3), ...attention.slice(0, 3), ...fixFirst]);
  const more = [...broken, ...attention].filter((f) => !shown.has(f));
  const incomplete = !crawl || pages.length === 0 || !base.assets || !base.basics;

  const hostOf = (u: string) => {
    try {
      return new URL(u).hostname.replace(/^www\./, "");
    } catch {
      return u;
    }
  };

  const accessFails =
    access.state === "measured" &&
    access.byImpact.some(
      (g) => (g.impact === "critical" || g.impact === "serious") && g.rules.length > 0,
    );
  const shownRows = {
    address: visibleRows(address),
    brokenThings: visibleRows(brokenThings),
    phone: visibleRows(phone),
    safe: visibleRows(safe),
    email: visibleRows(email),
    domain: domain && visibleRows([domain]).length ? domain : null,
  };

  return {
    host: hostOf(base.url),
    generatedAt: base.generatedAt,
    runningOn,
    nothingBroken: broken.length === 0 && !incomplete,
    anyRowBroken:
      [
        ...shownRows.address,
        ...shownRows.brokenThings,
        ...[...shownRows.phone, ...shownRows.safe].filter((r) => VISITOR_ROWS.has(r.label)),
      ].some((r) => r.ok === false) || accessFails,
    accessFails,
    incomplete,
    brokenTotal: broken.length,
    attentionTotal: attention.length,
    broken: broken.slice(0, 3),
    attention: attention.slice(0, 3),
    fixFirst,
    more,
    housekeeping: findings.filter((f) => f.weight === 1 && !fixFirst.includes(f)),
    sections: {
      running: {
        items: [...layers].map(([layer, names]) => ({ layer, names })),
        releaseLines: hiddenChecks.has("header-version-leak") ? [] : releaseLines,
      },
      ...shownRows,
      weight: { rows: weightRows, heaviest },
      access,
      read: whatWeRead(base, pages),
    },
  };
}

/**
 * The stored site check each finding and row is read alongside (maintenance's
 * `site-checks.ts` keys). An operator who hides that check on the main report
 * (W1) hides these too. Each value is a key from that file, checked by hand
 * against it on 11-23 (the security headers are `header-<name>`; `dns-mx` is
 * the site's own domain, `dns-contact-mx` other domains). A finding with no
 * check of its own (the not-found page, the www variant, broken links and
 * images, mixed content, accessibility) has nothing an operator can hide, and
 * the main report keeps those too. Two near misses are left unmapped on
 * purpose: `dead-links` counts only javascript:void anchors, not the crawl's
 * broken links, and `https-upgrade` counts redirect hops on http, not where
 * http lands (`basics.insecureEntry`, read here and on the main report). The heavy-image
 * finding is unmapped on purpose: it weighs bytes, and `oversized-images`
 * measures pixels against display size, a different claim.
 */
/** Rows outside the address and breakage sections that a visitor meets. */
const VISITOR_ROWS = new Set(["Sideways scrolling on a phone", "Images loaded over plain http"]);

const FINDING_CHECK: Record<string, string> = {
  "redirect-chains": "redirect-chains",
  "sitemap-broken": "sitemap-urls-live",
  "external-broken": "external-links-live",
  "failed-requests": "failed-requests",
  "script-errors": "console-errors",
  "template-leakage": "template-leakage",
  favicon: "favicon-served",
  overflow: "mobile-overflow",
  "tiny-text": "tiny-text",
  hsts: "header-strict-transport-security",
  framing: "header-x-frame-options",
  csp: "header-content-security-policy",
  nosniff: "header-x-content-type-options",
  // The release line is read from the same server header the version check
  // reads: a hide made because that header is a proxy's takes both.
  "version-announced": "header-version-leak",
  "release-server": "header-version-leak",
  "release-x-powered-by": "header-version-leak",
  spf: "dns-spf",
  dmarc: "dns-dmarc",
  mx: "dns-mx",
  noindex: "meta-noindex",
};
const ROW_CHECK: Record<string, string> = {
  Redirects: "redirect-chains",
  "The browser-tab icon": "favicon-served",
  "Addresses your sitemap lists": "sitemap-urls-live",
  "Links to other sites": "external-links-live",
  "Files your pages ask for": "failed-requests",
  Scripts: "console-errors",
  "Template code": "template-leakage",
  "Sideways scrolling on a phone": "mobile-overflow",
  "Text under 12 pixels": "tiny-text",
  "Telling browsers to always use https": "header-strict-transport-security",
  "Protection against framing": "header-x-frame-options",
  "A content policy for scripts": "header-content-security-policy",
  "File types declared, not guessed": "header-x-content-type-options",
  "Software version in headers": "header-version-leak",
  "SPF, the list of servers allowed to send as you": "dns-spf",
  "DMARC, what receivers do with forged mail": "dns-dmarc",
  "A mail server for your domain": "dns-mx",
  "Registered through": "domain-expiry",
};

/** The pages that came back, counted the way the main report counts them. */
function whatWeRead(base: ReportView, pages: RawPage[]): TechnicalView["sections"]["read"] {
  const read = pages.filter((p) => p.raw || p.rendered).map((p) => printableUrl(p.url));
  const phrase = readNothing(base) ? null : phraseOf(crawlDenominator(base));
  return {
    sentence: phrase ? `We read ${phrase}.` : "We could not read any of your pages.",
    pages: phrase ? read : [],
  };
}

const PRIORITY = [
  "mx",
  "insecure-entry",
  "host-variant",
  "broken-links",
  "broken-images",
  "failed-requests",
  "script-errors",
  "template-leakage",
  "noindex",
  "overflow",
  "release-server",
  "release-x-powered-by",
  "heavy-image",
  "dmarc",
  "spf",
  "mixed-content",
  "a11y-critical",
  "not-found",
  "sitemap-broken",
  "external-broken",
  "hsts",
];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
function monthYear(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
function dayMonthYear(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
