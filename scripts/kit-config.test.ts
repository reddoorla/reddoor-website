// SvelteKit 3 moved its configuration out of svelte.config.js and into the
// `sveltekit(...)` Vite plugin (reddoor-maintenance P1-53, after the starter's
// reddoor-starter#187). These tests hold the places that move can go wrong
// without a build failing:
//   - the config object never reaching the plugin (the adapter and the
//     prerender policy would just vanish);
//   - a svelte.config.js coming back beside it (kit 3 refuses to start);
//   - `paths.origin` set, which makes it the only origin kit 3's CSRF check
//     accepts a form POST from, so /contact, /api/inquiry and /api/book would
//     answer 403 on every other host;
//   - an environment variable read in src/ but not declared in src/env.ts,
//     which kit 3 turns into `undefined` with only a build warning;
//   - a `$app/stores` import, whose stores throw app_stores_removed in kit 3.
// Run by vitest (vitest.config.js includes scripts/**/*.test.ts), node env.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfigFromFile, type Plugin, type PluginOption } from "vite";
import { variables } from "../src/env.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function flatten(option: PluginOption): Promise<Plugin[]> {
  const value = await option;
  if (!value) return [];
  if (Array.isArray(value)) return (await Promise.all(value.map(flatten))).flat();
  return [value as Plugin];
}

/** The options SvelteKit itself validated, read off its own plugin: what kit
 *  will actually use, not what a config file says. */
async function kitOptions(): Promise<Record<string, unknown>> {
  const loaded = await loadConfigFromFile(
    { command: "build", mode: "production" },
    join(repoRoot, "vite.config.js"),
    repoRoot,
  );
  if (!loaded) throw new Error("vite.config.js did not load");
  const plugins = await flatten(loaded.config.plugins ?? []);
  const setup = plugins.find((p) => p.name === "vite-plugin-sveltekit-setup");
  if (!setup) throw new Error("vite.config.js does not register the sveltekit() plugin");
  return (setup.api as { options: Record<string, unknown> }).options;
}

describe("the SvelteKit config reaches the sveltekit() plugin", () => {
  it("has no svelte.config.js or svelte.config.ts, which kit 3 refuses to start beside", () => {
    expect(existsSync(join(repoRoot, "svelte.config.js"))).toBe(false);
    expect(existsSync(join(repoRoot, "svelte.config.ts"))).toBe(false);
  });

  it("has no src/params/ directory, which kit 3 no longer reads (matchers live in src/params.ts)", () => {
    expect(existsSync(join(repoRoot, "src/params"))).toBe(false);
  });

  it("hands kit the Netlify adapter", async () => {
    const options = await kitOptions();
    expect((options.adapter as { name?: string } | undefined)?.name).toBe(
      "@sveltejs/adapter-netlify",
    );
  });

  it("keeps `$lib` resolving: kit 3 no longer provides it", async () => {
    const options = await kitOptions();
    expect(options.alias).toMatchObject({ $lib: "src/lib" });
  });

  it('hands kit the prerender policy: a broken internal link fails the build ("fail")', async () => {
    const options = await kitOptions();
    expect((options.prerender as { handleHttpError: unknown }).handleHttpError).toBe("fail");
  });

  it("never sets paths.origin, which would refuse form posts from every other host", async () => {
    const options = await kitOptions();
    expect((options.paths as { origin?: string } | undefined)?.origin).toBeUndefined();
  });
});

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(svelte|ts|js)$/.test(entry) && !/\.(test|spec)\.ts$/.test(entry)) out.push(full);
  }
  return out;
}

// What a source file reads from "$app/env/<type>": through a namespace import
// (`env.NAME`, `env["NAME"]`, `const { NAME } = env`) or a named import. kit 3
// exports only the declared names, so any of these on an undeclared name is
// `undefined` at runtime with at most a build warning.
function envReads(source: string): { type: "public" | "private"; name: string }[] {
  const reads: { type: "public" | "private"; name: string }[] = [];
  const add = (type: string, name: string) =>
    reads.push({ type: type as "public" | "private", name });
  const namespaces = source.matchAll(
    /import\s+\*\s+as\s+(\w+)\s+from\s+["']\$app\/env\/(public|private)["']/g,
  );
  for (const [, binding, type] of namespaces) {
    for (const [, name] of source.matchAll(new RegExp(`\\b${binding}\\.([A-Z][A-Z0-9_]*)`, "g"))) {
      add(type, name);
    }
    for (const [, name] of source.matchAll(
      new RegExp(`\\b${binding}\\[\\s*["'\`]([A-Z][A-Z0-9_]*)["'\`]\\s*\\]`, "g"),
    )) {
      add(type, name);
    }
    for (const [, body] of source.matchAll(
      new RegExp(`\\{([^}]*)\\}\\s*=\\s*${binding}\\b`, "g"),
    )) {
      for (const [, name] of body.matchAll(/(?:^|,)\s*([A-Z][A-Z0-9_]*)\b/g)) add(type, name);
    }
  }
  const named = source.matchAll(
    /import\s*\{([^}]*)\}\s*from\s+["']\$app\/env\/(public|private)["']/g,
  );
  for (const [, body, type] of named) {
    for (const [, name] of body.matchAll(/(?:^|,)\s*([A-Z][A-Z0-9_]*)\b/g)) add(type, name);
  }
  return reads;
}

/** A namespace binding indexed by something other than a string literal
 *  (`env[SOME_CONST]`): the name cannot be read off the source, so it cannot
 *  be checked against src/env.ts. */
function computedEnvReads(source: string): string[] {
  const out: string[] = [];
  const namespaces = source.matchAll(
    /import\s+\*\s+as\s+(\w+)\s+from\s+["']\$app\/env\/(public|private)["']/g,
  );
  for (const [, binding] of namespaces) {
    for (const [m] of source.matchAll(new RegExp(`\\b${binding}\\[\\s*[^"'\`\\s]`, "g"))) {
      out.push(m);
    }
  }
  return out;
}

describe("environment variables (kit 3 exposes only what src/env.ts declares)", () => {
  const files = walk(join(repoRoot, "src"));

  it("finds the reads it is meant to check (the instrument's control)", () => {
    const names = files.flatMap((f) => envReads(readFileSync(f, "utf8")).map((r) => r.name));
    for (const name of [
      "FORMS_INGEST_URL",
      "PUBLIC_TURNSTILE_SITE_KEY",
      "CRM_FUNNEL_ACTIVE_TOKEN",
      "PRISMIC_HIDDEN_CONTENT",
    ]) {
      expect(names).toContain(name);
    }
  });

  it("sees every way a file can read one (the instrument's own control)", () => {
    const source = [
      'import * as env from "$app/env/private";',
      'import { NAMED_A, NAMED_B as b } from "$app/env/public";',
      "env.DOTTED;",
      'env["BRACKETED"];',
      "const { DESTRUCTURED, RENAMED: r } = env;",
    ].join("\n");
    expect(
      envReads(source)
        .map((read) => `${read.type}:${read.name}`)
        .sort(),
    ).toEqual(
      [
        "private:BRACKETED",
        "private:DESTRUCTURED",
        "private:DOTTED",
        "private:RENAMED",
        "public:NAMED_A",
        "public:NAMED_B",
      ].sort(),
    );
    expect(
      computedEnvReads('import * as env from "$app/env/private";\nenv[KEY];\nenv["OK"];'),
    ).toHaveLength(1);
  });

  it("declares every variable src/ reads, as public exactly when it is read from $app/env/public", () => {
    const declared = variables as Record<string, { public?: boolean }>;
    const missing = files.flatMap((file) =>
      envReads(readFileSync(file, "utf8"))
        .filter(
          ({ type, name }) =>
            !(name in declared) || !!declared[name].public !== (type === "public"),
        )
        .map(({ type, name }) => `${relative(repoRoot, file)}: ${name} from $app/env/${type}`),
    );
    expect(missing).toEqual([]);
  });

  it("reads none by a computed key, which this gate could not check", () => {
    const computed = files.filter((file) => computedEnvReads(readFileSync(file, "utf8")).length);
    expect(computed.map((f) => relative(repoRoot, f))).toEqual([]);
  });

  it("imports nothing from $app/stores, whose stores throw app_stores_removed in kit 3", () => {
    const stores = files.filter((file) =>
      /(?:from|import\s*\()\s*["']\$app\/stores["']/.test(readFileSync(file, "utf8")),
    );
    expect(stores.map((f) => relative(repoRoot, f))).toEqual([]);
  });

  it("reads none through $env/*, whose `env` object is now only a view of the declared list", () => {
    const legacy = files.filter((file) =>
      /(?:from|import\s*\()\s*["']\$env\//.test(readFileSync(file, "utf8")),
    );
    expect(legacy.map((f) => relative(repoRoot, f))).toEqual([]);
  });
});
