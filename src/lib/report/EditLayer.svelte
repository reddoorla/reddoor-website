<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { resolveTargets, type EditTarget } from "./editable";
  import type { OverrideMap } from "./fetch";

  let {
    targets,
    token,
    overrides,
  }: { targets: EditTarget[]; token: string; overrides: OverrideMap } = $props();

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
    const leaves: HTMLElement[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(`main :is(${LEAF})`)) {
      // Leaves only: a container whose text happens to equal a target's would
      // otherwise swallow the child that actually renders it.
      if (el.querySelector(LEAF)) continue;
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
    if (text === original) delete next[key];
    else next[key] = { original, text };

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

<aside class="rd-edit-bar">
  <strong>Editing.</strong>
  {resolved} lines editable{ambiguous > 0 ? `, ${ambiguous} skipped as ambiguous` : ""}.
  {#if saving}<span>Saving…</span>{/if}
  {#if failed}<span class="rd-edit-failed">{failed}</span>{/if}
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
  :global(.rd-editable:focus) {
    outline: 2px solid #d71920;
    outline-offset: 2px;
  }
  :global(.rd-editable:hover) {
    background: rgba(215, 25, 32, 0.06);
  }
</style>
