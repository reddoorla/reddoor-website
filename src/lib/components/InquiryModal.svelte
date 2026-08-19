<script lang="ts">
  import { onMount, tick } from "svelte";
  import { fade, scale } from "svelte/transition";
  import { trapFocus } from "$lib/actions/trapFocus";
  import RichTextBody from "$lib/components/RichTextBody.svelte";
  import type { RichTextField } from "@prismicio/client";
  import { stepNumber, numeralNudge } from "$lib/slices/TextColumns/stepNumber";
  import { goto } from "$app/navigation";
  import { questionsFor, SMS_CONSENT, type InquiryAnswers } from "$lib/ghl/questions";
  import { writeHandoff } from "$lib/schedule/handoff";
  import { resolveTimeZone } from "$lib/schedule/slots";
  import { page } from "$app/state";
  import { stripQueryParams } from "$lib/url/stripQueryParams";
  import SendingDots from "$lib/components/SendingDots.svelte";
  import { DEFAULT_INQUIRY_SURVEY_ID } from "$lib/ghl/constants";

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
    /** Shown once the application is in. */
    thanks?: string;
    /**
     * The framework steps, shown as tabs. Passed in from the page so the names,
     * order and copy stay in Prismic rather than being duplicated here.
     */
    steps?: InquiryStep[];
    /**
     * GHL wiring, from the industry document's Inquiry tab. Blank falls back to
     * the A-101 application funnel, so the flow works before the tab is filled
     * in — and a future industry page can point at its own survey.
     *
     * Survey only: the CRM sync runs server-side through the contacts API, which
     * has no per-form route, so a form id no longer addresses anything. The
     * survey id still selects the question set AND the custom fields the server
     * will write.
     */
    surveyId?: string;
    /** The page uid; recorded in the CRM's attribution note. */
    campaign?: string;
    class?: string;
  }

  let {
    // Typographic apostrophe, as the board sets it.
    title = "Let’s Get Started!",
    prompt = "Enter your email, then answer 5 questions to see if you're a good fit:",
    thanks = "Thanks — your application is in. We'll review it and be in touch shortly.",
    steps = [],
    surveyId = "",
    campaign = "",
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

  // ---- the two-form flow -------------------------------------------------
  // Frame one is the email capture (the CRM's "Application Step 1" form);
  // frames two onward are the five-question survey plus its contact slide.
  // The email goes up the moment frame one submits, so a visitor who bails
  // mid-questions is still a captured lead — that is the point of splitting
  // the flow in two.
  type Frame = "email" | "question" | "contact" | "sent";
  let frame = $state<Frame>("email");
  let qIndex = $state(0);
  let answers = $state<InquiryAnswers>({});
  let fullName = $state("");
  let phone = $state("");
  let smsConsent = $state(false);
  /** Field-level messages for the contact frame; keyed by input. */
  let contactErrors = $state<{ name?: string; phone?: string; consent?: string }>({});
  /** Focus lands here when a wizard frame changes — see goTo(). */
  let frameHeading = $state<HTMLElement>();
  /** The thank-you paragraph; focused on entry so a screen reader announces it. */
  let sentEl = $state<HTMLElement>();
  // Bumped on every fresh open. A submit captures the current value before it
  // awaits; if a close→reopen starts a new session mid-flight, the stale
  // continuation sees the mismatch and refuses to touch the new session's state.
  // Plain (not $state) — it gates control flow, it is never rendered.
  let session = 0;

  const resolvedSurveyId = $derived(surveyId.trim() || DEFAULT_INQUIRY_SURVEY_ID);
  /**
   * undefined when the document points at a survey this build has no question
   * set for: step one still captures the email, and the flow ends at the
   * thank-you rather than submitting answers a different survey would misfile.
   */
  const questions = $derived(questionsFor(resolvedSurveyId));
  const question = $derived(questions?.[qIndex]);

  const emailLooksValid = $derived(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()));
  /** The modal is one frame, and that frame is step one. */
  const firstStep = $derived(steps[0]);
  /** The section the opening CTA named via data-inquire-step, if any. */
  let triggerStep = $state<string | undefined>();
  /** Sent to ingest so a lead traces back to the CTA/section it came from —
   *  the trigger's own step when it gave one, else the first framework step. */
  const stepLabel = $derived((triggerStep ?? firstStep?.title)?.replace(/:$/, "") ?? "");
  /** Sent to the server for the CRM's attribution note (the API cannot write
   *  real attribution — see $lib/ghl/client). */
  const campaignSlug = () =>
    campaign || location.pathname.split("/").filter(Boolean).pop() || "industry";

  // Svelte transitions are JS-driven, so the stylesheet's reduced-motion block
  // can't reach them — the fade/scale below would keep running for someone who
  // asked for no motion. Collapsing the duration to 0 is what actually honours
  // the preference. Guarded for SSR, where the component's script still runs.
  const motionDuration =
    typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 300
      : 0;

  function show(step?: string) {
    // A visitor who closed the modal mid-questions resumes where they were:
    // their email is already captured and re-asking five answered questions is
    // how applications get abandoned. Everything else — a fresh open, a
    // finished application, a lingering error on frame one — resets so a
    // previous visitor's state never greets the next.
    if (frame === "question" || frame === "contact") {
      // Resuming — but never clear a still-in-flight submit, or its guard drops
      // and the visitor could fire a second one on reopen.
      if (status !== "sending") {
        status = "idle";
        error = "";
      }
      open = true;
      return;
    }
    resetSession(step);
    openedAt = Date.now();
    open = true;
  }

  /**
   * Everything a fresh visitor should see, and the bumped session id that
   * invalidates any submit still in flight from the last one.
   *
   * Shared by show()'s fresh branch and the post-submit hand-off. A finished
   * application MUST reset rather than merely close: the layout crossfades
   * routes inside a `{#key}` block, so a Back pressed during the transition
   * revives this very instance, and an unreset one would let show() take its
   * resume path straight back into a completed application's contact frame.
   */
  function resetSession(step?: string) {
    session++;
    triggerStep = step;
    status = "idle";
    error = "";
    email = "";
    botField = "";
    frame = "email";
    qIndex = 0;
    answers = {};
    fullName = "";
    phone = "";
    smsConsent = false;
    contactErrors = {};
  }

  /**
   * Resume an abandoned application from the CRM's chase link.
   *
   * A-102-1 texts and emails a lead who gave their email and never finished the
   * questions. That link carries `?email=&full_name=&phone=` — and the whole
   * reason they are being chased is that step one ALREADY succeeded, so landing
   * them back on the email field asks for the one thing we demonstrably have.
   * This opens straight into the questions instead.
   *
   * Deliberately does NOT re-post to ingest. Their email was captured when they
   * first submitted it; sending it again would file a second lead for the same
   * person, which is exactly what the chase exists to avoid.
   *
   * The params are stripped immediately — an email address in a URL is an email
   * address in the browser history and in anything that later reads
   * `location.href`. gtag.js is deferred until the first pointer/key/scroll
   * event (see app.html), so it initialises after this and reads a clean URL.
   * That ordering is the only thing keeping a lead's address out of analytics;
   * move GA back to load-time and this stops being sufficient.
   *
   * The strip itself lives in `$lib/url/stripQueryParams` — see there for why
   * it defers past hydration before touching the address bar.
   */
  const LINK_PARAMS = ["email", "full_name", "name", "phone"] as const;

  onMount(() => {
    const p = page.url.searchParams;
    const linkEmail = (p.get("email") ?? "").trim();
    const linkName = (p.get("full_name") ?? p.get("name") ?? "").trim();
    const linkPhone = (p.get("phone") ?? "").trim();
    // Unconditional, so even a malformed link leaves nothing in the URL bar.
    stripQueryParams(LINK_PARAMS);

    // An address we cannot use is not a resume — fall through to the normal
    // page, rather than opening a modal over it for no reason.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(linkEmail)) return;

    resetSession();
    openedAt = Date.now();
    email = linkEmail;
    fullName = linkName;
    phone = linkPhone;
    open = true;
    // Where a build has no question set for this survey, there is nothing to
    // resume INTO; frame one prefilled is the honest fallback.
    if (questions?.length) void goTo("question", 0);
  });

  function close() {
    open = false;
  }

  /** Move between frames, landing focus on the new frame's heading — without
   *  it a keyboard or screen-reader user is left on a button that vanished. */
  async function goTo(next: Frame, index = qIndex) {
    frame = next;
    qIndex = index;
    status = "idle";
    error = "";
    await tick();
    frameHeading?.focus();
  }

  /** Enter the thank-you frame, moving focus to its message so a screen-reader
   *  user is told the application landed rather than left on a vanished button. */
  async function goSent() {
    status = "sent";
    frame = "sent";
    await tick();
    sentEl?.focus();
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
      // A CTA may name the section it sits in via data-inquire-step so the lead
      // traces back to where it was opened; absent that, stepLabel falls back to
      // the first framework step.
      show(trigger.getAttribute("data-inquire-step") || undefined);
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

  // Returns the outcome rather than writing status/error itself — the caller
  // owns those writes and gates them on its session, so a late resolution from
  // a closed-and-reopened modal cannot stamp an error onto a fresh session.
  async function postIngest(
    payload: Record<string, unknown>,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          step: stepLabel,
          botField,
          ts: openedAt,
          // location.href carries the utm_* params the CRM's attribution note
          // is built from, so no separate params field is needed.
          sourceUrl: location.href,
          referrer: document.referrer,
          campaign: campaignSlug(),
          surveyId: resolvedSurveyId,
          // Set on the contact from the first touch, so any CRM send that
          // quotes a time — not just the booking confirmation — renders in the
          // visitor's zone instead of the location's Mountain.
          timezone: resolveTimeZone(),
          ...payload,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: data?.error ?? "Something went wrong. Please try again." };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: "Something went wrong. Please try again." };
    }
  }

  async function submitEmail(e: SubmitEvent) {
    e.preventDefault();
    if (status === "sending") return;
    if (!emailLooksValid) {
      status = "error";
      error = "Please provide a valid email address.";
      await tick();
      document.getElementById("inquiry-email")?.focus();
      return;
    }
    // Snapshot everything the deferred work needs BEFORE any await, and tag the
    // session, so a close→reopen mid-flight can neither corrupt the CRM fire's
    // email nor write frame/status onto whatever replaced this session.
    const mySession = session;
    const capturedEmail = email.trim();
    status = "sending";
    error = "";

    const res = await postIngest({ email: capturedEmail });
    if (!res.ok) {
      if (session === mySession) {
        status = "error";
        error = res.error;
        await tick();
        document.getElementById("inquiry-email")?.focus();
      }
      return;
    }

    // A close→reopen during the POST starts a new session; leave its frame alone.
    if (session !== mySession) return;
    if (questions?.length) {
      await goTo("question", 0);
    } else {
      await goSent();
    }
  }

  function toggleOption(tag: string, option: string, checked: boolean) {
    const current = (answers[tag] as string[] | undefined) ?? [];
    answers[tag] = checked ? [...current, option] : current.filter((o) => o !== option);
  }

  function isChecked(tag: string, option: string): boolean {
    const v = answers[tag];
    return Array.isArray(v) ? v.includes(option) : v === option;
  }

  async function nextQuestion(e: SubmitEvent) {
    e.preventDefault();
    if (!questions) return;
    if (qIndex < questions.length - 1) {
      await goTo("question", qIndex + 1);
    } else {
      await goTo("contact");
    }
  }

  async function back() {
    if (frame === "contact") {
      await goTo("question", (questions?.length ?? 1) - 1);
    } else if (qIndex > 0) {
      await goTo("question", qIndex - 1);
    }
  }

  async function submitApplication(e: SubmitEvent) {
    e.preventDefault();
    if (status === "sending") return;

    const errs: typeof contactErrors = {};
    if (!fullName.trim()) errs.name = "Please tell us your name.";
    if (phone.replace(/\D/g, "").length < 10)
      errs.phone = "Please provide a ten-digit phone number.";
    if (!smsConsent) errs.consent = "The application needs your consent to text this number.";
    contactErrors = errs;
    if (Object.keys(errs).length) {
      // Take focus to the first field at fault (each carries aria-invalid +
      // aria-describedby), so a keyboard/SR user hears the error rather than
      // the submit failing in silence.
      await tick();
      const firstId = errs.name ? "inquiry-name" : errs.phone ? "inquiry-phone" : "inquiry-consent";
      document.getElementById(firstId)?.focus();
      return;
    }

    // Snapshot before awaiting (see submitEmail): guards the session and pins
    // the values the deferred CRM fire sends.
    const mySession = session;
    const capturedEmail = email.trim();
    const capturedName = fullName.trim();
    const capturedPhone = phone.trim();
    status = "sending";
    error = "";

    // Empty answers dropped: the questions are optional, and the CRM's own
    // widget omits unanswered fields rather than submitting empty strings.
    const pruned: InquiryAnswers = {};
    for (const [tag, v] of Object.entries(answers)) {
      if (Array.isArray(v) ? v.length : v.trim()) pruned[tag] = v;
    }
    // Human-shaped copy of the answers for the ingest message — built here,
    // beside the wizard that rendered them, so labels can't drift from what
    // the visitor actually saw.
    const answerLines = (questions ?? []).map((q) => ({
      label: q.heading,
      value: answers[q.tag] ?? "",
    }));

    const res = await postIngest({
      email: capturedEmail,
      name: capturedName,
      phone: capturedPhone,
      smsConsent: true,
      answers: answerLines,
      // The same answers keyed by CRM field id. The server whitelists these
      // against its own question table, so an unknown id is dropped, not written.
      fields: pruned,
    });
    if (!res.ok) {
      if (session === mySession) {
        status = "error";
        error = res.error;
      }
      return;
    }

    // Advance only if this is still the live session AND still on the contact
    // frame — a Back during a slow submit must not be yanked to the thank-you.
    if (session !== mySession || frame !== "contact") return;

    // Straight on to the calendar, which is what the template does: booking
    // runs in PARALLEL with vetting ("while we are reviewing your inquiry,
    // please choose a time"), so the call is being scheduled while a human
    // reads the answers. A calendar reachable only from the nav is the failure
    // mode this avoids.
    //
    // The thank-you is not lost by navigating — /schedule opens on "Thanks —
    // your application is in", so the confirmation lands as the destination's
    // own headline rather than flashing here for half a second first.
    writeHandoff({
      email: capturedEmail,
      name: capturedName,
      phone: capturedPhone,
      applied: true,
    });
    // Closed and wound back BEFORE navigating, rather than left mounted to be
    // torn down with the page — see resetSession for what a revived instance
    // would otherwise resume into.
    open = false;
    resetSession();
    try {
      await goto("/schedule");
    } catch {
      // Navigation blocked (an offline SPA hop, a router failure): fall back to
      // the in-modal thank-you so a submitted application is never met with a
      // screen that still says "Submit". No session guard here — the reset above
      // deliberately invalidated the one this submit was tagged with.
      open = true;
      await goSent();
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

      {#if steps.length && frame === "email"}
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
        {#if frame === "sent"}
          <!-- role="status" alone isn't enough: it's inserted already holding
               its text, and a live region only announces text added AFTER it
               exists — so goSent() also moves focus here (tabindex=-1) to
               guarantee the confirmation is read. -->
          <p class="inquiry-sent" role="status" tabindex="-1" bind:this={sentEl}>{thanks}</p>
        {:else if frame === "email"}
          {#if firstStep?.body}
            <div class="inquiry-copy">
              <RichTextBody field={firstStep.body} />
            </div>
          {/if}

          <p class="inquiry-prompt">{prompt}</p>

          <form class="inquiry-form" onsubmit={submitEmail} novalidate>
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
              <!-- aria-busy, not disabled: disabling the button the visitor just
                   activated drops focus to <body>, and on the error path they'd
                   never get it back. The submitEmail guard blocks a re-submit. -->
              <button type="submit" class="inquiry-submit" aria-busy={status === "sending"}>
                {#if status === "sending"}Sending<SendingDots />{:else}Inquire Now{/if}
              </button>
            </div>

            {#if status === "error"}
              <p id="inquiry-error" class="inquiry-error" role="alert">{error}</p>
            {/if}
          </form>
        {:else if frame === "question" && question && questions}
          <!-- Visible progress is decorative (and would be announced twice);
               the heading below carries "Question N of 5" for AT instead. -->
          <div class="inquiry-progress" aria-hidden="true">
            <span class="inquiry-progress-text">Question {qIndex + 1} of {questions.length}</span>
            <span class="inquiry-progress-track">
              <span
                class="inquiry-progress-fill"
                style="width:{((qIndex + 1) / questions.length) * 100}%"
              ></span>
            </span>
          </div>

          <form class="inquiry-quiz" onsubmit={nextQuestion} novalidate>
            {#if question.kind === "text"}
              <h3
                class="inquiry-q-heading"
                id="inquiry-q-heading"
                tabindex="-1"
                bind:this={frameHeading}
              >
                <span class="inquiry-label">Question {qIndex + 1} of {questions.length}:</span>
                {question.heading}
              </h3>
              <input
                class="inquiry-input inquiry-q-text"
                type={question.inputType === "url" ? "url" : "text"}
                inputmode={question.inputType === "url" ? "url" : undefined}
                autocomplete={question.inputType === "url" ? "url" : undefined}
                placeholder={question.placeholder}
                aria-labelledby="inquiry-q-heading"
                value={(answers[question.tag] as string) ?? ""}
                oninput={(e) => (answers[question.tag] = e.currentTarget.value)}
              />
            {:else}
              <!-- A heading + role="group" rather than fieldset/legend: nesting
                   the focus-target heading inside a <legend> makes the whole
                   question (plus the hint) the group's accessible name, so a
                   screen reader announces the question two or three times. Here
                   the heading is a normal focus target and the group borrows it
                   as its name via aria-labelledby (plus the hint for checkboxes). -->
              <h3
                class="inquiry-q-heading"
                id="inquiry-q-heading"
                tabindex="-1"
                bind:this={frameHeading}
              >
                <span class="inquiry-label">Question {qIndex + 1} of {questions.length}:</span>
                {question.heading}
              </h3>
              {#if question.kind === "checkbox"}
                <p class="inquiry-q-hint" id="inquiry-q-hint">Select all that apply.</p>
              {/if}
              <div
                class="inquiry-options"
                role="group"
                aria-labelledby={question.kind === "checkbox"
                  ? "inquiry-q-heading inquiry-q-hint"
                  : "inquiry-q-heading"}
              >
                {#each question.options as opt (opt)}
                  <label class="inquiry-option" class:is-selected={isChecked(question.tag, opt)}>
                    <input
                      type={question.kind}
                      name={question.tag}
                      value={opt}
                      checked={isChecked(question.tag, opt)}
                      onchange={(e) =>
                        question.kind === "checkbox"
                          ? toggleOption(question.tag, opt, e.currentTarget.checked)
                          : (answers[question.tag] = opt)}
                    />
                    <span>{opt}</span>
                  </label>
                {/each}
              </div>
            {/if}

            <div class="inquiry-nav">
              {#if qIndex > 0}
                <button type="button" class="inquiry-ghost" onclick={back}>Back</button>
              {/if}
              <button type="submit" class="inquiry-submit">Next</button>
            </div>
          </form>
        {:else if frame === "contact"}
          <form class="inquiry-quiz" onsubmit={submitApplication} novalidate>
            <h3 class="inquiry-q-heading" tabindex="-1" bind:this={frameHeading}>
              Last step — how do we reach you?
            </h3>

            <div class="inquiry-fields">
              <div>
                <label class="inquiry-field-label" for="inquiry-name">Name</label>
                <input
                  id="inquiry-name"
                  class="inquiry-input inquiry-wide"
                  type="text"
                  autocomplete="name"
                  placeholder="Full Name"
                  required
                  aria-invalid={contactErrors.name ? "true" : undefined}
                  aria-describedby={contactErrors.name ? "inquiry-name-error" : undefined}
                  bind:value={fullName}
                />
                {#if contactErrors.name}
                  <p id="inquiry-name-error" class="inquiry-error">{contactErrors.name}</p>
                {/if}
              </div>

              <div>
                <label class="inquiry-field-label" for="inquiry-phone">Cell number</label>
                <input
                  id="inquiry-phone"
                  class="inquiry-input inquiry-wide"
                  type="tel"
                  inputmode="tel"
                  autocomplete="tel"
                  placeholder="+1 (555) 000-0000"
                  required
                  aria-invalid={contactErrors.phone ? "true" : undefined}
                  aria-describedby={contactErrors.phone ? "inquiry-phone-error" : undefined}
                  bind:value={phone}
                />
                {#if contactErrors.phone}
                  <p id="inquiry-phone-error" class="inquiry-error">{contactErrors.phone}</p>
                {/if}
              </div>

              <div>
                <label class="inquiry-consent" class:is-selected={smsConsent}>
                  <input
                    id="inquiry-consent"
                    type="checkbox"
                    required
                    aria-invalid={contactErrors.consent ? "true" : undefined}
                    aria-describedby={contactErrors.consent ? "inquiry-consent-error" : undefined}
                    bind:checked={smsConsent}
                  />
                  <span>{SMS_CONSENT.label}</span>
                </label>
                {#if contactErrors.consent}
                  <p id="inquiry-consent-error" class="inquiry-error">{contactErrors.consent}</p>
                {/if}
              </div>
            </div>

            {#if status === "error"}
              <p class="inquiry-error" role="alert">{error}</p>
            {/if}

            <div class="inquiry-nav">
              <!-- Disabled while sending so a Back cannot reset the in-flight
                   guard and let a second application submit through. -->
              <button
                type="button"
                class="inquiry-ghost"
                onclick={back}
                disabled={status === "sending"}
              >
                Back
              </button>
              <button type="submit" class="inquiry-submit" aria-busy={status === "sending"}>
                {#if status === "sending"}Sending<SendingDots />{:else}Submit Application{/if}
              </button>
            </div>
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
  .inquiry-submit:hover:not([aria-busy="true"]) {
    background: #aa1419; /* token: primary-dark */
    border-color: #aa1419;
  }
  /* The busy look rides aria-busy rather than :disabled — the button stays
     focusable through the send so focus is never dropped (the handler guards
     the re-submit). */
  .inquiry-submit[aria-busy="true"] {
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
  /* Focus moves here on entry; the ring would read as a stray artifact on a
     confirmation message, so suppress it (mouse) but keep it for keyboard. */
  .inquiry-sent:focus {
    outline: none;
  }
  .inquiry-sent:focus-visible {
    outline: 2px solid #d71920;
    outline-offset: 4px;
  }

  .inquiry-hp {
    position: absolute;
    left: -9999px;
    width: 1px;
    height: 1px;
    overflow: hidden;
  }

  /* ---- question frames --------------------------------------------------- */
  .inquiry-progress {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 22px;
  }
  .inquiry-progress-text {
    font-size: 13px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #6e6f72; /* token: muted */
  }
  .inquiry-progress-track {
    display: block;
    height: 3px;
    border-radius: 2px;
    background: #f0d4d5; /* the board's pale pink, on a non-text element */
    overflow: hidden;
  }
  .inquiry-progress-fill {
    display: block;
    height: 100%;
    background: #d71920; /* token: primary */
    transition: width 300ms;
  }

  .inquiry-q-heading {
    margin: 0 0 12px;
    font-size: 20px;
    font-weight: 400;
    line-height: 1.35;
    color: #000;
  }
  .inquiry-q-heading:focus {
    /* Focus lands here so AT reads the new frame; a visitor who got here by
       mouse shouldn't see a ring appear on a heading they never tabbed to. */
    outline: none;
  }
  .inquiry-q-heading:focus-visible {
    outline: 2px solid #d71920;
    outline-offset: 4px;
  }
  .inquiry-q-hint {
    margin: 0 0 16px;
    font-size: 14px;
    font-weight: 200;
    color: #6e6f72; /* token: muted */
  }

  .inquiry-options {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .inquiry-option {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid #bbbdbf; /* token: light */
    border-radius: 4px;
    font-size: 15px;
    font-weight: 200;
    line-height: 1.4;
    color: #000;
    cursor: pointer;
    transition: border-color 300ms;
  }
  .inquiry-option:hover {
    border-color: #6e6f72;
  }
  .inquiry-option.is-selected {
    border-color: #d71920;
  }
  .inquiry-option input {
    flex: none;
    width: 16px;
    height: 16px;
    margin-top: 2px;
    accent-color: #d71920;
  }
  /* The ring belongs on the card the visitor sees, not the 16px control. */
  .inquiry-option:has(input:focus-visible) {
    outline: 2px solid #d71920;
    outline-offset: 1px;
  }

  .inquiry-q-text,
  .inquiry-wide {
    width: 100%;
  }

  .inquiry-fields {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .inquiry-field-label {
    display: block;
    margin-bottom: 6px;
    font-size: 13px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #6e6f72; /* token: muted */
  }
  .inquiry-consent {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    font-size: 14px;
    font-weight: 200;
    line-height: 1.45;
    color: #000;
    cursor: pointer;
  }
  .inquiry-consent input {
    flex: none;
    width: 16px;
    height: 16px;
    margin-top: 2px;
    accent-color: #d71920;
  }
  .inquiry-consent:has(input:focus-visible) {
    outline: 2px solid #d71920;
    outline-offset: 2px;
  }

  .inquiry-nav {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 22px;
  }
  .inquiry-ghost {
    padding: 12px 22px;
    border: 1px solid #bbbdbf; /* token: light */
    border-radius: 4px;
    background: #fff;
    color: #000;
    font-size: 15px;
    cursor: pointer;
    transition: border-color 300ms;
  }
  .inquiry-ghost:hover {
    border-color: #000;
  }

  /* Zero-footprint mount for the invisible CRM Turnstile. */
  @media (prefers-reduced-motion: reduce) {
    .inquiry-close,
    .inquiry-submit,
    .inquiry-option,
    .inquiry-ghost,
    .inquiry-progress-fill {
      transition: none;
    }
  }
</style>
