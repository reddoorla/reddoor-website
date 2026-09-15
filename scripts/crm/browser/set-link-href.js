/* global ARGS */
// Change one link's href in the OPEN TipTap email editor, as a ProseMirror
// transaction — the only edit that sticks. Setting `href` on the <a> in the
// DOM looks right and is silently redrawn from the editor's state; cloning the
// node to force a re-parse reverts too.
//
// ARGS: { match: "/inquiry?", href: "<new href>" }
//    or { match: "/inquiry?", append: "&funnel={{contact.funnel}}" }
// `match` is a substring of the current href. Nothing is saved: run
// save-workflow.js next, then verify with capture-workflow.js.
(() => {
  const el = document.querySelector(".tiptap.ProseMirror");
  const editor = el?.editor;
  if (!editor) throw new Error("no open TipTap editor (run open-action.js first)");
  const { state, view } = editor;
  const linkType = state.schema.marks.link;
  const ranges = [];
  state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    const mark = node.marks.find(
      (m) => m.type === linkType && String(m.attrs.href).includes(ARGS.match),
    );
    if (mark) ranges.push({ from: pos, to: pos + node.nodeSize, attrs: mark.attrs });
  });
  if (!ranges.length) return { error: "no link matching ARGS.match", html: editor.getHTML() };
  const before = ranges[0].attrs.href;
  const href = ARGS.href ?? before + (ARGS.append ?? "");
  if (href === before) return { unchanged: true, before };
  let tr = state.tr;
  for (const r of ranges) {
    tr = tr.removeMark(r.from, r.to, linkType);
    tr = tr.addMark(r.from, r.to, linkType.create({ ...r.attrs, href }));
  }
  view.dispatch(tr);
  const after = [];
  editor.state.doc.descendants((node) => {
    for (const m of node.marks) if (m.type === linkType) after.push(m.attrs.href);
  });
  return { before, after: [...new Set(after)], htmlHrefs: editor.getHTML().match(/href="[^"]+"/g) };
})();
