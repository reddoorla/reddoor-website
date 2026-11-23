import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

/**
 * A report's 22-character token is the whole credential for reading it
 * (reddoor-maintenance `audit-report-json.mts`), and this repo is public. Our
 * own report's token sat in `docs/workJournal.md` for two months; it was
 * rotated on 2026-11-23, and git history keeps the old one, which now opens
 * nothing.
 *
 * This fails on any tracked file holding `/audit/` followed by exactly 22
 * token characters. Write `/audit/<token>` in prose, and keep real tokens in
 * the private workspace.
 */

// Built from parts, so this file never matches itself.
const TOKEN_CHARS = "[A-Za-z0-9_-]";
const REPORT_URL = new RegExp(`/audit/${TOKEN_CHARS}{22}(?!${TOKEN_CHARS})`, "g");

/** Fake tokens a test carries on purpose: `src/routes/layout.server.test.ts`. */
const ALLOWED = new Set(["/audit/" + "aB3-_xY9zQ1rS2tU4vW6xY"]);

function reportTokenHits(text: string): string[] {
  return [...text.matchAll(REPORT_URL)].map((m) => m[0]).filter((hit) => !ALLOWED.has(hit));
}

describe("reportTokenHits", () => {
  const fake = "/audit/" + "Ab0_-".repeat(4) + "Zz";

  it("finds a report URL with a 22-character token", () => {
    expect(fake).toHaveLength(7 + 22);
    expect(reportTokenHits(`see https://reddoorla.com${fake}/print today`)).toEqual([fake]);
  });

  it("ignores placeholders, wrong lengths and the allowed fixture", () => {
    expect(reportTokenHits("/audit/{token} and /audit/<token> and /audit/[token]")).toEqual([]);
    expect(reportTokenHits(fake.slice(0, -1))).toEqual([]);
    expect(reportTokenHits(fake + "x")).toEqual([]);
    expect(reportTokenHits([...ALLOWED].join(" "))).toEqual([]);
  });
});

describe("tracked files", () => {
  it("hold no report token", () => {
    const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
      .split("\0")
      .filter(Boolean);
    expect(files.length).toBeGreaterThan(100);
    const hits: string[] = [];
    for (const f of files) {
      let buf: Buffer;
      try {
        if (statSync(f).size > 5_000_000) continue;
        buf = readFileSync(f);
      } catch {
        continue; // deleted in the working tree, or a submodule
      }
      if (buf.includes(0)) continue; // binary
      buf
        .toString("utf8")
        .split("\n")
        .forEach((line, i) => {
          for (const hit of reportTokenHits(line)) hits.push(`${f}:${i + 1} ${hit.slice(0, 13)}…`);
        });
    }
    expect(
      hits,
      "A report token is in a tracked file. Rotate it and write /audit/<token> instead.",
    ).toEqual([]);
  });
});
