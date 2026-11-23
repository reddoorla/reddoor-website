import { describe, expect, it, vi } from "vitest";
import type { Component } from "svelte";
import { ssr, renderText } from "../ssr-test-harness";
import { TECHNICAL_REPORT } from "../fixtures/technical";
import {
  toTechnicalView,
  dmarcState,
  isDeliberatelyHidden,
  printableUrl,
  type TechnicalView,
} from "./model";
import { readReleaseLines } from "./release-lines";
import type { AuditReport } from "../fetch";

// W4, the Technical report. Every assertion here is about what a reader of the
// page sees, rendered through the real component.

// The unit config has no Svelte plugin, so a component the report imports is
// compiled by the same harness as the report.
vi.mock("$lib/components/ContentWidth/ContentWidth.svelte", async () => ({
  default: await ssr("src/lib/components/ContentWidth/ContentWidth.svelte"),
}));

const TODAY = new Date("2026-11-23T12:00:00Z");
type Props = { view: TechnicalView; reference: string | null };
const component = (): Promise<Component<Props>> =>
  ssr<Props>("src/lib/report/technical/TechnicalReport.svelte");

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const pageText = async (row: Record<string, unknown>) =>
  renderText(await component(), { view: toTechnicalView(row, TODAY), reference: "0a1b2c3d" });

/** The fixture with every stage a model wrote, or a paid call produced, deleted. */
const withoutPaidStages = () => {
  const row = clone(TECHNICAL_REPORT) as Record<string, unknown>;
  for (const k of ["analyze", "probes", "accuracy", "goalFit"]) delete row[k];
  return row;
};

describe("the Technical report prints no model output", () => {
  it("renders the identical page when every paid stage is deleted", async () => {
    expect(await pageText(withoutPaidStages())).toBe(await pageText(TECHNICAL_REPORT));
  });

  it("CONTROL: a change to a stage it does read does change the page", async () => {
    const row = clone(TECHNICAL_REPORT) as { dns: { data: { dmarc: string } } };
    row.dns.data.dmarc = "v=DMARC1; p=reject";
    expect(await pageText(row)).not.toBe(await pageText(TECHNICAL_REPORT));
  });
});

describe("no version string reaches the page", () => {
  it("names the server and its release line, never the build", async () => {
    const text = await pageText(TECHNICAL_REPORT);
    expect(text).toContain("Apache");
    expect(text).toContain("a 2016 long-term release line of Ubuntu");
    for (const version of ["2.4.18", "6.4.2", "5.9.3"]) expect(text).not.toContain(version);
    expect(text).not.toMatch(/\b\d+\.\d+\.\d+\b/);
  });
});

describe("the wording the legal lens allows", () => {
  it("never says what anyone can do, or calls the site vulnerable, insecure or an ADA matter", async () => {
    const text = await pageText(TECHNICAL_REPORT);
    expect(text).not.toMatch(/\banyone can\b|vulnerab|\binsecure\b|\bADA\b|hack/i);
  });

  it("says what it is not", async () => {
    const text = await pageText(TECHNICAL_REPORT);
    expect(text).toContain("not a security assessment or penetration test");
    expect(text).toContain("not a compliance assessment");
    expect(text).toContain("no timing measured");
  });
});

describe("the first screen", () => {
  const view = toTechnicalView(TECHNICAL_REPORT, TODAY);

  it("names the platform without counting HubSpot's banner as a CMS", () => {
    expect(view.runningOn).toBe("a WordPress site on an Apache server");
    const cms = view.sections.running.items.find((i) => i.layer === "cms");
    expect(cms?.names).toEqual(["WordPress"]);
    expect(view.sections.running.items.find((i) => i.layer === "analytics")?.names).toContain(
      "HubSpot tracking",
    );
  });

  it("reports the {{url}} link as broken now, and nothing else as broken", () => {
    expect(view.broken.map((f) => f.id)).toEqual(["template-leakage"]);
    expect(view.nothingBroken).toBe(false);
  });

  it("puts the old server line, the heavy photo and watch-only DMARC under attention", () => {
    expect(view.attention.map((f) => f.id).sort()).toEqual(
      ["dmarc", "heavy-image", "release-server"].sort(),
    );
  });

  it("keeps five to three repairs in order for what to fix first", () => {
    expect(view.fixFirst.length).toBeGreaterThanOrEqual(3);
    expect(view.fixFirst.length).toBeLessThanOrEqual(5);
    expect(view.fixFirst[0]!.id).toBe("template-leakage");
  });

  it("says nothing is broken when nothing is", () => {
    const row = clone(TECHNICAL_REPORT) as {
      crawl: { data: { pages: { rendered: { anchors: unknown[] } }[] } };
    };
    for (const p of row.crawl.data.pages) p.rendered.anchors = [];
    const clean = toTechnicalView(row, TODAY);
    expect(clean.nothingBroken).toBe(true);
    expect(clean.broken).toEqual([]);
  });

  it("sends both buttons to the scheduler with the report's reference", async () => {
    const { render } = await import("svelte/server");
    const html = render(await component(), {
      props: { view: toTechnicalView(TECHNICAL_REPORT, TODAY), reference: "0a1b2c3d" },
    }).body;
    const hrefs = [...html.matchAll(/href="([^"]*schedule[^"]*)"/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThan(0);
    for (const h of hrefs) expect(h).toBe("/schedule?ref=technical-0a1b2c3d");
  });
});

describe("findings re-derived from raw fields, not the stored verdict", () => {
  it("reads DMARC in three states", () => {
    expect(dmarcState(null)).toBe("missing");
    expect(dmarcState("v=DMARC1; p=none; sp=reject")).toBe("monitoring");
    expect(dmarcState("v=DMARC1; p=quarantine")).toBe("enforcing");
  });

  it("does not report a privacy page hidden on purpose", () => {
    expect(
      isDeliberatelyHidden("https://harbordentalandorthodonticsofsouthbay.example/privacy"),
    ).toBe(true);
    expect(
      isDeliberatelyHidden("https://harbordentalandorthodonticsofsouthbay.example/services"),
    ).toBe(false);
    expect(toTechnicalView(TECHNICAL_REPORT, TODAY).fixFirst.map((f) => f.id)).not.toContain(
      "noindex",
    );
  });

  it("does report a services page that asks to be hidden", () => {
    const row = clone(TECHNICAL_REPORT) as {
      crawl: { data: { pages: { rendered: { metas: Record<string, string> } }[] } };
    };
    row.crawl.data.pages[1]!.rendered.metas = { robots: "noindex" };
    expect(toTechnicalView(row, TODAY).broken.map((f) => f.id)).toContain("noindex");
  });

  it("does not print a missing DNS record from before the resolver was proven", () => {
    const row = clone(TECHNICAL_REPORT) as {
      generatedAt: string;
      dns: { data: { spf: string | null; dmarc: string | null } };
    };
    row.generatedAt = "2026-10-19T20:19:46.823Z";
    row.dns.data.spf = null;
    row.dns.data.dmarc = null;
    const view = toTechnicalView(row, TODAY);
    expect(view.sections.email.every((r) => r.ok === null || r.label.startsWith("A mail"))).toBe(
      true,
    );
    expect(view.fixFirst.map((f) => f.id)).not.toContain("spf");
    expect(view.fixFirst.map((f) => f.id)).not.toContain("dmarc");
  });
});

describe("a row crawled before the browser fixes", () => {
  const old = () => {
    const row = clone(TECHNICAL_REPORT) as {
      crawl: { data: { pages: { vitals: Record<string, unknown> }[] } };
    };
    for (const p of row.crawl.data.pages) delete p.vitals.scriptErrors;
    return row;
  };

  it("does not print its accessibility scan", () => {
    expect(toTechnicalView(old(), TODAY).sections.access.state).toBe("needs-fresh-scan");
  });

  it("does not turn its console messages into script errors", () => {
    const scripts = toTechnicalView(old(), TODAY).sections.brokenThings.find(
      (r) => r.label === "Scripts",
    );
    expect(scripts?.ok).toBeNull();
  });

  it("CONTROL: the current-shape fixture's scan is printed", () => {
    expect(toTechnicalView(TECHNICAL_REPORT, TODAY).sections.access.state).toBe("measured");
  });
});

describe("the release-line table is read at render time", () => {
  it("calls a line unsupported only after its end date", () => {
    const h = { server: "Apache/2.4.52 (Ubuntu)" };
    expect(readReleaseLines(h, new Date("2027-06-01T00:00:00Z"))[0]?.unsupported).toBe(false);
    expect(readReleaseLines(h, new Date("2027-07-01T00:00:00Z"))[0]?.unsupported).toBe(true);
  });

  it("says nothing about a server it has no row for", () => {
    expect(readReleaseLines({ server: "nginx" }, TODAY)).toEqual([]);
  });
});

describe("the not-found check, read apart", () => {
  type NF = {
    basics: {
      data: { notFound: { status: number | null; ok: boolean; linksBackToSite: boolean } };
    };
  };
  const withNotFound = (status: number | null, linksBackToSite: boolean) => {
    const row = clone(TECHNICAL_REPORT) as unknown as NF;
    row.basics.data.notFound = { ...row.basics.data.notFound, status, linksBackToSite, ok: false };
    return toTechnicalView(row as unknown as Record<string, unknown>, TODAY);
  };

  it("does not say a 404 fails to answer as not found when only the link home is missing", () => {
    const view = withNotFound(404, false);
    const row = view.sections.address.find((r) => r.label === "A page that does not exist");
    expect(row?.text).toContain("answers as not found");
    expect(view.attention.map((f) => f.id)).not.toContain("not-found");
    expect(view.housekeeping.map((f) => f.id)).toContain("not-found-dead-end");
  });

  it("does report an address that answers 200", () => {
    const view = withNotFound(200, true);
    const row = view.sections.address.find((r) => r.label === "A page that does not exist");
    expect(row).toMatchObject({ ok: false, text: "does not answer as not found" });
  });
});

describe("the domain row is read against the render date", () => {
  it("does not present a passed registration date as time in hand", () => {
    const later = toTechnicalView(TECHNICAL_REPORT, new Date("2027-05-01T00:00:00Z"));
    expect(later.sections.domain?.text).toContain("has now passed");
    expect(toTechnicalView(TECHNICAL_REPORT, TODAY).sections.domain?.text).not.toContain("passed");
  });
});

describe("W4 review round 1", () => {
  type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const row = () => clone(TECHNICAL_REPORT) as Any;

  it("never prints a ?ver= version from an evidence address", async () => {
    const r = row();
    r.crawl.data.pages[0].vitals.failedRequests = [
      {
        url: "https://x.example/wp-includes/js/jquery/jquery.min.js?ver=3.7.1",
        status: 404,
        firstParty: true,
      },
    ];
    expect(printableUrl("https://x.example/a.js?ver=6.4.2&x=1")).toBe("https://x.example/a.js?x=1");
    const text = await pageText(r);
    expect(text).toContain("jquery.min.js");
    expect(text).not.toContain("3.7.1");
  });

  it("does not call a 403 or a missing answer a soft 404", () => {
    for (const status of [403, 503, null]) {
      const r = row();
      r.basics.data.notFound.status = status;
      r.basics.data.notFound.ok = false;
      const view = toTechnicalView(r, TODAY);
      expect([...view.attention, ...view.more, ...view.fixFirst].map((f) => f.id)).not.toContain(
        "not-found",
      );
    }
  });

  it("makes no all-clear when the scan did not complete", () => {
    const r = row();
    r.assets = { ok: false, error: "timed out" };
    r.basics = { ok: false, error: "timed out" };
    r.crawl.data.pages[1].rendered.anchors = [];
    const view = toTechnicalView(r, TODAY);
    expect(view.incomplete).toBe(true);
    expect(view.nothingBroken).toBe(false);
  });

  it("counts every failing accessibility rule, not only the stored list", () => {
    const r = row();
    r.accessibility.data.violationsTotal = 14;
    const access = toTechnicalView(r, TODAY).sections.access;
    expect(access.state === "measured" && access.rulesFailed).toBe(14);
  });

  it("drops no weighty finding past the first screen", () => {
    const r = row();
    r.dns.data.spf = null;
    r.basics.data.mixedContent.imageUrls = ["http://x.example/a.jpg"];
    r.crawl.data.homeHeaders = { server: "Apache/2.4.18 (Ubuntu)" };
    const view = toTechnicalView(r, TODAY);
    const all = new Set(
      [...view.broken, ...view.attention, ...view.fixFirst, ...view.more].map((f) => f.id),
    );
    for (const id of ["dmarc", "spf", "mixed-content", "hsts", "heavy-image", "release-server"]) {
      expect(all, id).toContain(id);
    }
  });

  it("is not taken down by a malformed paid stage", () => {
    const r = row();
    r.analyze = { ok: true, data: { fixes: "not an array" } };
    r.probes = { ok: true, data: { answers: 7 } };
    expect(() => toTechnicalView(r, TODAY)).not.toThrow();
  });

  it("names a CDN as what the site sits behind, not its server", () => {
    const r = row();
    r.crawl.data.homeHeaders = { server: "cloudflare" };
    expect(toTechnicalView(r, TODAY).runningOn).toBe("a WordPress site behind cloudflare");
  });
});

describe("W4 review round 2", () => {
  type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const row = () => clone(TECHNICAL_REPORT) as Any;
  const rowText = (view: TechnicalView, label: string) =>
    [...view.sections.address, ...view.sections.brokenThings].find((r) => r.label === label)?.text;

  it("does not say every link answered when the {{ link came back missing", () => {
    const r = row();
    r.assets.data.brokenLinks = [
      { url: "https://x.example/{{url}}", status: 404, bytes: null, error: null, referencedBy: [] },
    ];
    const view = toTechnicalView(r, TODAY);
    expect(rowText(view, "Links on your pages")).toBe("1 of the 60 we tested came back missing");
    expect(view.broken.map((f) => f.id)).not.toContain("broken-links");
  });

  it("counts one file that fails on every page once", () => {
    const r = row();
    for (const p of r.crawl.data.pages)
      p.vitals.failedRequests = [
        {
          url: "https://x.example/wp-content/themes/x/fonts/a.woff2",
          status: 404,
          firstParty: true,
        },
      ];
    const f = toTechnicalView(r, TODAY).broken.find((x) => x.id === "failed-requests");
    expect(f?.text).toMatch(/^1 file /);
  });

  it("does not claim what a phone downloads", () => {
    const f = toTechnicalView(row(), TODAY).attention.find((x) => x.id === "heavy-image");
    expect(f?.text).not.toMatch(/phone/);
  });

  it("does not call a 403 to a made-up address a not-found page", () => {
    const r = row();
    r.basics.data.notFound.status = 403;
    r.basics.data.notFound.linksBackToSite = true;
    const view = toTechnicalView(r, TODAY);
    const nf = view.sections.address.find((x) => x.label === "A page that does not exist");
    expect(nf?.text).toContain("could not judge");
    expect(nf?.ok).toBeNull();
  });

  it("only says forged mail is reported when the record sets rua=", () => {
    const r = row();
    r.dns.data.dmarc = "v=DMARC1; p=none";
    const f = toTechnicalView(r, TODAY).attention.find((x) => x.id === "dmarc");
    expect(f?.text).not.toContain("reported to you");
    expect(f?.text).toContain("no report address is set");
  });

  it("strips a version from a file name too", () => {
    expect(printableUrl("https://x.example/js/jquery-1.12.4.min.js")).toBe(
      "https://x.example/js/jquery.min.js",
    );
  });

  it("reads a bare `all` in SPF as allowing any server", () => {
    const r = row();
    r.dns.data.spf = "v=spf1 include:_spf.mail.example all";
    const spf = toTechnicalView(r, TODAY).sections.email.find((x) => x.label.startsWith("SPF"));
    expect(spf?.ok).toBe(false);
  });
});

describe("W4 review round 3", () => {
  type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const row = () => clone(TECHNICAL_REPORT) as Any;
  const proven = (r: Any) => {
    r.dns.data.mx = [];
    r.checks.data.consistency = { emails: [{ normalized: "info@elsewhere.example" }] };
    return r;
  };

  it("puts a missing mail server under broken now when the site publishes an address at its own domain", () => {
    const r = proven(row());
    r.checks.data.consistency.emails.push({
      normalized: "hello@harbordentalandorthodonticsofsouthbay.example",
    });
    expect(toTechnicalView(r, TODAY).broken.map((f) => f.id)).toContain("mx");
  });

  it("CONTROL: not when every published address is elsewhere", () => {
    const view = toTechnicalView(proven(row()), TODAY);
    expect(view.broken.map((f) => f.id)).not.toContain("mx");
  });

  it("says standard support ended, never that all support did", () => {
    const f = toTechnicalView(row(), TODAY).attention.find((x) => x.id === "release-server");
    expect(f?.text).toContain("ended standard support");
  });

  it("does not quote +all when the record says all", () => {
    const r = row();
    r.dns.data.spf = "v=spf1 include:_spf.mail.example all";
    const f = toTechnicalView(r, TODAY)
      .fixFirst.concat(toTechnicalView(r, TODAY).more)
      .find((x) => x.id === "spf");
    expect(f?.text).not.toContain("+all");
  });

  it("strips versions from directories, and keeps a video id", () => {
    expect(
      printableUrl(
        "https://x.example/wp-content/themes/t/vendor/bootstrap-4.6.0/js/bootstrap.min.js",
      ),
    ).toBe("https://x.example/wp-content/themes/t/vendor/bootstrap/js/bootstrap.min.js");
    expect(printableUrl("https://x.example/js/jquery-ui-1.12.1.custom.min.js")).toBe(
      "https://x.example/js/jquery-ui.custom.min.js",
    );
    expect(printableUrl("https://www.youtube.com/watch?v=abc123")).toBe(
      "https://www.youtube.com/watch?v=abc123",
    );
  });
});

describe("W4 review round 4: printableUrl leaves ordinary addresses alone", () => {
  it.each([
    "https://x.example/wp-content/uploads/2023/05/Screenshot-2023-05-01-at-10.30.45.png",
    "https://x.example/wp-content/uploads/2023/05/Brochure-v1.2.pdf",
    "https://x.example/wp-content/uploads/Dr.-Smith-2.0.jpg",
    "https://x.example/blog/whats-new-in-wordpress-6.4/",
    "https://x.example/events/gala-10.30.2024/",
  ])("%s is printed as it is", (url) => {
    expect(printableUrl(url)).toBe(url);
  });

  it.each([
    [
      "https://cdnjs.example/ajax/libs/jquery/3.6.0/jquery.min.js",
      "https://cdnjs.example/ajax/libs/jquery/jquery.min.js",
    ],
    ["https://x.example/lib/jquery-3.6.0-min.js", "https://x.example/lib/jquery-min.js"],
    ["/relative/jquery-1.2.3.js?ver=1", "/relative/jquery.js"],
  ])("strips the version from the asset %s", (url, want) => {
    expect(printableUrl(url)).toBe(want);
  });
});

describe("W4 review round 5: a font carries its version too", () => {
  it("strips the version from a theme's font address", () => {
    expect(
      printableUrl(
        "https://site.example/wp-content/themes/t/font-awesome-4.7.0/fonts/fontawesome-webfont.woff2?v=4.7.0",
      ),
    ).toBe("https://site.example/wp-content/themes/t/font-awesome/fonts/fontawesome-webfont.woff2");
  });
});

describe("what we read says what W3's report says", () => {
  const crawlOf = (row: Record<string, unknown>) =>
    (row.crawl as { data: Record<string, unknown> }).data;
  const readLine = async (row: Record<string, unknown>) => {
    const text = await pageText(row);
    return text.slice(text.indexOf("What we read"));
  };

  it("states the pages read against the sitemap's complete count", async () => {
    const line = await readLine(clone(TECHNICAL_REPORT) as Record<string, unknown>);
    expect(line).toContain("We read five of your 41 pages.");
    expect(line).not.toContain("sitemap lists");
  });

  it("a truncated sitemap is a floor, never 'your pages'", async () => {
    const row = clone(TECHNICAL_REPORT) as Record<string, unknown>;
    crawlOf(row).sitemap = { present: true, urlCount: 50000, truncated: true };
    const line = await readLine(row);
    expect(line).toContain("We read five of at least 50,000 pages on your site.");
    expect(line).not.toMatch(/of your 50,000/);
  });

  it("with no sitemap, the count is the pages linked from the home page", async () => {
    const row = clone(TECHNICAL_REPORT) as Record<string, unknown>;
    crawlOf(row).sitemap = { present: false };
    crawlOf(row).selection = { pagesConsidered: 9 };
    const line = await readLine(row);
    expect(line).toContain("We read five of the nine pages we found linked from your home page.");
    expect(line).not.toContain("of your");
  });

  it("lists only the pages that came back, and says so when none did", async () => {
    const row = clone(TECHNICAL_REPORT) as Record<string, unknown>;
    const pages = crawlOf(row).pages as Record<string, unknown>[];
    pages[2]!.rendered = null;
    pages[2]!.raw = null;
    pages[2]!.status = null;
    const some = await readLine(row);
    expect(some).toContain("We read four of your 41 pages.");
    expect(some).not.toContain("/about");

    for (const p of pages) {
      p.rendered = null;
      p.raw = null;
    }
    expect(await readLine(row)).toContain("We could not read any of your pages.");
  });
});

/** The fields the post-rebase tests change, typed loosely enough to write. */
type Loose = {
  url: string;
  crawl: { data: { pages: { rendered: { anchors: unknown[] } }[] } };
  http: { data: Record<string, unknown> };
};

describe("review after the rebase", () => {
  it("a hidden site check takes its finding and its row off the Technical page", async () => {
    const hidden = new Set(["header-version-leak", "external-links-live"]);
    const row = clone(TECHNICAL_REPORT) as unknown as Loose;
    row.http.data.externalLinks = {
      checked: 15,
      total: 15,
      broken: [{ url: "https://partner.example/gone" }],
    };
    const shown = await pageText(row as unknown as Record<string, unknown>);
    expect(shown).toContain("Software version in headers");
    expect(shown).toContain("Links to other sites");
    const text = renderText(await component(), {
      view: toTechnicalView(row as unknown as AuditReport, TODAY, hidden),
      reference: "0a1b2c3d",
    });
    expect(text).not.toContain("Software version in headers");
    expect(text).not.toContain("announces which software version");
    expect(text).not.toContain("Links to other sites");
    expect(text).not.toContain("partner.example/gone");
  });

  it("the opening sentence never says nothing tested is broken over a row marked broken", async () => {
    const row = clone(TECHNICAL_REPORT) as unknown as Loose;
    for (const p of row.crawl.data.pages) p.rendered.anchors = [];
    row.http.data.sitemapUrls = { checked: 12, total: 41, broken: [{ url: `${row.url}gone` }] };
    const view = toTechnicalView(row as unknown as AuditReport, TODAY);
    expect(view.nothingBroken).toBe(true);
    const text = await pageText(row as unknown as Record<string, unknown>);
    expect(text).toContain("✕");
    expect(text).not.toMatch(/nothing we tested[^.]*broken/);
    expect(text).toContain("nothing we found stops a visitor from using it");
  });

  it("printableUrl strips a version under any parameter name on an asset", () => {
    expect(printableUrl("https://s.example/rbtools.min.js?rev=6.6.14")).toBe(
      "https://s.example/rbtools.min.js",
    );
    expect(printableUrl("https://s.example/style.css?6.4.2")).toBe("https://s.example/style.css");
    expect(printableUrl("https://s.example/fonts/fontawesome-webfont.svg?v=4.7.0")).toBe(
      "https://s.example/fonts/fontawesome-webfont.svg",
    );
    // Not a version: an ordinary parameter on an asset stays.
    expect(printableUrl("https://s.example/app.js?id=42")).toBe("https://s.example/app.js?id=42");
  });
});

describe("post-rebase review round 2", () => {
  type Row2 = Loose & {
    basics: { data: { insecureEntry: Record<string, unknown> } };
    dns: { data: Record<string, unknown> };
  };
  const viewOf = (row: Row2, hidden: string[] = []) =>
    JSON.stringify(toTechnicalView(row as unknown as AuditReport, TODAY, new Set(hidden)));

  it("each maintenance check key takes its own finding and rows off the page", () => {
    const row = clone(TECHNICAL_REPORT) as unknown as Row2;
    row.dns.data.mx = [];
    row.basics.data.insecureEntry = {
      measured: true,
      url: "http://x.example/",
      ok: false,
      landedOn: "http://x.example/",
      error: null,
    };
    const cases: [string, string[]][] = [
      ["header-strict-transport-security", ["Telling browsers to always use https"]],
      ["header-x-frame-options", ["Protection against framing"]],
      ["header-content-security-policy", ["A content policy for scripts"]],
      ["header-x-content-type-options", ["File types declared, not guessed"]],
      ["dns-mx", ["A mail server for your domain"]],
      ["https-upgrade", ["Typing the address without https", '"label":"https"']],
    ];
    for (const [key, texts] of cases) {
      const before = viewOf(row);
      const after = viewOf(row, [key]);
      for (const t of texts) {
        expect(before, key).toContain(t);
        expect(after, key).not.toContain(t);
      }
      expect(after.length, key).toBeLessThan(before.length);
    }
  });

  it("an SVG image keeps its own address; only an SVG font loses a version", () => {
    for (const u of [
      "https://s.example/uploads/2024/05/award-badge-2.0.svg",
      "https://s.example/img/screenshot-at-10.30.45.svg",
      "https://s.example/map.svg?zoom=1.5",
    ])
      expect(printableUrl(u)).toBe(u);
    expect(printableUrl("https://s.example/fonts/fontawesome-webfont.svg?v=4.7.0")).toBe(
      "https://s.example/fonts/fontawesome-webfont.svg",
    );
  });

  it("a prerelease or encoded version does not reach the page", () => {
    expect(printableUrl("https://s.example/b.js?rev=6.6.14-beta")).toBe("https://s.example/b.js");
    expect(printableUrl("https://s.example/b.js?6.6.14-rc.1")).toBe("https://s.example/b.js");
    expect(printableUrl("https://s.example/b.css?ver%3D6.4.2")).toBe("https://s.example/b.css");
  });

  it("the lede claims nothing is broken only when no row is marked broken", async () => {
    const row = clone(TECHNICAL_REPORT) as unknown as Row2;
    for (const p of row.crawl.data.pages) p.rendered.anchors = [];
    row.http.data.externalLinks = {
      checked: 15,
      total: 15,
      broken: [{ url: "https://partner.example/a" }, { url: "https://partner.example/b" }],
    };
    const view = toTechnicalView(row as unknown as AuditReport, TODAY);
    expect(view.nothingBroken).toBe(true);
    const text = await pageText(row as unknown as Record<string, unknown>);
    expect(text).not.toMatch(/nothing (?:we tested|a visitor runs into)[^.]*\./);
    expect(text).toContain("nothing we found stops a visitor from using it");
  });
});
