import { defineEnvVars } from "@sveltejs/kit/env";

// Kit 3 exposes ONLY the variables declared here, through `$app/env/private`
// and `$app/env/public`. `$env/dynamic/*` still resolves, but it is now a view
// of this same list: with no src/env.ts, `env.FORMS_INGEST_URL` is undefined
// even when Netlify sets it. The build says so in a warning ("will always be
// undefined"), and nothing fails, so a variable read anywhere in src/ and
// missing from this file is a form, a booking or a report that silently stops
// working. scripts/kit-config.test.ts fails on an undeclared read. Every one is
// optional: unset is a real state (dev, CI, a deploy context without it), and
// each reader already handles it.
const optional = (value: string | undefined) => value;

export const variables = defineEnvVars({
  FORMS_INGEST_URL: {
    schema: optional,
    description: "Central form-ingest endpoint the contact, inquiry and booking forms post to.",
  },
  FORMS_INGEST_TOKEN: {
    schema: optional,
    description: "Bearer token for the central form-ingest endpoint.",
  },
  PUBLIC_TURNSTILE_SITE_KEY: {
    public: true,
    schema: optional,
    description: "Cloudflare Turnstile sitekey; unset renders no widget.",
  },
  CRM_FUNNEL_ACTIVE_TOKEN: {
    schema: optional,
    description:
      "GoHighLevel token for the funnel: slots, booking, appointments, email preferences.",
  },
  PROSPECT_REPORT_URL: {
    schema: optional,
    description: "Base URL the /audit/[token] reports are read from.",
  },
  PROSPECT_EDIT_TOKEN: {
    schema: optional,
    description: "Token for writing audit report edits upstream.",
  },
  REPORT_EDIT_KEY: {
    schema: optional,
    description: "Key that unlocks /audit/[token]/edit and /api/audit-edit.",
  },
  MEETING_OUTCOME_KEY: {
    schema: optional,
    description: "Key that unlocks /api/meeting-outcome.",
  },
  FUNNEL_COPY_BUILTIN: {
    schema: optional,
    description:
      'Set to "1" by the Playwright smoke suite only: the booking funnel renders its built-in copy, whatever is published in Prismic.',
  },
  PRISMIC_HIDDEN_CONTENT: {
    schema: optional,
    description: 'Set to "show" on the staging site to show hide-tagged Prismic documents.',
  },
});
