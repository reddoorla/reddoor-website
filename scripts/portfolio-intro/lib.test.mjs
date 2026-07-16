import { describe, expect, it } from "vitest";
import { planSlices, duplicatesIntro, textOf } from "./lib.mjs";

const rt = (text) => [{ type: "paragraph", text, spans: [] }];
const slice = (slice_type, text) => ({
  slice_type,
  primary: text ? { content: rt(text) } : {},
});

const LEAD =
  "Rubrik Zero Labs is a cybersecurity research team whose existing brand felt over-designed and trendy.";
const ABOUT =
  "Rubrik Zero Labs is a cybersecurity research and thought leadership resource designed to provide actionable insights.";

const INTRO = [slice("lead_text"), slice("text_columns"), slice("accordion")];

describe("planSlices", () => {
  it("prepends the intro to a doc that has none", () => {
    const body = [slice("rich_text", "organic opener"), slice("content_width_image")];
    const { slices, dropped, replacedIntroCount } = planSlices({ existing: body, intro: INTRO });
    expect(slices.map((s) => s.slice_type)).toEqual([
      "lead_text",
      "text_columns",
      "accordion",
      "rich_text",
      "content_width_image",
    ]);
    expect(dropped).toBeNull();
    expect(replacedIntroCount).toBe(0);
  });

  it("replaces only the leading contiguous intro run", () => {
    const existing = [
      slice("lead_text"),
      slice("text_columns"),
      slice("accordion"),
      slice("content_width_image"),
      // Editor-added accordion mid-document: content, not intro.
      slice("accordion", "FAQ the editor wrote"),
      slice("rich_text", "closing thoughts"),
    ];
    const { slices, replacedIntroCount } = planSlices({ existing, intro: INTRO });
    expect(replacedIntroCount).toBe(3);
    expect(slices.map((s) => s.slice_type)).toEqual([
      "lead_text",
      "text_columns",
      "accordion",
      "content_width_image",
      "accordion", // preserved — this was the destroy path in the original code
      "rich_text",
    ]);
  });

  it("is idempotent: planning its own output changes nothing", () => {
    const existing = [
      slice("rich_text", LEAD), // duplicate of the new lead → dropped on first run
      slice("screen_width_image"),
      slice("accordion", "editor FAQ"),
    ];
    const first = planSlices({
      existing,
      intro: INTRO,
      dropExistingLead: true,
      introTexts: [LEAD, ABOUT],
    });
    expect(first.dropped).toContain("Rubrik Zero Labs");

    const second = planSlices({
      existing: first.slices,
      intro: INTRO,
      dropExistingLead: true,
      introTexts: [LEAD, ABOUT],
    });
    expect(second.slices).toEqual(first.slices);
    expect(second.dropped).toBeNull();

    const third = planSlices({
      existing: second.slices,
      intro: INTRO,
      dropExistingLead: true,
      introTexts: [LEAD, ABOUT],
    });
    expect(third.slices).toEqual(first.slices);
  });

  it("never drops an organic paragraph, even with dropExistingLead set", () => {
    const organic = "A completely different paragraph the editor wrote after launch.";
    const existing = [slice("rich_text", organic), slice("screen_width_image")];
    const { slices, dropped } = planSlices({
      existing,
      intro: INTRO,
      dropExistingLead: true,
      introTexts: [LEAD, ABOUT],
    });
    expect(dropped).toBeNull();
    expect(textOf(slices[3].primary.content)).toBe(organic);
  });

  it("drops the old lead only when it duplicates the intro copy", () => {
    const existing = [slice("rich_text", LEAD + " Extra trailing words."), slice("slideshow")];
    const { slices, dropped } = planSlices({
      existing,
      intro: INTRO,
      dropExistingLead: true,
      introTexts: [LEAD, ABOUT],
    });
    expect(dropped).toContain("Rubrik Zero Labs");
    expect(slices.map((s) => s.slice_type)).toEqual([
      "lead_text",
      "text_columns",
      "accordion",
      "slideshow",
    ]);
  });

  it("does not drop when the post-intro slice is not rich_text", () => {
    const existing = [slice("content_width_image")];
    const { dropped } = planSlices({
      existing,
      intro: INTRO,
      dropExistingLead: true,
      introTexts: [LEAD],
    });
    expect(dropped).toBeNull();
  });

  it("handles an empty doc", () => {
    const { slices } = planSlices({ existing: [], intro: INTRO });
    expect(slices).toEqual(INTRO);
  });
});

describe("duplicatesIntro", () => {
  it("matches on a 60-char normalized prefix in either direction", () => {
    expect(duplicatesIntro(LEAD, [LEAD + " and more."])).toBe(true);
    expect(duplicatesIntro(LEAD + " and more.", [LEAD])).toBe(true);
  });

  it("rejects short strings (30-char floor) and unrelated copy", () => {
    expect(duplicatesIntro("Rubrik Zero Labs", [LEAD])).toBe(false);
    expect(duplicatesIntro("An entirely unrelated paragraph about something else.", [LEAD])).toBe(
      false,
    );
  });
});
