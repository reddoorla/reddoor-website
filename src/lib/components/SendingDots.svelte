<!--
  The ellipsis on a button that is waiting on the network, animated.

  A static "Sending…" is indistinguishable from a button that did nothing, which
  is exactly the moment a visitor is most likely to press it again — and these
  three buttons sit on the two requests that create a lead and book a real
  appointment. Movement is the cheapest possible "we heard you".

  Three separate glyphs rather than the single U+2026 character, because one
  character cannot be animated in sequence. They are `aria-hidden`, so the
  accessible name stays "Sending" rather than a string that mutates under a
  screen reader mid-announcement; `aria-busy` on the button is what actually
  conveys the state assistively.
-->

<span class="dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>

<style>
  .dots span {
    /* Held at a legible weight rather than fading to nothing: this is an
       ellipsis that breathes, not a loading spinner pretending to be one. */
    opacity: 0.35;
    animation: dot 1.4s ease-in-out infinite;
  }
  .dots span:nth-child(2) {
    animation-delay: 0.18s;
  }
  .dots span:nth-child(3) {
    animation-delay: 0.36s;
  }

  @keyframes dot {
    0%,
    70%,
    100% {
      opacity: 0.35;
    }
    35% {
      opacity: 1;
    }
  }

  /* The dots still read as an ellipsis standing still — the label already says
     "Sending", so nothing is lost by holding them. */
  @media (prefers-reduced-motion: reduce) {
    .dots span {
      opacity: 1;
      animation: none;
    }
  }
</style>
