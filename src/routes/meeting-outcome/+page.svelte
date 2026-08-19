<script lang="ts">
  import { onMount, tick } from "svelte";
  import { page } from "$app/state";
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import SendingDots from "$lib/components/SendingDots.svelte";
  import { OUTCOMES } from "$lib/ghl/outcome";

  /**
   * Logging what happened on a call. Replaces go.reddoorla.com/update.
   *
   * The only page here written for a colleague rather than a lead, and it reads
   * like it: dense, no persuasion, the destructive-sounding fields labelled
   * with who actually sees them. The recap textarea says so twice, because the
   * difference between "internal notes" and "text emailed to the client" is the
   * one mistake on this form that cannot be taken back.
   *
   * `?k=` is a shared key carried by the trigger link. Everything else on this
   * site acts on the person submitting; this writes a sales outcome onto
   * somebody else's record and can send them an email, so it is not left open
   * the way the page it replaces is.
   */

  const key = page.url.searchParams.get("k") ?? "";
  const prefillEmail = page.url.searchParams.get("email") ?? "";
  const prefillName = [
    page.url.searchParams.get("first_name") ?? "",
    page.url.searchParams.get("last_name") ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  let email = $state(prefillEmail);
  let outcome = $state("");
  let leadValue = $state("");
  let internalNotes = $state("");
  let recapNotes = $state("");
  let sendRecap = $state(false);

  let submitting = $state(false);
  let formError = $state("");
  let saved = $state<{
    name: string;
    sendRecap: boolean;
    /** true marked no-show, false the write failed, null nothing to mark. */
    noShowSynced: boolean | null;
  } | null>(null);
  let savedEl = $state<HTMLElement>();

  const isSold = $derived(outcome === "Sold!");

  onMount(() => {
    email = prefillEmail;
  });

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (submitting) return;
    formError = "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      formError = "Please provide the client's email address.";
      document.getElementById("mo-email")?.focus();
      return;
    }
    if (!outcome) {
      formError = "Please choose an outcome.";
      document.getElementById("mo-outcome")?.focus();
      return;
    }
    if (sendRecap && !recapNotes.trim()) {
      formError = "A recap email needs recap notes — that text is what gets sent.";
      document.getElementById("mo-recap")?.focus();
      return;
    }

    submitting = true;
    try {
      const res = await fetch("/api/meeting-outcome", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key,
          email: email.trim(),
          outcome,
          leadValue: isSold ? leadValue.trim() : "",
          internalNotes: internalNotes.trim(),
          recapNotes: recapNotes.trim(),
          sendRecap,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        formError = data?.error ?? "We couldn't save that. Please try again.";
        return;
      }
      saved = {
        name: data?.name ?? "",
        sendRecap: data?.sendRecap === true,
        noShowSynced: data?.noShowSynced ?? null,
      };
      await tick();
      savedEl?.focus();
    } catch {
      formError = "Something went wrong. Please try again.";
    } finally {
      submitting = false;
    }
  }
</script>

<div class="w-screen h-[50vh] max-h-96 relative bg-paper">
  <ContentWidth class="h-full flex flex-col justify-evenly items-start">
    <div class="h-32"></div>
    <h1 class="type-hero text-primary z-10 md:ml-[20%]">
      {saved ? "Logged." : "How did the call go?"}
    </h1>
  </ContentWidth>
</div>

<div class="w-screen bg-white py-16">
  <ContentWidth class="flex flex-col md:flex-row gap-8 mb-32">
    <h2 class="type-kicker md:w-1/5 text-primary shrink-0">
      {saved ? "Saved to the CRM" : "Call outcome"}
    </h2>

    <div class="w-full md:w-4/5 max-w-2xl">
      {#if saved}
        <!-- role="status" alone would not announce: the element is inserted
             already holding its text, and a live region only speaks for text
             added after it exists. Focus is moved here as well. -->
        <div class="done" role="status" tabindex="-1" bind:this={savedEl}>
          <p class="body">
            Outcome recorded{saved.name ? ` against ${saved.name}` : ""}.
          </p>
          {#if saved.noShowSynced === true}
            <p class="body">
              The appointment is marked as a no-show in the calendar too, so the CRM's own
              reschedule follow-up takes it from here.
            </p>
          {:else if saved.noShowSynced === false}
            <p class="body">
              Heads up — we couldn't mark the appointment as a no-show in the calendar. The outcome
              above did save. Please set that status by hand so the reschedule follow-up still goes
              out.
            </p>
          {/if}
          <p class="body">
            {#if saved.sendRecap}
              You asked for a recap email. Heads up — that send is a CRM workflow keyed to a form
              submission, which this page can't fire yet. Check it went out, or send it by hand.
            {:else}
              No recap email was requested.
            {/if}
          </p>
        </div>
      {:else}
        <p class="lede">
          {#if prefillName}
            Logging the call with <strong>{prefillName}</strong>. This writes straight to the CRM
            record.
          {:else}
            This writes straight to the CRM record for the email address below.
          {/if}
        </p>

        <form class="form" onsubmit={submit} novalidate>
          <div>
            <label class="field-label" for="mo-email">Client email</label>
            <input
              id="mo-email"
              class="input"
              type="email"
              inputmode="email"
              autocomplete="off"
              placeholder="them@theircompany.com"
              required
              bind:value={email}
            />
            <p class="hint">
              Used to find the contact. Nothing is created if it doesn't match one.
            </p>
          </div>

          <div>
            <label class="field-label" for="mo-outcome">Appointment outcome</label>
            <select id="mo-outcome" class="input" required bind:value={outcome}>
              <option value="" disabled>Select an option</option>
              {#each OUTCOMES as o (o.value)}
                <option value={o.value}>{o.value}</option>
              {/each}
            </select>
          </div>

          {#if isSold}
            <div>
              <label class="field-label" for="mo-value">Lead value</label>
              <input
                id="mo-value"
                class="input"
                type="text"
                inputmode="decimal"
                autocomplete="off"
                placeholder="12000"
                bind:value={leadValue}
              />
              <p class="hint">Numbers only — the CRM field is a currency amount.</p>
            </div>
          {/if}

          <div>
            <label class="field-label" for="mo-internal">
              Internal notes <span class="tag tag--safe">not sent to anyone</span>
            </label>
            <textarea
              id="mo-internal"
              class="input textarea"
              rows="4"
              placeholder="Anything worth knowing before the next conversation."
              bind:value={internalNotes}></textarea>
          </div>

          <div class="recap" class:is-armed={sendRecap}>
            <label class="check">
              <input type="checkbox" bind:checked={sendRecap} />
              <span>Send the client a conversation recap</span>
            </label>

            <div>
              <label class="field-label" for="mo-recap">
                Recap notes <span class="tag tag--live">emailed to the client</span>
              </label>
              <textarea
                id="mo-recap"
                class="input textarea"
                rows="5"
                placeholder="What you agreed, in the words you'd want them to read."
                aria-describedby="mo-recap-hint"
                bind:value={recapNotes}></textarea>
              <p id="mo-recap-hint" class="hint">
                This text goes to the client verbatim. Internal notes belong in the field above.
              </p>
            </div>
          </div>

          {#if formError}
            <p class="form-error" role="alert">{formError}</p>
          {/if}

          <div class="actions">
            <!-- aria-busy rather than disabled: disabling the button just
                 pressed drops focus to <body>, and on the error path they never
                 get it back. The guard in submit() blocks the re-submit. -->
            <button type="submit" class="submit" aria-busy={submitting}>
              {#if submitting}Saving<SendingDots />{:else}Save outcome{/if}
            </button>
          </div>
        </form>
      {/if}
    </div>
  </ContentWidth>
</div>

<style>
  /* Values, not tokens, matching the rest of this flow. #d71920 primary,
     #aa1419 primary-dark, #bbbdbf light, #6e6f72 muted (4.6:1 on white). */
  .lede {
    margin: 0 0 28px;
    font-size: 18px;
    font-weight: 200;
    line-height: 1.6;
    color: #000;
  }
  .body {
    margin: 0 0 14px;
    font-size: 16px;
    font-weight: 200;
    line-height: 1.6;
    color: #000;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 22px;
    max-width: 560px;
  }
  .field-label {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 6px;
    font-size: 13px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #6e6f72;
  }
  .input {
    display: block;
    width: 100%;
    padding: 12px 14px;
    border: 1px solid #bbbdbf;
    border-radius: 4px;
    background: #fff;
    color: #000;
    font-size: 16px;
    font-weight: 200;
    transition: border-color 300ms;
  }
  .input::placeholder {
    color: #6e6f72;
  }
  .textarea {
    resize: vertical;
    line-height: 1.5;
  }
  .hint {
    margin: 6px 0 0;
    font-size: 13px;
    font-weight: 200;
    color: #6e6f72;
  }

  /* The one distinction on this form worth making visually: what stays inside
     the building, and what a client reads. */
  .tag {
    padding: 2px 7px;
    border-radius: 3px;
    font-size: 12px;
    letter-spacing: 0.5px;
    text-transform: none;
  }
  /* NOT the #6e6f72 muted grey used elsewhere. That is sized against white,
     where it clears AA at 4.6:1 — on this chip's #f1f1f1 it measures 4.44:1 and
     fails. #5f6064 is 5.6:1 on the tint. Same trap the paper texture sets
     elsewhere in this codebase: a muted colour is only muted against the
     surface it was chosen for. */
  .tag--safe {
    background: #f1f1f1;
    color: #5f6064;
  }
  .tag--live {
    background: #aa1419;
    color: #fff;
  }

  .recap {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 18px;
    border: 1px solid #bbbdbf;
    border-radius: 4px;
    transition: border-color 300ms;
  }
  .recap.is-armed {
    border-color: #aa1419;
  }
  .check {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 16px;
    font-weight: 200;
    color: #000;
    cursor: pointer;
  }
  .check input {
    width: 18px;
    height: 18px;
    accent-color: #d71920;
  }

  .actions {
    display: flex;
    gap: 12px;
  }
  .submit {
    padding: 12px 26px;
    border: 1px solid #d71920;
    border-radius: 4px;
    background: #d71920;
    color: #fff;
    font-size: 15px;
    cursor: pointer;
    transition: background-color 300ms;
  }
  .submit:hover:not([aria-busy="true"]) {
    background: #aa1419;
    border-color: #aa1419;
  }
  .submit[aria-busy="true"] {
    cursor: progress;
  }

  .submit:focus-visible,
  .input:focus-visible,
  .check input:focus-visible,
  .done:focus-visible {
    outline: 2px solid #d71920;
    outline-offset: 1px;
  }

  .form-error {
    margin: 0;
    font-size: 14px;
    line-height: 20px;
    /* primary-dark — 5.9:1 on white, where primary alone is 4.0:1. */
    color: #aa1419;
  }

  @media (prefers-reduced-motion: reduce) {
    .submit,
    .input,
    .recap {
      transition: none;
    }
  }
</style>
