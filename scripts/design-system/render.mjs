import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { tokensToCss } from "./tokens-css.mjs";

const { values, positionals } = parseArgs({
  options: {
    project: { type: "string" },
    out: { type: "string" },
    blobs: { type: "string" },
    motion: { type: "string", default: "reduce" },
    theme: { type: "string" },
  },
  allowPositionals: true,
});

const project = resolve(values.project);
const out = resolve(values.out);
await mkdir(out, { recursive: true });
const blobs =
  values.blobs && existsSync(values.blobs) ? JSON.parse(await readFile(values.blobs, "utf8")) : {};

const TYPES = {
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".html": "text/html",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".md": "text/markdown",
};

const tokens = JSON.parse(await readFile(join(project, "tokens.json"), "utf8"));
const tokensCss = tokensToCss(tokens);
const firstTheme = values.theme ?? tokens.color?.themes?.[0]?.id ?? "light";
const libs = existsSync(join(project, "components/lib"))
  ? (await readdir(join(project, "components/lib"))).sort((a, b) =>
      a.startsWith("react-dom") ? 1 : b.startsWith("react-dom") ? -1 : 0,
    )
  : [];

const frameHead = [
  `<style data-frame="tokens">${tokensCss}</style>`,
  existsSync(join(project, "components/bundle.css"))
    ? `<link rel="stylesheet" href="/project/components/bundle.css">`
    : "",
  ...libs.map((l) => `<script src="/project/components/lib/${l}"></script>`),
  existsSync(join(project, "components/bundle.js"))
    ? `<script src="/project/components/bundle.js"></script>`
    : "",
].join("\n");

const compDir = join(project, "components");
const names = positionals.length
  ? positionals
  : (await readdir(compDir)).filter((d) => existsSync(join(compDir, d, "preview.html")));

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const report = [];

for (const name of names) {
  const file = join(compDir, name, "preview.html");
  const html = await readFile(file, "utf8");
  const marker = /^<!--\s*@dsCard([^>]*)-->/.exec(html);
  const attr = (k) => new RegExp(`${k}\\s*=\\s*"?([^"\\s]+)"?`).exec(marker?.[1] ?? "")?.[1];
  const height = Number(attr("height") ?? 120);
  const width = Number(attr("width") ?? 960);
  const withFrame = html.includes("<head>")
    ? html.replace("<head>", `<head>\n${frameHead}`)
    : html.replace(/(<html[^>]*>)/i, `$1<head>${frameHead}</head>`);
  const doc = withFrame.replace(/<html([^>]*)>/i, (m, a) =>
    /data-theme/.test(a) ? m : `<html${a} data-theme="${firstTheme}">`,
  );

  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion: values.motion === "reduce" ? "reduce" : "no-preference",
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const issues = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning")
      issues.push(`console.${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => issues.push(`pageerror: ${e.message}`));
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "ds.local") {
      if (url.pathname === `/project/components/${name}/preview.html`) {
        return route.fulfill({ status: 200, contentType: "text/html", body: doc });
      }
      if (url.pathname.startsWith("/_blob/")) {
        const id = url.pathname.slice(7);
        const local = blobs[id];
        if (local && existsSync(local)) {
          return route.fulfill({
            status: 200,
            contentType: TYPES[extname(local).toLowerCase()] ?? "application/octet-stream",
            body: await readFile(local),
          });
        }
        issues.push(`missing blob ${id}`);
        return route.fulfill({ status: 404, body: "" });
      }
      if (url.pathname.startsWith("/project/")) {
        const local = join(project, decodeURIComponent(url.pathname.slice(9)));
        if (existsSync(local) && (await stat(local)).isFile()) {
          return route.fulfill({
            status: 200,
            contentType: TYPES[extname(local).toLowerCase()] ?? "application/octet-stream",
            body: await readFile(local),
          });
        }
      }
      issues.push(`404 ${url.pathname}`);
      return route.fulfill({ status: 404, body: "" });
    }
    if (
      /^(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com)$/.test(
        url.hostname,
      )
    ) {
      return route.continue();
    }
    issues.push(`blocked ${url.href}`);
    return route.abort();
  });
  await page.goto(`https://ds.local/project/components/${name}/preview.html`, {
    waitUntil: "load",
  });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(values.motion === "reduce" ? 400 : 3000);
  const metrics = await page.evaluate(() => {
    const body = document.body;
    const text = (body.innerText || "").trim();
    const visible = [...body.querySelectorAll("*")].filter((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.opacity !== "0";
    }).length;
    const fonts = [...document.fonts]
      .filter((f) => f.status === "loaded")
      .map((f) => `${f.family} ${f.weight}`);
    return {
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
      textLength: text.length,
      visible,
      fonts: [...new Set(fonts)],
    };
  });
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: true });
  report.push({ name, width, height, ...metrics, issues });
  await context.close();
}

await browser.close();
await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
for (const r of report) {
  const flag = r.issues.length || r.visible < 2 ? "!!" : "ok";
  console.log(
    `${flag} ${r.name} ${r.width}x${r.height} -> ${r.scrollWidth}x${r.scrollHeight} text=${r.textLength} visible=${r.visible}${r.issues.length ? "\n   " + r.issues.slice(0, 8).join("\n   ") : ""}`,
  );
}
