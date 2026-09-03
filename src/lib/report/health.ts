import type { ReportView } from "./model";

/**
 * Whether the site works, checked the way a stranger would check it.
 *
 * Lifted out of SiteHealth.svelte so the page can do two things with one
 * list: print the rows that alert as findings, and fold the rows that passed
 * into the single "What passes" disclosure with every other pass on the page.
 * A component-local `$derived` could do the first and not the second.
 *
 * Each row is a finding, not a score. A count of broken links is a fact a
 * reader can go and check in thirty seconds; a "site health score" would be
 * another number we invented and then graded people against. Where a check
 * could not run, it is absent rather than a reassuring zero — "we did not
 * measure" and "nothing was wrong" are opposite claims and only one of them is
 * ours to make.
 */
export type HealthRow = {
  key: string;
  label: string;
  /** The finding in a phrase. */
  value: string;
  /** Worth their attention? Drives the only colour on the row, and decides
   *  whether it renders as a finding or joins the passes. */
  alert: boolean;
  /** Shown only on a finding — a cleared check needs no explaining. */
  detail: string;
};

const mb = (bytes: number): string => (bytes / 1_000_000).toFixed(1);
const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

export function healthRows(view: ReportView): HealthRow[] {
  const out: HealthRow[] = [];
  const { assets, journey, consistency, basics } = view;

  // ── Can people reach it at all ─────────────────────────────────────────
  // First, because everything below assumes the answer is yes.
  if (basics) {
    if (basics.insecureEntry.measured) {
      out.push({
        key: "https",
        label: "Typing your address without “https”",
        value: basics.insecureEntry.ok ? "Redirects to the secure site" : "Does not redirect",
        alert: !basics.insecureEntry.ok,
        detail:
          "Pasted links, printed cards and old bookmarks all still start with plain http. When that does not " +
          "redirect, the visitor gets a browser warning saying your site is not secure — or nothing at all.",
      });
    }

    // No counterpart to check is not a finding; a counterpart that fails is.
    if (basics.hostVariant.measured) {
      out.push({
        key: "host",
        label: `Visitors who type ${basics.hostVariant.host}`,
        value: basics.hostVariant.ok ? "Lands on your site" : "Does not reach you",
        alert: !basics.hostVariant.ok,
        detail:
          "Half the people who type your address by hand will include the www and half will leave it off. " +
          "Both spellings need to end up in the same place.",
      });
    }

    if (basics.notFound.measured) {
      // Three outcomes, not two, and the third is the one live sites actually
      // have: a site that answers 200 for every missing URL by quietly
      // redirecting it to the homepage shows a real page that is not the one
      // asked for, which is a different problem from an empty 200 in place.
      const soft = basics.notFound.status !== null && basics.notFound.status < 400;
      const redirected =
        soft &&
        basics.notFound.landedOn !== null &&
        basics.notFound.landedOn !== basics.notFound.url;
      out.push({
        key: "notfound",
        label: "A page that does not exist",
        value: redirected
          ? "Quietly shows another page instead"
          : soft
            ? `Answers ${basics.notFound.status}, as though it were real`
            : basics.notFound.linksBackToSite
              ? "Shows your own error page"
              : "Shows a bare error page",
        alert: !basics.notFound.ok,
        detail: redirected
          ? `We asked for a page that cannot exist and your site answered ${basics.notFound.status} with ` +
            `${basics.notFound.landedOn}. Nobody is ever told the link was wrong: a visitor following an outdated ` +
            `link believes they are where they meant to be, and search engines see an unlimited number of ` +
            `addresses all serving the same content.`
          : soft
            ? "Your server says “found” for a page that is not there. Search engines index the empty result, and a " +
              "visitor following a mistyped or outdated link sees what looks like a real but empty page."
            : "Someone reaching a dead link should land on your site with a way back into it, not on a blank " +
              "server message with no navigation. That visitor leaves.",
      });
    }
  }

  // ── On a phone ─────────────────────────────────────────────────────────
  if (view.viewportOk !== null) {
    out.push({
      key: "viewport",
      label: "Built for phone screens",
      value: view.viewportOk ? "Yes" : "No",
      alert: !view.viewportOk,
      detail:
        "Without the one tag that tells a phone how wide the page is, the browser renders it at desktop width and " +
        "shrinks it. The text is unreadable and every tap target is too small. Most of your visitors are on a phone.",
    });
  }

  // A number you cannot tap. `linked` is absent on older reports — undefined
  // must not read as false, so only an explicit false counts.
  if (consistency) {
    const untappable = consistency.phones.filter((p) => p.linked === false);
    if (consistency.phones.length > 0 && consistency.phones.some((p) => p.linked !== undefined)) {
      out.push({
        key: "tappable",
        label: "Tapping your phone number",
        value:
          untappable.length === 0
            ? "Works"
            : `${untappable.length} ${plural(untappable.length, "number is", "numbers are")} plain text`,
        alert: untappable.length > 0,
        detail:
          "On a phone, a number written as text is something the visitor has to memorise and retype. Written as a " +
          "link it is one tap. It is a one-attribute change and it is the moment they were most likely to call.",
      });
    }
  }

  // ── What is broken ─────────────────────────────────────────────────────
  if (assets) {
    const broken = assets.brokenLinks.length + assets.brokenImages.length;
    out.push({
      key: "broken",
      label: "Broken links and images",
      value: broken === 0 ? "None found" : `${broken} found`,
      alert: broken > 0,
      // The denominator, always. Saying "no broken links" having tested 40
      // of 200 is the kind of quiet overclaim this report exists not to make.
      detail:
        `We checked ${assets.linksChecked} of ${assets.linksFound} links and ` +
        `${assets.imagesChecked} of ${assets.imagesFound} images. Each one below is an address you can open.`,
    });
  }

  if (basics?.mixedContent.measured) {
    const n = basics.mixedContent.imageUrls.length;
    out.push({
      key: "mixed",
      label: "Images loaded insecurely",
      value: n === 0 ? "None" : `${n} ${plural(n, "image", "images")}`,
      alert: n > 0,
      detail:
        `Your site is served securely, but ${n === 1 ? "this image is" : "these images are"} requested over plain ` +
        `http. Browsers block or refuse to upgrade them, so they are broken for some visitors and a security ` +
        `warning for the rest. Of ${basics.mixedContent.imagesSeen} images we could see.`,
    });
  }

  // ── Weight ─────────────────────────────────────────────────────────────
  // Null, not zero: a server that does not report content-length leaves this
  // genuinely unknown, and printing "0 MB of images" for a page full of
  // photographs would be a lie the reader can see through.
  if (assets && assets.imageBytesMeasured !== null) {
    const heaviest = assets.heaviestImages.at(0);
    out.push({
      key: "weight",
      label: "Image weight",
      value: `${mb(assets.imageBytesMeasured)} MB across ${assets.imagesWithKnownSize} images`,
      alert: (heaviest?.bytes ?? 0) >= 1_000_000,
      // Says what was actually measured, which is not what a phone downloads:
      // every distinct image across the crawl, as a desktop browser receives
      // it. The error can only run one way, upward, which is the wrong
      // direction for the one document whose value is that its numbers hold.
      detail: heaviest
        ? `The heaviest single image is ${mb(heaviest.bytes ?? 0)} MB — that one is worth ` +
          `fixing on its own. The total is every image across the site, measured as a desktop ` +
          `browser would receive it; if you serve smaller versions to phones, they download less.`
        : "No single image is large enough to be worth calling out.",
    });
  }

  // ── Reaching you ───────────────────────────────────────────────────────
  if (journey) {
    const dead = journey.deadEnds.length;
    const worst = journey.worstClicksToContact;
    out.push({
      key: "contact",
      label: "Getting hold of you",
      value:
        journey.affordances.length === 0
          ? "No way to make contact found"
          : dead > 0
            ? `${dead} of ${journey.pagesExamined} pages offer no route`
            : worst === null
              ? "Not measured"
              : worst === 0
                ? "Every page offers a way"
                : `At most ${worst} ${plural(worst, "click", "clicks")} away`,
      alert: journey.affordances.length === 0 || dead > 0,
      detail:
        `Search engines send people to whichever page answers their question, not to your home ` +
        `page — so we measured this from all ${journey.pagesExamined} pages we looked at, not just the first.`,
    });
  }

  // ── Content basics ─────────────────────────────────────────────────────
  if (basics && basics.altText.imagesTotal > 0) {
    const { imagesTotal, imagesWithAlt, pagesExamined } = basics.altText;
    const without = imagesTotal - imagesWithAlt;
    const share = Math.round((imagesWithAlt / imagesTotal) * 100);
    out.push({
      key: "alt",
      label: "Images with a description",
      value: `${share}%`,
      // Below half is worth raising; a handful of decorative images is not.
      alert: share < 50,
      detail:
        `${without} of ${imagesTotal} images across ${pagesExamined} pages carry no alt text. Anyone using a ` +
        `screen reader hears nothing there, and nothing that reads your pages — including the assistant — ` +
        `knows what those pictures show.`,
    });
  }

  if (basics && basics.duplicateTitles.length > 0) {
    const worst = basics.duplicateTitles[0];
    out.push({
      key: "titles",
      label: "Pages sharing one title",
      value: `${basics.duplicateTitles.length} ${plural(basics.duplicateTitles.length, "title", "titles")} reused`,
      alert: true,
      detail: worst
        ? `“${worst.title}” is the title of ${worst.pages.length} different pages. That text is the browser tab, ` +
          `the bookmark and the search result, so those pages are indistinguishable in all three.`
        : "",
    });
  }

  // ── Saying the same thing everywhere ───────────────────────────────────
  if (consistency) {
    if (consistency.phones.length > 0) {
      // A receipt, never an alert. Replayed across every stored audit, "more
      // than one number = disagreeing with itself" was wrong every time it
      // fired: a second number is usually a second office.
      out.push({
        key: "phones",
        label: "Phone numbers published",
        value: `${consistency.phones.length} ${plural(consistency.phones.length, "number", "numbers")}`,
        alert: false,
        detail:
          consistency.phones.length > 1
            ? "Listed so you can check them, not as a problem — a second number is usually a second office."
            : "",
      });
    }

    if (consistency.newestCopyrightYear !== null) {
      // Compared against the audit's own date rather than today's, so a
      // report reread next year does not silently change its own findings.
      const auditYear = view.generatedAt ? new Date(view.generatedAt).getFullYear() : null;
      const stale = auditYear !== null && auditYear - consistency.newestCopyrightYear >= 2;
      out.push({
        key: "copyright",
        label: "Copyright year",
        value: String(consistency.newestCopyrightYear),
        alert: stale,
        detail: "It reads as a site nobody has touched in years — to every visitor, on every page.",
      });
    }

    if (consistency.pagesOffTemplate.length > 0) {
      out.push({
        key: "template",
        label: "Pages outside your template",
        value: `${consistency.pagesOffTemplate.length} found`,
        alert: true,
        detail:
          "These carry none of your site's navigation. Someone who lands on one is in a different website with " +
          "no way back into this one.",
      });
    }
  }

  return out;
}
