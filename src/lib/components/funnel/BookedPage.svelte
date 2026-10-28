<script lang="ts">
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import RailRow from "$lib/components/RailRow.svelte";
  import VideoCard from "$lib/components/VideoCard.svelte";
  import ProjectCard from "$lib/components/ProjectCard.svelte";
  import Testimonial from "$lib/slices/Testimonial/index.svelte";
  import CtaBanner from "$lib/slices/CtaBanner/index.svelte";
  import { stepNumber } from "$lib/slices/TextColumns/stepNumber";
  import type { FunnelCopy } from "$lib/funnel-copy/copy";
  import { bookedCtaSlice, bookedQuoteSlice } from "$lib/funnel-copy/booked-slices";
  import type { BookedProject } from "$lib/server/funnel-copy";
  import rescheduleIcon from "$lib/assets/icons/booked/reschedule.svg";
  import cancelIcon from "$lib/assets/icons/booked/cancel.svg";

  /**
   * "You're on the calendar": /schedule once a call is booked (Figma
   * RD-Sales-Funnel-LP 5314:75, with Tim's two comments of 2026-10-28 built
   * in: the video is 16:9, and the logo band is the MSOT testimonial for now).
   *
   * Everything sits on RailRow's five-column grid, which is this same file's
   * "Sales Funnel v2" grid: the details take column 1 beside the video in 2-5,
   * the steps take 2-4, the work 2-5 with its label in the rail.
   *
   * The time and length are the booking's, as the CRM confirmed it; the
   * calendar and change links go to the routes the confirmation email uses, by
   * the same id. With no id (`links` null) none of them are drawn, rather than
   * links that would have to guess.
   */
  interface Props {
    copy: FunnelCopy;
    projects: BookedProject[];
    /** The booked time, already in the visitor's zone. */
    when: string;
    duration: string | null;
    links: {
      google?: string;
      ics?: string;
      outlook?: string;
      reschedule?: string;
      cancel?: string;
    } | null;
    /** The element focus moves to once booked, so the details are announced. */
    statusEl?: HTMLElement;
  }

  let { copy, projects, when, duration, links, statusEl = $bindable() }: Props = $props();

  const video = $derived(copy.booked.video);

  // The two landing-page slices, fed from this page's own fields so the band
  // and the banner are the ones /medtech shows, not look-alikes.
  const quoteSlice = $derived(bookedQuoteSlice(copy));
  const ctaSlice = $derived(bookedCtaSlice(copy));
</script>

<!-- The board's paper runs 113px into this band and the video starts 35px
     down, so the card straddles the break; the details start below it. -->
<div class="booked-top relative w-screen bg-white">
  <div class="absolute inset-x-0 top-0 hidden h-28.25 bg-paper lg:block" aria-hidden="true"></div>
  <ContentWidth class="relative">
    <div class="flex flex-col gap-10 pt-12 pb-10 lg:grid lg:grid-cols-5 lg:gap-5 lg:pt-8.75">
      <div class="flex flex-col gap-5 lg:pt-31.75">
        <!-- role="status" alone would not announce: the element is inserted
             already holding its text, and a live region only speaks for text
             added after it exists. Focus is moved here as well. Only the time
             and length, so the five links are not read out in the same breath. -->
        <div
          class="booked-details flex flex-col gap-5"
          role="status"
          tabindex="-1"
          bind:this={statusEl}
        >
          <div class="detail">
            <p class="detail-label">{copy.booked_date_label}</p>
            <p class="detail-value">{when}</p>
          </div>
          {#if duration}
            <div class="detail">
              <p class="detail-label">{copy.booked_duration_label}</p>
              <p class="detail-value">{duration}</p>
            </div>
          {/if}
        </div>

        {#if links}
          <!-- The routes the confirmation email links to. They build the
               calendar hand-offs server-side, so the Zoom link never reaches
               this page's source. -->
          <div class="flex flex-col items-start gap-3.5">
            <a class="cal-button" href={links.google}>{copy.booked_google_label}</a>
            <!-- No `download`: the server sets Content-Disposition. -->
            <a class="cal-button" href={links.ics}>{copy.booked_ical_label}</a>
            <!-- Outlook on the web cannot open an .ics download; this hands it
                 the event the way the calendar page does. -->
            <a class="cal-button" href={links.outlook}>{copy.booked_outlook_label}</a>
          </div>
          <div class="flex flex-wrap gap-5">
            <a class="change-link" href={links.reschedule}>
              <img src={rescheduleIcon} alt="" width="20" height="20" />
              {copy.booked_reschedule_label}
            </a>
            <a class="change-link" href={links.cancel}>
              <img src={cancelIcon} alt="" width="20" height="20" />
              {copy.booked_cancel_label}
            </a>
          </div>
        {/if}
      </div>

      <!-- Tim, Figma comment 2026-10-28: "make this 16:9". -->
      <div class="lg:col-span-4">
        <VideoCard
          vimeo={video.vimeo}
          mp4={video.mp4}
          mobileMp4={video.mobileMp4}
          captions={video.captions}
          poster={video.poster}
          title={video.title ?? copy.booked_video_title}
          sizes="(min-width: 1024px) 74vw, 92vw"
          class="bg-paper"
        />
      </div>
    </div>
  </ContentWidth>
</div>

<div class="w-screen bg-white py-12.5">
  <RailRow>
    <h2 class="type-lede prepare-heading m-0 text-primary">{copy.booked_prepare_heading}</h2>
    <!-- role="list": Safari drops list semantics from an unstyled list. -->
    <ol role="list" class="prepare-steps mt-6.75 grid gap-6 pt-6.75 md:grid-cols-3 md:gap-5.75">
      {#each copy.booked.steps as step, i (i)}
        <li class="flex flex-col gap-2.5">
          <span class="step-number" aria-hidden="true">{stepNumber(i)}</span>
          <span class="step-text">{step}</span>
        </li>
      {/each}
    </ol>
  </RailRow>
</div>

{#if projects.length}
  <div class="w-screen bg-white py-12.5">
    <RailRow label={copy.booked_work_label} wide>
      <ul class="grid gap-6 md:grid-cols-2">
        {#each projects as project (project.uid)}
          <li class="aspect-4/3">
            <ProjectCard
              uid={project.uid}
              title={project.title}
              heroUrl={project.heroUrl}
              services={project.services}
              sizes="(min-width: 768px) 37vw, 92vw"
            />
          </li>
        {/each}
      </ul>
    </RailRow>
  </div>
{/if}

<Testimonial slice={quoteSlice} />
<CtaBanner slice={ctaSlice} />

<style>
  /* #d71920 primary, #aa1419 primary-dark, #6e6f72 muted (4.6:1 on white),
     as on the rest of the booking pages. The board's #ababab values and
     #8b8c8d links fail AA on white, so they take the muted grey. */
  .booked-details:focus {
    outline: none;
  }
  .booked-details:focus-visible {
    outline: 2px solid #d71920;
    outline-offset: 4px;
  }

  /* Pragmatica Light 18/1.4, the label in red capitals over its value. */
  .detail {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .detail-label,
  .detail-value {
    margin: 0;
    font-family: pragmatica, helvetica, sans-serif;
    font-size: 18px;
    font-weight: 300;
    line-height: 1.4;
  }
  .detail-label {
    color: #d71920;
    letter-spacing: 0.01em;
    text-transform: uppercase;
  }
  .detail-value {
    color: #6e6f72;
  }

  /* The board's "button round red": a red outline and label, 14px Book. The
     label may wrap: the details column is a fifth of the page, narrower than
     the longest label between lg and xl. */
  .cal-button {
    display: inline-block;
    padding: 10px 15px;
    border: 1px solid #d71920;
    border-radius: 4px;
    color: #d71920;
    font-family: pragmatica, helvetica, sans-serif;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.4;
    text-decoration: none;
    transition:
      background-color 300ms,
      color 300ms;
  }
  .cal-button:hover {
    background: #aa1419;
    border-color: #aa1419;
    color: #fff;
  }

  .change-link {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: #6e6f72;
    font-family: pragmatica, helvetica, sans-serif;
    font-size: 14px;
    font-weight: 400;
    line-height: normal;
    text-decoration: none;
  }
  .change-link:hover {
    color: #000;
    text-decoration: underline;
  }

  .cal-button:focus-visible,
  .change-link:focus-visible {
    outline: 2px solid #d71920;
    outline-offset: 2px;
  }

  /* Besley 26/1.45, the board's H2. */
  .prepare-heading {
    font-size: 26px;
    line-height: 1.45;
  }
  .prepare-steps {
    margin-bottom: 0;
    padding-left: 0;
    list-style: none;
    border-top: 1px solid #d71920;
  }
  .step-number {
    color: #d71920;
    font-family: pragmatica, helvetica, sans-serif;
    font-size: 16px;
    font-weight: 200;
    letter-spacing: 0.03em;
    line-height: 1.5;
  }
  .step-text {
    color: #000;
    font-family: pragmatica, helvetica, sans-serif;
    font-size: 16px;
    font-weight: 300;
    line-height: 1.5;
  }

  @media (prefers-reduced-motion: reduce) {
    .cal-button {
      transition: none;
    }
  }
</style>
