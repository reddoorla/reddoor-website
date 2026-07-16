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

// Fresh intro arrays per call — planSlices output embeds these objects, so
// sharing one INTRO constant across runs would let identity equality pass
// where content equality should be asserted.
const intro3 = () => [slice("lead_text", LEAD), slice("text_columns"), slice("accordion", ABOUT)];
const intro2 = () => [slice("lead_text", LEAD), slice("text_columns")];

describe("planSlices — slot-based intro consumption", () => {
  it("prepends the intro to a doc that has none, preserving body content byte-for-byte", () => {
    const body = [slice("rich_text", "organic opener"), slice("content_width_image")];
    const { slices, dropped, replacedIntroCount } = planSlices({ existing: body, intro: intro3() });
    expect(replacedIntroCount).toBe(0);
    expect(dropped).toBeNull();
    // Content equality on the kept slices, not just type sequence — a mutant
    // that swaps kept slices for fresh copies must fail here.
    expect(slices.slice(3)).toEqual(body);
    expect(textOf(slices[3].primary.content)).toBe("organic opener");
  });

  it("does NOT consume an editor accordion that opens a never-migrated doc", () => {
    // Slot 0 expects lead_text; an accordion at position 0 is editor content.
    const faq = slice("accordion", "FAQ the editor wrote");
    const existing = [faq, slice("content_width_image")];
    const { slices, replacedIntroCount } = planSlices({ existing, intro: intro3() });
    expect(replacedIntroCount).toBe(0);
    expect(slices.slice(3)).toEqual(existing);
    expect(textOf(slices[3].primary.content)).toBe("FAQ the editor wrote");
  });

  it("does NOT consume an editor accordion contiguous with the intro (the review repro)", () => {
    // Run 1 on a doc whose duplicate lead sits before an editor FAQ accordion.
    const faq = slice("accordion", "FAQ the editor wrote");
    const existing = [slice("rich_text", LEAD), faq, slice("content_width_image")];
    const run1 = planSlices({
      existing,
      intro: intro3(),
      dropExistingLead: true,
      introTexts: [LEAD, ABOUT],
    });
    expect(run1.dropped).toContain("Rubrik Zero Labs");
    // The FAQ is now DIRECTLY after the intro's accordion — the naive
    // "leading contiguous run of intro types" scan absorbed and deleted it
    // on run 2. Slot matching must not.
    const run2 = planSlices({
      existing: run1.slices,
      intro: intro3(),
      dropExistingLead: true,
      introTexts: [LEAD, ABOUT],
    });
    expect(run2.replacedIntroCount).toBe(3);
    expect(run2.dropped).toBeNull();
    expect(run2.slices).toEqual(run1.slices);
    expect(textOf(run2.slices[3].primary.content)).toBe("FAQ the editor wrote");

    const run3 = planSlices({
      existing: run2.slices,
      intro: intro3(),
      dropExistingLead: true,
      introTexts: [LEAD, ABOUT],
    });
    expect(run3.slices).toEqual(run1.slices);
  });

  it("re-run with an organic rich_text directly after the intro keeps it (drop guard live)", () => {
    // Exercises the dropExistingLead branch ON the re-run path, not just run 1.
    const organic = "A completely different paragraph the editor wrote after launch.";
    const migrated = [...intro3(), slice("rich_text", organic), slice("screen_width_image")];
    const rerun = planSlices({
      existing: migrated,
      intro: intro3(),
      dropExistingLead: true,
      introTexts: [LEAD, ABOUT],
    });
    expect(rerun.replacedIntroCount).toBe(3);
    expect(rerun.dropped).toBeNull();
    expect(textOf(rerun.slices[3].primary.content)).toBe(organic);
  });

  it("updates intro copy in place on re-run (the copy-edit use case)", () => {
    const migrated = [...intro3(), slice("screen_width_image")];
    const updatedIntro = [
      slice("lead_text", LEAD + " Now with revised copy."),
      slice("text_columns"),
      slice("accordion", ABOUT),
    ];
    const { slices, replacedIntroCount } = planSlices({ existing: migrated, intro: updatedIntro });
    expect(replacedIntroCount).toBe(3);
    expect(textOf(slices[0].primary.content)).toContain("revised copy");
    expect(slices).toHaveLength(4);
  });

  it("a data.json entry that gains an accordion extends a 2-slice intro cleanly", () => {
    // Prior run wrote [lead, cols] (no accordion — e.g. summittrek); the entry
    // later gains accordion copy. Only the 2 written slots are consumed; the
    // kept old lead stays.
    const oldKeptLead = slice("rich_text", "We've enjoyed a lengthy partnership with SummitTrek.");
    const migrated = [...intro2(), oldKeptLead, slice("screen_width_image")];
    const { slices, replacedIntroCount, dropped } = planSlices({
      existing: migrated,
      intro: intro3(),
      dropExistingLead: false,
    });
    expect(replacedIntroCount).toBe(2);
    expect(dropped).toBeNull();
    expect(slices.map((s) => s.slice_type)).toEqual([
      "lead_text",
      "text_columns",
      "accordion",
      "rich_text",
      "screen_width_image",
    ]);
    expect(slices[3]).toEqual(oldKeptLead);
  });

  it("never drops an organic paragraph on first run, even with dropExistingLead set", () => {
    const organic = "A completely different paragraph the editor wrote after launch.";
    const original = slice("rich_text", organic);
    const existing = [original, slice("screen_width_image")];
    const { slices, dropped } = planSlices({
      existing,
      intro: intro3(),
      dropExistingLead: true,
      introTexts: [LEAD, ABOUT],
    });
    expect(dropped).toBeNull();
    expect(slices[3]).toEqual(original);
  });

  it("drops the old lead only when it prefix-duplicates the intro copy", () => {
    const existing = [slice("rich_text", LEAD + " Extra trailing words."), slice("slideshow")];
    const { slices, dropped } = planSlices({
      existing,
      intro: intro3(),
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
      intro: intro3(),
      dropExistingLead: true,
      introTexts: [LEAD],
    });
    expect(dropped).toBeNull();
  });

  it("handles an empty doc", () => {
    const intro = intro3();
    const { slices } = planSlices({ existing: [], intro });
    expect(slices).toEqual(intro);
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
