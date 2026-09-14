import { describe, expect, it } from "vitest";
import { TAG_EVENT_BEW } from "./constants";
import { eventTags } from "./events";

describe("eventTags", () => {
  it("tags a landing URL whose utm_source is bew", () => {
    expect(eventTags("https://reddoorla.com/boise?utm_source=bew&utm_medium=event")).toEqual([
      TAG_EVENT_BEW,
    ]);
  });
  it("is case-insensitive on the value, since a hand-typed link may shout", () => {
    expect(eventTags("https://reddoorla.com/boise?utm_source=BEW")).toEqual([TAG_EVENT_BEW]);
  });
  it("tags nothing for any other source, or none", () => {
    expect(eventTags("https://reddoorla.com/boise?utm_source=google")).toEqual([]);
    expect(eventTags("https://reddoorla.com/boise")).toEqual([]);
    expect(eventTags("https://reddoorla.com/medtech?utm_source=bew-newsletter")).toEqual([]);
  });
  it("tags nothing for a malformed or empty URL", () => {
    expect(eventTags("")).toEqual([]);
    expect(eventTags("not a url")).toEqual([]);
  });
});
