import type { AuditReport } from "../fetch";

/**
 * An invented current-shape audit row for the Technical report.
 *
 * Fictional business, reserved TLD. Shaped like the stored rows the 11-23
 * review read (every stage a current run writes), and seeded with the cases
 * the review found mis-reported: DMARC at p=none, a server header naming an
 * old release line, HubSpot's cookie banner on a WordPress site, a privacy
 * page hidden on purpose, a link carrying `{{url}}`, a styled console.error
 * that is not a script error, and one very heavy photo.
 *
 * The paid stages (`analyze`, `probes`, `accuracy`, `goalFit`) are present on
 * purpose: the Technical view must never read them, and a test deletes them
 * and requires the identical page.
 */
const HOME = "https://harbordentalandorthodonticsofsouthbay.example/";
const page = (
  path: string,
  extra: Record<string, unknown> = {},
  vitals: Record<string, unknown> = {},
) => ({
  url: `${HOME.replace(/\/$/, "")}${path}`,
  status: 200,
  error: null,
  rendered: { metas: {}, anchors: [{ href: "/services" }], ...extra },
  axe: null,
  vitals: {
    consoleErrors: [],
    scriptErrors: [],
    failedRequests: [],
    overflowAt375: 0,
    tinyText: { count: 0, sample: null },
    oversizedImages: [],
    ...vitals,
  },
});

export const TECHNICAL_REPORT: AuditReport = {
  url: HOME,
  businessName: "Harbor Dental",
  generatedAt: "2026-11-20T18:00:00.000Z",
  scores: { findability: 90, readability: 70, answers: 60, aiVisibility: 20 },
  crawl: {
    ok: true,
    data: {
      origin: "https://harbordentalandorthodonticsofsouthbay.example",
      homeHeaders: {
        server: "Apache/2.4.18 (Ubuntu)",
        "content-encoding": "gzip",
        "permissions-policy": "camera=()",
      },
      sitemap: { present: true, urlCount: 41, truncated: false },
      pages: [
        page("/", {}, { consoleErrors: ["%c%d font-size:0;color:transparent NaN"] }),
        page("/services", {
          anchors: [{ href: "https://harbordentalandorthodonticsofsouthbay.example/{{url}}" }],
        }),
        page("/about", {}, { overflowAt375: 4 }),
        page("/privacy", { metas: { robots: "noindex, follow" } }),
        page("/contact"),
      ],
    },
  },
  checks: {
    ok: true,
    data: {
      crawlerAccessMeasured: true,
      crawlerAccess: [],
      viewportOk: true,
      sitemapMeasured: true,
      sitemapPresent: true,
      securityHeaders: { present: ["permissions-policy"], missing: [] },
    },
  },
  assets: {
    ok: true,
    data: {
      brokenLinks: [],
      brokenImages: [],
      linksUnverified: { count: 0, groups: [] },
      imagesUnverified: { count: 0, groups: [] },
      heaviestImages: [
        {
          url: "https://harbordentalandorthodonticsofsouthbay.example/wp-content/uploads/2019/04/team-photo.jpg",
          status: 200,
          bytes: 5_192_308,
          error: null,
          referencedBy: ["https://harbordentalandorthodonticsofsouthbay.example/about"],
        },
        {
          url: "https://harbordentalandorthodonticsofsouthbay.example/wp-content/uploads/2024/01/hero.png",
          status: 200,
          bytes: 640_000,
          error: null,
          referencedBy: [HOME],
        },
      ],
      imageBytesMeasured: 9_400_000,
      imagesWithKnownSize: 28,
      linksFound: 70,
      linksChecked: 60,
      imagesFound: 44,
      imagesChecked: 40,
    },
  },
  basics: {
    ok: true,
    data: {
      insecureEntry: {
        measured: true,
        url: "http://harbordentalandorthodonticsofsouthbay.example/",
        ok: true,
        landedOn: HOME,
        error: null,
      },
      hostVariant: {
        measured: true,
        url: "https://www.harbordentalandorthodonticsofsouthbay.example/",
        host: "www.harbordentalandorthodonticsofsouthbay.example",
        ok: true,
        landedOn: HOME,
        error: null,
      },
      notFound: {
        measured: true,
        url: "https://harbordentalandorthodonticsofsouthbay.example/no-such-page",
        ok: true,
        landedOn: "https://harbordentalandorthodonticsofsouthbay.example/no-such-page",
        error: null,
        status: 404,
        linksBackToSite: true,
      },
      mixedContent: { measured: true, imageUrls: [], imagesSeen: 44 },
      altText: { imagesTotal: 44, imagesWithAlt: 40, pagesExamined: 5 },
      duplicateTitles: [],
    },
  },
  stack: {
    ok: true,
    data: {
      measured: true,
      pagesExamined: 5,
      headersExamined: true,
      items: [
        {
          layer: "cms",
          name: "HubSpot CMS",
          evidence: "https://js.hs-banner.com/v2/1234567/banner.js",
        },
        { layer: "cms", name: "WordPress", evidence: '<meta name="generator"> WordPress 6.4.2' },
        {
          layer: "plugin",
          name: "contact-form-7",
          evidence:
            "https://harbordentalandorthodonticsofsouthbay.example/wp-content/plugins/contact-form-7/includes/js/index.js?ver=5.9.3",
        },
        { layer: "hosting", name: "Apache", evidence: "server: Apache/2.4.18 (Ubuntu)" },
      ],
    },
  },
  siteChecks: {
    ok: true,
    data: [
      {
        key: "template-leakage",
        label: "Template code showing as text",
        status: "pass",
        evidence: "none across the 5 pages we read",
        why: "",
        scope: "quick",
      },
      {
        key: "header-version-leak",
        label: "Not advertising your software versions",
        status: "fail",
        evidence: "server: Apache/2.4.18 (Ubuntu)",
        why: "",
        scope: "quick",
      },
    ],
  },
  accessibility: {
    ok: true,
    data: {
      measured: true,
      pagesExamined: 5,
      rulesPassed: 40,
      rulesIncomplete: 2,
      incompleteIds: ["color-contrast"],
      rulesInapplicable: 30,
      violations: [
        {
          id: "image-alt",
          impact: "critical",
          help: "Images must have alternative text",
          helpUrl: "https://dequeuniversity.com/rules/axe/4.14/image-alt",
          nodes: 4,
          sample: '<img src="/wp-content/uploads/2019/04/team-photo.jpg">',
          pages: [HOME],
        },
        {
          id: "link-name",
          impact: "serious",
          help: "Links must have discernible text",
          helpUrl: "https://dequeuniversity.com/rules/axe/4.14/link-name",
          nodes: 12,
          sample: '<a href="/"><i class="icon"></i></a>',
          pages: [HOME, `${HOME}services`],
        },
      ],
      violationsTotal: 2,
    },
  },
  dns: {
    ok: true,
    data: {
      measured: true,
      domain: "harbordentalandorthodonticsofsouthbay.example",
      spf: "v=spf1 include:_spf.mail.example -all",
      dmarc: "v=DMARC1; p=none; rua=mailto:dmarc@harbordentalandorthodonticsofsouthbay.example",
      mx: ["mx1.mail.example"],
      contactMx: null,
      expiresAt: "2027-04-27T22:47:47Z",
    },
  },
  http: {
    ok: true,
    data: {
      measured: true,
      httpUpgrade: { hops: 1, https: true },
      favicon: { url: `${HOME}favicon.png`, declared: true, verdict: "ok" },
      trailingSlash: { path: "/services", settled: true, detail: "" },
      caseAlias: { path: "/Services/", duplicate: false, detail: "" },
      indexAlias: null,
      redirectChains: { checked: 10, chained: [] },
      sitemapUrls: { checked: 12, total: 41, broken: [] },
      externalLinks: { checked: 15, total: 20, broken: [] },
    },
  },
  lighthouse: {
    ok: true,
    data: {
      performance: 71,
      accessibility: 86,
      bestPractices: 78,
      seo: 92,
      summary: "",
      status: "pass",
    },
  },
  analyze: {
    ok: true,
    data: {
      business: "A model wrote this sentence.",
      businessName: "Harbor Dental",
      fixes: [],
      categoryQueries: [],
    },
  },
  probes: { ok: true, data: { answers: [] } },
  // The stored shape (assertions, not claims): W1's loader runs the main
  // report's narrative over every route's row, and a shape no row has would
  // crash it before the Technical view is built.
  accuracy: {
    ok: true,
    data: {
      assertions: [
        {
          claim: "An assistant said this about the business.",
          verdict: "contradicted",
          engineQuote: "An assistant said this about the business.",
          siteQuote: "The site says otherwise.",
          unverifiedReason: null,
          nearbyMention: null,
          sourceDomains: [],
          query: "who is Harbor Dental",
          engine: "claude",
        },
      ],
      sources: [],
      siteFullyRead: false,
      pagesRead: 4,
      pagesTotal: 12,
      answersRead: 1,
    },
  },
  goalFit: { ok: true, data: { goal: "book", requirements: [] } },
};
