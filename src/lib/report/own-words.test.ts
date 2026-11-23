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
