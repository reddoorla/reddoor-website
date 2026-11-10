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

/** The step that proves R2 answers the player's origin, after the encode. */
const CORS_STEP = "Check the R2 bucket serves CORS";

/**
 * The `run:` script of the step whose `run:` line is `start`, read as a
 * single-line value or a `run: |` block scalar.
 */
function scriptAt(lines: string[], start: number): string {
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
  return scriptAt(lines, start);
}

/** The `run:` script of the step named `name` (a `- name:` line), same rules as `encodeStepRun`. */
function stepRunNamed(yaml: string, name: string): string {
  const lines = yaml.split("\n");
  const at = lines.findIndex((line) => line.trim() === `- name: ${name}`);
  if (at === -1) throw new Error(`no step named "${name}" in video-encode.yml`);
  const dash = lines[at]!.search(/\S/);
  let start = -1;
  for (let i = at + 1; i < lines.length; i += 1) {
    const line = lines[i]!;
    // Stop at the next step: a list item at this step's own indent.
    if (line.trim() !== "" && /^\s*-\s/.test(line) && line.search(/\S/) <= dash) break;
    if (/^\s*run:/.test(line)) {
      start = i;
      break;
    }
  }
  if (start === -1) throw new Error(`the step "${name}" has no run:`);
  return scriptAt(lines, start);
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

/** Stubs for commands on PATH: each prints its `output`, records its arguments, and exits with `exit`. */
type Stubs = Record<string, { output?: string; exit?: number }>;

/**
 * Runs a step script as Actions does, with `stubs` first on PATH. Returns what
 * the step wrote to `$GITHUB_OUTPUT` and the arguments each stub received.
 */
function runStep(script: string, env: Record<string, string>, stubs: Stubs = {}) {
  const bin = mkdtempSync(join(tmpdir(), "encode-wf-stubs-"));
  for (const [name, { output = "", exit = 0 }] of Object.entries(stubs)) {
    writeFileSync(
      join(bin, name),
      `#!/bin/sh\necho "$@" >> "${bin}/${name}.args"\ncat <<'STUB_OUTPUT'\n${output}\nSTUB_OUTPUT\nexit ${exit}\n`,
      { mode: 0o755 },
    );
  }
  const githubOutput = join(mkdtempSync(join(tmpdir(), "encode-wf-")), "github-output");
  writeFileSync(githubOutput, "");
  const result = spawnSync("bash", ["--noprofile", "--norc", "-eo", "pipefail", "-c", script], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 60_000,
    env: {
      PATH: `${bin}:${process.env.PATH ?? ""}`,
      HOME: process.env.HOME ?? "",
      GITHUB_OUTPUT: githubOutput,
      RUNNER_TEMP: mkdtempSync(join(tmpdir(), "encode-wf-runner-")),
      ...env,
    },
  });
  const argsOf = (name: string) => {
    try {
      return readFileSync(join(bin, `${name}.args`), "utf8");
    } catch {
      return "";
    }
  };
  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}`,
    githubOutput: readFileSync(githubOutput, "utf8"),
    argsOf,
  };
}

const PRISMIC_URL = "https://reddoor-la.cdn.prismic.io/reddoor-la/a1_alpha-1080.mp4";
const RIGHT_KEY = videoKey("reddoor-website", PRISMIC_URL) as string;

/** Flag-value failures from the encode CLI. None may appear in a correct run. */
const FLAG_ERRORS = ["Unknown option", "does not match", "must be"];

/** What `video-pipeline encode` prints on success, and the manifest path it names. */
const MANIFEST_PATH = "reddoor-website/alpha-0123456789/manifest.json";
const MANIFEST_LINE = `MANIFEST ${MANIFEST_PATH}`;
const SKIP_LINE =
  "SKIP reddoor-website/alpha-0123456789: already encoded as player (R2 manifest covers it)";

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

const ENCODE_ENV = { URL: PRISMIC_URL, CLASS: "player", KEY: "" };

describe("video-encode.yml encode step outputs", () => {
  it("writes the encoded manifest path for the CORS check", () => {
    const script = encodeStepRun(readFileSync(WORKFLOW, "utf8"));
    const { status, githubOutput } = runStep(script, ENCODE_ENV, {
      pnpm: { output: MANIFEST_LINE },
    });

    expect(status).toBe(0);
    expect(githubOutput).toContain(`manifest=${MANIFEST_PATH}`);
  });

  it("a SKIP line writes rebuild=false and no manifest", () => {
    const script = encodeStepRun(readFileSync(WORKFLOW, "utf8"));
    const { status, githubOutput } = runStep(script, ENCODE_ENV, {
      pnpm: { output: SKIP_LINE },
    });

    expect(status).toBe(0);
    expect(githubOutput).toContain("rebuild=false");
    expect(githubOutput).not.toContain("manifest=");
  });

  it("an encode that printed a MANIFEST line does not write rebuild=false", () => {
    const script = encodeStepRun(readFileSync(WORKFLOW, "utf8"));
    const { status, githubOutput } = runStep(script, ENCODE_ENV, {
      pnpm: { output: MANIFEST_LINE },
    });

    expect(status).toBe(0);
    expect(githubOutput).not.toContain("rebuild=false");
  });
});

describe("video-encode.yml CORS check after the encode", () => {
  const corsScript = () => stepRunNamed(readFileSync(WORKFLOW, "utf8"), CORS_STEP);
  const MANIFEST_ENV = { MANIFEST: MANIFEST_PATH };

  it("passes when R2 allows the player's origin", () => {
    const { status, output } = runStep(corsScript(), MANIFEST_ENV, {
      curl: {
        output: "HTTP/2 200\r\naccess-control-allow-origin: https://reddoorla.com\r\n",
      },
    });

    expect(status).toBe(0);
    expect(output).not.toContain("::error::");
  });

  it("reads the header whatever its letter case", () => {
    const { status } = runStep(corsScript(), MANIFEST_ENV, {
      curl: { output: "HTTP/2 200\r\nAccess-Control-Allow-Origin: https://reddoorla.com\r\n" },
    });

    expect(status).toBe(0);
  });

  it("fails with an error that names the CORS rule when the header is missing", () => {
    const { status, output } = runStep(corsScript(), MANIFEST_ENV, {
      curl: { output: "HTTP/2 200\r\ncontent-type: video/mp4\r\n" },
    });

    expect(status).not.toBe(0);
    expect(output).toContain("::error::");
    expect(output).toContain("CORS");
  });

  it("asks R2 for the manifest with the player's Origin", () => {
    const { argsOf } = runStep(corsScript(), MANIFEST_ENV, {
      curl: { output: "HTTP/2 200\r\naccess-control-allow-origin: https://reddoorla.com\r\n" },
    });

    expect(argsOf("curl")).toContain("Origin: https://reddoorla.com");
    expect(argsOf("curl")).toContain(`https://media.reddoorla.com/${MANIFEST_PATH}`);
  });

  it("fails when the encode printed no manifest to check", () => {
    const { status, output } = runStep(
      corsScript(),
      { MANIFEST: "" },
      {
        curl: { output: "HTTP/2 200\r\naccess-control-allow-origin: https://reddoorla.com\r\n" },
      },
    );

    expect(status).not.toBe(0);
    expect(output).toContain("no MANIFEST");
  });

  it("asks for the manifest with GET, not HEAD, since the player makes GET requests", () => {
    const { argsOf } = runStep(corsScript(), MANIFEST_ENV, {
      curl: { output: "HTTP/2 200\r\naccess-control-allow-origin: https://reddoorla.com\r\n" },
    });

    expect(argsOf("curl")).not.toMatch(/(^|\s)(-I|--head)(\s|$)/);
    expect(argsOf("curl")).toMatch(/(^|\s)-D(\s|$)/);
  });

  it("fails with the status, not the CORS message, when R2 does not serve the manifest", () => {
    const { status, output } = runStep(corsScript(), MANIFEST_ENV, {
      curl: { output: "HTTP/2 404\r\ncontent-type: application/xml\r\n" },
    });

    expect(status).not.toBe(0);
    expect(output).toContain("::error::");
    expect(output).toContain("404");
    expect(output).toContain("did not serve the manifest");
    expect(output).not.toContain("CORS");
    expect(output).not.toContain("Access-Control");
  });

  it("fails with a CORS message that says to re-run with force when the header is missing on a 200", () => {
    const { status, output } = runStep(corsScript(), MANIFEST_ENV, {
      curl: { output: "HTTP/2 200\r\ncontent-type: video/mp4\r\n" },
    });

    expect(status).not.toBe(0);
    expect(output).toContain("CORS");
    expect(output).toContain("force");
  });
});
