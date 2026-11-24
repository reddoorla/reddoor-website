import { describe, it, expect } from "vitest";
import { crawlerClass } from "./crawler-class";

describe("crawlerClass", () => {
  it.each([
    ["Googlebot", "search"],
    ["Bingbot", "search"],
    ["OAI-SearchBot", "retrieval"],
    ["ChatGPT-User", "retrieval"],
    ["PerplexityBot", "retrieval"],
    ["Perplexity-User", "retrieval"],
    ["Claude-SearchBot", "retrieval"],
    ["Claude-User", "retrieval"],
    ["GPTBot", "training"],
    ["ClaudeBot", "training"],
    ["Google-Extended", "training"],
    ["CCBot", "training"],
    ["SomeUnknownBot", "training"],
  ] as const)("%s is %s", (name, kind) => {
    expect(crawlerClass(name)).toBe(kind);
  });
});
