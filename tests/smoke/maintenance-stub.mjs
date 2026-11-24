// A stand-in for reddoor-maintenance's two audit-report routes, so the smoke
// suite can drive the report editor end to end in a real browser (W1, TEC-02).
// Nothing here reaches a real database or a real report.
//
//   GET  /api/audit-report/:token            the report JSON; a draft only with the bearer
//   POST /api/audit-report/:token/overrides  store the override map (bearer required)
//   POST /__seed                             { token, report, approved } — set up one report
//   GET  /__state/:token                     what is stored, for assertions
//
// The bearer is PROSPECT_EDIT_TOKEN, the same contract maintenance enforces.
import { createServer } from "node:http";

/** @typedef {import("node:http").IncomingMessage} Req */
/** @typedef {import("node:http").ServerResponse} Res */

const PORT = Number(process.env.EDIT_STUB_PORT || 5197);
const TOKEN = process.env.PROSPECT_EDIT_TOKEN || "smoke-edit-token";
/** @type {Map<string, { report: unknown; overrides: unknown; approvedAt: string | null }>} */
const reports = new Map();

/** @param {Res} res @param {number} status @param {unknown} body */
const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};
/** @param {Req} req @returns {Promise<string>} */
const read = (req) =>
  new Promise((resolve) => {
    let s = "";
    req.on("data", (/** @type {Buffer} */ c) => (s += c));
    req.on("end", () => resolve(s));
  });
/** @param {Req} req */
const bearer = (req) => (req.headers.authorization ?? "") === `Bearer ${TOKEN}`;

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  if (req.method === "GET" && url.pathname === "/health") return json(res, 200, { ok: true });
  if (req.method === "POST" && url.pathname === "/__seed") {
    const { token, report, approved } = JSON.parse(await read(req));
    reports.set(token, {
      report,
      overrides: null,
      approvedAt: approved ? new Date().toISOString() : null,
    });
    return json(res, 200, { ok: true });
  }
  const state = /^\/__state\/([\w-]+)$/.exec(url.pathname);
  if (req.method === "GET" && state) return json(res, 200, reports.get(state[1]) ?? null);

  const save = /^\/api\/audit-report\/([\w-]+)\/overrides$/.exec(url.pathname);
  if (req.method === "POST" && save) {
    const row = reports.get(save[1]);
    if (!bearer(req) || !row) return json(res, 404, { ok: false, error: "not-found" });
    row.overrides = JSON.parse(await read(req)).overrides ?? {};
    return json(res, 200, { ok: true });
  }
  const get = /^\/api\/audit-report\/([\w-]+)$/.exec(url.pathname);
  if (req.method === "GET" && get) {
    const row = reports.get(get[1]);
    if (!row || (row.approvedAt === null && !bearer(req)))
      return json(res, 404, { error: "not-found" });
    return json(res, 200, {
      report: row.report,
      overrides: row.overrides,
      editedAt: null,
      approvedAt: row.approvedAt,
      openedAt: null,
    });
  }
  json(res, 404, { error: "not-found" });
}).listen(PORT, "127.0.0.1");
