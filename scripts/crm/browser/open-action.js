/* global ARGS */
// Open an action's side panel in the builder, by the name shown on its node.
//
// ARGS: { name: "Inquiry reminder 1" }
// Clicks "Fit to screen" first because the canvas culls offscreen nodes, then
// dispatches a full pointer sequence on the node (real CDP input never reaches
// this iframe). Reports what the panel holds so the next step can be chosen.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const name = ARGS.name;
  if (!name) throw new Error("ARGS.name is required");
  const click = (el) => {
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      el.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          pointerType: "mouse",
          button: 0,
        }),
      );
    }
  };
  const fit = [...document.querySelectorAll(".vue-flow__panel button")].find((b) =>
    /fit/i.test(b.getAttribute("aria-label") ?? b.title ?? ""),
  );
  if (fit) {
    click(fit);
    await sleep(800);
  }
  let node = null;
  for (let i = 0; i < 10 && !node; i++) {
    node = [...document.querySelectorAll(".vue-flow__node")].find((n) =>
      n.innerText.includes(name),
    );
    if (!node) await sleep(500);
  }
  if (!node) {
    return {
      error: "node not found on the canvas",
      nodes: [...document.querySelectorAll(".vue-flow__node")].map((n) =>
        n.innerText.replace(/\s+/g, " ").trim(),
      ),
    };
  }
  click(node.querySelector("div") ?? node);
  await sleep(1500);
  const editor = document.querySelector(".tiptap.ProseMirror");
  return {
    opened: name,
    tiptap: !!editor?.editor,
    links: editor
      ? [...editor.querySelectorAll("a")].map((a) => ({
          href: a.getAttribute("href"),
          text: a.innerText,
        }))
      : [],
    editables: [
      ...document.querySelectorAll("[contenteditable=true], textarea, input[type=text]"),
    ].map((e) => ({
      tag: e.tagName,
      cls: String(e.className).slice(0, 60),
    })),
    buttons: [...document.querySelectorAll("button")]
      .map((b) => b.innerText.replace(/\s+/g, " ").trim())
      .filter((t) => /save|cancel|delete/i.test(t)),
  };
})();
