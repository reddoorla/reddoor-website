<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import {
    changeList,
    resolveTargets,
    showStatement,
    type EditTarget,
    type HideTarget,
  } from "./editable";
  import type { OverrideMap } from "./fetch";

  let {
    targets,
    hideable = [],
    token,
    overrides,
    approved = true,
  }: {
    targets: EditTarget[];
    /** W1: rows the operator can take off the report. */
    hideable?: HideTarget[];
    token: string;
    overrides: OverrideMap;
    /** W1: false for a draft, which no prospect can open yet. */
    approved?: boolean;
  } = $props();

  const changes = $derived(changeList(overrides, targets, hideable));
  let panel = $state<"" | "changes" | "hide">("");

  let resolved = $state(0);
  let ambiguous = $state(0);
  let saving = $state(false);
  let failed = $state("");

  /** Leaf elements only: a container whose text happens to equal a target's
   *  would otherwise swallow the child that actually renders it. */
  const LEAF = "p,li,h2,h3,h4,td,dd,span";

  /**
   * Wire each target to the element that renders it.
   *
   * Matching by text rather than by an id attribute on every render site, on
   * purpose: it keeps the report's own components identical for a prospect and
   * an operator, and it means this whole mechanism can only ever misbehave
   * behind the edit cookie.
   *
   * The decision about WHAT resolves lives in `resolveTargets`, not here, so
   * the safety rule — skip anything ambiguous, never guess — is unit-tested
   * rather than only exercised by a browser test that is skipped without a live
   * token. This function does the DOM half: collect the leaves, then attach to
   * whatever came back resolved.
   */
  function wire(): void {
    // Unwire everything first (review round 2): after a hide, an element can
    // render a different line, and a stale key on it would save an edit nobody
    // typed against the old line.
    for (const el of document.querySelectorAll<HTMLElement>("[data-edit-key]")) {
      delete el.dataset.editKey;
      delete el.dataset.editOriginal;
      el.contentEditable = "inherit";
      el.classList.remove("rd-editable");
      el.removeEventListener("blur", onBlur);
    }
    const leaves: HTMLElement[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(`main :is(${LEAF})`)) {
      // Leaves only: a container whose text happens to equal a target's would
      // otherwise swallow the child that actually renders it.
      if (el.querySelector(LEAF)) continue;
      // The editor's own panels quote report lines; they are not the report.
      if (el.closest(".rd-edit-bar")) continue;
      leaves.push(el);
    }

    const { resolved: hits, ambiguous: skipped } = resolveTargets(
      leaves.map((el) => ({ id: el, text: (el.textContent ?? "").trim() })),
      targets,
    );

    for (const { id: el, target } of hits) {
      el.dataset.editKey = target.key;
      el.dataset.editOriginal = target.original;
      el.contentEditable = "true";
      el.spellcheck = true;
      el.classList.add("rd-editable");
      el.addEventListener("blur", onBlur);
    }

    resolved = hits.length;
    ambiguous = skipped;
  }

  async function onBlur(ev: FocusEvent): Promise<void> {
    const el = ev.currentTarget as HTMLElement;
    const key = el.dataset.editKey;
    const original = el.dataset.editOriginal;
    if (!key || original === undefined) return;

    const text = (el.textContent ?? "").trim();
    const next: OverrideMap = { ...overrides };
    // Typing the generated text back in REMOVES the override rather than
    // storing a no-op, so a report can always be returned to what was measured.
    // An emptied COMPOSED line reverts too (review round 5): a blank composed
    // override renders as the generated text everywhere, so storing one would
    // only mislead. A payload field emptied still blanks that one field for
    // every reader (review round 6), as it always did.
    if (text === original || (text === "" && key.startsWith("composed:"))) delete next[key];
    else next[key] = { original, text };
    await save(next);
  }

  /** W1: take a row off the report, or put it back. */
  async function toggleHidden(t: HideTarget): Promise<void> {
    const next: OverrideMap = t.hidden
      ? showStatement(overrides, t)
      : { ...overrides, [t.key]: { original: t.original, text: "", hidden: true } };
    await save(next);
    // A maintenance deploy older than W1 drops the `hidden` flag and still
    // answers "updated", so check what was stored rather than trust the 200.
    if (!t.hidden && !failed && overrides[t.key]?.hidden !== true) {
      failed = "The hide was not stored: the report server does not support hiding yet.";
    }
  }

  /** W1: undo one change, whatever kind it is. */
  async function revert(key: string): Promise<void> {
    const next: OverrideMap = { ...overrides };
    delete next[key];
    await save(next);
  }

  async function save(next: OverrideMap): Promise<void> {
    saving = true;
    failed = "";
    try {
      const res = await fetch("/api/audit-edit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, overrides: next }),
      });
      if (!res.ok) failed = `Save failed (${res.status}). Your change is not stored.`;
      // Re-read from the server rather than trusting the local edit. An
      // override whose `original` no longer matches is WITHHELD upstream — see
      // the cascade note in the plan — and re-reading is what makes that show
      // up as a line that reverted rather than one that silently disagrees with
      // what is stored.
      else await invalidateAll();
    } catch {
      failed = "Save failed. Your change is not stored.";
    } finally {
      saving = false;
    }
  }

  $effect(() => {
    // Re-wire whenever targets change, which is after every successful save.
    void targets;
    wire();
  });
</script>

<aside class="rd-edit-bar" aria-label="Report editor">
  {#if panel === "changes"}
    <div class="rd-edit-panel">
      {#if changes.length === 0}
        <p>No changes yet. This report shows exactly what the audit wrote.</p>
      {:else}
        <ul>
          {#each changes as c (c.key)}
            <li>
              {#if c.kind === "hidden"}<span>
                  Hidden: {c.before}
                </span>{:else if c.kind === "stale"}<span class="rd-edit-gone">
                  “{c.after}”: no longer applies: the line it reworded has changed or is gone
                </span>{:else}<span>“{c.before}” → “{c.after}”</span>{/if}
              <button type="button" disabled={saving} onclick={() => revert(c.key)}>Revert</button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {:else if panel === "hide"}
    <div class="rd-edit-panel">
      {#if hideable.length === 0}
        <p>Nothing on this report can be hidden.</p>
      {:else}
        <ul>
          {#each hideable as t (t.key)}
            <li>
              <span class:rd-edit-gone={t.hidden}>
                {t.noun}: {t.label ?? (t.original || "(no quote)")}
              </span>
              <button
                type="button"
                disabled={saving || (!t.hidden && !t.canHide)}
                title={!t.hidden && !t.canHide
                  ? "The last row of a section cannot be hidden. Withdraw the report instead."
                  : undefined}
                onclick={() => toggleHidden(t)}
              >
                {t.hidden ? "Show" : "Hide"}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
  <div class="rd-edit-row">
    {#if approved}
      <strong>Editing a live report.</strong> Every save shows to whoever holds the link.
    {:else}
      <strong>Draft, not approved.</strong> Only the editor can open this report.
    {/if}
    {resolved} lines editable{ambiguous > 0 ? `, ${ambiguous} skipped as ambiguous` : ""}.
    <button type="button" onclick={() => (panel = panel === "changes" ? "" : "changes")}>
      Changes ({changes.length})
    </button>
    <button type="button" onclick={() => (panel = panel === "hide" ? "" : "hide")}>
      Hide a row
    </button>
    {#if saving}<span>Saving…</span>{/if}
    {#if failed}<span class="rd-edit-failed" role="alert">{failed}</span>{/if}
  </div>
</aside>

<style>
  .rd-edit-bar {
    position: fixed;
    inset-inline: 0;
    bottom: 0;
    z-index: 100;
    padding: 0.6rem 1rem;
    background: #1a1a1a;
    color: #fff;
    font:
      14px/1.4 system-ui,
      sans-serif;
  }
  .rd-edit-failed {
    color: #ff9a9a;
  }
  .rd-edit-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    align-items: baseline;
  }
  .rd-edit-bar button {
    color: inherit;
    background: transparent;
    border: 1px solid currentColor;
    border-radius: 3px;
    padding: 0.1rem 0.5rem;
    font: inherit;
    cursor: pointer;
  }
  .rd-edit-panel {
    max-height: 40vh;
    overflow-y: auto;
    margin-bottom: 0.5rem;
  }
  .rd-edit-panel ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .rd-edit-panel li {
    display: flex;
    gap: 1rem;
    justify-content: space-between;
    align-items: baseline;
    padding: 0.25rem 0;
    border-bottom: 1px solid #333;
  }
  .rd-edit-gone {
    text-decoration: line-through;
    opacity: 0.7;
  }
  :global(.rd-editable:focus) {
    outline: 2px solid #d71920;
    outline-offset: 2px;
  }
  :global(.rd-editable:hover) {
    background: rgba(215, 25, 32, 0.06);
  }
</style>
