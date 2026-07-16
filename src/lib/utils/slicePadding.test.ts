import { describe, expect, it } from "vitest";
import { resolvePadding } from "./slicePadding";

describe("resolvePadding", () => {
  it("falls back per-slice when no padding field is set", () => {
    expect(resolvePadding({})).toEqual({ padTop: true, padBottom: true });
    expect(resolvePadding({}, false)).toEqual({ padTop: false, padBottom: false });
    expect(
      resolvePadding({ hasTopPadding: null, hasBottomPadding: null, hasPadding: null }),
    ).toEqual({ padTop: true, padBottom: true });
  });

  it("honors the legacy hasPadding for docs not yet migrated", () => {
    expect(resolvePadding({ hasPadding: false })).toEqual({ padTop: false, padBottom: false });
    expect(resolvePadding({ hasPadding: true }, false)).toEqual({ padTop: true, padBottom: true });
  });

  it("prefers the new per-side flags over the legacy field", () => {
    expect(
      resolvePadding({ hasTopPadding: false, hasBottomPadding: true, hasPadding: true }),
    ).toEqual({ padTop: false, padBottom: true });
  });

  it("mixes per-side flags with the legacy fallback side-by-side", () => {
    // Top explicitly set; bottom unset → falls through to hasPadding.
    expect(resolvePadding({ hasTopPadding: true, hasPadding: false })).toEqual({
      padTop: true,
      padBottom: false,
    });
  });

  it("treats explicit false as a value, not an absence", () => {
    expect(resolvePadding({ hasTopPadding: false }, true)).toEqual({
      padTop: false,
      padBottom: true,
    });
  });
});
