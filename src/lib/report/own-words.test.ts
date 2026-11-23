import { describe, it, expect } from "vitest";
import { ssr, renderText } from "./ssr-test-harness";
import { ALL_PASS_REPORT } from "./fixtures/all-pass";
import type { AuditReport, OverrideMap } from "./fetch";
import { brandedExcerpt, toReportView, withheldTopic, type Assertion } from "./model";
import { headlineFinding } from "./narrative";
import { editableTargets } from "./editable";

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
 *  sitemap so an `absent` can stand. */
function reportWith(assertions: Assertion[], over: Partial<Data> = {}): AuditReport {
  const pages = allPass.accuracy.data.pagesRead as number;
  return {
    ...ALL_PASS_REPORT,
    crawl: {
      ok: true,
      data: { ...allPass.crawl.data, sitemap: { present: true, urlCount: pages } },
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
        data: { ...allPass.crawl.data, sitemap: { present: true, urlCount: 95 } },
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
