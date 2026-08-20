import { describe, expect, it } from "vitest";
import { deriveHeroButtons, type HeroButtonItem } from "./buttons";

// Prismic's API shapes, hand-rolled so the test stays free of the generated types.
const web = (url: string, text?: string | null): HeroButtonItem => ({
  link: {
    link_type: "Web",
    url,
    ...(text === undefined ? {} : { text }),
  } as HeroButtonItem["link"],
});

const emptyLink: HeroButtonItem = { link: { link_type: "Any" } as HeroButtonItem["link"] };

// A relationship whose target is unpublished/broken: the field is "filled" but
// carries no url, so asLink() resolves to null.
const brokenDoc: HeroButtonItem = {
  link: {
    link_type: "Document",
    id: "X",
    type: "page",
    tags: [],
    lang: "en-us",
    isBroken: true,
    text: "Our Process",
  } as unknown as HeroButtonItem["link"],
};

describe("deriveHeroButtons", () => {
  it("returns nothing for an absent or empty group", () => {
    expect(deriveHeroButtons(undefined)).toEqual([]);
    expect(deriveHeroButtons(null)).toEqual([]);
    expect(deriveHeroButtons([])).toEqual([]);
  });

  it("resolves a labelled link to an href/text pair", () => {
    expect(deriveHeroButtons([web("https://reddoorla.com/contact", "Get Started")])).toEqual([
      { href: "https://reddoorla.com/contact", text: "Get Started" },
    ]);
  });

  it("drops a link the editor left empty", () => {
    expect(deriveHeroButtons([emptyLink])).toEqual([]);
    expect(deriveHeroButtons([{ link: null }])).toEqual([]);
    expect(deriveHeroButtons([{}])).toEqual([]);
  });

  it("drops a link with no label — an unlabelled ghost button is invisible copy", () => {
    expect(
      deriveHeroButtons([web("/contact"), web("/contact", ""), web("/contact", null)]),
    ).toEqual([]);
  });

  it("drops a filled link that resolves to no destination", () => {
    expect(deriveHeroButtons([brokenDoc])).toEqual([]);
  });

  it("keeps the authored order of the surviving buttons", () => {
    expect(
      deriveHeroButtons([
        web("/contact", "Get Started"),
        emptyLink,
        web("/process", "Our Process"),
      ]),
    ).toEqual([
      { href: "/contact", text: "Get Started" },
      { href: "/process", text: "Our Process" },
    ]);
  });
});
