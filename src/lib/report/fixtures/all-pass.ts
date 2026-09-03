import type { AuditReport } from "../fetch";

/**
 * A complete stored result in which every stage ran and nothing failed.
 *
 * This is the "check, check, check" page: the shape the report takes when a
 * site is doing everything we can measure. It exists because a report that
 * can only ever render findings has no way to say "this is right", and we
 * want our own site to reach this page — it is not there yet, which is why it
 * is a test case rather than the fixture.
 *
 * The business is fictional and the URL is on a reserved TLD, so nothing here
 * can be mistaken for a client. Rendered at /dev/audit-report, and asserted
 * all-clear end to end in narrative.test.ts.
 */
const URL = "https://example-studio.test/";
const PAGES = ["/", "/work", "/about", "/services", "/contact"].map(
  (p) => `${URL.slice(0, -1)}${p}`,
);

const question = (question: string, evidence: string) => ({
  question,
  answered: "yes" as const,
  quotable: true,
  page: `${URL}services`,
  evidence,
});

const requirement = (
  key: string,
  label: string,
  evidence: string,
  why: string,
  scope: "quick" | "content" | "structural",
) => ({
  key,
  label,
  status: "met" as const,
  evidence,
  why,
  scope,
});

const assertion = (claim: string, engineQuote: string, siteQuote: string) => ({
  claim,
  verdict: "confirmed" as const,
  engineQuote,
  siteQuote,
  unverifiedReason: null,
  nearbyMention: null,
  sourceDomains: ["example-studio.test", "linkedin.com"],
  query: "who is Example Studio",
  engine: "claude",
});

export const ALL_PASS_REPORT: AuditReport = {
  url: URL,
  businessName: "Example Studio",
  generatedAt: "2026-09-03T09:00:00.000Z",
  // What computeScores (reddoor-maintenance src/prospect/checks.ts) gives a
  // perfect site: findability and readability are deterministic and reach 100
  // (the scorer's own test pins this); answers is ten of ten; visibility is a
  // measurement, not a score, and one of two searches named the site.
  scores: { findability: 100, readability: 100, answers: 100, aiVisibility: 50 },
  crawl: {
    ok: true,
    data: {
      agentAccess: [
        "GPTBot",
        "ClaudeBot",
        "PerplexityBot",
        "Google-Extended",
        "Bytespider",
        "CCBot",
        "anthropic-ai",
        "Applebot-Extended",
      ].map((agent) => ({ agent })),
    },
  },
  checks: {
    ok: true,
    data: {
      crawlerAccessMeasured: true,
      crawlerAccess: { blockedAi: [], blockedClassical: [] },
      viewportOk: true,
      journey: {
        affordances: [
          { kind: "form", page: `${URL}contact`, detail: "enquiry form with 6 fields" },
          { kind: "tel", page: URL, detail: "tel:+15125550142" },
        ],
        pages: PAGES.map((url) => ({ url, clicksToContact: 0, internalLinks: 12 })),
        deadEnds: [],
        worstClicksToContact: 0,
        pagesExamined: PAGES.length,
      },
      consistency: {
        phones: [
          { normalized: "+15125550142", seenAs: ["(512) 555-0142"], pages: PAGES, linked: true },
        ],
        emails: [
          {
            normalized: "hello@example-studio.test",
            seenAs: ["hello@example-studio.test"],
            pages: PAGES,
            linked: true,
          },
        ],
        copyrightYears: [2026],
        newestCopyrightYear: 2026,
        pagesOffTemplate: [],
        sharedNavLinks: 5,
        pagesExamined: PAGES.length,
      },
    },
  },
  assets: {
    ok: true,
    data: {
      brokenLinks: [],
      brokenImages: [],
      heaviestImages: [],
      imageBytesMeasured: 2_400_000,
      imagesWithKnownSize: 18,
      linksFound: 64,
      linksChecked: 64,
      imagesFound: 18,
      imagesChecked: 18,
    },
  },
  basics: {
    ok: true,
    data: {
      insecureEntry: {
        measured: true,
        url: "http://example-studio.test/",
        ok: true,
        landedOn: URL,
        error: null,
      },
      hostVariant: {
        measured: true,
        url: "https://www.example-studio.test/",
        host: "www.example-studio.test",
        ok: true,
        landedOn: URL,
        error: null,
      },
      notFound: {
        measured: true,
        url: `${URL}this-page-cannot-exist`,
        ok: true,
        landedOn: null,
        error: null,
        status: 404,
        linksBackToSite: true,
      },
      mixedContent: { measured: true, imageUrls: [], imagesSeen: 18 },
      altText: { imagesTotal: 18, imagesWithAlt: 18, pagesExamined: PAGES.length },
      duplicateTitles: [],
    },
  },
  goalFit: {
    ok: true,
    data: {
      goal: "enquire",
      source: "operator",
      requirements: [
        requirement(
          "qualifying-form",
          "A form that asks enough to have a real first conversation",
          "enquiry form with 6 fields",
          "A name-and-email box produces enquiries you have to qualify by hand.",
          "content",
        ),
        requirement(
          "route-to-contact",
          "A route to you from wherever they land",
          "every one of 5 pages links to /contact",
          "Search sends people to whichever page answers their question, not to the home page.",
          "quick",
        ),
        requirement(
          "price-signal",
          "Some signal of what it costs",
          "“Identity projects start at $12,000”",
          "Buyers ask this before making contact, and a site that does not answer it sends them to one that does.",
          "content",
        ),
        requirement(
          "what-happens-next",
          "What happens after they get in touch",
          "“We reply within one working day and book a 30-minute call”",
          "The last hesitation before the form is not knowing what the form starts.",
          "content",
        ),
      ],
      met: 4,
      total: 4,
    },
  },
  accuracy: {
    ok: true,
    data: {
      assertions: [
        assertion(
          "Example Studio is based in Austin, Texas.",
          "based in Austin, Texas",
          "Example Studio, Austin, Texas",
        ),
        assertion(
          "Example Studio is a brand identity studio.",
          "a brand identity studio",
          "We are a brand identity studio.",
        ),
        assertion("Example Studio was founded in 2012.", "founded in 2012", "Founded in 2012"),
      ],
      sources: [
        { domain: "example-studio.test", owner: "yours", because: "it is the site under audit" },
        { domain: "linkedin.com", owner: "platform", because: "a listing site" },
      ],
      siteFullyRead: true,
      pagesRead: PAGES.length,
      pagesTotal: PAGES.length,
      answersRead: 2,
      conflation: { detected: false, otherNames: [], engineQuote: null },
    },
  },
  analyze: {
    ok: true,
    data: {
      buyerQuestions: [
        question("What does this cost?", "Identity projects start at $12,000."),
        question(
          "Is this for someone like me?",
          "We work with founders launching a first product.",
        ),
        question(
          "Why should I believe you can do this?",
          "Forty identities since 2012, six of them for companies that went on to raise.",
        ),
        question(
          "Who will I actually be dealing with?",
          "You work directly with Sam and Priya, the two of us.",
        ),
        question("Where are you, and do you cover me?", "Austin, Texas, and remote across the US."),
        question(
          "What happens after I get in touch?",
          "We reply within one working day and book a 30-minute call.",
        ),
        question(
          "How long does a project like mine take?",
          "An identity takes eight to ten weeks.",
        ),
        question(
          "How do you work — what are the stages?",
          "Discovery, two rounds of concepts, then rollout.",
        ),
        question(
          "Is there a minimum size of project you take on?",
          "We do not take on projects under $12,000.",
        ),
        question("What will you need from me?", "About two hours a week from one decision-maker."),
      ],
      fixes: [
        {
          title: "Add a short case study for each of the three service lines",
          why: "The work page shows outcomes but the services page does not link to them, so a reader deciding between the three has to find the proof themselves.",
          impact: "medium",
          effort: "medium",
          tier: "content",
          origin: "recommendation",
        },
        {
          title: "Publish the answers to the ten buyer questions as a single FAQ page",
          why: "Every answer exists, spread over four pages. One page an assistant can quote whole is easier to cite than ten sentences it has to assemble.",
          impact: "medium",
          effort: "low",
          tier: "content",
          origin: "recommendation",
        },
      ],
      narrative: { findability: "", readability: "", answers: "" },
    },
  },
  probes: {
    ok: true,
    data: {
      answers: [
        {
          engine: "claude",
          query: "brand identity studio Austin",
          kind: "category",
          domainCited: true,
          brandMentioned: true,
          countedAsVisible: true,
          citedDomains: ["example-studio.test", "clutch.co", "designrush.com"],
          snippet: "Example Studio is a well-regarded identity studio in Austin…",
          truncated: true,
          askedAt: "2026-09-03T08:50:00.000Z",
        },
        {
          engine: "claude",
          query: "branding agency for a startup launching its first product",
          kind: "category",
          domainCited: false,
          brandMentioned: false,
          countedAsVisible: false,
          citedDomains: ["clutch.co", "designrush.com", "sortlist.com"],
          snippet: "Several studios specialise in launch identities…",
          truncated: true,
          askedAt: "2026-09-03T08:51:00.000Z",
        },
        {
          engine: "claude",
          query: "who is Example Studio",
          kind: "branded",
          domainCited: true,
          brandMentioned: true,
          countedAsVisible: true,
          citedDomains: ["example-studio.test", "linkedin.com"],
          snippet:
            "Example Studio is a brand identity studio based in Austin, Texas, founded in 2012…",
          truncated: true,
          askedAt: "2026-09-03T08:52:00.000Z",
        },
      ],
      visibilityScore: 50,
      brandedRecognized: true,
      competitorsSeen: [
        { domain: "clutch.co", count: 2 },
        { domain: "designrush.com", count: 2 },
        { domain: "sortlist.com", count: 1 },
      ],
      categoryProbes: { attempted: 2, answered: 2 },
      answerSpace: {
        answersWithCitations: 2,
        queriesAsked: 2,
        citationsTotal: 6,
        distinctDomains: 4,
        topSources: [
          { domain: "clutch.co", count: 2, share: 0.33 },
          { domain: "designrush.com", count: 2, share: 0.33 },
          { domain: "example-studio.test", count: 1, share: 0.17 },
          { domain: "sortlist.com", count: 1, share: 0.17 },
        ],
        domainsToHalf: 2,
        medianWidthPerAnswer: 3,
        ownDomainRank: 3,
        ownDomainCount: 1,
        topRival: { domain: "clutch.co", count: 2, share: 0.33 },
      },
    },
  },
};
