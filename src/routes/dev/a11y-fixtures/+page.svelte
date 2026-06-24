<svelte:head>
  <title>a11y fixtures — Reddoor</title>
  <!-- Test-harness target, not a public page: keep it out of search indexes
       (robots.txt also Disallows /dev/). The route still renders so the
       Lighthouse/axe harness can hit it. -->
  <meta name="robots" content="noindex" />
  <meta
    name="description"
    content="Reddoor accessibility fixtures — semantic landmarks, heading hierarchy, and a stable target for @lhci/cli and Playwright + axe-core coverage. Not linked from the public site."
  />
</svelte:head>

<!-- No <main> here: the root layout already wraps every page in
     <main id="main-content">. A second <main> would nest/duplicate the main
     landmark (axe: landmark-no-duplicate-main / landmark-main-is-top-level). -->
<div class="min-h-screen bg-white p-8 text-black">
  <header>
    <h1>Accessibility fixtures</h1>
    <p>
      This page exists so <code>@lhci/cli</code> and Playwright + axe-core have a stable target with predictable
      a11y characteristics. It is not linked from the public site.
    </p>
  </header>

  <section aria-labelledby="landmarks-heading">
    <h2 id="landmarks-heading">Landmarks</h2>
    <p>
      The root layout provides the single <code>main</code> landmark; each section here declares
      <code>aria-labelledby</code> matched to its heading id so screen readers and axe both see a clean
      outline.
    </p>
  </section>

  <section aria-labelledby="links-heading">
    <h2 id="links-heading">Links</h2>
    <p>
      <a href="/">Back to home</a> — relative link with descriptive visible text, so no
      <code>aria-label</code> override is needed.
    </p>
  </section>
</div>
