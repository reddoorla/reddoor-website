import { describe, expect, it } from "vitest";
import { resolveAvatarAlt } from "./avatarAlt";

describe("resolveAvatarAlt", () => {
  it("prefers the alt authored on the Prismic asset", () => {
    expect(resolveAvatarAlt("Albert Turgon, smiling", "Albert Turgon")).toBe(
      "Albert Turgon, smiling",
    );
  });

  it("falls back to the credited person's name when no alt was authored", () => {
    expect(resolveAvatarAlt(null, "Albert Turgon")).toBe("Albert Turgon");
    expect(resolveAvatarAlt(undefined, "Albert Turgon")).toBe("Albert Turgon");
    expect(resolveAvatarAlt("", "Albert Turgon")).toBe("Albert Turgon");
  });

  it("treats whitespace-only values as absent", () => {
    expect(resolveAvatarAlt("   ", "Albert Turgon")).toBe("Albert Turgon");
    expect(resolveAvatarAlt(null, "  ")).toBeNull();
  });

  it("returns null when there is nothing to say, so the image can be decorative", () => {
    expect(resolveAvatarAlt(null, null)).toBeNull();
    expect(resolveAvatarAlt("", "")).toBeNull();
    expect(resolveAvatarAlt(undefined, undefined)).toBeNull();
  });

  it("returns the trimmed value it picked", () => {
    expect(resolveAvatarAlt(" Albert ", "Albert Turgon")).toBe("Albert");
    expect(resolveAvatarAlt(null, " Albert Turgon ")).toBe("Albert Turgon");
  });
});
