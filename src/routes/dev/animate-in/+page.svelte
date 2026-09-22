<script lang="ts">
  import { animateIn } from "$lib/actions/animateIn";
  import { cascadeIn } from "$lib/actions/cascadeIn";
</script>

<!--
  The axe target for this site's reveal animations (#900).

  This site ships `animateIn` and a `cascadeIn` built on top of it, and until
  now it had no `/dev/animate-in`, so the central a11y audit's second fixture
  scanned nothing here. That is a real coverage gap rather than a false alarm:
  every other fleet site that fails on this route does not ship the action at
  all.

  Nothing on this page is hidden by SERVER markup, and that is deliberate. The
  starter's copy of this fixture ships a `data-reveal` element whose hidden
  state is in the HTML, which is what makes axe sample semi-transparent text
  and produce a flaky color-contrast violation about a third of the time. This
  site has no `[data-reveal]` rule in app.css at all — `animateIn` hides from
  JS only — so there is nothing to reproduce, and the same reasoning the
  a11y-fixtures page states ("fixtures render statically so nothing is
  opacity-hidden when axe scans on load") applies here.
-->

<div class="mx-auto max-w-4xl px-8 py-16">
  <h1>Animation fixtures</h1>
  <p class="type-lede">
    Every parameter shape <code>animateIn</code> accepts, plus the
    <code>cascadeIn</code> wrapper, so the a11y audit scans them.
  </p>

  <section>
    <h2>Default viewport reveal</h2>
    <p use:animateIn>
      Revealed on first intersection with the viewport, at the action's default duration and travel.
    </p>
  </section>

  <section>
    <h2>Triggered mode</h2>
    <p use:animateIn={{ trigger: true }}>
      Driven by its <code>trigger</code> parameter rather than by scroll position.
    </p>
  </section>

  <section>
    <h2>Custom duration</h2>
    <p use:animateIn={{ duration: 800 }}>A snappier reveal at 800ms.</p>
  </section>

  <section>
    <h2>Custom travel</h2>
    <p use:animateIn={{ translateY: "24px" }}>A short slide instead of the default half-height.</p>
  </section>

  <section>
    <h2>No stagger</h2>
    <div class="grid grid-cols-3 gap-4">
      <p use:animateIn={{ delayMax: 0 }}>All</p>
      <p use:animateIn={{ delayMax: 0 }}>Arrive</p>
      <p use:animateIn={{ delayMax: 0 }}>Together</p>
    </div>
  </section>

  <section>
    <h2>Disabled</h2>
    <p use:animateIn={{ enabled: false }}>
      The action is a no-op and this renders exactly as authored. It is here because a disabled
      reveal is the state every reduced-motion reader gets, and it is the one state a scroll-driven
      fixture would never reach.
    </p>
  </section>

  <section>
    <h2>Cascade over children</h2>
    <!--
      cascadeIn gives each child its own scroll trigger. The rich-text case it
      exists for has no authored element to hang `use:animateIn` on, so the
      wrapper is the only surface a test or a scan can reach it through.
    -->
    <div use:cascadeIn>
      <p>Each of these arrives as it reaches the viewport,</p>
      <p>on its own trigger rather than on a shared timer,</p>
      <p>which is what makes the cascade follow the reader.</p>
    </div>
  </section>
</div>
