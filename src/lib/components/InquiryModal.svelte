<script lang="ts">
  import { fade, scale } from "svelte/transition";
  import { trapFocus } from "$lib/actions/trapFocus";
  import RichTextBody from "$lib/components/RichTextBody.svelte";
  import type { RichTextField } from "@prismicio/client";
  import { stepNumber, numeralNudge } from "$lib/slices/TextColumns/stepNumber";

  export type InquiryStep = {
    title: string;
    subtitle?: string;
    body?: RichTextField;
  };

  interface Props {
    /** Heading, per the board. */
    title?: string;
    /** The line above the field. */
    prompt?: string;
    /**
     * The framework steps, shown as tabs. Passed in from the page so the names,
     * order and copy stay in Prismic rather than being duplicated here.
     */
    steps?: InquiryStep[];
    class?: string;
  }

  let {
    // Typographic apostrophe, as the board sets it.
    title = "Let’s Get Started!",
    prompt = "Enter your email, then answer 5 questions to see if you're a good fit:",
    steps = [],
    class: className = "",
  }: Props = $props();

  let open = $state(false);
  let email = $state("");
  let status = $state<"idle" | "sending" | "sent" | "error">("idle");
  let error = $state("");
  // Planted when the modal opens rather than server-side: these pages are
  // prerendered, so there is no per-request timestamp to bake in. It still
  // measures fill time, which is what the bot screen actually reads.
  let openedAt = 0;
  // Honeypot. A real visitor never sees or fills this.
  let botField = $state("");

  const emailLooksValid = $derived(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()));
  /** The modal is one frame, and that frame is step one. */
  const firstStep = $derived(steps[0]);
  /** Sent to ingest so a lead traces back to the step it came from. */
  const stepLabel = $derived(firstStep?.title?.replace(/:$/, "") ?? "");

  // Svelte transitions are JS-driven, so the stylesheet's reduced-motion block
  // can't reach them — the fade/scale below would keep running for someone who
  // asked for no motion. Collapsing the duration to 0 is what actually honours
  // the preference. Guarded for SSR, where the component's script still runs.
  const motionDuration =
    typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 300
      : 0;

  function show() {
    // Reset per-open so a previous error or success never greets the next
    // visitor who opens it.
    status = "idle";
    error = "";
    email = "";
    botField = "";
    openedAt = Date.now();
    open = true;
  }

  function close() {
    open = false;
  }

  // Delegated so every CTA on the page works without each slice knowing the
  // modal exists: content points a button at `/contact#inquire` and this picks
  // it up. That href is deliberately a real destination rather than a bare
  // `#inquire` — the contact form carries `id="inquire"`, so with JS off (or
  // before hydration) the CTA still lands on a working form instead of doing
  // nothing. SvelteKit's prerender link check enforces this: a fragment with no
  // matching id fails the build.
  //
  // Capture phase, so it runs before SvelteKit's client router sees the click.
  $effect(() => {
    const onClick = (e: MouseEvent) => {
      // Let modified clicks through — a Cmd/ctrl-click should not be swallowed.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      const trigger = (e.target as Element | null)?.closest?.(
        'a[href="#inquire"], a[href$="#inquire"], [data-inquire]',
      );
      if (!trigger) return;
      e.preventDefault();
      show();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  });

  // Lock the background while the overlay is up, and put it back exactly as it
  // was. Reading the value into a local (not reassigning the same reactive
  // state) keeps this out of the self-write trap that kills the effect scheduler.
  //
  // `overflow: hidden` alone removes the scrollbar, which widens the viewport by
  // its width and jolts the whole page — including the fixed nav — sideways as
  // the modal opens. `scrollbar-gutter: stable` keeps that space reserved while
  // the bar is gone, so the scroll is arrested with nothing moving. Where it is
  // unsupported (Safari < 18.2) fall back to padding the body by the measured
  // scrollbar width, which fixes the page but not the fixed nav.
  $effect(() => {
    if (!open) return;
    const root = document.documentElement;
    const body = document.body;
    const prev = {
      overflow: body.style.overflow,
      gutter: root.style.scrollbarGutter,
      padRight: body.style.paddingRight,
    };
    const canGutter = typeof CSS !== "undefined" && CSS.supports?.("scrollbar-gutter", "stable");

    if (canGutter) {
      root.style.scrollbarGutter = "stable";
    } else {
      // Measure BEFORE hiding the bar — afterwards the difference is zero.
      const barWidth = window.innerWidth - root.clientWidth;
      if (barWidth > 0) {
        const current = parseFloat(getComputedStyle(body).paddingRight) || 0;
        body.style.paddingRight = `${current + barWidth}px`;
      }
    }
    body.style.overflow = "hidden";

    return () => {
      body.style.overflow = prev.overflow;
      root.style.scrollbarGutter = prev.gutter;
      body.style.paddingRight = prev.padRight;
    };
  });

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (status === "sending") return;
    if (!emailLooksValid) {
      status = "error";
      error = "Please provide a valid email address.";
      return;
    }
    status = "sending";
    error = "";
    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          step: stepLabel,
          botField,
          ts: openedAt,
          sourceUrl: location.href,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        status = "error";
        error = data?.error ?? "Something went wrong. Please try again.";
        return;
      }
      status = "sent";
    } catch {
      status = "error";
      error = "Something went wrong. Please try again.";
    }
  }
</script>

{#if open}
  <!-- The backdrop is a plain div with a sibling close button rather than a
       clickable div: the dialog below owns the semantics, and a click-to-close
       backdrop that is also a focusable control would be a second, confusing
       tab stop. Keyboard users close with Escape or the × button. -->
  <div
    class="inquiry-backdrop {className}"
    transition:fade={{ duration: motionDuration }}
    onclick={(e) => {
      if (e.target === e.currentTarget) close();
    }}
    aria-hidden="true"
  ></div>

  <div class="inquiry-wrap" transition:scale={{ duration: motionDuration, start: 0.97 }}>
    <div
      class="inquiry"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inquiry-title"
      use:trapFocus={{ onEscape: close }}
    >
      <button type="button" class="inquiry-close" onclick={close} aria-label="Close">
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
          <path d="M1 1L15 15M15 1L1 15" stroke="currentColor" stroke-width="1.5" />
        </svg>
      </button>

      <h2 id="inquiry-title" class="inquiry-title">{title}</h2>

      {#if steps.length}
        <!-- Not tabs. This is one frame that says "you are at step one" — the
             other two are there to place it in the framework, not to be picked.
             So: static markup, nothing focusable, no panel to control. An
             earlier pass made these real tabs, which promised movement the
             design never intended to offer.

             `aria-hidden` because the copy below already names the step, and
             the run of numbers and labels would otherwise be read out before
             every visitor reached it. -->
        <div class="inquiry-steps" aria-hidden="true">
          {#each steps as s, i (i)}
            <div class="inquiry-step" class:is-active={i === 0}>
              <span class="inquiry-step-num">
                <span
                  class="inquiry-step-digits"
                  style="--digit-nudge:{numeralNudge(stepNumber(i))}px">{stepNumber(i)}</span
                >
                {#if i === 0}
                  <!-- The board drops the process rail's arrow out of the
                       current step: a rule down to a chevron, not a loose
                       chevron. Same join as the rail — the head is pulled back
                       by its full depth so the rule ends at the vertex. -->
                  <span class="inquiry-step-arrow">
                    <span class="inquiry-step-arrow-line"></span>
                    <svg class="inquiry-step-arrow-head" viewBox="0 0 16 9" fill="none">
                      <path
                        d="M1 1L8 8L15 1"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="square"
                      />
                    </svg>
                  </span>
                {/if}
              </span>
              <span class="inquiry-step-label">
                <!-- Trailing colon trimmed for display only. The CMS titles read
                     "The Diagnosis:" because the process rail sets them on their
                     own line above the subtitle; here they sit inline and the
                     board draws no colon. Presentation, not a copy edit — the
                     text stays editable in Prismic. -->
                <span class="inquiry-step-title">{s.title?.replace(/:$/, "")}</span>
                {#if i === 0 && s.subtitle}
                  <span class="inquiry-step-sub">{s.subtitle}</span>
                {/if}
              </span>
            </div>
          {/each}
        </div>
      {/if}

      <div>
        {#if status === "sent"}
          <!-- Announced: the form it replaces is gone from the DOM, so without a
               live region a screen-reader user gets no confirmation. -->
          <p class="inquiry-sent" role="status">
            Thanks — we've got it. We'll be in touch shortly.
          </p>
        {:else}
          {#if firstStep?.body}
            <div class="inquiry-copy">
              <RichTextBody field={firstStep.body} />
            </div>
          {/if}

          <p class="inquiry-prompt">{prompt}</p>

          <form class="inquiry-form" onsubmit={submit} novalidate>
            <!-- Honeypot: off-screen, not display:none (some bots skip hidden
                 fields), and hidden from AT + the tab order. -->
            <div class="inquiry-hp" aria-hidden="true">
              <label for="inquiry-company">Company</label>
              <input
                id="inquiry-company"
                type="text"
                tabindex="-1"
                autocomplete="off"
                bind:value={botField}
              />
            </div>

            <label class="inquiry-label" for="inquiry-email">Email address</label>
            <div class="inquiry-row">
              <input
                id="inquiry-email"
                class="inquiry-input"
                type="email"
                inputmode="email"
                autocomplete="email"
                placeholder="you@domain.com"
                required
                data-autofocus
                aria-describedby={status === "error" ? "inquiry-error" : undefined}
                aria-invalid={status === "error" ? "true" : undefined}
                bind:value={email}
              />
              <button type="submit" class="inquiry-submit" disabled={status === "sending"}>
                {status === "sending" ? "Sending…" : "Inquire Now"}
              </button>
            </div>

            {#if status === "error"}
              <p id="inquiry-error" class="inquiry-error" role="alert">{error}</p>
            {/if}
          </form>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .inquiry-backdrop {
    position: fixed;
    inset: 0;
    z-index: 60;
    background: rgb(38 38 38 / 0.88);
  }
  .inquiry-wrap {
    position: fixed;
    inset: 0;
    z-index: 61;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    /* The wrapper is only a positioner — without this the full-bleed flex box
       would swallow clicks meant for the backdrop behind it. */
    pointer-events: none;
  }
  .inquiry {
    position: relative;
    pointer-events: auto;
    width: 100%;
    max-width: 640px; /* the board's popup width */
    max-height: calc(100vh - 40px);
    overflow-y: auto;
    /* The board's card: generous padding and a soft radius. */
    padding: 46px 52px 52px;
    border-radius: 24px;
    background: #fff;
    font-family: "pragmatica", "helvetica", sans-serif;
  }
  @media (max-width: 640px) {
    .inquiry {
      padding: 32px 24px 36px;
      border-radius: 16px;
    }
  }

  .inquiry-close {
    position: absolute;
    top: 16px;
    right: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    color: #6e6f72; /* token: muted */
    cursor: pointer;
    transition: color 300ms;
  }
  .inquiry-close:hover {
    color: #000;
  }
  .inquiry-close svg {
    width: 16px;
    height: 16px;
  }

  /* Besley 54 — the board's popup headline. Family and size pinned because the
     global `h2` rule would otherwise supply its own. */
  .inquiry-title {
    margin: 0 0 34px;
    font-family: "besley", "georgia", serif;
    font-size: 54px;
    font-weight: 400;
    line-height: 1.08;
    color: #d71920; /* token: primary */
  }
  @media (max-width: 640px) {
    .inquiry-title {
      margin-bottom: 24px;
      font-size: 34px;
    }
  }

  /* ---- step row (decorative, nothing here is clickable) ----------------- */
  .inquiry-steps {
    display: flex;
    flex-wrap: wrap;
    gap: 14px 26px;
    margin-bottom: 30px;
  }
  .inquiry-step {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    text-align: left;
    /* The board's pale pink for the two steps you are not on. It only reads as
       "not this one" because the active step sits beside it at full strength —
       and it is legitimate here ONLY because this row is decorative: it names
       no destination and controls nothing, the copy below says which step you
       are on, and the whole block is aria-hidden. If these ever become real
       controls again, this colour has to go back up — it is ~2.4:1 on white. */
    color: #eba3a6;
  }
  .inquiry-step.is-active {
    color: #d71920; /* token: primary */
  }

  .inquiry-step-num {
    position: relative;
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: 1.5px solid currentColor;
    border-radius: 50%;
    font-size: 14px;
    font-weight: 400;
    line-height: 24px;
  }
  .is-active .inquiry-step-num {
    border-color: currentColor;
  }
  /* Same circle, same correction as the process rail — see .step-num-digits in
     slices/TextColumns for the full reasoning. Short version: `--digit-nudge`
     (set in the markup) carries the trailing tracking and the numeral's own
     bearings in one number, and 0.75px drops the ink onto the circle's middle
     instead of its metrics. Both on the transform, none on the box — Firefox
     snaps a transformed element's layout position, so a half-pixel box offset
     comes back as a whole one. */
  .inquiry-step-digits {
    letter-spacing: 1px;
    transform: translate(var(--digit-nudge, 0px), 0.75px);
  }
  /* Absolute so the arrow hangs below the circle without adding height and
     pushing the row's baseline off the label beside it. */
  .inquiry-step-arrow {
    position: absolute;
    top: 100%;
    left: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 16px;
    height: 26px;
    margin-left: -8px;
  }
  .inquiry-step-arrow-line {
    flex: 1 1 auto;
    width: 1.5px;
    background: currentColor;
  }
  .inquiry-step-arrow-head {
    flex: none;
    width: 16px;
    height: 9px;
    /* Back by the box's full depth, so the rule runs under the head and stops
       at the vertex rather than at the chevron's open ends — see the process
       rail, where getting this wrong left a visible 8px gap. */
    margin-top: -9px;
    /* The mitred vertex overshoots its own viewBox by ~1px. Let it paint. */
    overflow: visible;
  }

  .inquiry-step-label {
    display: flex;
    flex-direction: column;
    padding-top: 3px;
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .inquiry-step-title {
    font-weight: 300;
  }
  .is-active .inquiry-step-title {
    font-weight: 700;
  }
  .inquiry-step-sub {
    font-weight: 300;
  }

  /* ---- panel ------------------------------------------------------------ */
  .inquiry-copy :global(p) {
    margin: 0 0 12px;
    font-size: 16px;
    font-weight: 200;
    line-height: 1.55;
    color: #000;
  }
  .inquiry-copy :global(p:last-child) {
    margin-bottom: 0;
  }

  .inquiry-prompt {
    margin: 26px 0 0;
    font-size: 16px;
    font-weight: 200;
    line-height: 1.5;
    color: #000;
  }

  .inquiry-form {
    margin-top: 14px;
  }
  /* Visible-label equivalent: the placeholder alone is not a label, and it
     disappears the moment the field has content. */
  .inquiry-label {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .inquiry-row {
    display: flex;
    gap: 12px;
  }
  @media (max-width: 520px) {
    .inquiry-row {
      flex-direction: column;
    }
  }
  .inquiry-input {
    flex: 1 1 auto;
    min-width: 0;
    padding: 12px 14px;
    border: 1px solid #bbbdbf; /* token: light */
    border-radius: 4px;
    font-size: 16px; /* below 16 iOS Safari zooms the page on focus */
    font-weight: 200;
    color: #000;
    background: #fff;
  }
  .inquiry-input::placeholder {
    color: #6e6f72; /* token: muted — 4.6:1 on white */
  }
  .inquiry-input:focus-visible {
    outline: 2px solid #d71920;
    outline-offset: 1px;
  }
  .inquiry-submit {
    flex: none;
    padding: 12px 22px;
    border: 1px solid #d71920;
    border-radius: 4px;
    background: #d71920; /* token: primary */
    color: #fff;
    font-size: 15px;
    white-space: nowrap;
    cursor: pointer;
    transition: background-color 300ms;
  }
  .inquiry-submit:hover:not(:disabled) {
    background: #aa1419; /* token: primary-dark */
    border-color: #aa1419;
  }
  .inquiry-submit:disabled {
    opacity: 0.7;
    cursor: default;
  }

  .inquiry-error {
    margin: 12px 0 0;
    font-size: 14px;
    line-height: 20px;
    color: #aa1419; /* token: primary-dark — 5.9:1 on white */
  }
  .inquiry-sent {
    margin: 0;
    font-size: 16px;
    font-weight: 200;
    line-height: 1.5;
    color: #000;
  }

  .inquiry-hp {
    position: absolute;
    left: -9999px;
    width: 1px;
    height: 1px;
    overflow: hidden;
  }

  @media (prefers-reduced-motion: reduce) {
    .inquiry-close,
    .inquiry-submit {
      transition: none;
    }
  }
</style>
