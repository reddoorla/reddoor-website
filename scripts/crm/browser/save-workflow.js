// Two-phase save: "Save action" on the open panel, then the header "Save",
// which only appears once the panel commit flips it from "Saved". An action
// edit that never reaches the header Save reads back fine from the editor and
// is gone on reload, so verify with capture-workflow.js after a fresh load.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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
  const button = (re) =>
    [...document.querySelectorAll("button")].find((b) => re.test(b.innerText.trim()));
  const saveAction = button(/^save action$/i);
  if (!saveAction) throw new Error('no "Save action" button — is a panel open?');
  click(saveAction);
  let header = null;
  for (let i = 0; i < 20 && !header; i++) {
    await sleep(300);
    header = button(/^save$/i);
  }
  if (!header)
    return {
      savedAction: true,
      headerSave: false,
      note: 'the header never left "Saved"; nothing changed?',
    };
  click(header);
  let saved = false;
  for (let i = 0; i < 40 && !saved; i++) {
    await sleep(500);
    saved = !!button(/^saved$/i);
  }
  return {
    savedAction: true,
    headerSave: saved,
    panelStillOpen: !!document.querySelector(".tiptap.ProseMirror"),
  };
})();
