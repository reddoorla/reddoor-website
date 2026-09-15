#!/usr/bin/env node
// Evaluate JavaScript inside one target of a Chrome started with
// --remote-debugging-port (the superpowers-chrome MCP browser listens on 9222).
//
// The CRM's automation UI is a cross-origin iframe
// (client-app-automation-workflows.leadconnectorhq.com) that browser MCP tools
// cannot click into, so anything that has to happen inside the builder goes
// through here. See ./README.md for the recipes.
//
//   node scripts/crm/ghl-cdp.mjs --file scripts/crm/browser/find-workflow.js --args '{"query":"A-102"}'
//   node scripts/crm/ghl-cdp.mjs --find app.6figurecreative.com --code 'location.href'
//
// --find   substring of the target URL (default: the automation iframe)
// --port   debugging port (default 9222)
// --args   JSON exposed to the script as `ARGS`
// --file   a file whose contents are one expression (an IIFE); --code inline
//
// Prints the value the expression resolves to (a promise is awaited), or the
// exception, and exits non-zero on failure.
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const port = opt("--port", "9222");
const find = opt("--find", "client-app-automation-workflows.leadconnectorhq.com");
const argsJson = opt("--args", "{}");
const source = opt("--file") ? readFileSync(opt("--file"), "utf8") : opt("--code");
if (!source) {
  console.error(
    "usage: node scripts/crm/ghl-cdp.mjs [--find <url-substring>] [--port 9222] [--args '<json>'] (--file <path> | --code '<js>')",
  );
  process.exit(2);
}
JSON.parse(argsJson); // fail here, not inside the page
// Prettier leaves a trailing semicolon on the snippet files; it cannot sit
// inside the parentheses below.
const code = source.trim().replace(/;$/, "");
const expression = `(async () => { const ARGS = ${argsJson}; return await (\n${code}\n); })()`;

const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const hit = targets.find(
  (t) => (t.type === "page" || t.type === "iframe") && (t.url ?? "").includes(find),
);
if (!hit) {
  console.error(`no page/iframe target matching "${find}" on port ${port}. Targets:`);
  for (const t of targets)
    if (t.type === "page" || t.type === "iframe") console.error(`  ${t.type.padEnd(6)} ${t.url}`);
  process.exit(1);
}
console.error(`[target] ${hit.type} ${hit.url.slice(0, 110)}`);

const ws = new WebSocket(hit.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});
const reply = await new Promise((resolve) => {
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id === 1) resolve(d);
  };
  ws.send(
    JSON.stringify({
      id: 1,
      method: "Runtime.evaluate",
      params: { expression, awaitPromise: true, returnByValue: true, userGesture: true },
    }),
  );
});
ws.close();

if (reply.error) {
  console.error("cdp error:", reply.error);
  process.exit(1);
}
const details = reply.result.exceptionDetails;
if (details) {
  console.error("exception:", details.exception?.description ?? details.text);
  process.exit(1);
}
const value = reply.result.result.value;
console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));
