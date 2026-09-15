# CRM workflow builder — editing what the API cannot reach

Reddoor's CRM is a GoHighLevel sub-account under the 6 Figure Creative agency
(`app.6figurecreative.com`, location `nluRF7uH234gl3PdTBVD`). Its workflows
send the funnel's emails and texts. What is and is not reachable by API is
worked out in [docs/inquiry-funnel.md](../../docs/inquiry-funnel.md) §6.16 and
§6.20; the short version:

| Thing                                                  | Reachable how                                                   |
| ------------------------------------------------------ | --------------------------------------------------------------- |
| Custom values (`{{custom_values.…}}`)                  | API, one PUT; `src/lib/ghl/`                                    |
| Survey answer options                                  | API (custom-field `options`)                                    |
| Workflow message bodies composed inline (most of ours) | **the builder only** — no API reads or writes them; this folder |
| Survey question text, Marketing → Snippets             | a human in the builder                                          |

The builder can be driven from a script, so "builder only" no longer means "a
human". It does still mean: **read it back after every save**, because an
unsaved panel edit looks persisted from inside the editor and is gone on
reload.

**Rule 1 of the funnel doc applies: no CRM writes without Tucker's explicit
permission.** The auto-mode permission classifier refuses a script that
dispatches events into the CRM until that permission is in the conversation;
read-only steps pass.

## How it works

The automation UI is a **cross-origin iframe**
(`client-app-automation-workflows.leadconnectorhq.com`) inside the CRM page.
Browser MCP tools (`use_browser`) can navigate the parent tab, but their
selectors do not reach into that frame and real CDP input events never arrive
in it. What works is attaching to the iframe's own debugging target and running
JavaScript there with synthetic events. `ghl-cdp.mjs` does the attaching; the
files in `browser/` are the JavaScript.

Prerequisites:

- A Chrome with `--remote-debugging-port=9222`. The superpowers-chrome MCP
  browser is one; its profile keeps the CRM login between sessions. If a
  navigate lands on the sign-in page, `show_browser` (which restarts Chrome
  headed) has been enough to bring the session back; otherwise a human signs in
  once in that window.
- Node 24 (global `fetch` and `WebSocket`; nothing to install).
- The CRM re-prompts a **notifications permission dialog** on most navigations.
  With `use_browser`, click `dialog::dismiss` and repeat the navigate.

## The recipe (what edited A-102-1 on 2026-09-15)

Every step prints what it found; stop when a step does not.

1. **Find the workflow id.** Folders cannot be opened by URL (`parentId` and
   `folderId` query params are ignored), so search the list store instead.

   ```sh
   # use_browser navigate → https://app.6figurecreative.com/v2/location/nluRF7uH234gl3PdTBVD/automation/workflows
   node scripts/crm/ghl-cdp.mjs --file scripts/crm/browser/find-workflow.js --args '{"query":"A-102"}'
   ```

2. **Open the builder** by deep link on the parent tab (singular `workflow`;
   `workflows/<id>` is an empty shell):
   `…/automation/workflow/<id>`.

3. **Read the saved definition** — which actions exist, and every href in every
   email body. The JSON sits in no store; the script hooks XHR and bounces the
   router to refetch it.

   ```sh
   node scripts/crm/ghl-cdp.mjs --file scripts/crm/browser/capture-workflow.js --args '{"id":"<id>"}'
   ```

4. **Open the action** by the name on its node.

   ```sh
   node scripts/crm/ghl-cdp.mjs --file scripts/crm/browser/open-action.js --args '{"name":"Inquiry reminder 1"}'
   ```

5. **Change the link.** Email bodies are TipTap (`.tiptap.ProseMirror`). Editing
   the `<a href>` in the DOM is silently redrawn from the editor's state, and
   cloning the node to force a re-parse reverts as well. TipTap leaves its
   `Editor` on the element (`el.editor`), and a ProseMirror transaction against
   it is the one edit that sticks.

   ```sh
   node scripts/crm/ghl-cdp.mjs --file scripts/crm/browser/set-link-href.js \
     --args '{"match":"/inquiry?","append":"&funnel={{contact.funnel}}"}'
   ```

   SMS bodies are also ProseMirror; for plain text `execCommand("selectAll")`
   - `insertText` with raw `{{tags}}` works there (they become chips; a
     `[data-cv-state=invalid]` chip means the tag is wrong — `{{contact.name}}`,
     not `{{contact.full_name}}`).

6. **Save, twice.** The panel button is literally "Save action"; then the header
   "Save" appears (it reads "Saved" until something changed) and must be clicked
   too. Each header save bumps the workflow `version` and keeps `status`.

   ```sh
   node scripts/crm/ghl-cdp.mjs --file scripts/crm/browser/save-workflow.js
   ```

7. **Verify from the server.** Navigate the parent tab to the builder again
   (fresh load), then run step 3 and read the hrefs back.

If a panel gets stuck (Cancel, X and Escape all refuse) after heavy synthetic
interaction, `location.reload()` inside the iframe and redo the step.

## Edits made this way

| Date       | Workflow                   | Change                                                                                                          | Versions |
| ---------- | -------------------------- | --------------------------------------------------------------------------------------------------------------- | -------- |
| 2026-08-24 | A-102-3 Appointment Booked | Consolidated Tim's pre-call texts (SMS bodies via `execCommand`)                                                | —        |
| 2026-09-15 | A-102-1 Inquiry Started    | `&funnel={{contact.funnel}}` appended to the `/inquiry?…` link in "Inquiry reminder 1" and "Inquiry reminder 3" | 11 → 13  |

Known gap seen on the way: "Inquiry reminder 2" (`Still interested?`) in
A-102-1 has no link at all.

Workflow ids as of 2026-09-15 (A-101 folder `2627d9f1-4ab7-4c69-9a9f-b28423395f58`):

| Workflow                                | id                                     |
| --------------------------------------- | -------------------------------------- |
| A-102-1. Inquiry Started                | `16c0b36c-dbaf-4221-a8e0-1cdd73e7882b` |
| A-102-2. New Inquiry Submitted          | `006e248e-2b58-40c3-bfd1-0b20a9800da6` |
| A-102-3. Appointment Booked + Reminders | `16c2a705-040c-49ae-9c96-3bfe7f8dbbb9` |
| A-102-4. Lead Approved                  | `079a0953-d7e7-43ce-8f56-b2c4e6a830cb` |
| A-102-5. Lead Rejected                  | `b891ef5b-1275-4052-8015-d2363d2699b8` |
| A-102-6 Fibonacci Followup              | `088b3f4f-09c3-49c6-a6e6-ab44259cbf1c` |
