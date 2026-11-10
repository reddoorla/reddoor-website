import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const WORKFLOW = join(ROOT, ".github/workflows/video-encode.yml");

/**
 * The `run:` script of the step whose command calls `video-pipeline encode`.
 * Line-based on purpose: the workflow is plain YAML and the `yaml` package is
 * not a dependency of this repo. Handles a single-line `run:` and a `run: |`
 * block scalar.
 */
function encodeStepRun(yaml: string): string {
  const lines = yaml.split("\n");
  const at = lines.findIndex((line) => line.includes("video-pipeline encode"));
  if (at === -1) throw new Error("no step runs `video-pipeline encode`");
  let start = at;
  while (start >= 0 && !/^\s*-?\s*run:/.test(lines[start]!)) start -= 1;
  if (start < 0) throw new Error("no `run:` above the encode command");
  const head = lines[start]!;
  const indent = head.search(/\S/);
  const value = head.replace(/^\s*-?\s*run:\s*/, "").trim();
  if (value !== "|" && value !== "|-" && value !== ">") return value;
  const body: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (line.trim() !== "" && line.search(/\S/) <= indent) break;
    body.push(line);
  }
  const bodyIndent = Math.min(...body.filter((l) => l.trim() !== "").map((l) => l.search(/\S/)));
  return body.map((l) => l.slice(bodyIndent)).join("\n");
}

/**
 * Runs the workflow's encode command as Actions does (`bash -eo pipefail`) with
 * the step's env names set from the given values. No R2 secrets are set, so a
 * run that gets past argument checks would fail on a missing variable instead.
 */
function runEncode(env: { URL: string; CLASS: string; KEY: string }) {
  const script = encodeStepRun(readFileSync(WORKFLOW, "utf8"));
  const githubOutput = join(mkdtempSync(join(tmpdir(), "encode-wf-")), "github-output");
  writeFileSync(githubOutput, "");
  const result = spawnSync("bash", ["--noprofile", "--norc", "-eo", "pipefail", "-c", script], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 60_000,
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      GITHUB_OUTPUT: githubOutput,
      RUNNER_TEMP: mkdtempSync(join(tmpdir(), "encode-wf-runner-")),
      ...env,
    },
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

const NOT_PRISMIC = "https://example.com/not-prismic.mp4";
const KEY = "reddoor-website/x-0123456789";

describe("video-encode.yml encode command", () => {
  it("is accepted by the installed CLI: a non-Prismic URL fails on the URL, not on the flags", () => {
    const { status, output } = runEncode({ URL: NOT_PRISMIC, CLASS: "player", KEY: KEY });

    expect(status).not.toBe(0);
    expect(output).toContain("--url must be");
    expect(output).not.toContain("Unknown option");
  }, 90_000);

  it("is accepted with KEY empty, as a manual run sends it", () => {
    const { status, output } = runEncode({ URL: NOT_PRISMIC, CLASS: "player", KEY: "" });

    expect(status).not.toBe(0);
    expect(output).toContain("--url must be");
    expect(output).not.toContain("Unknown option");
  }, 90_000);
});
