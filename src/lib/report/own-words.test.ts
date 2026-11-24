import { describe, it, expect } from "vitest";
import { ssr, renderText } from "./ssr-test-harness";
import { ALL_PASS_REPORT } from "./fixtures/all-pass";
import type { AuditReport, OverrideMap } from "./fetch";
import {
  brandedExcerpt,
  heldBack,
  otherNamesOf,
  statements,
  toReportView,
  withheldTopic,
  type Assertion,
  type HeldBack,
} from "./model";
import { displayQuote, headlineFinding, passes } from "./narrative";
import { changeList, editableTargets, hideTargets, showStatement } from "./editable";

/**
 * W2: the accuracy section says what the assistant said, about the right
 * company. Each fixture is the shape of a stored case, renamed.
 *
 * Rendered on both surfaces that print the section: the screen report's
 * source-check section and the print sheet.
 */

type Data = Record<string, unknown> & { assertions: Assertion[] };
const allPass = ALL_PASS_REPORT as unknown as {
  accuracy: { data: Data };
  crawl: { data: Record<string, unknown> };
  probes: { data: Record<string, unknown> & { answers: Record<string, unknown>[] } };
};

const row = (over: Partial<Assertion>): Assertion => ({
  claim: "",
  verdict: "absent",
  engineQuote: "",
  siteQuote: null,
  unverifiedReason: null,
  nearbyMention: null,
  sourceDomains: [],
  query: "who is Example Studio",
  engine: "claude",
  ...over,
});

/** The all-pass report with these assertions, its site read whole by its own
 *  sitemap so an `absent` can stand. Since W3 the rule is the one its sentences
 *  use (`completeOf`): a complete, untruncated sitemap that the crawl's count
 *  of what it knew of (`selection`) reaches, with every page read. */
function reportWith(assertions: Assertion[], over: Partial<Data> = {}): AuditReport {
  const pages = allPass.accuracy.data.pagesRead as number;
  return {
    ...ALL_PASS_REPORT,
    crawl: {
      ok: true,
      data: {
        ...allPass.crawl.data,
        sitemap: { present: true, urlCount: pages, truncated: false },
        selection: { pagesConsidered: pages },
        pages: Array.from({ length: pages }, (_, i) => ({ url: `/p${i}`, raw: { text: "x" } })),
      },
    },
    accuracy: { ok: true, data: { ...allPass.accuracy.data, assertions, ...over } },
  } as AuditReport;
}

const sourceCheck = await ssr<{ view: ReturnType<typeof toReportView> }>(
  "src/lib/report/SourceCheck.svelte",
);
const lede = await ssr<{ view: ReturnType<typeof toReportView> }>(
  "src/lib/report/SourceCheckLede.svelte",
);
const printSheet = await ssr<{ data: { report: AuditReport; overrides: OverrideMap } }>(
  "src/routes/audit/[token]/print/+page.svelte",
);

/** What a reader sees on each surface: markup gone, entities as text. */
const seen = (html: string): string =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&ldquo;|&rdquo;|[“”]/g, '"')
    .replace(/\s+/g, " ");

const surfaces = (report: AuditReport): Array<[string, string]> => [
  ["the source-check section", seen(renderText(sourceCheck, { view: toReportView(report) }))],
  ["the print sheet", seen(renderText(printSheet, { data: { report, overrides: {} } }))],
];

describe("no paraphrase appears for a non-confirmed row", () => {
  const report = reportWith([
    row({
      claim: "PARAPHRASE-ABSENT Example Studio has an office in Denver.",
      engineQuote: "it opened a second office in Denver",
    }),
    row({
      claim: "PARAPHRASE-UNVERIFIED Example Studio works mostly for startups.",
      verdict: "unverified",
      engineQuote: "works mostly with early-stage startups",
    }),
    row({
      claim: "PARAPHRASE-CONTRADICTED Example Studio was founded in 2001.",
      verdict: "contradicted",
      engineQuote: "was established in 2001",
      siteQuote: "Founded in 2012",
    }),
  ]);

  describe.each(surfaces(report))("%s", (_label, text) => {
    it("prints the assistant's own words, in quotation marks", () => {
      expect(text).toContain('"it opened a second office in Denver"');
      expect(text).toContain('"works mostly with early-stage startups"');
      expect(text).toContain('"was established in 2001"');
    });

    it("never prints the paraphrase", () => {
      expect(text).not.toContain("PARAPHRASE");
    });
  });

  it("quotes the assistant in the headline too", () => {
    const h = headlineFinding(toReportView(report));
    expect(h.text).toContain("was established in 2001");
    expect(h.text).not.toContain("PARAPHRASE");
  });
});

describe("the other firm's rating never appears with the client as subject", () => {
  // The stored shape, renamed: the answer offers another firm as the "most
  // likely match" and then describes that firm.
  const report = reportWith([
    row({
      claim: "The business is located in Riverton.",
      engineQuote: "Most likely match: Southgate Outfitters (Riverton)",
      subject: "other",
      otherName: "Southgate Outfitters",
      topic: "other",
    }),
    row({
      claim: "The business holds a 2.1 out of 5 rating.",
      engineQuote: "It holds a 2.1 out of 5 rating",
      subject: "other",
      otherName: "Southgate Outfitters",
      topic: "ratings_reviews",
    }),
    row({
      claim: "Example Studio opened in 2012.",
      engineQuote: "opened its doors in 2012",
      subject: "prospect",
      topic: "other",
    }),
  ]);

  describe.each(surfaces(report))("%s", (_label, text) => {
    it("prints neither of the other firm's statements", () => {
      expect(text).not.toContain("Riverton");
      expect(text).not.toContain("2.1 out of 5");
      expect(text).not.toContain("The business");
    });

    it("says they were left out, and still prints the client's own", () => {
      expect(text).toContain(
        "Two statements the assistant made were about another business, or one it could not tell apart from you, so they are left out.",
      );
      expect(text).toContain('"opened its doors in 2012"');
    });
  });

  it("leaves out a statement the producer could not place", () => {
    const text = seen(
      renderText(sourceCheck, {
        view: toReportView(
          reportWith([
            row({ claim: "x", engineQuote: "it opened a branch in Riverton", subject: "unclear" }),
          ]),
        ),
      }),
    );
    expect(text).not.toContain("Riverton");
  });
});

describe("a rating sentence is absent from the rendered list", () => {
  // A row stored before the producer recorded a topic: the text alone has to
  // withhold it.
  const report = reportWith([
    row({
      claim: "It holds a 3.4 out of 5 rating on an employer review site.",
      engineQuote: "Employee ratings sit at 3.4/5",
    }),
    row({
      claim: "The founder and CEO is Dana Reyes.",
      engineQuote: "its founder and CEO is Dana Reyes",
    }),
    row({ claim: "It has an office in Denver.", engineQuote: "an office in Denver" }),
  ]);

  describe.each(surfaces(report))("%s", (_label, text) => {
    it("prints neither the rating nor the named person", () => {
      expect(text).not.toContain("3.4");
      expect(text).not.toContain("Dana Reyes");
    });

    it("counts them, by topic, and still prints the rest", () => {
      expect(text).toContain(
        "The assistant also made two statements about ratings and named people that we have not checked",
      );
      expect(text).toContain('"an office in Denver"');
    });
  });

  it("reads each withheld topic off a stored row's words", () => {
    const cases: [string, ReturnType<typeof withheldTopic>][] = [
      ["It is not accredited by the trade body.", "accreditation"],
      ["It has one alert on file.", "complaints"],
      ["It is listed as a sole proprietorship.", "legal_entity"],
      ["It was acquired by a holding group in 2019.", "ownership"],
      ["The studio is run by Dana Reyes.", "named_person"],
      ["It has about 40 employees.", "revenue_headcount"],
      ["It is at 118 Larkspur Lane.", "street_address"],
      ["It designs brand identities.", null],
    ];
    for (const [claim, topic] of cases) {
      expect(withheldTopic(row({ claim, engineQuote: claim })), claim).toBe(topic);
    }
  });

  it("does not reprint a branded answer's excerpt that gives a score", () => {
    expect(
      brandedExcerpt({ snippet: "Staff give it 2.8/5 on one site.", truncated: false }),
    ).not.toContain("2.8");
    expect(brandedExcerpt({ snippet: "A brand studio in Austin", truncated: true })).toBe(
      "A brand studio in Austin…",
    );
  });
});

describe("the proof sentence", () => {
  const PROOF = "That is the proof that editing your pages changes the answer";
  const withCitations = (cited: string[]): AuditReport => {
    const r = reportWith(allPass.accuracy.data.assertions);
    const probes = structuredClone(allPass.probes);
    for (const a of probes.data.answers) if (a.kind === "branded") a.citedDomains = cited;
    return { ...r, probes } as AuditReport;
  };

  it("is absent when the assistant cited the site zero times", () => {
    const text = seen(renderText(sourceCheck, { view: toReportView(withCitations([])) }));
    expect(text).not.toContain(PROOF);
    // The confirmed statements are still listed, with both quotes.
    expect(text).toContain('"based in Austin, Texas"');
    expect(text).toContain('"Example Studio, Austin, Texas"');
  });

  it("prints when it did (positive control)", () => {
    const text = seen(
      renderText(sourceCheck, { view: toReportView(withCitations(["example-studio.test"])) }),
    );
    expect(text).toContain(PROOF);
  });
});

describe("absent needs the whole site, by its own sitemap", () => {
  const absent = row({ claim: "It has an office in Denver.", engineQuote: "an office in Denver" });

  it("makes an absent on a partly read site unverified: 20 of 95 pages", () => {
    const base = reportWith([absent], { siteFullyRead: true, pagesRead: 20, pagesTotal: 20 });
    const r = {
      ...base,
      crawl: {
        ok: true,
        data: { ...allPass.crawl.data, sitemap: { present: true, urlCount: 95, truncated: false } },
      },
    } as AuditReport;
    const view = toReportView(r);
    expect(view.accuracy?.siteFullyRead).toBe(false);
    expect(view.accuracy?.assertions[0]).toMatchObject({
      verdict: "unverified",
      unverifiedReason:
        "We read 20 of your 95 pages, so we cannot say this is absent from your site.",
    });
  });

  it("keeps absent when the pages read cover the sitemap (positive control)", () => {
    const view = toReportView(reportWith([absent]));
    expect(view.accuracy?.assertions[0]?.verdict).toBe("absent");
  });

  // One rule with W3's sentences: "we read them all" never prints over a row
  // stored before the crawl counted what it knew of, or a sitemap with no
  // `truncated` flag, so an absence may not rest on it either. W2's own rule
  // (sitemap count at or below the pages read) kept this one `absent`.
  it("makes an absent unverified on a row stored before the crawl counted its pages", () => {
    const base = reportWith([absent]);
    const data = (base.crawl as { data: Record<string, unknown> }).data;
    const { selection: _s, ...legacy } = data;
    const { truncated: _t, ...sitemap } = data.sitemap as Record<string, unknown>;
    const r = { ...base, crawl: { ok: true, data: { ...legacy, sitemap } } } as AuditReport;
    expect(toReportView(r).accuracy?.assertions[0]?.verdict).toBe("unverified");
  });

  // R3 fix 11: the coverage rule is pinned on both of its branches, not only on
  // the legacy one above. Each must go red with `completeOf(d)` replaced by
  // `d.site !== null && d.site <= d.read`.
  it("a truncated sitemap whose count the pages read reach does not make an absence", () => {
    const pages = allPass.accuracy.data.pagesRead as number;
    const base = reportWith([absent]);
    const data = (base.crawl as { data: Record<string, unknown> }).data;
    const r = {
      ...base,
      crawl: {
        ok: true,
        data: { ...data, sitemap: { present: true, urlCount: pages, truncated: true } },
      },
    } as AuditReport;
    expect(toReportView(r).accuracy?.assertions[0]?.verdict).toBe("unverified");
  });

  it("a crawl with no sitemap whose linked pages were all read does not make an absence", () => {
    const pages = allPass.accuracy.data.pagesRead as number;
    const base = reportWith([absent]);
    const data = (base.crawl as { data: Record<string, unknown> }).data;
    const { sitemap: _sitemap, ...noSitemap } = data;
    const r = {
      ...base,
      crawl: { ok: true, data: { ...noSitemap, selection: { pagesConsidered: pages } } },
    } as AuditReport;
    expect(toReportView(r).accuracy?.assertions[0]?.verdict).toBe("unverified");
  });
});

describe("the editor cannot put a paraphrase back (W1 interaction)", () => {
  const claim = "Example Studio is rated 2.1 stars by its former staff.";
  const report = reportWith([
    row({
      claim: "Example Studio is a bakery in Lakeside.",
      verdict: "unverified",
      engineQuote: "Most likely match: Example Bakery (Lakeside)",
      unverifiedReason: "We could not find the passage this was based on.",
    }),
    row({ claim, verdict: "unverified", engineQuote: "former staff rate it 2.1 out of 5" }),
  ]);

  it("offers no assertion's claim as a line to reword", () => {
    const keys = editableTargets(toReportView(report), report).map((t) => t.key);
    expect(keys.some((k) => /^accuracy\.data\.assertions\[\d+\]\.claim$/.test(k))).toBe(false);
  });

  it("never prints a reworded claim, even when an override for one is stored", () => {
    const overrides: OverrideMap = {
      "accuracy.data.assertions[0].claim": {
        original: "Example Studio is a bakery in Lakeside.",
        text: "OPERATOR REWORDING",
      },
      "accuracy.data.assertions[1].claim": { original: claim, text: "A friendly studio." },
    };
    const onScreen = seen(renderText(sourceCheck, { view: toReportView(report, overrides) }));
    const onPrint = seen(renderText(printSheet, { data: { report, overrides } }));
    for (const text of [onScreen, onPrint]) {
      expect(text).not.toContain("OPERATOR REWORDING");
      expect(text).not.toContain("A friendly studio.");
      // The rating row stays withheld: its quote still carries the topic.
      expect(text).not.toContain("2.1 out of 5");
    }
  });
});

/* ------------------------------------------------------------------------ *
 * Review round 1 (reddoor-website#380). Each block is written before its fix.
 * ------------------------------------------------------------------------ */

const count = (text: string, needle: string): number => text.split(needle).length - 1;

describe("R1 fix 1: one sentence split into several claims prints and counts once", () => {
  const QUOTE = "it serves clients across three cities";
  const report = reportWith([
    row({ claim: "CLAIM-ONE Example Studio serves Denver.", engineQuote: QUOTE }),
    row({ claim: "CLAIM-TWO Example Studio serves Austin.", engineQuote: QUOTE }),
    row({ claim: "CLAIM-THREE Example Studio serves Dallas.", engineQuote: QUOTE }),
  ]);

  describe.each(surfaces(report))("%s", (_label, text) => {
    it("prints the quote exactly once", () => {
      expect(count(text, `"${QUOTE}"`)).toBe(1);
    });
  });

  const withheld = reportWith([
    row({
      claim: "WITHHELD-ONE It holds a 3.4 out of 5 rating.",
      engineQuote: "Employee ratings sit at 3.4/5",
    }),
    row({
      claim: "WITHHELD-TWO Staff rate it 3.4 out of 5.",
      engineQuote: "Employee ratings sit at 3.4/5",
    }),
    row({
      claim: "WITHHELD-THREE It is rated 3.4 out of 5.",
      engineQuote: "Employee ratings sit at 3.4/5",
    }),
  ]);

  describe.each(surfaces(withheld))("%s", (_label, text) => {
    it("counts the three rows that share a quote as one statement", () => {
      expect(text).toContain(
        "The assistant made one statement about ratings that we have not checked",
      );
      expect(text).not.toContain("three statements");
    });
  });
});

describe("R1 fix 2: a row with an empty quote never prints", () => {
  const report = reportWith([
    row({
      claim: "EMPTY-CLAIM Example Studio was founded in 2009.",
      verdict: "contradicted",
      engineQuote: "",
      siteQuote: "Founded in 2012",
    }),
  ]);

  describe.each(surfaces(report))("%s", (_label, text) => {
    it("prints no empty quotation and no paraphrase", () => {
      expect(text).not.toContain('""');
      expect(text).not.toContain("EMPTY-CLAIM");
    });
  });

  it("is not quoted in the headline", () => {
    expect(headlineFinding(toReportView(report)).text).not.toContain('""');
  });
});

describe("R1 fix 3: a confirmed statement on a withheld topic is withheld", () => {
  const confirmed = (over: Partial<Assertion>): Assertion =>
    row({
      verdict: "confirmed",
      siteQuote: "Example Studio, Austin, Texas",
      ...over,
    });

  describe("a rating", () => {
    const report = reportWith([
      confirmed({
        claim: "Employees rate Example Studio 4.6 out of 5.",
        engineQuote: "employees rate it 4.6 out of 5 on Glassdoor",
        topic: "ratings_reviews",
      }),
    ]);

    describe.each(surfaces(report))("%s", (_label, text) => {
      it("does not print the rating, and counts it as held back", () => {
        expect(text).not.toContain("4.6 out of 5");
        expect(text).toContain("statement about ratings that we have not checked");
      });
    });
  });

  describe("a named person", () => {
    const report = reportWith([
      confirmed({
        claim: "Example Studio was founded by Dana Reyes.",
        engineQuote: "founded by Dana Reyes",
      }),
    ]);

    describe.each(surfaces(report))("%s", (_label, text) => {
      it("does not print the name, and counts it as held back", () => {
        expect(text).not.toContain("founded by Dana Reyes");
        expect(text).toContain("statement about named people that we have not checked");
      });
    });
  });
});

describe("R1 fix 4: a statement about another business is counted for every verdict", () => {
  const report = reportWith([
    row({
      claim: "Southgate Outfitters opened in 1999.",
      verdict: "confirmed",
      engineQuote: "Southgate Outfitters opened in 1999",
      siteQuote: "Example Studio, Austin, Texas",
      subject: "other",
      otherName: "Southgate Outfitters",
      topic: "other",
    }),
  ]);

  describe.each(surfaces(report))("%s", (_label, text) => {
    it("prints the about-another-business count, not silence", () => {
      expect(text).toContain("statement the assistant made was about another business");
    });

    it("leaves its quote out of what the site backs up", () => {
      expect(text).not.toContain("Southgate Outfitters opened in 1999");
      expect(text).not.toContain("What your site backs up");
    });
  });
});

describe("R1 fix 5: a stored row with no subject is read from its own words", () => {
  const OTHER = "Southgate Medical Supply (Riverton, TX)";
  const report = reportWith(
    [
      row({
        claim: "PARTNER-CLAIM Example Studio is a bakery in Riverton.",
        engineQuote: "Most likely match: Southgate Medical Supply (Riverton, TX)",
      }),
      row({
        claim: "NAMED-CLAIM Southgate Medical Supply supplies hospitals.",
        engineQuote: "Southgate Medical Supply supplies hospitals in Texas",
      }),
      row({
        claim: "OWN-CLAIM Example Studio is a design agency.",
        engineQuote: "Example Studio is a design agency",
      }),
    ],
    { conflation: { detected: false, otherNames: [OTHER], engineQuote: null } },
  );

  describe.each(surfaces(report))("%s", (_label, text) => {
    it("keeps another business's statements out, and counts them", () => {
      expect(text).not.toContain("Most likely match");
      expect(text).not.toContain("Southgate Medical Supply");
      expect(text).toContain("statements the assistant made were about another business");
    });

    it("still prints a subject-less statement that names the client", () => {
      expect(text).toContain('"Example Studio is a design agency"');
    });
  });
});

describe("R1 fix 6: a withheld contradiction does not leave the all-clear standing", () => {
  const report = reportWith([
    ...allPass.accuracy.data.assertions,
    row({
      claim: "Example Studio has 50 employees.",
      verdict: "contradicted",
      engineQuote: "has 50 employees",
      siteQuote: "a team of 8",
      topic: "revenue_headcount",
    }),
  ]);

  it("says the assistant said something the site contradicts, and asks for it", () => {
    const h = headlineFinding(toReportView(report));
    expect(h.text).toBe(
      "The assistant said something about you that your own site contradicts, on a topic we have not checked here. Ask us for it.",
    );
    expect(h.text).not.toContain("Everything we can measure");
  });

  it("does not fire for a contradiction about another business", () => {
    const other = reportWith([
      ...allPass.accuracy.data.assertions,
      row({
        claim: "Southgate has 50 employees.",
        verdict: "contradicted",
        engineQuote: "Southgate has 50 employees",
        siteQuote: "a team of 8",
        subject: "other",
        topic: "revenue_headcount",
      }),
    ]);
    expect(headlineFinding(toReportView(other)).text).toContain("Everything we can measure");
  });
});

describe("R1 fix 7: ordinary sentences match no topic", () => {
  const ORDINARY = [
    "helps small business owners grow",
    "works with startup founders and creative directors",
    "Projects start at $5,000",
    "built over 200 sites along the way",
    "offers code reviews for agencies",
    "a rising star in branding",
    "builds event registration sites",
    "writes grant funding applications",
  ];

  it.each(ORDINARY)("%s", (claim) => {
    expect(withheldTopic(row({ claim, engineQuote: claim }))).toBeNull();
  });
});

describe("R1 fix 8: the topic patterns still catch the phrasings they must", () => {
  const MUST: [string, string][] = [
    ["Example Studio, Inc. is a design firm", "legal_entity"],
    ["Example Studio operates as Example Corp.", "legal_entity"],
    ["The office is at 123 W. 5th St.", "street_address"],
    ["The assistant says it has a 4.9 on Google", "ratings_reviews"],
    ["60% would recommend it to a friend", "ratings_reviews"],
  ];

  it.each(MUST)("%s", (claim, topic) => {
    expect(withheldTopic(row({ claim, engineQuote: claim }))).toBe(topic);
  });

  it("withholds a branded excerpt that says 'would recommend'", () => {
    const excerpt = brandedExcerpt({
      snippet: "60% would recommend it to a friend",
      truncated: false,
    });
    expect(excerpt).not.toContain("would recommend");
  });
});

describe("R1 fix 9: a reworded claim does not change what is withheld", () => {
  const CLAIM = "Rated 2 stars by customers";
  const report = reportWith([
    row({ claim: CLAIM, engineQuote: "Customers say it is slow", verdict: "absent" }),
  ]);
  const overrides: OverrideMap = {
    "accuracy.data.assertions[0].claim": {
      original: CLAIM,
      text: "Customers mention slow turnaround",
    },
  };

  it("keeps the row withheld on the screen report", () => {
    const text = seen(renderText(sourceCheck, { view: toReportView(report, overrides) }));
    expect(text).not.toContain("Customers say it is slow");
    expect(text).not.toContain("Customers mention slow turnaround");
  });

  it("keeps the row withheld on the print sheet", () => {
    const text = seen(renderText(printSheet, { data: { report, overrides } }));
    expect(text).not.toContain("Customers say it is slow");
    expect(text).not.toContain("Customers mention slow turnaround");
  });
});

describe("R1 fix 11: tests a mutation could not turn red", () => {
  const confirmedRow = row({
    claim: "Example Studio is based in Austin, Texas.",
    verdict: "confirmed",
    engineQuote: "is based in Austin, Texas",
    siteQuote: "Based in Austin, Texas.",
  });

  it("(b) the print sheet lists the confirmed statements under What your site backs up", () => {
    const text = seen(
      renderText(printSheet, { data: { report: reportWith([confirmedRow]), overrides: {} } }),
    );
    expect(text).toContain("What your site backs up");
    expect(text).toContain('"is based in Austin, Texas"');
    // R2: the site's own words beside the assistant's, not only the quote.
    expect(text).toContain("Based in Austin, Texas.");
  });

  it("(c) with no answers read, there is no confirmed list and no passes line", () => {
    const report = reportWith([confirmedRow], { answersRead: 0 });
    for (const [, text] of surfaces(report)) {
      expect(text).not.toContain("What your site backs up");
      expect(text).not.toContain('"is based in Austin, Texas"');
    }
  });
});

describe("R1 fix 12: the lede and the 'also' wording follow what prints", () => {
  const onlyWithheld = reportWith([
    row({ claim: "It holds a 3.4 out of 5 rating.", engineQuote: "Employee ratings sit at 3.4/5" }),
  ]);

  it("no lede promises sorted statements when nothing printable exists", () => {
    const text = seen(renderText(lede, { view: toReportView(onlyWithheld) }));
    expect(text).not.toContain("took its answer apart");
  });

  it("says 'made', not 'also made', when no statement printed above the count", () => {
    const text = seen(renderText(sourceCheck, { view: toReportView(onlyWithheld) }));
    expect(text).toContain("The assistant made one statement about ratings");
    expect(text).not.toContain("also made");
  });
});

/* ------------------------------------------------------------------------ *
 * Review round 2 (reddoor-website#380). Written before the fix.
 * ------------------------------------------------------------------------ */

/** The surfaces with overrides applied, as the reader and the print sheet see them. */
const surfacesWith = (report: AuditReport, overrides: OverrideMap): Array<[string, string]> => [
  [
    "the source-check section",
    seen(renderText(sourceCheck, { view: toReportView(report, overrides) })),
  ],
  ["the print sheet", seen(renderText(printSheet, { data: { report, overrides } }))],
];

describe("R2: each statement is decided once, then printed, withheld, counted or hidden", () => {
  const Q = "it was founded in 2001 in Denver";

  it("a contradiction beside its absent sibling prints once, as the contradiction", () => {
    const report = reportWith([
      row({ claim: "Example Studio was founded in 2001.", engineQuote: Q }),
      row({
        claim: "Example Studio was founded in 2001.",
        verdict: "contradicted",
        engineQuote: Q,
        siteQuote: "Founded in 2022",
      }),
    ]);
    for (const [, text] of surfaces(report)) {
      // The headline quotes it too, so count the list item, not the sentence.
      expect(text.match(new RegExp(`The AI said:\\s*"${Q}"`, "g"))?.length ?? 0).toBe(1);
      expect(text).toContain('"Founded in 2022"');
    }
    const h = headlineFinding(toReportView(report)).text;
    expect(h).toContain(Q);
    expect(h).not.toContain("Everything we can measure");
  });

  it("two rows sharing one sentence, on ratings and other, count once as ratings", () => {
    const S =
      "Example Studio has an average rating of 4.2 from 37 customers and offers free consultations";
    const report = reportWith([
      row({ claim: "A rating.", engineQuote: S, topic: "ratings_reviews" }),
      row({ claim: "A rating again.", engineQuote: S, topic: "other" }),
    ]);
    for (const [, text] of surfaces(report)) {
      expect(text).not.toContain("4.2");
      expect(text).toContain(
        "The assistant made one statement about ratings that we have not checked",
      );
    }
  });

  it("a sentence shared by an other-business row and a prospect row is about another business", () => {
    const S = "Example Studio sits next to Harbor Dental on Main";
    const report = reportWith([
      row({ claim: "Other.", engineQuote: S, subject: "other" }),
      row({ claim: "Prospect.", engineQuote: S, subject: "prospect" }),
    ]);
    for (const [, text] of surfaces(report)) {
      expect(text).not.toContain("Harbor Dental");
      expect(text).not.toContain("What the AI says about you");
      expect(text).toContain("statement the assistant made was about another business");
    }
  });

  it("an absent row beside a confirmed sibling prints once, under What your site backs up only", () => {
    const S = "it is based in Austin, Texas";
    const report = reportWith([
      row({ claim: "Absent.", engineQuote: S }),
      row({
        claim: "Confirmed.",
        verdict: "confirmed",
        engineQuote: S,
        siteQuote: "Based in Austin, Texas.",
      }),
    ]);
    for (const [, text] of surfaces(report)) {
      expect(count(text, `"${S}"`)).toBe(1);
      expect(text).not.toContain("What the AI says about you");
      expect(text.indexOf("What your site backs up")).toBeLessThan(text.indexOf(`"${S}"`));
    }
  });

  it("a sentence withheld on one row does not print from its unwithheld sibling", () => {
    const Q = "it serves three cities";
    const report = reportWith([
      row({ claim: "Example Studio serves three cities.", engineQuote: Q, topic: "other" }),
      row({
        claim: "Example Studio serves three cities too.",
        engineQuote: Q,
        topic: "ratings_reviews",
      }),
    ]);
    for (const [, text] of surfaces(report)) {
      expect(text).not.toContain(`"${Q}"`);
      expect(text).toContain(
        "The assistant made one statement about ratings that we have not checked",
      );
    }
  });

  it("a confirmed row with no site quote prints under What your site backs up (R4 fix 7)", () => {
    const S = "it has been open since 2012";
    const report = reportWith([
      row({ claim: "Open since 2012.", verdict: "confirmed", engineQuote: S, siteQuote: null }),
    ]);
    for (const [, text] of surfaces(report)) {
      expect(text).toContain("What your site backs up");
      expect(text).toContain(`"${S}"`);
      expect(text).not.toContain("What the AI says about you");
    }
  });

  it("an empty quote is counted as unquoted, never printed, and not a bare empty state", () => {
    const report = reportWith([row({ claim: "UNQUOTED Example Studio is old.", engineQuote: "" })]);
    for (const [, text] of surfaces(report)) {
      expect(text).toContain(
        "The assistant made one statement we could not quote exactly, so we have not repeated it.",
      );
      expect(text).not.toContain('""');
      expect(text).not.toContain("UNQUOTED");
      expect(text).not.toContain("could not pull a checkable statement");
    }
  });

  it("the print sheet shows the section heading with the count line, never a bare heading", () => {
    const report = reportWith([row({ claim: "UNQUOTED x.", engineQuote: "   " })]);
    const text = seen(renderText(printSheet, { data: { report, overrides: {} } }));
    expect(text).toContain("What AI is saying about you");
    expect(text).toContain("we could not quote exactly");
  });

  it("counts the unquoted statements in the plural, and says 'also' only after a printed statement", () => {
    const report = reportWith([
      row({ claim: "x", engineQuote: "" }),
      row({ claim: "y", engineQuote: "  ", query: "a second question" }),
      row({
        claim: "Example Studio is a design agency.",
        engineQuote: "Example Studio is a design agency",
      }),
    ]);
    const text = seen(renderText(sourceCheck, { view: toReportView(report) }));
    expect(text).toContain("The assistant also made two statements we could not quote exactly");
    const alone = seen(
      renderText(sourceCheck, {
        view: toReportView(reportWith([row({ claim: "x", engineQuote: "" })])),
      }),
    );
    expect(alone).toContain("The assistant made one statement we could not quote exactly");
    expect(alone).not.toContain("also made");
  });

  it("statements() gives one outcome per statement, in the stated order", () => {
    const view = toReportView(
      reportWith([
        row({ claim: "a", engineQuote: "a sentence about another firm", subject: "other" }),
        row({ claim: "b", engineQuote: "an absent sentence", verdict: "absent" }),
      ]),
    );
    expect(statements(view).map((s) => s.outcome)).toEqual(["aboutOthers", "notSourced"]);
  });
});

describe("R2: hiding takes a statement, not a row", () => {
  const Q = "it serves three cities";
  const raw = reportWith([
    row({ claim: "A-CLAIM Example Studio serves Denver.", engineQuote: Q }),
    row({ claim: "B-CLAIM Example Studio serves Austin.", engineQuote: Q }),
    row({ claim: "C-CLAIM Example Studio designs logos.", engineQuote: "it designs logos" }),
  ]);
  const overrides: OverrideMap = {
    "accuracy.data.assertions[0]": {
      original: "A-CLAIM Example Studio serves Denver.",
      text: "",
      hidden: true,
    },
  };

  it("hiding one row of a statement removes the statement from both surfaces", () => {
    for (const [, text] of surfacesWith(raw, overrides)) {
      expect(text).not.toContain(`"${Q}"`);
      expect(text).toContain('"it designs logos"');
    }
  });

  it("the last printed statement cannot be hidden, and a hidden statement can still be put back", () => {
    const targets = hideTargets(raw, overrides);
    const c = targets.find((t) => t.key === "accuracy.data.assertions[2]");
    expect(c).toMatchObject({ canHide: false, hidden: false });
    const a = targets.find((t) => t.key === "accuracy.data.assertions[0]");
    expect(a).toMatchObject({ canHide: true, hidden: true });
    expect(targets.filter((t) => t.key === "accuracy.data.assertions[1]")).toHaveLength(0);
  });

  it("labels a statement with the quote the page prints, whatever markup it arrived with", () => {
    const marked = reportWith([
      row({ claim: "A.", engineQuote: '"it serves three cities"' }),
      row({ claim: "B.", engineQuote: "it is **the best** firm", query: "who is Example Studio" }),
      row({ claim: "C.", engineQuote: "it designs logos" }),
    ]);
    const labels = hideTargets(marked, {})
      .filter((t) => t.key.startsWith("accuracy."))
      .map((t) => t.label ?? "");
    expect(labels).toContain("“it serves three cities”");
    expect(labels).toContain("“it is the best firm”");
    for (const label of labels) {
      expect(label).not.toContain("**");
      expect(label).not.toContain('""');
    }
    for (const [, text] of surfaces(marked)) {
      expect(text).toContain('"it serves three cities"');
      expect(text).toContain('"it is the best firm"');
    }
  });

  // R3 fix 6 changed this: one sentence is one statement whatever question it
  // answered, so the label no longer needs the question to tell two apart.
  it("two rows with the same quote and different questions are one statement, labelled once", () => {
    const same = reportWith([
      row({ claim: "A.", engineQuote: Q, query: "best firm in Denver" }),
      row({ claim: "B.", engineQuote: Q, query: "best firm in Austin" }),
      row({ claim: "C.", engineQuote: "it designs logos" }),
    ]);
    const labels = hideTargets(same, {}).map((t) => t.label);
    expect(labels).toContain(`“${Q}”`);
    expect(labels.filter((l) => l === `“${Q}”`)).toHaveLength(1);
    expect(labels.some((l) => l?.includes("(asked:"))).toBe(false);
    expect(displayQuote(`"${Q}"`)).toBe(Q);
  });
});

describe("R2: other names", () => {
  it("drops an other name that is part of the business's own name", () => {
    const report = {
      ...ALL_PASS_REPORT,
      businessName: "Acme Roofing",
      accuracy: {
        ok: true,
        data: {
          ...allPass.accuracy.data,
          conflation: {
            detected: true,
            settled: true,
            otherNames: ["Acme (Dallas)"],
            engineQuote: null,
          },
          assertions: [
            row({ claim: "Acme.", engineQuote: "Acme Roofing installs metal roofs in Austin" }),
          ],
        },
      },
    } as unknown as AuditReport;
    expect(otherNamesOf(toReportView(report))).toEqual([]);
    for (const [, text] of surfaces(report)) {
      expect(text).toContain('"Acme Roofing installs metal roofs in Austin"');
    }
  });

  it("still counts a subject-less statement naming another business", () => {
    const report = {
      ...ALL_PASS_REPORT,
      businessName: "Acme Roofing",
      accuracy: {
        ok: true,
        data: {
          ...allPass.accuracy.data,
          conflation: {
            detected: false,
            otherNames: ["Riverton Roofing Supply"],
            engineQuote: null,
          },
          assertions: [
            row({ claim: "Riverton.", engineQuote: "Most likely match: Riverton Roofing Supply" }),
          ],
        },
      },
    } as unknown as AuditReport;
    for (const [, text] of surfaces(report)) {
      expect(text).not.toContain("Riverton");
      expect(text).toContain("statement the assistant made was about another business");
    }
  });
});

describe("R2: a confirmed statement is counted in What passes only when it prints", () => {
  it("the passes line counts the one confirmed statement that prints, not the withheld or other ones", () => {
    const view = toReportView(
      reportWith([
        row({
          claim: "Example Studio is based in Austin.",
          verdict: "confirmed",
          engineQuote: "is based in Austin, Texas",
          siteQuote: "Based in Austin, Texas.",
        }),
        row({
          claim: "Employees rate it 4.6.",
          verdict: "confirmed",
          engineQuote: "employees rate it 4.6 out of 5 on Glassdoor",
          siteQuote: "Example Studio, Austin, Texas",
        }),
        row({
          claim: "Southgate opened in 1999.",
          verdict: "confirmed",
          engineQuote: "Southgate opened in 1999",
          siteQuote: "Example Studio, Austin, Texas",
          subject: "other",
        }),
      ]),
    );
    const ai = passes(view).find((g) => g.title === "What AI is saying about you");
    expect(ai?.items[0]).toBe(
      "One statement the assistant made matches a passage on your own site",
    );
    expect(ai?.items.join(" ")).not.toContain("Two statements");
  });
});

describe("R2: the one-sentence statements printed on the print sheet carry their site quote", () => {
  it("the confirmed list shows the site's own words", () => {
    const text = seen(
      renderText(printSheet, {
        data: {
          report: reportWith([
            row({
              claim: "Example Studio is based in Austin, Texas.",
              verdict: "confirmed",
              engineQuote: "is based in Austin, Texas",
              siteQuote: "Based in Austin, Texas.",
            }),
          ]),
          overrides: {},
        },
      }),
    );
    expect(text).toContain('"Based in Austin, Texas."');
  });
});

describe("R2: the other-names rule reads names as whole words", () => {
  it("does not match a name inside a longer word", () => {
    const assertions = [row({ claim: "x", engineQuote: "Southgate Medical Supplyco opens late" })];
    const withName = {
      ...reportWith(assertions),
      accuracy: {
        ok: true,
        data: {
          ...allPass.accuracy.data,
          conflation: {
            detected: false,
            otherNames: ["Southgate Medical Supply"],
            engineQuote: null,
          },
          assertions,
        },
      },
    } as unknown as AuditReport;
    const text = seen(renderText(sourceCheck, { view: toReportView(withName) }));
    // R5 fix 1 changes this pin. "Southgate" alone no longer makes a sentence
    // another firm's (round 4 read it that way). The other name is not whole in
    // the quote ("Supplyco" is not "Supply"), so the sentence is the client's and
    // prints. This assertion was "does not print" in round 4.
    expect(text).toContain('"Southgate Medical Supplyco opens late"');
  });

  it("a longer word that only starts like the other firm's word still prints", () => {
    const assertions = [row({ claim: "x", engineQuote: "Southgatez Medical Supplyco opens late" })];
    const withName = {
      ...reportWith(assertions),
      accuracy: {
        ok: true,
        data: {
          ...allPass.accuracy.data,
          conflation: {
            detected: false,
            otherNames: ["Southgate Medical Supply"],
            engineQuote: null,
          },
          assertions,
        },
      },
    } as unknown as AuditReport;
    const text = seen(renderText(sourceCheck, { view: toReportView(withName) }));
    expect(text).toContain('"Southgatez Medical Supplyco opens late"');
  });
});

describe("R2: topic patterns", () => {
  const WITHHELD: [string, string][] = [
    ["has an average rating of 4.6", "ratings_reviews"],
    ["a 4.6 rating on Yelp", "ratings_reviews"],
    ["Google rating of 4.7", "ratings_reviews"],
    ["4.8★ on Google", "ratings_reviews"],
    ["with 120 five-star reviews", "ratings_reviews"],
    // R5 fix 2 changes this pin: "John Smith founded the company" is no longer a
    // pattern (a verb after two capitalised words names the business). The noun
    // form below is the person.
    ["The studio was founded by John Smith in 2001", "named_person"],
    ["founded in 2001 by John Smith", "named_person"],
    ["owner Jane Doe", "named_person"],
    ["its founder, Jane Doe,", "named_person"],
    ["A man named Tim leads Acme.", "named_person"],
    ["located at 450 Elm St, Austin", "street_address"],
    ["at 12 Oak Ave in Austin", "street_address"],
    ["a team of 25", "revenue_headcount"],
    // R3 fix 3: the phrasings a stored row uses, with no topic recorded.
    ["it has a Glassdoor score of 3.9", "ratings_reviews"],
    ["Glassdoor rating: 3.9", "ratings_reviews"],
    ["**Rating:** 4.2", "ratings_reviews"],
    ["Google: 4.2 (37 reviews)", "ratings_reviews"],
    ["averages 4.2 from 37 Google reviews", "ratings_reviews"],
    ["Employees on Glassdoor give it 3.9", "ratings_reviews"],
    ["has a 3.9 Glassdoor score", "ratings_reviews"],
    ["customers rated it five stars", "ratings_reviews"],
    ["a rating of four stars", "ratings_reviews"],
    ["Employees give it 3.9 out of five", "ratings_reviews"],
    ["It has a 3.4 Glassdoor rating.", "ratings_reviews"],
    ["Glassdoor: 3.4", "ratings_reviews"],
    ["It has a 3.9 overall rating on Glassdoor.", "ratings_reviews"],
    ["Employees give it 4 stars on Indeed.", "ratings_reviews"],
    ["It is rated at 3.8 by employees.", "ratings_reviews"],
    ["Employee reviews average 3.2.", "ratings_reviews"],
    ["On Glassdoor it holds a 3.6.", "ratings_reviews"],
    ["Senior management 2.9", "ratings_reviews"],
    ["Charity Navigator gives it 4 out of 4 stars.", "ratings_reviews"],
    ["employs around 40 people", "revenue_headcount"],
    ["a 12-person team", "revenue_headcount"],
    ["Dana Reyes is the founder of the studio", "named_person"],
    ["Founder: Dana Reyes", "named_person"],
    ["Owner: Dana Reyes", "named_person"],
    ["the studio's principal, Dana Reyes", "named_person"],
  ];

  it.each(WITHHELD)("withholds %s", (claim, topic) => {
    expect(withheldTopic(row({ claim, engineQuote: claim }))).toBe(topic);
  });

  const NOT_WITHHELD = [
    "has helped over 10,000 people",
    "serves 500 people each week",
    "trained 2,000 staff at hospitals",
    "offers annual maintenance plans from $99",
    "provides fraud prevention for banks",
    "sends real-time alerts to homeowners",
    "handles customer complaints for retailers",
    "is a franchise-friendly agency",
    "works with any business entity",
    "an Inc. 5000 honoree",
    "works in 5 star hotels",
    "9 out of 10 dentists recommend it",
    // R3 fix 3: negative controls, which must still print.
    "Example Studio designs logos for restaurants",
    "it was founded in 2001 in Denver",
    "offers free consultations",
  ];

  it.each(NOT_WITHHELD)("does not withhold %s", (claim) => {
    expect(withheldTopic(row({ claim, engineQuote: claim }))).toBeNull();
  });

  it("keeps the round-1 ordinary sentences unwithheld", () => {
    for (const claim of [
      "helps small business owners grow",
      "works with startup founders and creative directors",
      "Projects start at $5,000",
      "built over 200 sites along the way",
      "offers code reviews for agencies",
      "a rising star in branding",
      "builds event registration sites",
      "writes grant funding applications",
    ]) {
      expect(withheldTopic(row({ claim, engineQuote: claim })), claim).toBeNull();
    }
  });
});

describe("R2: the withheld count is held in the HeldBack type", () => {
  it("heldBack reports unquoted statements beside the other counts", () => {
    const h: HeldBack = heldBack(toReportView(reportWith([row({ claim: "x", engineQuote: "" })])));
    expect(h.unquoted).toBe(1);
  });
});

/* ------------------------------------------------------------------------ *
 * Review round 3 (reddoor-website#380). Written before the fix.
 * ------------------------------------------------------------------------ */

const withBusiness = (report: AuditReport, businessName: string): AuditReport =>
  ({ ...report, businessName }) as unknown as AuditReport;

describe("R3 fix 1: a contradiction about the client survives a mixed statement", () => {
  const Q = "Example Studio was founded in 2001 with Southgate Outfitters as a partner";
  const prospect = row({
    claim: "Example Studio was founded in 2001.",
    verdict: "contradicted",
    engineQuote: Q,
    siteQuote: "Founded in 2022",
    subject: "prospect",
  });
  const other = row({
    claim: "Southgate Outfitters was founded in 2001.",
    engineQuote: Q,
    subject: "other",
  });
  const cases: [string, Assertion[]][] = [
    ["other row first", [other, prospect]],
    ["prospect row first", [prospect, other]],
  ];

  it.each(cases)(
    "the headline is not all-clear, and names the withheld contradiction: %s",
    (_l, rows) => {
      const h = headlineFinding(toReportView(reportWith(rows))).text;
      expect(h).not.toContain("Everything we can measure");
      expect(h).toContain("that your own site contradicts");
    },
  );

  const S = "Example Studio sits next to Harbor Dental on Main";
  const otherRow = row({ claim: "Other.", engineQuote: S, subject: "other" });
  const prospectRow = row({ claim: "Prospect.", engineQuote: S, subject: "prospect" });
  const mixed: [string, Assertion[]][] = [
    ["other row first", [otherRow, prospectRow]],
    ["prospect row first", [prospectRow, otherRow]],
  ];

  it.each(mixed)("a shared sentence is about another business, in either order: %s", (_l, rows) => {
    for (const [, text] of surfaces(reportWith(rows))) {
      expect(text).not.toContain("Harbor Dental");
      expect(text).not.toContain("What the AI says about you");
      expect(text).toContain("statement the assistant made was about another business");
    }
  });
});

describe("R3 fix 2: hiding the collision block keeps the names it is judged by", () => {
  const report = withBusiness(
    reportWith(
      [
        row({ claim: "Studio.", engineQuote: "Example Studio is a design studio in Denver" }),
        row({
          claim: "Northwind.",
          engineQuote: "Northwind sells screen printing and embroidered uniforms",
        }),
      ],
      {
        conflation: {
          detected: true,
          settled: false,
          otherNames: ["Northwind (Austin)"],
          engineQuote: "it may be Northwind",
        },
      },
    ),
    "Example Studio",
  );
  const overrides: OverrideMap = {
    "accuracy.data.conflation": { original: "it may be Northwind", text: "", hidden: true },
  };

  it("the hide leaves the Northwind sentence counted as another business", () => {
    expect(heldBack(toReportView(report, overrides)).aboutOthers).toBe(1);
    expect(heldBack(toReportView(report)).aboutOthers).toBe(1);
  });

  it("the Northwind sentence prints on neither surface", () => {
    for (const [, text] of surfacesWith(report, overrides)) {
      expect(text).not.toContain("Northwind sells");
    }
  });
});

describe("R3 fix 3: the withheld phrasings print on neither surface", () => {
  const PHRASES = [
    "it has a Glassdoor score of 3.9",
    "Glassdoor rating: 3.9",
    "**Rating:** 4.2",
    "Google: 4.2 (37 reviews)",
    "averages 4.2 from 37 Google reviews",
    "Employees on Glassdoor give it 3.9",
    "customers rated it five stars",
    "a rating of four stars",
    "Senior management 2.9",
    "Charity Navigator gives it 4 out of 4 stars.",
    "employs around 40 people",
    "a 12-person team",
    "Dana Reyes is the founder of the studio",
    "Founder: Dana Reyes",
    "the studio's principal, Dana Reyes",
  ];

  it("none of them is printed as a quote, and a control row still prints", () => {
    const CONTROL = "Example Studio designs logos for restaurants";
    const report = reportWith([
      ...PHRASES.map((s) => row({ claim: s, engineQuote: s })),
      row({ claim: CONTROL, engineQuote: CONTROL }),
    ]);
    for (const [, text] of surfaces(report)) {
      for (const s of PHRASES) expect(text, s).not.toContain(s);
      expect(text, "control").toContain(CONTROL);
    }
  });
});

describe("R3 fix 4: the branded excerpt does not reprint a withheld topic", () => {
  it.each([
    "Glassdoor rating: 3.9",
    "BBB rating: A+",
    "It was founded in 2012 by Dana Reyes. There are several complaints filed against the business with the state board.",
  ])("does not reprint: %s", (snippet) => {
    expect(brandedExcerpt({ snippet, truncated: false })).not.toContain(snippet);
  });

  it("does not reprint an excerpt answering a 'reviews' question", () => {
    const excerpt = brandedExcerpt({
      snippet: "Example Studio is a design studio in Denver.",
      truncated: false,
      query: "Example Studio reviews",
    });
    expect(excerpt).not.toContain("design studio");
  });

  it("still prints an ordinary excerpt under a name question (positive control)", () => {
    const excerpt = brandedExcerpt({
      snippet: "Example Studio is a design studio in Denver.",
      truncated: false,
      query: "who is Example Studio",
    });
    expect(excerpt).toContain("Example Studio is a design studio in Denver.");
  });
});

describe("R3 fix 5: the collision block does not print another firm's rating", () => {
  const report = withBusiness(
    reportWith(
      [
        row({
          claim: "Example Studio is a design agency.",
          engineQuote: "Example Studio is a design agency",
        }),
      ],
      {
        conflation: {
          detected: true,
          settled: false,
          otherNames: ["Southgate Outfitters (a store rated 2.1 out of 5 on Glassdoor)"],
          engineQuote: "Most likely match: Southgate Outfitters, rated 2.1 out of 5 by employees",
        },
      },
    ),
    "Example Studio",
  );

  it("prints the other name without its rating, and no rating quote, on both surfaces", () => {
    for (const [label, text] of surfaces(report)) {
      expect(text, label).toContain("Southgate Outfitters");
      expect(text, label).not.toContain("2.1");
      expect(text, label).not.toContain("Glassdoor");
    }
  });
});

describe("R3 fix 6: one sentence prints once, whatever questions it answered", () => {
  const Q = "it was founded in 2001";

  it("a contradiction and an absent copy under two questions print once, as the contradiction", () => {
    const report = reportWith([
      row({
        claim: "Founded 2001.",
        verdict: "contradicted",
        engineQuote: Q,
        siteQuote: "Founded in 2012",
        query: "who is Example Studio",
      }),
      row({ claim: "Founded 2001 too.", engineQuote: Q, query: "Example Studio reviews" }),
    ]);
    for (const [, text] of surfaces(report)) {
      // The print sheet's headline quotes it too, so count the list item.
      expect(text.match(new RegExp(`The AI said:\\s*"${Q}"`, "g"))?.length ?? 0).toBe(1);
      expect(text).toContain("Your site says");
      expect(text).not.toContain("What the AI says about you");
    }
  });

  it("two absent copies under two questions print once", () => {
    const Q2 = "it does branding work";
    const report = reportWith([
      row({ claim: "Brands.", engineQuote: Q2, query: "who is Example Studio" }),
      row({ claim: "Brands again.", engineQuote: Q2, query: "best branding studio" }),
    ]);
    for (const [, text] of surfaces(report)) {
      expect(count(text, `"${Q2}"`)).toBe(1);
    }
  });

  it("hiding one copy hides the other, whatever question it answered", () => {
    const Q2 = "it does branding work";
    const raw = reportWith([
      row({ claim: "A.", engineQuote: Q2, query: "who is Example Studio" }),
      row({ claim: "B.", engineQuote: Q2, query: "best branding studio" }),
      row({ claim: "C.", engineQuote: "it designs logos" }),
    ]);
    const overrides: OverrideMap = {
      "accuracy.data.assertions[0]": { original: "A.", text: "", hidden: true },
    };
    for (const [, text] of surfacesWith(raw, overrides)) {
      expect(text).not.toContain(`"${Q2}"`);
      expect(text).toContain('"it designs logos"');
    }
  });
});

describe("R3 fix 7: a withheld contradiction with no quote has its own headline", () => {
  it("says it contradicts something it could not quote exactly", () => {
    const report = reportWith([
      row({
        claim: "Example Studio has 50 employees.",
        verdict: "contradicted",
        engineQuote: "  ",
        siteQuote: "a team of 8",
        topic: "revenue_headcount",
      }),
    ]);
    const h = headlineFinding(toReportView(report)).text;
    expect(h).toContain("your own site contradicts, in words we could not quote exactly");
    expect(h).not.toContain("topic we have not checked");
  });
});

describe("R3 fix 8: a sibling hide reads as hidden, and the last statement cannot be hidden", () => {
  const raw = reportWith([
    row({ claim: "Example Studio was founded in 2001.", engineQuote: "founded in 2001 in Denver" }),
    row({ claim: "Example Studio is in Denver.", engineQuote: "founded in 2001 in Denver" }),
    row({ claim: "Example Studio does branding work.", engineQuote: "it does branding work" }),
  ]);
  const overrides: OverrideMap = {
    "accuracy.data.assertions[1]": {
      original: "Example Studio is in Denver.",
      text: "",
      hidden: true,
    },
  };

  it("the target for the shared statement reads hidden", () => {
    const t = hideTargets(raw, overrides).find((x) => x.key === "accuracy.data.assertions[0]");
    expect(t).toMatchObject({ hidden: true });
  });

  it("the last visible statement cannot be hidden", () => {
    const t = hideTargets(raw, overrides).find((x) => x.key === "accuracy.data.assertions[2]");
    expect(t).toMatchObject({ canHide: false });
  });

  it("showing the statement again removes every hide in its group", () => {
    const both: OverrideMap = {
      ...overrides,
      "accuracy.data.assertions[0]": {
        original: "Example Studio was founded in 2001.",
        text: "",
        hidden: true,
      },
    };
    const target = hideTargets(raw, both).find((x) => x.key === "accuracy.data.assertions[0]")!;
    expect(target.hidden).toBe(true);
    expect(showStatement(both, target)).toEqual({});
  });
});

describe("R3 fix 9: an empty first-row claim does not block hiding", () => {
  const raw = reportWith([
    row({ claim: "", engineQuote: "it designs logos" }),
    row({ claim: "x", engineQuote: "it builds sites" }),
  ]);
  const accuracyKeys = (map: OverrideMap) =>
    hideTargets(raw, map)
      .map((t) => t.key)
      .filter((k) => k.startsWith("accuracy.data.assertions["));

  it("offers both statements", () => {
    expect(accuracyKeys({})).toHaveLength(2);
  });

  it.each([
    ["it designs logos", 0],
    ["it builds sites", 1],
  ])("each can be hidden, and hiding it takes %s off the page", (quote, index) => {
    const key = `accuracy.data.assertions[${index}]`;
    const target = hideTargets(raw, {}).find((t) => t.key === key);
    const overrides: OverrideMap = {
      [key]: { original: target!.original, text: "", hidden: true },
    };
    expect(hideTargets(raw, overrides).find((t) => t.key === key)?.hidden).toBe(true);
    for (const [, text] of surfacesWith(raw, overrides)) {
      expect(text).not.toContain(`"${quote}"`);
    }
  });
});

describe("R3 fix 10: the changes list names a hidden statement by the quote it printed", () => {
  it("shows the quote, not the paraphrase", () => {
    const raw = reportWith([
      row({ claim: "Example Studio has an office in Denver.", engineQuote: "an office in Denver" }),
    ]);
    const map: OverrideMap = {
      "accuracy.data.assertions[0]": {
        original: "Example Studio has an office in Denver.",
        text: "",
        hidden: true,
      },
    };
    expect(changeList(map, [], hideTargets(raw, map))).toEqual([
      {
        key: "accuracy.data.assertions[0]",
        kind: "hidden",
        before: "an office in Denver",
        after: "",
      },
    ]);
  });
});

describe("R3 fix 12: a blank site quote is no site quote, and the unverified reason is not editable", () => {
  it("a confirmed row with a blank site quote prints under what the site backs up (R4 fix 7)", () => {
    const report = reportWith([
      row({
        claim: "Open since 2012.",
        verdict: "confirmed",
        engineQuote: "it has been open since 2012",
        siteQuote: "   ",
      }),
    ]);
    for (const [, text] of surfaces(report)) {
      expect(text).toContain("What your site backs up");
      expect(text).not.toContain("What the AI says about you");
      expect(text).not.toContain("Your site says");
    }
  });

  it("offers no unverified reason as a line to reword", () => {
    const report = reportWith([
      row({
        claim: "Example Studio has an office in Denver.",
        verdict: "unverified",
        engineQuote: "an office in Denver",
        unverifiedReason: "We could not find the passage this was based on.",
      }),
    ]);
    const keys = editableTargets(toReportView(report), report).map((t) => t.key);
    expect(keys.some((k) => k.endsWith(".unverifiedReason"))).toBe(false);
  });
});

/* ------------------------------------------------------------------------ *
 * Review round 4 (reddoor-website#380). Written before the fix.
 * ------------------------------------------------------------------------ */

const branded = await ssr<{ probes: unknown[] }>("src/lib/report/BrandedAnswers.svelte");

const brandedProbe = (query: string, snippet: string, citedDomains: string[] = []) => ({
  kind: "branded",
  query,
  snippet,
  truncated: false,
  citedDomains,
  engine: "claude",
});

const conflationOf = (otherNames: string[], engineQuote = "") => ({
  detected: true,
  settled: false,
  otherNames,
  engineQuote,
});

// The run is 2,000 spaces (R5 fix 8 widened it from 1,000): the old cubic rating
// pattern took about 0.9 s at 1,000 here (so the mutation goes red in bounded
// time). The 250 ms bound leaves room for a slow CI runner. R5 fix 8 adds the two
// inputs that were slowest on a 20,000-character probe of every pattern: a
// platform name then 20,000 spaces, and 20,000 letters.
describe("R4 fix 1a: the topic patterns finish fast on long runs of spaces", () => {
  const LONG: [string, string][] = [
    ["a rating, then 2,000 spaces", `Rating${" ".repeat(2000)}x`],
    ["a platform, then 2,000 spaces", `Glassdoor${" ".repeat(2000)}`],
    ["a platform, then 20,000 spaces", `Glassdoor${" ".repeat(20000)}`],
    ["20,000 letters", "a".repeat(20000)],
    ["20,000 digits", "1".repeat(20000)],
    ['"1," repeated 20,000 times', "1,".repeat(20000)],
    ['"A-" repeated 20,000 times', "A-".repeat(20000)],
    ['"A\'" repeated 20,000 times', "A'".repeat(20000)],
    [
      "a 20,000-character ordinary paragraph",
      "The studio builds brand identities for restaurants in Denver. ".repeat(340),
    ],
  ];

  it.each(LONG)("withheldTopic is quick on %s", (_l, claim) => {
    const t0 = performance.now();
    withheldTopic(row({ claim, engineQuote: claim }));
    expect(performance.now() - t0).toBeLessThan(250);
  });

  it.each(LONG)("brandedExcerpt is quick on %s", (_l, snippet) => {
    const t0 = performance.now();
    brandedExcerpt({ snippet, truncated: false, query: "who is Example Studio" });
    expect(performance.now() - t0).toBeLessThan(250);
  });
});

describe("R4 fix 1b: ordinary sentences are not held back as ratings", () => {
  const ORDINARY_HELD = [
    "It has managed Google Ads campaigns since 2015",
    "It builds Shopify stores and Google Analytics 4 dashboards",
    "Founded in 2001, the studio is indeed one of Denver's oldest agencies",
    "it has built 3 apps for Google",
    "it is a Google Partner agency since 2015",
    "three out of five clients come from referrals",
    "it ran 12 campaigns on Yelp and Google Ads",
  ];

  it.each(ORDINARY_HELD)("does not withhold: %s", (claim) => {
    expect(withheldTopic(row({ claim, engineQuote: claim }))).toBeNull();
  });

  it("prints each of them on both surfaces", () => {
    const report = reportWith(ORDINARY_HELD.map((claim) => row({ claim, engineQuote: claim })));
    for (const [, text] of surfaces(report)) {
      for (const s of ORDINARY_HELD) expect(text, s).toContain(s);
    }
  });

  it("prints a contradicted row about the prospect that quotes a founding date", () => {
    const quote = "Founded in 2001, the studio is indeed one of Denver's oldest agencies";
    const report = reportWith([
      row({
        claim: "Example Studio was founded in 2001.",
        verdict: "contradicted",
        engineQuote: quote,
        siteQuote: "Founded in 2012",
        subject: "prospect",
      }),
    ]);
    for (const [name, text] of surfaces(report)) {
      expect(text).toContain(quote);
      if (name === "the source-check section")
        expect(text).toContain("Your site says something different");
      else expect(text).toContain("your site says otherwise");
    }
    expect(headlineFinding(toReportView(report)).text).toContain(displayQuote(quote));
  });
});

describe("R4 fix 1c: phrasings that still leak are withheld on both surfaces", () => {
  const WITHHELD_PHRASES: [string, string][] = [
    ["There are several complaints about its customer service.", "complaints"],
    ["Several former clients have complained about missed deadlines.", "complaints"],
    ["It holds a 4.9 on Clutch from 12 reviews.", "ratings_reviews"],
    ["Clutch reviewers give it 4.9.", "ratings_reviews"],
    ["It has 37 reviews.", "ratings_reviews"],
    ["It has a 4.8 average across 120 reviews.", "ratings_reviews"],
    ["It has five-star reviews from past clients.", "ratings_reviews"],
    ["It is highly rated on Google.", "ratings_reviews"],
    ["Google reviews praise its fast turnaround.", "ratings_reviews"],
    ["It has five stars on Yelp.", "ratings_reviews"],
    ["averages 4 stars", "ratings_reviews"],
    ["has a 4.5 average from customers", "ratings_reviews"],
    ["rated highly, 4.8 overall", "ratings_reviews"],
    ["Dana Reyes is the studio's founder.", "named_person"],
    ["It is led by designer Dana Reyes.", "named_person"],
    ["Creative director Dana Reyes oversees every project.", "named_person"],
    // R5 fix 2 removed "Dana Reyes started / owns the studio" as a person pattern
    // (the verb pins for "started in 2001" and "own the studio" were removed with it).
    ["Dana Reyes is the studio's owner.", "named_person"],
    ["It has about 40 staff.", "revenue_headcount"],
    ["It has a team of about 40 designers.", "revenue_headcount"],
    ["It brings in about $500,000 a year.", "revenue_headcount"],
    ["It has twelve employees.", "revenue_headcount"],
    ["Example Studio is a limited liability company.", "legal_entity"],
    ["It is a woman-owned business.", "ownership"],
    ["It is family-owned and operated.", "ownership"],
    ["Northwind Group acquired it in 2019.", "ownership"],
    ["It is part of Northwind Group.", "ownership"],
    ["Its office is at 1200 Broadway in Denver.", "street_address"],
  ];

  it.each(WITHHELD_PHRASES)("withholds %s", (claim, topic) => {
    expect(withheldTopic(row({ claim, engineQuote: claim }))).toBe(topic);
    expect(
      brandedExcerpt({ snippet: claim, truncated: false, query: "who is Example Studio" }),
    ).not.toContain(claim);
  });

  it.each(WITHHELD_PHRASES)("prints neither %s on either surface", (claim) => {
    for (const [, text] of surfaces(reportWith([row({ claim, engineQuote: claim })]))) {
      expect(text).not.toContain(claim);
    }
  });

  const NEGATIVE_CONTROLS = [
    "Example Studio designs logos for restaurants",
    "it was founded in 2001 in Denver",
    "offers free consultations",
    "It is a Google Partner agency serving Denver since 2009",
    "It designs logos. Three out of five of its clients are restaurants.",
    "Dana's Bakery is one of its clients",
    "it moved to 1200 square feet of studio space",
  ];

  it.each(NEGATIVE_CONTROLS)("still prints the control: %s", (claim) => {
    expect(withheldTopic(row({ claim, engineQuote: claim }))).toBeNull();
    for (const [, text] of surfaces(reportWith([row({ claim, engineQuote: claim })]))) {
      expect(text).toContain(claim);
    }
  });
});

describe("R4 fix 2: an unverified contradiction about the prospect is withheld, not all-clear", () => {
  it("the employee-count example gives the withheld-contradiction headline", () => {
    const report = reportWith([
      row({
        claim: "Example Studio has 10 employees.",
        verdict: "unverified",
        subject: "prospect",
        topic: "revenue_headcount",
        contradiction: { attribute: "employees", engineValue: "10", siteValue: "45" },
        engineQuote: "Example Studio has 10 employees",
        siteQuote: "Our team of 45 designers",
      }),
    ]);
    const h = headlineFinding(toReportView(report)).text;
    expect(h).toContain("on a topic we have not checked here. Ask us for it.");
    expect(h).not.toContain("Everything we can measure");
  });

  it("the street-address example gives the withheld-contradiction headline", () => {
    const report = reportWith([
      row({
        claim: "Example Studio is located at 12 Main Street.",
        verdict: "unverified",
        subject: "prospect",
        topic: "street_address",
        contradiction: {
          attribute: "address",
          engineValue: "12 Main Street",
          siteValue: "40 Oak Avenue",
        },
        engineQuote: "Example Studio is located at 12 Main Street",
        siteQuote: "Visit our studio at 40 Oak Avenue",
      }),
    ]);
    const h = headlineFinding(toReportView(report)).text;
    expect(h).toContain("on a topic we have not checked here. Ask us for it.");
    expect(h).not.toContain("Everything we can measure");
  });

  it("the same shape about another business is not a prospect contradiction", () => {
    const report = reportWith([
      row({
        claim: "Northwind Group has 10 employees.",
        verdict: "unverified",
        subject: "other",
        topic: "revenue_headcount",
        contradiction: { attribute: "employees", engineValue: "10", siteValue: "45" },
        engineQuote: "Northwind Group has 10 employees",
        siteQuote: "Our team of 45 designers",
      }),
    ]);
    expect(headlineFinding(toReportView(report)).text).not.toContain("Ask us for it.");
  });
});

describe("R4 fix 3: a mixed statement gets the mixed headline, and a withheld topic beats it", () => {
  const MIXED =
    "The assistant said something about you that your own site contradicts, in a sentence that also describes another business, so we have not repeated it here. Ask us for it.";
  const Q = "Example Studio was founded in 2001 with Southgate Outfitters as a partner";
  const prospect = row({
    claim: "Example Studio was founded in 2001.",
    verdict: "contradicted",
    engineQuote: Q,
    siteQuote: "Founded in 2022",
    subject: "prospect",
  });
  const other = row({
    claim: "Southgate Outfitters was founded in 2001.",
    engineQuote: Q,
    subject: "other",
  });

  it.each([
    ["other row first", [other, prospect]],
    ["prospect row first", [prospect, other]],
  ] as [string, Assertion[]][])("gives the mixed headline: %s", (_l, rows) => {
    expect(headlineFinding(toReportView(reportWith(rows))).text).toContain(MIXED);
  });

  it("a withheld topic gives the topic wording, not the mixed wording", () => {
    const topicRow = row({
      claim: "Example Studio has 10 employees.",
      verdict: "contradicted",
      engineQuote: "Example Studio has 10 employees",
      siteQuote: "a team of 45",
      subject: "prospect",
    });
    const h = headlineFinding(toReportView(reportWith([topicRow, other, prospect]))).text;
    expect(h).toContain("on a topic we have not checked here");
    expect(h).not.toContain("also describes another business");
  });
});

describe("R4 fix 4: the collision block does not print another firm's rating", () => {
  it.each([
    ["a comma", "Southgate Outfitters, a store rated 2.1 out of 5 on Glassdoor"],
    ["a dash", "Southgate Outfitters — rated 2.1 on Glassdoor"],
  ])("with %s after the name, the name prints and the rating does not", (_l, other) => {
    const report = reportWith(
      [
        row({
          claim: "Example Studio designs logos.",
          engineQuote: "Example Studio designs logos",
        }),
      ],
      { conflation: conflationOf([other]) },
    );
    for (const [, text] of surfaces(report)) {
      expect(text).toContain("Southgate Outfitters");
      expect(text).not.toContain("2.1");
      expect(text).not.toContain("Glassdoor");
    }
  });
});

describe("R4 fix 5: another firm's facts do not print as the client's", () => {
  it("R5 fix 1: a shortened other name does not make the client's sentence another firm's", () => {
    const report = withBusiness(
      reportWith(
        [
          row({
            claim: "Northwind sells screen printing.",
            engineQuote: "Northwind sells screen printing and embroidered uniforms",
          }),
        ],
        { conflation: conflationOf(["Northwind Outfitters (Austin)"]) },
      ),
      "Example Studio",
    );
    // R5 fix 1: "Northwind Outfitters" is not named in the quote, so the sentence
    // is the client's and prints. The single-word match this asserted is removed.
    for (const [, text] of surfaces(report)) {
      expect(text).toContain("Northwind sells screen printing and embroidered uniforms");
    }
  });

  it("an other name sharing the client's first word is kept, and matches on its full phrase", () => {
    const report = withBusiness(
      reportWith(
        [
          row({
            claim: "Northwind Partners sells screen printing.",
            engineQuote: "Northwind Partners sells screen printing and embroidered uniforms",
          }),
        ],
        { conflation: conflationOf(["Northwind Partners (Austin)"]) },
      ),
      "Northwind Studio",
    );
    for (const [, text] of surfaces(report)) {
      expect(text).not.toContain("Northwind Partners sells screen printing");
    }
  });

  it("the client's own sentence with that other name still prints", () => {
    const report = withBusiness(
      reportWith(
        [
          row({
            claim: "Northwind Studio designs logos.",
            engineQuote: "Northwind Studio designs logos",
          }),
        ],
        { conflation: conflationOf(["Northwind Partners (Austin)"]) },
      ),
      "Northwind Studio",
    );
    for (const [, text] of surfaces(report))
      expect(text).toContain("Northwind Studio designs logos");
  });

  it("a row with subject prospect that names the other firm stays the client's", () => {
    const report = withBusiness(
      reportWith(
        [
          row({
            claim: "Northwind Outfitters sells screen printing.",
            engineQuote: "Northwind Outfitters sells screen printing",
            subject: "prospect",
          }),
        ],
        { conflation: conflationOf(["Northwind Outfitters (Austin)"]) },
      ),
      "Example Studio",
    );
    for (const [, text] of surfaces(report))
      expect(text).toContain("Northwind Outfitters sells screen printing");
  });
});

describe("R4 fix 6: a contradiction with no site words is not printed as one", () => {
  it.each([
    ["a blank site quote", "  "],
    ["no site quote", null],
  ])("%s goes to the not-sourced list, not the contradictions", (_l, siteQuote) => {
    const quote = "Example Studio has a store in Denver";
    const report = reportWith([
      row({
        claim: "Example Studio has a store in Denver.",
        verdict: "contradicted",
        engineQuote: quote,
        siteQuote,
        subject: "prospect",
      }),
    ]);
    for (const [, text] of surfaces(report)) {
      expect(text).not.toContain("Your site says something different");
      expect(text).toContain("What the AI says about you");
      expect(text).toContain(quote);
    }
    expect(headlineFinding(toReportView(report)).text).not.toContain(
      "your own site says otherwise",
    );
  });
});

describe("R4 fix 7: a confirmed row with no site quote is still backed up", () => {
  it.each([
    ["a blank site quote", "   "],
    ["no site quote", null],
  ])("%s prints under what the site backs up, not not-sourced", (_l, siteQuote) => {
    const quote = "it has been open since 2012";
    const report = reportWith([
      row({ claim: "Open since 2012.", verdict: "confirmed", engineQuote: quote, siteQuote }),
    ]);
    for (const [, text] of surfaces(report)) {
      expect(text).toContain("What your site backs up");
      expect(text).toContain(quote);
      expect(text).not.toContain("What the AI says about you");
    }
  });
});

describe("R4 fix 8: the changes list never shows a claim for a hidden statement", () => {
  it("a sibling hide is labelled by the quote the page printed", () => {
    const raw = reportWith([
      row({
        claim: "Example Studio was founded in 2001.",
        engineQuote: "founded in 2001 in Denver",
      }),
      row({ claim: "Example Studio is in Denver.", engineQuote: "founded in 2001 in Denver" }),
      row({ claim: "Example Studio does branding work.", engineQuote: "it does branding work" }),
    ]);
    const map: OverrideMap = {
      "accuracy.data.assertions[1]": {
        original: "Example Studio is in Denver.",
        text: "",
        hidden: true,
      },
    };
    expect(changeList(map, [], hideTargets(raw, map))).toEqual([
      {
        key: "accuracy.data.assertions[1]",
        kind: "hidden",
        before: "founded in 2001 in Denver",
        after: "",
      },
    ]);
  });

  it("a hide on a withheld row shows its quote, not its claim, and Revert removes it", () => {
    const raw = reportWith([
      row({
        claim: "Example Studio has a 4.2 Google rating.",
        engineQuote: "Example Studio has a 4.2 Google rating",
      }),
    ]);
    const map: OverrideMap = {
      "accuracy.data.assertions[0]": {
        original: "Example Studio has a 4.2 Google rating.",
        text: "",
        hidden: true,
      },
    };
    const changes = changeList(map, [], hideTargets(raw, map));
    expect(changes).toEqual([
      {
        key: "accuracy.data.assertions[0]",
        kind: "hidden",
        before: "Example Studio has a 4.2 Google rating",
        after: "",
      },
    ]);
    expect(changes[0]!.before).not.toContain("Example Studio has a 4.2 Google rating.");
    const reverted: OverrideMap = {};
    expect(changeList(reverted, [], hideTargets(raw, reverted))).toEqual([]);
  });
});

describe("R4 fix 9: the branded-answers block is tested where a reader sees it", () => {
  it("a snippet with a rating is not printed", () => {
    const text = seen(
      renderText(branded, {
        probes: [
          brandedProbe(
            "who is Example Studio",
            "Example Studio was rated 4.2 out of 5 by employees.",
          ),
        ],
      }),
    );
    expect(text).not.toContain("rated 4.2");
  });

  it("a snippet under a reviews question is not printed", () => {
    const text = seen(
      renderText(branded, {
        probes: [
          brandedProbe("Example Studio reviews", "Example Studio is a well-liked design studio."),
        ],
      }),
    );
    expect(text).not.toContain("well-liked");
  });

  it("an ordinary snippet is printed", () => {
    const text = seen(
      renderText(branded, {
        probes: [
          brandedProbe("who is Example Studio", "Example Studio is a design studio in Denver."),
        ],
      }),
    );
    expect(text).toContain("Example Studio is a design studio in Denver.");
  });
});

describe("R4 fix 10: the test gaps that left fixes unpinned", () => {
  it("round 3 fix 9: a statement is keyed by the first row that has a claim", () => {
    const Q = "Example Studio opened a Denver office";
    const R = "Example Studio offers free consultations";
    const raw = reportWith([
      row({ claim: "", engineQuote: Q }),
      row({ claim: "y", engineQuote: Q }),
      row({ claim: "z", engineQuote: R }),
    ]);
    const targets = hideTargets(raw, {});
    expect(targets.find((t) => t.key === "accuracy.data.assertions[1]")).toMatchObject({
      original: "y",
    });
    expect(targets.find((t) => t.key === "accuracy.data.assertions[2]")).toMatchObject({
      original: "z",
    });
    expect(targets.some((t) => t.key === "accuracy.data.assertions[0]")).toBe(false);
  });

  it("the proof sentence needs a confirmed statement, not only an own-site citation", () => {
    const base = reportWith([
      row({
        claim: "Example Studio has a 4.2 Google rating.",
        verdict: "confirmed",
        engineQuote: "Example Studio has a 4.2 Google rating",
        siteQuote: "Rated 4.2 on Google",
      }),
    ]);
    const probes = ALL_PASS_REPORT.probes as unknown as { data: { answers: unknown[] } };
    const report = {
      ...base,
      probes: {
        ...probes,
        data: {
          ...probes.data,
          answers: [
            ...probes.data.answers,
            brandedProbe("who is Example Studio", "Example Studio is a design studio in Denver.", [
              "example-studio.test",
            ]),
          ],
        },
      },
    } as unknown as AuditReport;
    for (const [, text] of surfaces(report)) {
      expect(text).not.toContain("Zero statements");
      expect(text).not.toContain("That is the proof that editing your pages");
    }
  });
});

// ---------------------------------------------------------------------------
// Review round 5 (reddoorla/reddoor-website#380), fixes 1 to 8 of the fix brief.
// ---------------------------------------------------------------------------

const NO_QUOTE_LABEL = "A statement with no quote from the assistant";
// R6 fix 8: the label carries the question the statement answered (the row's query, default "who is Example Studio" in `row`).
const NO_QUOTE_LABEL_ASKED = `${NO_QUOTE_LABEL} (asked: who is Example Studio)`;
const PROOF = "That is the proof that editing your pages changes the answer";

describe("R5 fix 1: another firm's first word does not swallow the client's sentences", () => {
  it.each([
    ["Denver Print Works", "Example Studio was founded in Denver in 2001."],
    ["First Choice Plumbing", "Example Studio was founded in 2001, first in Denver."],
  ])(
    "a row with no subject, quoting a word of %s, stays the client's contradiction",
    (other, quote) => {
      const report = withBusiness(
        reportWith(
          [
            row({
              claim: "Example Studio was founded in 2001.",
              verdict: "contradicted",
              engineQuote: quote,
              siteQuote: "Founded in 2012",
            }),
          ],
          { conflation: conflationOf([other]) },
        ),
        "Example Studio",
      );
      expect(otherNamesOf(toReportView(report))).toEqual([other]);
      expect(headlineFinding(toReportView(report)).text).not.toContain("Everything we can measure");
      for (const [name, text] of surfaces(report)) {
        expect(text, name).toContain(quote);
        if (name === "the source-check section")
          expect(text).toContain("Your site says something different");
        else expect(text).toContain("your site says otherwise");
      }
    },
  );

  it("a row with no subject that quotes the whole other name is another firm's, and does not print", () => {
    const quote = "Denver Print Works has a studio downtown";
    const report = withBusiness(
      reportWith(
        [
          row({
            claim: "Denver Print Works has a studio downtown.",
            verdict: "contradicted",
            engineQuote: quote,
            siteQuote: "Founded in 2012",
          }),
        ],
        { conflation: conflationOf(["Denver Print Works"]) },
      ),
      "Example Studio",
    );
    for (const [, text] of surfaces(report)) expect(text).not.toContain(quote);
  });
});

describe("R5 fix 2: a statement about the client's founding is not read as one about a named person", () => {
  it("the contradiction prints as the client's, with the contradiction headline", () => {
    const quote = "Example Studio started in 2001";
    const report = reportWith([
      row({
        claim: "Example Studio started in 2001.",
        verdict: "contradicted",
        engineQuote: quote,
        siteQuote: "Founded in 2012",
      }),
    ]);
    const h = headlineFinding(toReportView(report)).text;
    expect(h).not.toContain("on a topic we have not checked");
    for (const [, text] of surfaces(report)) expect(text).toContain(quote);
  });

  it.each(["Example Studio was founded by Dana Reyes.", "Dana Reyes is the studio's founder."])(
    "control: %s stays withheld as a named person",
    (claim) => {
      expect(withheldTopic(row({ claim, engineQuote: claim }))).toBe("named_person");
    },
  );
});

describe("R5 fix 3: ratings on Google Maps and Google Business Profile are withheld", () => {
  it.each([
    "It holds a 4.8 on Google Business Profile.",
    "Rated 4.7 on Google Maps.",
    "It holds a 4.8 on Google Maps.",
  ])("withholds %s as a rating", (claim) => {
    expect(withheldTopic(row({ claim, engineQuote: claim }))).toBe("ratings_reviews");
  });

  it("control: Google Ads and Google Analytics 4 still print", () => {
    const claim = "We run Google Ads and Google Analytics 4 for clients.";
    expect(withheldTopic(row({ claim, engineQuote: claim }))).toBeNull();
  });
});

describe("R5 fix 4: the legal-form exemption applies only when no other topic is carried", () => {
  it.each([
    ["an owner", "Southgate Outfitters Inc., owned by Dana Reyes", "Southgate Outfitters Inc."],
    ["an address", "Southgate Outfitters LLC, 12 Main Street", "Southgate Outfitters LLC"],
    ["a headcount", "Southgate Outfitters Inc., with 40 employees", "Southgate Outfitters Inc."],
  ])("a name with %s is cut to the firm's name", (_l, other, printed) => {
    const report = reportWith(
      [
        row({
          claim: "Example Studio designs logos.",
          engineQuote: "Example Studio designs logos",
        }),
      ],
      { conflation: conflationOf([other]) },
    );
    for (const [, text] of surfaces(report)) {
      expect(text).toContain(printed);
      expect(text).not.toContain("Dana Reyes");
      expect(text).not.toContain("12 Main Street");
      expect(text).not.toContain("40 employees");
    }
  });

  it("control: a legal form alone still prints in full", () => {
    const report = reportWith(
      [
        row({
          claim: "Example Studio designs logos.",
          engineQuote: "Example Studio designs logos",
        }),
      ],
      { conflation: conflationOf(["Southgate Outfitters Inc."]) },
    );
    for (const [, text] of surfaces(report)) expect(text).toContain("Southgate Outfitters Inc.");
  });

  it("a name whose every cut still carries a topic prints as another business", () => {
    const report = reportWith(
      [
        row({
          claim: "Example Studio designs logos.",
          engineQuote: "Example Studio designs logos",
        }),
      ],
      { conflation: conflationOf(["Harbor Plumbing Glassdoor 3.4, complaints filed"]) },
    );
    for (const [, text] of surfaces(report)) {
      expect(text).toContain("another business");
      expect(text).not.toContain("Harbor Plumbing");
      expect(text).not.toContain("3.4");
    }
  });
});

describe("R5 fix 5: the proof sentence counts only confirmed statements that print a site passage", () => {
  const citing = (r: AuditReport): AuditReport => {
    const probes = structuredClone(allPass.probes);
    for (const a of probes.data.answers)
      if (a.kind === "branded") a.citedDomains = ["example-studio.test"];
    return { ...r, probes } as AuditReport;
  };
  const sectionText = (report: AuditReport): string =>
    seen(renderText(sourceCheck, { view: toReportView(report) }));

  it("is absent when the only confirmed statement has no site quote", () => {
    const report = citing(
      reportWith([
        row({
          claim: "Example Studio is based in Austin, Texas.",
          verdict: "confirmed",
          engineQuote: "based in Austin, Texas",
          siteQuote: null,
        }),
      ]),
    );
    expect(sectionText(report)).not.toContain(PROOF);
  });

  it("prints when the confirmed statement has a site quote (control), counting only those with one", () => {
    const report = citing(
      reportWith([
        row({
          claim: "Example Studio is based in Austin, Texas.",
          verdict: "confirmed",
          engineQuote: "based in Austin, Texas",
          siteQuote: "Based in Austin, Texas",
        }),
        row({
          claim: "Example Studio has a studio in Denver.",
          verdict: "confirmed",
          engineQuote: "a studio in Denver",
          siteQuote: "",
        }),
      ]),
    );
    const text = sectionText(report);
    expect(text).toContain(PROOF);
    expect(text).toContain("One statement the assistant made matches a passage on your own site");
  });
});

describe("R5 fix 6: a hidden statement with no quote is labelled by a fixed phrase", () => {
  it("the target list and the changes list show the fixed phrase, never the claim", () => {
    const raw = reportWith([
      row({ claim: "Example Studio opened a Denver office.", engineQuote: "" }),
    ]);
    const map: OverrideMap = {
      "accuracy.data.assertions[0]": {
        original: "Example Studio opened a Denver office.",
        text: "",
        hidden: true,
      },
    };
    const targets = hideTargets(raw, map);
    expect(targets.find((t) => t.key === "accuracy.data.assertions[0]")).toMatchObject({
      label: NO_QUOTE_LABEL_ASKED,
      hidden: true,
    });
    expect(changeList(map, [], targets)).toEqual([
      {
        key: "accuracy.data.assertions[0]",
        kind: "hidden",
        before: NO_QUOTE_LABEL_ASKED,
        after: "",
      },
    ]);
  });

  it("control: a quoted statement keeps its quote as its label", () => {
    const raw = reportWith([
      row({ claim: "Example Studio has an office in Denver.", engineQuote: "an office in Denver" }),
    ]);
    const map: OverrideMap = {
      "accuracy.data.assertions[0]": {
        original: "Example Studio has an office in Denver.",
        text: "",
        hidden: true,
      },
    };
    expect(
      hideTargets(raw, map).find((t) => t.key === "accuracy.data.assertions[0]"),
    ).toMatchObject({ label: "“an office in Denver”" });
  });
});

describe("R5 fix 7: the round-4 fix parts that no test pinned", () => {
  it("the Google exclusion: a figure after Google Ads is not a rating", () => {
    const claim = "Google Ads brought 4.2 times more leads";
    expect(withheldTopic(row({ claim, engineQuote: claim }))).toBeNull();
  });

  it("the Indeed rules: a mid-sentence Indeed with a figure, or an Indeed rating, is withheld", () => {
    expect(
      withheldTopic(
        row({
          claim: "Indeed, the studio has grown.",
          engineQuote: "Indeed, the studio has grown.",
        }),
      ),
    ).toBeNull();
    for (const claim of [
      "Rated 3.1 on Indeed",
      "Indeed reviews average 3.4",
      "Its Indeed page shows 3.1",
    ])
      // The claim ends in a colon, so the quote's "Indeed" is not read through the
      // mid-sentence rule: each rule is tested on its own.
      expect(withheldTopic(row({ claim: "Its listing says:", engineQuote: claim })), claim).toBe(
        "ratings_reviews",
      );
  });

  it("an unverified row with no contradiction is not a prospect contradiction", () => {
    const report = reportWith([
      row({
        claim: "Example Studio has 10 employees.",
        verdict: "unverified",
        subject: "prospect",
        topic: "revenue_headcount",
        engineQuote: "Example Studio has 10 employees",
        siteQuote: "Our team of 45 designers",
      }),
    ]);
    expect(headlineFinding(toReportView(report)).text).not.toContain(
      "on a topic we have not checked here. Ask us for it.",
    );
  });
});

// ---------------------------------------------------------------------------
// Review round 6 (reddoorla/reddoor-website#380), fixes 1 to 8 of the fix brief.
// ---------------------------------------------------------------------------

describe("R6 fix 1: What passes counts only the confirmed statements that print a passage", () => {
  const withPassage = row({
    claim: "Example Studio is in Austin.",
    verdict: "confirmed",
    engineQuote: "Example Studio is in Austin",
    siteQuote: "Our studio in Austin",
  });
  const noPassage = row({
    claim: "Example Studio designs packaging.",
    verdict: "confirmed",
    engineQuote: "Example Studio designs packaging",
    siteQuote: "",
  });
  const passLines = (report: AuditReport): string[] => {
    const ai = passes(toReportView(report)).find((g) => g.title === "What AI is saying about you");
    return ai?.items ?? [];
  };
  // WhatPasses renders `passes(view)` as it is, so the line is pinned on the data
  // it prints and on the print sheet's own "What passes" (the SSR harness cannot
  // compile WhatPasses, which imports ReportDisclosure).
  const passSurfaces = surfaces;

  it("two confirmed rows, one with no passage: the line counts the one with a passage, and the verb agrees", () => {
    const report = reportWith([withPassage, noPassage]);
    expect(passLines(report)[0]).toBe(
      "One statement the assistant made matches a passage on your own site",
    );
    for (const [name, text] of passSurfaces(report)) {
      expect(text, name).toContain("One statement the assistant made matches a passage");
      expect(text, name).not.toContain("Two statements");
    }
  });

  it("two confirmed rows, both with a passage: the plural verb", () => {
    const report = reportWith([
      withPassage,
      row({
        claim: "Example Studio has a studio in Denver.",
        verdict: "confirmed",
        engineQuote: "Example Studio has a studio in Denver",
        siteQuote: "Denver studio",
      }),
    ]);
    expect(passLines(report)[0]).toBe(
      "Two statements the assistant made match a passage on your own site",
    );
    for (const [name, text] of passSurfaces(report))
      expect(text, name).toContain("Two statements the assistant made match a passage");
  });

  it("only a confirmed row with no passage: the passage line does not print", () => {
    const report = reportWith([noPassage]);
    expect(passLines(report).join(" ")).not.toContain("passage on your own site");
    for (const [name, text] of passSurfaces(report))
      expect(text, name).not.toContain("passage on your own site");
  });
});

describe("R6 fix 2: 'named' needs a person noun before it", () => {
  it("a no-topic contradiction 'was named Denver's Best Design Studio' prints as the client's", () => {
    const quote = "Example Studio was named Denver's Best Design Studio in 2019";
    const report = reportWith([
      row({
        claim: "Example Studio was named Denver's Best Design Studio in 2019.",
        verdict: "contradicted",
        engineQuote: quote,
        siteQuote: "Named Best Studio by Westword in 2021",
      }),
    ]);
    expect(headlineFinding(toReportView(report)).text).not.toContain(
      "on a topic we have not checked",
    );
    for (const [, text] of surfaces(report)) expect(text).toContain(quote);
  });

  it("control: 'A man named Tim leads Acme.' stays withheld as a named person", () => {
    const claim = "A man named Tim leads Acme.";
    expect(withheldTopic(row({ claim, engineQuote: claim }))).toBe("named_person");
  });
});

describe("R6 fix 3: the person verb pattern is back, without 'started' and 'own'", () => {
  it.each([
    "Dana Reyes founded the studio in 2012.",
    "Dana Reyes runs the studio with Sam Ortiz.",
    "Northwind Holdings owns Example Studio.",
  ])("withholds %s as a named person, with no all-clear headline", (claim) => {
    expect(withheldTopic(row({ claim, engineQuote: claim }))).toBe("named_person");
    const report = reportWith([
      row({ claim, verdict: "contradicted", engineQuote: claim, siteQuote: "Founded in 2012" }),
    ]);
    expect(headlineFinding(toReportView(report)).text).not.toContain("Everything we can measure");
    for (const [, text] of surfaces(report)) expect(text).not.toContain(claim);
  });

  it("control: 'Example Studio started in 2001' against 'Founded in 2012' still prints as a contradiction", () => {
    const quote = "Example Studio started in 2001";
    const report = reportWith([
      row({
        claim: "Example Studio started in 2001.",
        verdict: "contradicted",
        engineQuote: quote,
        siteQuote: "Founded in 2012",
      }),
    ]);
    for (const [, text] of surfaces(report)) expect(text).toContain(quote);
  });
});

describe("R6 fix 4: the 'most likely match' hedge keeps a row about another business", () => {
  const hedged = "Most likely match: Northwind Bakery, a bakery in Lakeside";
  const report = reportWith([
    row({
      claim: "The business is a bakery in Lakeside.",
      verdict: "contradicted",
      engineQuote: hedged,
      siteQuote: "Founded in 2012",
    }),
  ]);

  it("the row is absent from the client's list on both surfaces", () => {
    for (const [name, text] of surfaces(report))
      expect(text, name).not.toContain("Most likely match");
  });
});

describe("R6 fix 6: a contradiction with subject 'unclear' is held, not filed as another business's", () => {
  const quote = "Example Studio was founded in 2001";
  const unclear = (over: Partial<Assertion>) =>
    reportWith([
      row({
        claim: "Example Studio was founded in 2001.",
        engineQuote: quote,
        siteQuote: "Founded in 2012",
        subject: "unclear",
        ...over,
      }),
    ]);

  it.each([
    ["a contradicted row", { verdict: "contradicted" as const }],
    [
      "an unverified row with a contradiction",
      {
        verdict: "unverified" as const,
        contradiction: { attribute: "founded", engineValue: "2001", siteValue: "2012" },
      },
    ],
  ])("%s gives the withheld-contradiction headline, and its quote does not print", (_l, over) => {
    const report = unclear(over);
    const h = headlineFinding(toReportView(report));
    expect(h.kind).toBe("withheld-contradiction");
    expect(h.text).toContain("on a topic we have not checked here. Ask us for it.");
    for (const [name, text] of surfaces(report)) expect(text, name).not.toContain(quote);
  });

  it("control: the same row with subject 'other' keeps today's behaviour (not held)", () => {
    const report = unclear({ verdict: "contradicted", subject: "other" });
    expect(headlineFinding(toReportView(report)).kind).not.toBe("withheld-contradiction");
    for (const [, text] of surfaces(report)) expect(text).not.toContain(quote);
  });
});

describe("R6 fix 7: the bounded patterns keep their positive cases", () => {
  it.each([
    ["37 reviews on Yelp", "ratings_reviews"],
    ["Example Studio, Inc.", "legal_entity"],
    ["40 employees", "revenue_headcount"],
  ])("%s is still withheld as %s", (claim, topic) => {
    expect(withheldTopic(row({ claim, engineQuote: claim }))).toBe(topic);
  });
});

describe("R6 fix 8: the minor pins", () => {
  it("containsOwn: 'Example Studio Denver' is this business's own name, not another firm", () => {
    const report = withBusiness(
      reportWith([], { conflation: conflationOf(["Example Studio Denver"]) }),
      "Example Studio",
    );
    expect(otherNamesOf(toReportView(report))).toEqual([]);
  });

  it("the Google Analytics exclusion: a figure after Google Analytics is not a rating", () => {
    const claim = "Google Analytics shows 4.2 sessions per visit.";
    expect(withheldTopic(row({ claim, engineQuote: claim }))).toBeNull();
  });

  it("two no-quote hides carry labels that say which question each answered", () => {
    const raw = reportWith([
      row({
        claim: "Example Studio opened a Denver office.",
        engineQuote: "",
        query: "best firm in Denver",
      }),
      row({
        claim: "Example Studio opened an Austin office.",
        engineQuote: "",
        query: "best firm in Austin",
      }),
    ]);
    const map: OverrideMap = {
      "accuracy.data.assertions[0]": {
        original: "Example Studio opened a Denver office.",
        text: "",
        hidden: true,
      },
      "accuracy.data.assertions[1]": {
        original: "Example Studio opened an Austin office.",
        text: "",
        hidden: true,
      },
    };
    const labels = hideTargets(raw, map).map((t) => t.label);
    expect(labels).toContain(`${NO_QUOTE_LABEL} (asked: best firm in Denver)`);
    expect(labels).toContain(`${NO_QUOTE_LABEL} (asked: best firm in Austin)`);
    for (const l of labels)
      if (typeof l === "string") expect(l).not.toContain("Example Studio opened");
  });

  it("a legal-form name that ends in a full stop does not print a doubled full stop", () => {
    const report = reportWith(
      [
        row({
          claim: "Example Studio designs logos.",
          engineQuote: "Example Studio designs logos",
        }),
      ],
      { conflation: conflationOf(["Southgate Outfitters Inc."]) },
    );
    for (const [name, text] of surfaces(report)) {
      expect(text, name).toContain("Southgate Outfitters Inc.");
      expect(text, name).not.toContain("Inc..");
    }
  });
});
