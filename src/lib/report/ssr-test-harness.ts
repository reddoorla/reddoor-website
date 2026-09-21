import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { compile } from "svelte/compiler";
import { render } from "svelte/server";
import type { Component } from "svelte";

/**
 * Render a report component for a test, rather than grepping its source.
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
 * the rendered HTML with no plugin added to the unit-test config.
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
  name: string,
): Promise<Component<P>> => {
  const out = compile(readFileSync(`src/lib/report/${name}.svelte`, "utf-8"), {
    generate: "server",
    filename: `${name}.svelte`,
  });
  const dir = ".svelte-kit/report-ssr";
  mkdirSync(dir, { recursive: true });
  const file = `${process.cwd()}/${dir}/${name}.js`;
  const from = `${process.cwd()}/src/lib/report/`;
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
