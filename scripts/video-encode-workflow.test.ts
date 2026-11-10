import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { videoKey } from "@reddoorla/maintenance/video-pipeline";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const WORKFLOW = join(ROOT, ".github/workflows/video-encode.yml");

/** Secrets the workflow hands the encode step. The child must never see them. */
const R2_SECRETS = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "CF_AI_TOKEN"];

/**
 * The `run:` script of the encode step, found by its `id: encode` (the step is
 * named "Encode and upload to R2"). Throws if the step or its `run:` is missing,
 * so a renamed step fails the test instead of testing some other command.
 * Line-based on purpose: the workflow is plain YAML and the `yaml` package is
 * not a dependency of this repo. Handles a single-line `run:` and a `run: |`
 * block scalar.
 */
function encodeStepRun(yaml: string): string {
  const lines = yaml.split("\n");
  const id = lines.findIndex((line) => /^\s*id:\s*encode\s*$/.test(line));
  if (id === -1) throw new Error("no step with `id: encode` in video-encode.yml");
  const stepIndent = lines[id]!.search(/\S/);
  let start = -1;
  for (let i = id + 1; i < lines.length; i += 1) {
    const line = lines[i]!;
    // Stop at the next step: a list item less indented than this step's keys.
    if (line.trim() !== "" && /^\s*-\s/.test(line) && line.search(/\S/) < stepIndent) break;
    if (/^\s*-?\s*run:/.test(line)) {
      start = i;
      break;
    }
  }
  if (start === -1) throw new Error("the encode step has no `run:`");
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
 * Runs the encode step as Actions does (`bash -eo pipefail`). The child gets
 * only PATH, HOME and the step's own variables: no R2 secrets and nothing else
 * from the test runner's environment. A run that gets past argument checks
 * fails on the missing R2 variables instead.
 */
function runEncode(env: { URL: string; CLASS: string; KEY: string; FORCE?: string }) {
  const script = encodeStepRun(readFileSync(WORKFLOW, "utf8"));
  const githubOutput = join(mkdtempSync(join(tmpdir(), "encode-wf-")), "github-output");
  writeFileSync(githubOutput, "");
  const childEnv: Record<string, string> = {
    PATH: process.env.PATH ?? "",
    HOME: process.env.HOME ?? "",
    GITHUB_OUTPUT: githubOutput,
    RUNNER_TEMP: mkdtempSync(join(tmpdir(), "encode-wf-runner-")),
    ...env,
  };
  for (const name of R2_SECRETS) {
    if (name in childEnv) throw new Error(`${name} must not be in the encode step's env`);
  }
  const result = spawnSync("bash", ["--noprofile", "--norc", "-eo", "pipefail", "-c", script], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 60_000,
    env: childEnv,
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

const PRISMIC_URL = "https://reddoor-la.cdn.prismic.io/reddoor-la/a1_alpha-1080.mp4";
const RIGHT_KEY = videoKey("reddoor-website", PRISMIC_URL) as string;

/** Flag-value failures from the encode CLI. None may appear in a correct run. */
const FLAG_ERRORS = ["Unknown option", "does not match", "must be"];

describe("video-encode.yml encode command", () => {
  it("finds the encode step and its command", () => {
    const script = encodeStepRun(readFileSync(WORKFLOW, "utf8"));

    expect(script).toContain("video-pipeline encode");
    expect(script).toContain("--site reddoor-website");
  });

  it("accepts its flag values with the matching key: it stops at the missing R2 variables", () => {
    const { status, output } = runEncode({ URL: PRISMIC_URL, CLASS: "player", KEY: RIGHT_KEY });

    expect(status).not.toBe(0);
    expect(output).toContain("missing environment variables");
    for (const error of FLAG_ERRORS) expect(output).not.toContain(error);
  }, 90_000);

  it("accepts its flag values with KEY empty, as a manual run sends it", () => {
    const { status, output } = runEncode({ URL: PRISMIC_URL, CLASS: "player", KEY: "" });

    expect(status).not.toBe(0);
    expect(output).toContain("missing environment variables");
    for (const error of FLAG_ERRORS) expect(output).not.toContain(error);
  }, 90_000);

  it("accepts the force input, as a manual re-encode sends it", () => {
    const { status, output } = runEncode({
      URL: PRISMIC_URL,
      CLASS: "background",
      KEY: "",
      FORCE: "true",
    });

    expect(status).not.toBe(0);
    expect(output).toContain("missing environment variables");
    for (const error of FLAG_ERRORS) expect(output).not.toContain(error);
  }, 90_000);

  it("refuses a key that its own --site would not give", () => {
    const { status, output } = runEncode({
      URL: PRISMIC_URL,
      CLASS: "player",
      KEY: "reddoor-website/wrong-0123456789",
    });

    expect(status).not.toBe(0);
    expect(output).toContain("does not match");
  }, 90_000);
});
