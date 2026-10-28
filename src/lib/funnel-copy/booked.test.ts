import { describe, it, expect } from "vitest";
import { BOOKED_DEFAULTS, resolveBooked } from "./booked";
import { DEFAULT_FUNNEL_COPY, resolveFunnelCopy } from "./copy";

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
    expect(D.booked.steps).toHaveLength(3);
    expect(D.booked.projectUids).toEqual([
      "revogen",
      "msot",
      "rubrik-zero-labs",
      "the-texas-organ-sharing-alliance",
    ]);
    expect(D.booked.video).toEqual(BOOKED_DEFAULTS.video);
    expect(D.booked.video.mp4).toMatch(/brand-friction-offer.*1080\.mp4$/);
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

  it("a new Vimeo link alone replaces the whole video, so the old file cannot play first", () => {
    const out = resolveBooked({ booked_vimeo_video: "https://vimeo.com/1" });
    expect(out.video).toEqual({
      vimeo: "https://vimeo.com/1",
      mp4: null,
      mobileMp4: null,
      captions: null,
      poster: null,
    });
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
