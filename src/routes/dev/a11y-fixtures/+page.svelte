<script lang="ts">
  import type { Content, RichTextField } from "@prismicio/client";
  import { onMount } from "svelte";
  import LeadText from "$lib/slices/LeadText/index.svelte";
  import TextColumns from "$lib/slices/TextColumns/index.svelte";
  import Accordion from "$lib/slices/Accordion/index.svelte";
  import IndustryHero from "$lib/slices/IndustryHero/index.svelte";
  import CaseStudy from "$lib/slices/CaseStudy/index.svelte";
  import LogoGrid from "$lib/slices/LogoGrid/index.svelte";
  import Testimonial from "$lib/slices/Testimonial/index.svelte";
  import FeaturedProject from "$lib/slices/FeaturedProject/index.svelte";
  import ValueBlock from "$lib/slices/ValueBlock/index.svelte";
  import CtaBanner from "$lib/slices/CtaBanner/index.svelte";
  import InquiryModal from "$lib/components/InquiryModal.svelte";

  // Hydration marker for interaction tests: onMount only runs client-side after
  // hydration, so `html[data-hydrated]` is a deterministic "the page is now
  // interactive" signal. Interacting before this races the first click away
  // (Playwright's actionability checks don't wait for framework hydration).
  onMount(() => document.documentElement.setAttribute("data-hydrated", "true"));

  // Minimal API-shaped rich text (a single paragraph). Fixtures render statically
  // (isAnimated: false) so nothing is opacity-hidden when axe scans on load.
  const rt = (text: string): RichTextField =>
    [{ type: "paragraph", text, spans: [] }] as unknown as RichTextField;

  const leadSlice: Content.LeadTextSlice = {
    id: "fixture-lead",
    slice_type: "lead_text",
    slice_label: null,
    variation: "default",
    version: "initial",
    primary: {
      eyebrow: "The Challenge",
      body: rt(
        "As a brand-new global media agency, CANVAS Worldwide wanted to “do business differently”; they needed an identity on a tight timeline to communicate that message from day one.",
      ),
      isAnimated: false,
      hide: false,
    },
    items: [],
  };

  const columnsSlice: Content.TextColumnsSlice = {
    id: "fixture-columns",
    slice_type: "text_columns",
    slice_label: null,
    variation: "default",
    version: "initial",
    primary: {
      eyebrow: "Our Solution",
      hasTopRule: true,
      desktopColumns: "3",
      columns: [
        { title: "Straight A Design", body: rt("Imagination on a blank canvas.") },
        { title: "Collective Buy-In", body: rt("A standing ovation from leadership.") },
        { title: "Collaborative Effort", body: rt("A bold, thought-provoking solution.") },
      ],
      isAnimated: false,
      hide: false,
    },
    items: [],
  };

  const accordionOpen: Content.AccordionSlice = {
    id: "fixture-accordion-open",
    slice_type: "accordion",
    slice_label: null,
    variation: "default",
    version: "initial",
    primary: {
      label: "",
      defaultOpen: true,
      items: [
        {
          title: "About Canvas Worldwide",
          body: rt("A joint venture between INNOCEAN Worldwide and Horizon Media."),
        },
      ],
      hide: false,
    },
    items: [],
  };

  // Second instance starts collapsed to exercise the inert (removed from a11y
  // tree + tab order) branch under axe.
  const accordionClosed: Content.AccordionSlice = {
    ...accordionOpen,
    id: "fixture-accordion-closed",
    primary: {
      label: "",
      defaultOpen: false,
      hide: false,
      items: [
        {
          title: "About (collapsed)",
          body: rt("This panel starts collapsed and is inert until expanded."),
        },
      ],
    },
  };

  // Regression lock for the review findings: an eyebrow-less TextColumns must
  // promote its column titles to h2 (no h1→h3 skip), and duplicate/blank titles
  // must not throw each_key_duplicate (columns are keyed by index, not title).
  // If either fix regresses, this fixture crashes the page → the axe gate fails.
  const columnsEdge: Content.TextColumnsSlice = {
    id: "fixture-columns-edge",
    slice_type: "text_columns",
    slice_label: null,
    variation: "default",
    version: "initial",
    primary: {
      eyebrow: "",
      hasTopRule: false,
      desktopColumns: "3",
      columns: [
        { title: "Shared metric", body: rt("First column.") },
        { title: "Shared metric", body: rt("Duplicate title — index-keyed, no crash.") },
        { title: "", body: rt("Blank title renders no heading.") },
      ],
      isAnimated: false,
      hide: false,
    },
    items: [],
  };

  // Accordion with duplicate item titles — index-keyed, so it renders instead of
  // throwing each_key_duplicate. (Distinct name from the other fixtures so the
  // smoke tests' by-name lookups stay unambiguous.)
  const accordionDup: Content.AccordionSlice = {
    id: "fixture-accordion-dup",
    slice_type: "accordion",
    slice_label: null,
    variation: "default",
    version: "initial",
    primary: {
      label: "",
      defaultOpen: false,
      items: [
        { title: "Repeated disclosure", body: rt("First.") },
        { title: "Repeated disclosure", body: rt("Second, same title.") },
      ],
      hide: false,
    },
    items: [],
  };

  // ── Industry landing-page slices (the /medtech board) ──────────────────────
  // These carry the page's own outline: the hero owns the h1, so the fixture
  // page's own <h1> above is the only other one — axe sees hero h1 → section h2
  // → column h3 with no skips, matching a real industry page.

  // Prismic image fields need a url + dimensions to render at all; the host is
  // never fetched during an axe scan, and alt text is what the gate checks.
  const img = (alt: string) =>
    ({
      url: "https://images.prismic.io/reddoor-la/fixture.png?auto=format,compress",
      alt,
      copyright: null,
      dimensions: { width: 1200, height: 800 },
      edit: { x: 0, y: 0, zoom: 1, background: "transparent" },
      id: "fixture-image",
      create: null,
    }) as unknown as Content.IndustryHeroSlice["primary"]["image"];

  // An UNFILLED image field is `{}` in the API, not a url-less object — that is
  // what `isFilled.image` tests for, so optional-image branches must be fed this
  // rather than `img("")` to exercise their "absent" path.
  const emptyImg = {} as ReturnType<typeof img>;

  // The logo grid's rollover background declares a `mobile` THUMBNAIL, so its
  // type is ImageField<"mobile"> — an image without that key does not satisfy
  // it. Feeding the thumbnail here also means the fixture exercises the branch
  // the site now takes in production (portrait crop from the thumbnail) rather
  // than only the deprecated standalone field.
  type RolloverBackground = Content.LogoGridSlice["primary"]["logos"][number]["active_background"];
  const imgWithMobile = (alt: string) =>
    ({ ...img(alt), mobile: img(alt) }) as unknown as RolloverBackground;
  // Unfilled counterpart: same `{}` the API returns, typed to carry the thumbnail.
  const emptyBg = {} as RolloverBackground;

  const link = (text?: string) =>
    ({ link_type: "Web", url: "https://example.com", text }) as unknown as NonNullable<
      Content.FeaturedProjectSlice["primary"]["link"]
    >;

  const heroSlice: Content.IndustryHeroSlice = {
    id: "fixture-industry-hero",
    slice_type: "industry_hero",
    slice_label: null,
    variation: "default",
    version: "initial",
    primary: {
      image: img("Two surgeons reviewing a tablet in an operating room"),
      headline: [
        { type: "heading1", text: "From screened out to short list", spans: [] },
      ] as unknown as RichTextField,
      card_label: "Brand-Credibility Framework",
      card_body: rt("Buyers trust you before your rep walks through the door."),
      buttons: [{ link: link("Get Started") }],
      isAnimated: false,
      hide: false,
    },
    items: [],
  };

  const leadRail: Content.LeadTextSlice = {
    id: "fixture-lead-rail",
    slice_type: "lead_text",
    slice_label: null,
    variation: "rail",
    version: "initial",
    primary: {
      eyebrow: "What we do for you:",
      body: rt("Closing the Trust Gap for Your Brand"),
      subBody: rt("We handle everything, from diagnosis to deployment."),
      hasTopPadding: true,
      hasBottomPadding: true,
      isAnimated: false,
      hide: false,
    },
    items: [],
  };

  // Eyebrow-less on purpose: on a real page the LeadText above owns the section
  // h2, so these column titles must come out as h3 — a level skip here fails the
  // axe gate, which is exactly the regression this fixture locks.
  const serviceList: Content.TextColumnsSlice = {
    id: "fixture-service-list",
    slice_type: "text_columns",
    slice_label: null,
    variation: "serviceList",
    version: "initial",
    primary: {
      eyebrow: "",
      hasTopRule: false,
      desktopColumns: "3",
      columns: [
        {
          title: "Brand Identity",
          body: [
            { type: "paragraph", text: "Brand Strategy", spans: [] },
            { type: "paragraph", text: "Brand Positioning", spans: [] },
          ] as unknown as RichTextField,
        },
        { title: "Digital Presence", body: rt("Website Design") },
      ],
      hasTopPadding: true,
      hasBottomPadding: true,
      isAnimated: false,
      hide: false,
    },
    items: [],
  };

  const iconColumns: Content.TextColumnsSlice = {
    id: "fixture-icon-columns",
    slice_type: "text_columns",
    slice_label: null,
    variation: "iconColumns",
    version: "initial",
    primary: {
      eyebrow: "",
      hasTopRule: true,
      desktopColumns: "3",
      columns: [
        {
          title: "The Diagnosis:",
          subtitle: "Friction Audit",
          body: rt("We audit your marketing deliverables against your competition."),
        },
        // Subtitle-less: it is optional, and the column must still render a
        // valid heading rather than an empty label row.
        {
          title: "The Rebuild:",
          subtitle: "",
          body: rt("A complete brand system."),
        },
      ],
      hasTopPadding: true,
      hasBottomPadding: true,
      isAnimated: false,
      hide: false,
    },
    items: [],
  };

  // No before_image → the before/after switch must not render at all.
  const caseStudy: Content.CaseStudySlice = {
    id: "fixture-case-study",
    slice_type: "case_study",
    slice_label: null,
    variation: "default",
    version: "initial",
    primary: {
      label: "Case Study",
      project_name: "Revogen",
      services: "Brand, Packaging, Digital",
      heading: "Taking a biologics brand from overlooked to standing out.",
      after_image: img("Revogen packaging"),
      // Two extra slides, so the fixture exercises the Slideshow branch (3
      // slides => the component renders its prev/next, pause and nav-dot
      // chrome) rather than the single-image branch, which has no controls for
      // axe to audit.
      after_images: [{ image: img("Revogen brand system") }, { image: img("Revogen mobile site") }],
      before_image: {} as unknown as Content.CaseStudySlice["primary"]["before_image"],
      vimeo_id: "",
      link: link(),
      hasTopPadding: false,
      hasBottomPadding: false,
      isAnimated: false,
      hide: false,
    },
    items: [],
  };

  // With before_image → exercises the switch, which is the slice's only control.
  const caseStudyToggle: Content.CaseStudySlice = {
    ...caseStudy,
    id: "fixture-case-study-toggle",
    primary: {
      ...caseStudy.primary,
      label: "Case Study: before and after",
      before_image: img("Revogen packaging, before"),
    },
  };

  const logoGrid: Content.LogoGridSlice = {
    id: "fixture-logo-grid",
    slice_type: "logo_grid",
    slice_label: null,
    variation: "default",
    version: "initial",
    primary: {
      label: "Clients: Join these brands in building trust",
      link: link("Our Work"),
      logos: [
        // Linked, unlinked-with-alt, and unlinked-without-alt: the three naming
        // paths (link aria-label / field alt / sr-only fallback).
        //
        // Only the first carries rollover art, on purpose: that exercises BOTH
        // rollover branches in one fixture — a logo that activates a backdrop
        // and a knockout swap, and logos that must stay inert because they have
        // none — while keeping the section's own a11y surface under axe.
        {
          logo: img("Revogen"),
          logo_negative: img("Revogen"),
          // Carries its `mobile` thumbnail, so this row emits the <source> media
          // query; the row below has neither thumbnail nor legacy field and
          // falls through to the landscape <img> alone — both <picture>
          // branches covered.
          active_background: imgWithMobile(""),
          active_background_mobile: emptyImg,
          name: "Revogen",
          link: link(),
        },
        {
          logo: img("Preveta"),
          logo_negative: emptyImg,
          active_background: emptyBg,
          active_background_mobile: emptyImg,
          name: "Preveta",
          link: {} as ReturnType<typeof link>,
        },
        {
          logo: img(""),
          logo_negative: emptyImg,
          active_background: emptyBg,
          active_background_mobile: emptyImg,
          name: "Caltex Medical",
          link: {} as ReturnType<typeof link>,
        },
      ],
      hasTopPadding: true,
      hasBottomPadding: true,
      isAnimated: false,
      hide: false,
    },
    items: [],
  };

  const testimonial: Content.TestimonialSlice = {
    id: "fixture-testimonial",
    slice_type: "testimonial",
    slice_label: null,
    variation: "default",
    version: "initial",
    primary: {
      label: "What clients are saying:",
      quote: "Their branding and web work took us to the next level.",
      name: "Albert Turgon",
      role: "COO of MSOT (Medical Solutions of Texas)",
      avatar: img("Albert Turgon"),
      hasTopPadding: true,
      hasBottomPadding: true,
      isAnimated: false,
      hide: false,
    },
    items: [],
  };

  const featuredProject: Content.FeaturedProjectSlice = {
    id: "fixture-featured-project",
    slice_type: "featured_project",
    slice_label: null,
    variation: "default",
    version: "initial",
    primary: {
      image: img("The Medical Solutions of Texas website on a desktop display"),
      title: "Medical Solutions of Texas",
      services: "brand, digital",
      link: link(),
      hasTextureBleed: false,
      hasTopPadding: false,
      hasBottomPadding: false,
      isAnimated: false,
      hide: false,
    },
    items: [],
  };

  const valueExpandable: Content.ValueBlockSlice = {
    id: "fixture-value-expandable",
    slice_type: "value_block",
    slice_label: null,
    variation: "expandable",
    version: "initial",
    primary: {
      displayTitle: "On Your Behalf",
      eyebrow: "About Us",
      lede: rt("Reddoor's been at this for 20 years."),
      body: rt("We're a nimble senior team, and we've stayed that way on purpose."),
      readMoreLabel: "Read More +",
      hasTopPadding: true,
      hasBottomPadding: true,
      isAnimated: false,
      hide: false,
    },
    items: [],
  };

  // Rail FAQ with empty answers — the design ships no answer copy, so the
  // body-less branch is the state this will actually launch in.
  const faqRail: Content.AccordionSlice = {
    id: "fixture-accordion-rail",
    slice_type: "accordion",
    slice_label: null,
    variation: "rail",
    version: "initial",
    primary: {
      label: "Frequently Asked Questions",
      defaultOpen: false,
      items: [
        { title: "How does pricing work?", body: rt("Three phases, quoted up front.") },
        { title: "How do we get started?", body: [] as unknown as RichTextField },
      ],
      hasTopPadding: true,
      hasBottomPadding: true,
      isAnimated: false,
      hide: false,
    },
    items: [],
  };

  const ctaBanner: Content.CtaBannerSlice = {
    id: "fixture-cta-banner",
    slice_type: "cta_banner",
    slice_label: null,
    variation: "default",
    version: "initial",
    primary: {
      heading: [
        { type: "heading2", text: "Are you ready for instant credibility?", spans: [] },
      ] as unknown as RichTextField,
      buttonLabel: "Talk with a founder",
      buttonLink: link(),
      background: "paper-red",
      hasTopPadding: true,
      hasBottomPadding: true,
      isAnimated: false,
      hide: false,
    },
    items: [],
  };
</script>

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

  <!-- Portfolio intro slices (LeadText / TextColumns / Accordion). Rendered here
       so the axe gate (which scans /dev/a11y-fixtures) covers them. Each carries
       its own section heading (h2) + the columns' h3 children, so the outline
       stays skip-free. The collapsed accordion exercises the inert branch. -->
  <LeadText slice={leadSlice} />
  <TextColumns slice={columnsSlice} />
  <TextColumns slice={columnsEdge} />
  <Accordion slice={accordionOpen} />
  <Accordion slice={accordionClosed} />
  <Accordion slice={accordionDup} />

  <!-- Industry landing-page slices, in board order so the rendered outline
       matches a real /medtech page: the hero's h1, then each section's h2, then
       column h3s. A level skip or a nested interactive here fails the axe gate. -->
  <IndustryHero slice={heroSlice} />
  <LeadText slice={leadRail} />
  <TextColumns slice={serviceList} />
  <TextColumns slice={iconColumns} />
  <CaseStudy slice={caseStudy} />
  <CaseStudy slice={caseStudyToggle} />
  <LogoGrid slice={logoGrid} />
  <Testimonial slice={testimonial} />
  <FeaturedProject slice={featuredProject} />
  <ValueBlock slice={valueExpandable} />
  <Accordion slice={faqRail} />
  <CtaBanner slice={ctaBanner} />

  <!-- Inquiry modal (industry pages). The live /medtech document still points
       its CTAs at /contact until the content migration runs, so the trigger has
       to exist here for the modal to be reachable in a test at all. The closed
       modal renders nothing, so the axe gate on load is unaffected; the smoke
       spec opens it and re-scans. -->
  <a href="/contact#inquire" data-inquire-step="The Diagnosis">Open the inquiry modal</a>
  <InquiryModal />
</div>
