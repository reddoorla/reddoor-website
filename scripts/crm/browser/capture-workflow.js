/* global ARGS */
// Read a workflow's saved definition from the server, from inside the builder.
//
// ARGS: { id: "<workflow id>" }
// Open the builder at …/automation/workflow/<id> first. The definition sits in
// no store and the build exposes no component tree, so this hooks
// XMLHttpRequest, bounces the SPA router to the list and back (which refetches
// the workflow), and returns what came down. Also the way to VERIFY a save:
// navigate the parent tab fresh, then run this.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const id = ARGS.id;
  if (!id) throw new Error("ARGS.id is required");
  const cap = (window.__wfCapture ??= []);
  if (!window.__wfHooked) {
    window.__wfHooked = true;
    const open = XMLHttpRequest.prototype.open;
    const send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      this.__url = String(url);
      this.__method = method;
      return open.call(this, method, url, ...rest);
    };
    XMLHttpRequest.prototype.send = function (...rest) {
      this.addEventListener("load", () => {
        if (this.__url?.includes(id)) {
          cap.push({
            method: this.__method,
            url: this.__url.replace(/^https?:\/\/[^/]+/, ""),
            body: this.responseText,
          });
        }
      });
      return send.apply(this, rest);
    };
  }
  const n0 = cap.length;
  const appEl = [...document.querySelectorAll("*")].find((e) => e.__vue_app__);
  const router = appEl.__vue_app__.config.globalProperties.$router;
  const base = location.pathname.replace(/\/automation\/.*$/, "/automation");
  await router.push(base + "/workflows");
  await sleep(1500);
  await router.push(base + "/workflow/" + id);
  let fresh = null;
  const isGet = (c) =>
    c.method === "GET" && new RegExp("/workflow/[^/]+/" + id + "\\?").test(c.url);
  for (let i = 0; i < 40 && !fresh; i++) {
    await sleep(500);
    fresh = cap.slice(n0).find(isGet);
  }
  if (!fresh) throw new Error("the workflow GET was not captured");
  const wf = JSON.parse(fresh.body);
  const templates = (wf.workflowData?.templates ?? []).map((t) => ({
    id: t.id,
    type: t.type,
    name: t.name,
    hrefs:
      t.type === "email"
        ? [...String(t.attributes?.html ?? "").matchAll(/href="([^"]+)"/g)].map((m) =>
            m[1].replace(/&amp;/g, "&"),
          )
        : undefined,
  }));
  return {
    version: wf.version,
    status: wf.status,
    updatedAt: wf.updatedAt,
    templates,
    writesSeen: cap.filter((c) => c.method !== "GET").map((c) => `${c.method} ${c.url}`),
  };
})();
