import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { compile } from "svelte/compiler";
import { render } from "svelte/server";
import type { Component } from "svelte";

/**
 * Render a component for a test, rather than grepping its source.
 *
 * Used by every test whose subject is TEMPLATE STRUCTURE — which branch of a
 * conditional a reader actually lands in. A source-text assertion cannot see
 * that: swap the two branches of an `{#if}` and every `toContain` on the file
 * still passes while the page prints the opposite of what it means. This lives
 * in its own file because two test files need it and a second copy would be a
 * second thing to keep true.
 *
 * `svelte/compiler` compiles a `lang="ts"` component to a server module directly
 * (Svelte 5 strips the type annotations itself), so the property under test is
 * the rendered HTML with no plugin added to the unit-test config. A route's
 * `+page.svelte` works too: its `import type { PageData } from "./$types"` is
 * type-only, so Svelte strips it before the module is ever loaded.
 *
 * The output goes under `.svelte-kit/` rather than `node_modules/`: vitest
 * externalises `node_modules`, so a module written there is loaded by node
 * itself, and node resolves neither an extensionless `.ts` sibling nor the
 * `$lib` alias. Under `.svelte-kit/` (already gitignored and prettier-ignored)
 * the module goes through vite, which resolves both. A component compiled away
 * from its own directory still needs its `./…` sibling specifiers pointed back
 * at the directory it came from, which is the rewrite below.
 */
export const ssr = async <P extends Record<string, unknown>>(
  path: string,
): Promise<Component<P>> => {
  const dir = path.slice(0, path.lastIndexOf("/") + 1);
  const out = compile(readFileSync(path, "utf-8"), {
    generate: "server",
    filename: path.slice(dir.length),
  });
  const outDir = ".svelte-kit/report-ssr";
  mkdirSync(outDir, { recursive: true });
  const file = `${process.cwd()}/${outDir}/${path.replace(/[^a-zA-Z0-9]+/g, "-")}.js`;
  const from = `${process.cwd()}/${dir}`;
  writeFileSync(
    file,
    out.js.code.replace(/(from\s+")\.\//g, (_m, head) => `${head}${from}`),
  );
  const mod = (await import(pathToFileURL(file).href)) as { default: Component<P> };
  return mod.default;
};

/**
 * The rendered body as plain text: comment markers out, whitespace flattened —
 * so an assertion about a sentence does not depend on where prettier chose to
 * wrap it.
 */
export const renderText = <P extends Record<string, unknown>>(
  component: Component<P>,
  props: P,
): string =>
  render(component, { props })
    .body.replace(/<!--.*?-->/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * R8. `ssr` for a component whose own children are components (Report.svelte).
 * Its child `.svelte` imports cannot be compiled here (no Svelte plugin), so each
 * is replaced by a stub that records the props it was given, and renders its
 * `children` snippet, so a component mounted inside another is observed being
 * mounted with the props its parent passed. Read the record with `stubCalls()`.
 */
export const ssrStubbed = async <P extends Record<string, unknown>>(
  path: string,
): Promise<Component<P>> => {
  const dir = path.slice(0, path.lastIndexOf("/") + 1);
  const compiled = compile(readFileSync(path, "utf-8"), {
    generate: "server",
    filename: path.slice(dir.length),
  }).js.code;
  const stubbed = compiled.replace(
    /import (\w+) from "[^"]+\.svelte";/g,
    (_m, name: string) =>
      `const ${name} = (p, props) => { (globalThis.__ssrStubCalls ??= []).push({ name: "${name}", props }); props.children?.(p); };`,
  );
  const outDir = ".svelte-kit/report-ssr";
  mkdirSync(outDir, { recursive: true });
  const file = `${process.cwd()}/${outDir}/${path.replace(/[^a-zA-Z0-9]+/g, "-")}.stubbed.js`;
  const from = `${process.cwd()}/${dir}`;
  writeFileSync(
    file,
    stubbed.replace(/(from\s+")\.\//g, (_m, head) => `${head}${from}`),
  );
  const mod = (await import(pathToFileURL(file).href)) as { default: Component<P> };
  return mod.default;
};

/** The child components a stubbed render mounted, with their props, since the last call. */
export const stubCalls = (): Array<{ name: string; props: Record<string, unknown> }> => {
  const calls =
    (globalThis as { __ssrStubCalls?: Array<{ name: string; props: Record<string, unknown> }> })
      .__ssrStubCalls ?? [];
  (globalThis as { __ssrStubCalls?: unknown[] }).__ssrStubCalls = [];
  return calls;
};
