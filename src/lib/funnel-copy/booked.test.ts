import { describe, it, expect } from "vitest";
import { asLink } from "@prismicio/client";
import { bookedCtaSlice, bookedQuoteSlice } from "./booked-slices";
import { BOOKED_DEFAULTS, resolveBooked } from "./booked";
import { DEFAULT_FUNNEL_COPY, resolveFunnelCopy, safeHref } from "./copy";

const mp4 = (name: string) => ({
  link_type: "Media" as const,
  kind: "file",
  id: name,
  url: `https://reddoor-la.cdn.prismic.io/reddoor-la/${name}`,
  name,
  size: "1",
});

const projectLink = (uid: string) => ({
  link_type: "Document" as const,
  id: `id-${uid}`,
  uid,
  type: "project",
  tags: [],
  lang: "en-us",
  slug: uid,
  isBroken: false,
});

describe("the booked page with nothing written in Prismic is the board", () => {
  const D = DEFAULT_FUNNEL_COPY;

  it("says the board's words", () => {
    expect([
      D.schedule_booked_heading,
      D.booked_subhead,
      D.booked_date_label,
      D.booked_duration_label,
      D.booked_google_label,
      D.booked_ical_label,
      D.booked_reschedule_label,
      D.booked_cancel_label,
      D.booked_prepare_heading,
      D.booked_work_label,
      D.booked_cta_heading,
      D.booked_cta_button,
    ]).toEqual([
      "You’re on the calendar.",
      "Check your email and watch the video below for more details",
      "Date and Time",
      "Duration",
      "Add to Google Calendar",
      "Add to iCal/Outlook Calendar",
      "Reschedule",
      "Cancel",
      "How to Prepare for This 1:1 Call",
      "Check out Our Work",
      "It’s time to arm your brand with a clear story and compelling design.",
      "Meet with us",
    ]);
  });

  it("repeats the MSOT quote from the landing pages, with Albert's photo", () => {
    expect(D.booked_quote_name).toBe("Albert Turgon");
    expect(D.booked_quote).toMatch(/^We needed to look credible/);
    expect(D.booked.quotePhoto?.url).toContain("testimonial-albert-turgon");
  });

  it("has the three steps, the four projects and the offer video", () => {
    expect(D.booked.projectUids).toEqual([
      "revogen",
      "msot",
      "rubrik-zero-labs",
      "the-texas-organ-sharing-alliance",
    ]);
  });
});

describe("resolveBooked", () => {
  it("takes Tim's steps in order, skipping blank ones", () => {
    const out = resolveBooked({
      booked_steps: [{ text: " One. " }, { text: "  " }, { text: "Two." }],
    });
    expect(out.steps).toEqual(["One.", "Two."]);
  });

  it("falls back to the board's steps when every step is blank", () => {
    expect(resolveBooked({ booked_steps: [{ text: "" }] }).steps).toEqual(BOOKED_DEFAULTS.steps);
  });

  it("takes the projects he picks, in his order, skipping empty rows", () => {
    const out = resolveBooked({
      booked_projects: [
        { project: projectLink("worthe") },
        { project: { link_type: "Document" } },
        { project: projectLink("msot") },
      ],
    } as never);
    expect(out.projectUids).toEqual(["worthe", "msot"]);
  });

  it("shows a project once, however often it is picked", () => {
    const out = resolveBooked({
      booked_projects: [
        { project: projectLink("msot") },
        { project: projectLink("revogen") },
        { project: projectLink("msot") },
      ],
    } as never);
    expect(out.projectUids).toEqual(["msot", "revogen"]);
  });

  it("a paste that names no Vimeo video keeps the default video", () => {
    expect(resolveBooked({ booked_vimeo_video: "tbd" }).video).toEqual(BOOKED_DEFAULTS.video);
    expect(resolveBooked({ booked_vimeo_video: "https://youtu.be/abc" }).video).toEqual(
      BOOKED_DEFAULTS.video,
    );
  });

  it("a poster on its own replaces the default still and nothing else", () => {
    const still = { ...BOOKED_DEFAULTS.quotePhoto!, url: "https://images.prismic.io/x/new.png" };
    const out = resolveBooked({ booked_video_poster: still } as never);
    expect(out.video.poster?.url).toBe("https://images.prismic.io/x/new.png");
    expect(out.video.mp4).toBe(BOOKED_DEFAULTS.video.mp4);
  });

  it("a new Vimeo link alone replaces the whole video, so the old file cannot play first", () => {
    const out = resolveBooked({ booked_vimeo_video: "https://vimeo.com/1" });
    expect(out.video).toEqual({
      title: "Video",
      vimeo: "https://vimeo.com/1",
      mp4: null,
      mobileMp4: null,
      captions: null,
      poster: null,
    });
  });

  it("a new video is never announced by the default video's title", () => {
    const own = resolveBooked({ booked_vimeo_video: "https://vimeo.com/1" });
    expect(own.video.title).toBe("Video");
    const named = resolveBooked({
      booked_vimeo_video: "https://vimeo.com/1",
      booked_video_title: "Meet Tim",
    });
    expect(named.video.title).toBe("Meet Tim");
  });

  it("a new file brings its own captions and poster, never the old ones", () => {
    const out = resolveBooked({ booked_video_mp4: mp4("new-1080.mp4") } as never);
    expect(out.video.mp4).toMatch(/new-1080\.mp4$/);
    expect(out.video.vimeo).toBe("");
    expect(out.video.captions).toBeNull();
    expect(out.video.poster).toBeNull();
  });

  it("keeps Albert's photo until another is uploaded", () => {
    expect(resolveBooked({}).quotePhoto).toEqual(BOOKED_DEFAULTS.quotePhoto);
  });

  it("reaches the page through resolveFunnelCopy", () => {
    expect(resolveFunnelCopy({ booked_steps: [{ text: "Only step." }] }).booked.steps).toEqual([
      "Only step.",
    ]);
  });
});

describe("safeHref, for the closing banner's link", () => {
  it("never draws a script URL", () => {
    expect(safeHref("javascript:alert(1)", "/contact")).toBe("/contact");
    expect(safeHref(" JavaScript:alert(1)", "/contact")).toBe("/contact");
    expect(safeHref("//evil.example", "/contact")).toBe("/contact");
  });

  it("keeps the site's own links on the site the visitor is on", () => {
    expect(safeHref("https://reddoorla.com/contact", "/contact")).toBe("/contact");
    expect(safeHref("/schedule", "/contact")).toBe("/schedule");
    expect(safeHref("https://example.com/x", "/contact")).toBe("https://example.com/x");
  });
});

describe("the closing banner", () => {
  it("goes to /contact when the link field holds a script URL", () => {
    const copy = { ...DEFAULT_FUNNEL_COPY, booked_cta_link: "javascript:alert(1)" };
    expect(asLink(bookedCtaSlice(copy).primary.buttonLink)).toBe("/contact");
  });

  it("carries the board's heading and button", () => {
    const slice = bookedCtaSlice(DEFAULT_FUNNEL_COPY);
    expect(slice.primary.buttonLabel).toBe(DEFAULT_FUNNEL_COPY.booked_cta_button);
    expect(asLink(slice.primary.buttonLink)).toBe("/contact");
  });
});

describe("the testimonial band", () => {
  it("is the quote, name, role and photo from the page's fields", () => {
    const slice = bookedQuoteSlice(DEFAULT_FUNNEL_COPY);
    expect(slice.primary.name).toBe("Albert Turgon");
    expect(slice.primary.avatar).toEqual(DEFAULT_FUNNEL_COPY.booked.quotePhoto);
  });
});
