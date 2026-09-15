import { describe, expect, it } from "vitest";
import { industryFromArgs, missingRequiredKeys, uidMismatch } from "./lib.mjs";

describe("industryFromArgs", () => {
  it("reads the uid that follows the flag", () => {
    expect(industryFromArgs(["--industry", "boise", "--dry-run"])).toBe("boise");
  });

  it("is undefined when the flag is absent or has no value", () => {
    expect(industryFromArgs(["--dry-run"])).toBeUndefined();
    expect(industryFromArgs(["--industry"])).toBeUndefined();
  });

  it("refuses the next flag as a uid", () => {
    // `--industry --dry-run` would otherwise resolve to a folder named
    // "--dry-run" and fail somewhere much less legible.
    expect(industryFromArgs(["--industry", "--dry-run"])).toBeUndefined();
  });

  it("refuses anything that could be a path or a different case", () => {
    expect(industryFromArgs(["--industry", "../boise"])).toBeUndefined();
    expect(industryFromArgs(["--industry", "Boise"])).toBeUndefined();
  });
});

describe("uidMismatch", () => {
  it("names both uids when a copied data.json was not renamed", () => {
    const why = uidMismatch("medtech", "boise");
    expect(why).toContain("medtech");
    expect(why).toContain("boise");
  });

  it("is null when the folder and the document agree", () => {
    expect(uidMismatch("boise", "boise")).toBeNull();
  });
});

describe("missingRequiredKeys", () => {
  it("names every dotted path an empty file is missing", () => {
    expect(missingRequiredKeys({})).toEqual(["featuredProject.link.uid", "logoGrid.logos"]);
  });

  it("is empty for a complete file", () => {
    expect(
      missingRequiredKeys({ featuredProject: { link: { uid: "enzos" } }, logoGrid: { logos: [] } }),
    ).toEqual([]);
  });

  it("reports a logos key that is not an array", () => {
    expect(
      missingRequiredKeys({
        featuredProject: { link: { uid: "enzos" } },
        logoGrid: { logos: "x" },
      }),
    ).toEqual(["logoGrid.logos"]);
  });
});
