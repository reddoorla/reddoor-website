<script lang="ts">
  import { fade, scale } from "svelte/transition";
  import { trapFocus } from "$lib/actions/trapFocus";

  interface Props {
    /** Heading, per the board. */
    title?: string;
    /** The line above the field. */
    prompt?: string;
    class?: string;
  }

  let {
    title = "Let's Get Started!",
    prompt = "Enter your email, then answer 5 questions to see if you're a good fit:",
    class: className = "",
  }: Props = $props();

  let open = $state(false);
  // Which control opened it (a step name, or a CTA's label) — forwarded to
  // ingest so a lead can be traced back to the section that produced it.
  let step = $state("");
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

  // Svelte transitions are JS-driven, so the stylesheet's reduced-motion block
  // can't reach them — the fade/scale below would keep running for someone who
  // asked for no motion. Collapsing the duration to 0 is what actually honours
  // the preference. Guarded for SSR, where the component's script still runs.
  const motionDuration =
    typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 300
      : 0;

  function show(from: string) {
    step = from;
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
      show(
        trigger.getAttribute("data-inquire-step") ??
          (trigger.textContent ?? "").replace(/\s+/g, " ").trim(),
      );
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
          step,
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

      {#if step}
        <p class="inquiry-step">{step}</p>
      {/if}

      {#if status === "sent"}
        <!-- Announced: the form it replaces is gone from the DOM, so without a
             live region a screen-reader user gets no confirmation. -->
        <p class="inquiry-sent" role="status">Thanks — we've got it. We'll be in touch shortly.</p>
      {:else}
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
{/if}

<style>
  .inquiry-backdrop {
    position: fixed;
    inset: 0;
    z-index: 60;
    background: rgb(0 0 0 / 0.55);
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
    max-width: 635px; /* the board's popup width */
    max-height: calc(100vh - 40px);
    overflow-y: auto;
    padding: 40px;
    border-radius: 8px;
    background: #fff;
    font-family: "pragmatica", "helvetica", sans-serif;
  }
  @media (max-width: 640px) {
    .inquiry {
      padding: 28px 20px;
    }
  }

  .inquiry-close {
    position: absolute;
    top: 14px;
    right: 14px;
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

  /* Besley 44 — the board's popup headline. Family pinned because the global
     `h2` rule would otherwise supply its own size here. */
  .inquiry-title {
    margin: 0;
    font-family: "besley", "georgia", serif;
    font-size: 44px;
    font-weight: 400;
    line-height: 1.15;
    color: #d71920; /* token: primary */
  }
  @media (max-width: 640px) {
    .inquiry-title {
      font-size: 32px;
    }
  }

  /* Which step opened it — the board's 14/24 +1px uppercase label. */
  .inquiry-step {
    margin: 14px 0 0;
    font-size: 14px;
    font-weight: 700;
    line-height: 24px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #d71920; /* token: primary */
  }

  .inquiry-prompt {
    margin: 18px 0 0;
    font-size: 16px;
    font-weight: 200;
    line-height: 1.5;
    color: #000;
  }

  .inquiry-form {
    margin-top: 20px;
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
    gap: 10px;
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
    padding: 12px 20px;
    border: 1px solid #d71920;
    border-radius: 4px;
    background: #d71920; /* token: primary */
    color: #fff;
    font-size: 14px;
    letter-spacing: 0.08em;
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
    margin: 18px 0 0;
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
