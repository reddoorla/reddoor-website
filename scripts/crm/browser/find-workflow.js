/* global ARGS */
// Find workflows by name and print their ids, from the automation list page.
//
// ARGS: { query: "A-102" }
// Open the parent tab at …/automation/workflows first. The list URL ignores
// parentId/folderId, so folders cannot be opened by URL; the list store's
// search action is how you reach a workflow inside one.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const appEl = [...document.querySelectorAll("*")].find((e) => e.__vue_app__);
  const pinia = appEl.__vue_app__.config.globalProperties.$pinia;
  const search = pinia._s.get("workflowListSearch");
  const data = pinia._s.get("workflowData");
  const query = ARGS.query ?? "";
  search.updateSearch(query);
  let list = [];
  for (let i = 0; i < 24; i++) {
    await sleep(500);
    list = (data.workflows ?? []).map((w) => ({
      name: w.name,
      id: w.id ?? w._id,
      type: w.type,
      status: w.status,
      parentId: w.parentId ?? null,
    }));
    if (list.some((w) => w.type === "workflow" && w.name.includes(query))) break;
  }
  return list;
})();
