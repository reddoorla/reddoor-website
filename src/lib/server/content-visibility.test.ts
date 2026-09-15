import { describe, expect, it, vi } from "vitest";

vi.mock("$app/environment", () => ({ dev: false }));
vi.mock("$env/dynamic/private", () => ({ env: {} }));

const { showsHiddenContent, HIDE_FILTER, HIDE_TAG, SHOW_HIDDEN_ENV } =
  await import("./content-visibility");

describe("showsHiddenContent", () => {
  const base = { dev: false, showHiddenEnv: undefined, previewCookie: undefined };
  it("hides by default: production, deploy previews, any build with the variable unset", () => {
    expect(showsHiddenContent(base)).toBe(false);
    expect(showsHiddenContent({ ...base, showHiddenEnv: "" })).toBe(false);
    expect(showsHiddenContent({ ...base, showHiddenEnv: "yes" })).toBe(false);
  });
  it("shows under vite dev, so the smoke suite sees every published document", () => {
    expect(showsHiddenContent({ ...base, dev: true })).toBe(true);
  });
  it(`shows when ${SHOW_HIDDEN_ENV} is exactly "show" (the staging site)`, () => {
    expect(showsHiddenContent({ ...base, showHiddenEnv: "show" })).toBe(true);
    expect(showsHiddenContent({ ...base, showHiddenEnv: " show " })).toBe(true);
  });
  it("shows inside a Prismic preview session", () => {
    expect(showsHiddenContent({ ...base, previewCookie: "1" })).toBe(true);
  });
});

it("the filter is the array form the API accepts", () => {
  expect(HIDE_TAG).toBe("hide");
  expect(HIDE_FILTER).toBe('[not(document.tags, ["hide"])]');
});
