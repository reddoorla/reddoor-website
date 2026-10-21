import { describe, expect, it } from "vitest";
import { parseVimeo } from "./vimeo";

describe("parseVimeo", () => {
  it("takes a bare id", () => {
    expect(parseVimeo(" 123456789 ")).toEqual({ id: "123456789" });
  });

  it("takes a public link, with or without the scheme", () => {
    expect(parseVimeo("https://vimeo.com/123456789")).toEqual({ id: "123456789" });
    expect(parseVimeo("vimeo.com/123456789")).toEqual({ id: "123456789" });
  });

  it("keeps an unlisted link's privacy hash", () => {
    expect(parseVimeo("https://vimeo.com/123456789/abcdef1234")).toEqual({
      id: "123456789",
      hash: "abcdef1234",
    });
    expect(parseVimeo("https://player.vimeo.com/video/123456789?h=abcdef1234")).toEqual({
      id: "123456789",
      hash: "abcdef1234",
    });
  });

  it("is null for empty or non-Vimeo input", () => {
    expect(parseVimeo("")).toBeNull();
    expect(parseVimeo(null)).toBeNull();
    expect(parseVimeo("https://youtube.com/watch?v=123")).toBeNull();
    expect(parseVimeo("https://notvimeo.com/123456789")).toBeNull();
    expect(parseVimeo("https://vimeo.com/channels/staffpicks")).toBeNull();
  });
});
