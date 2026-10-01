# reddoor-website

The [reddoorla.com](https://reddoorla.com) site — Reddoor Creative's own portfolio/marketing site.

**Stack:** SvelteKit 2 + Svelte 5 (runes) · [Prismic](https://prismic.io) (Type Builder + the `prismic` CLI) · Tailwind CSS v4 (`@config` legacy mode, see `src/app.css`) · Netlify (project name `reddoorla`) · Node 24 + pnpm 11 via corepack.

## Getting started

```sh
nvm use            # node 24 (engines enforces >=24)
corepack enable    # pins pnpm from packageManager
pnpm install
pnpm dev           # vite dev server (:5173)
```

## Scripts

| Script             | What it does                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| `pnpm dev`         | Vite dev server                                                                                           |
| `pnpm prismic:gen` | Regenerate `prismicio-types.d.ts` and the slice index from the models on disk; CI fails if they are stale |
| `pnpm build`       | Production build (Netlify adapter; prerender fails on broken links)                                       |
| `pnpm check`       | `svelte-check` type/diagnostic pass                                                                       |
| `pnpm lint`        | Prettier check + ESLint                                                                                   |
| `pnpm format`      | Prettier write                                                                                            |
| `pnpm test`        | `test:unit` then `test:smoke` — this is what CI runs                                                      |
| `pnpm test:unit`   | Vitest (`src/**/*.test.ts`, `scripts/**/*.test.mjs`)                                                      |
| `pnpm test:smoke`  | Playwright behavior suite (`tests/smoke/`), installs chromium first                                       |

## CI / gates

`.github/workflows/ci.yml` calls the shared fleet workflow (`reddoorla/.github`): prettier, eslint, svelte-check, build, `pnpm test` (unit + smoke), and an axe a11y audit against `/dev/a11y-fixtures`. `.github/workflows/lighthouse.yml` additionally gates PRs on Lighthouse scores of the **Netlify deploy preview** (real prod-built routes: `/`, `/portfolio`, one detail page); a11y + best-practices are hard gates, performance is warn-only.

## Content ops

- Content lives in the Prismic repo configured in `prismic.config.json`; slices are in `src/lib/slices/`, custom types in `customtypes/`. Slice Machine is gone (deprecated by Prismic 2026-09-18). Edit a model's JSON (or use `npx prismic type|slice|field …`), run `pnpm prismic:gen`, and commit both. Models reach Prismic through reddoor-maintenance's `prismic-models` workflow on merge, never `prismic push`; see that repo's `docs/runbooks/prismic-model-delivery.md` and `docs/prismic-migration-plan-2026-10.md`.
- `scripts/portfolio-intro/` — the (idempotent, unit-tested) migration that seeded the 16 portfolio-page intros from the Figma project-page designs. See its README before re-running anything.
- `scripts/crm/` — drives the CRM's workflow builder over Chrome's debugging port, for the message bodies no API reaches. Its README is the runbook and the log of edits made; read `docs/inquiry-funnel.md` §7 before writing anything there.
- Secrets: `PRISMIC_WRITE_TOKEN` lives in `.env.local` (gitignored). Scripts load it via `node --env-file=.env.local …`. Never commit or print it.

## Conventions worth knowing

- **Tailwind v4 + `@config`:** element-level rules in `app.css` must live in `@layer base`, or they beat every utility. CMS-composed classes (`"bg-" + slice.primary.background`) are safelisted via `@source inline()` at the top of `app.css` — the legacy `safelist` config key is ignored by v4.
- **Headings:** heading level and visual size are coupled by the global element styles; when changing a heading's level for a11y, pin its visual with a `.type-*` class (including `font-family` and every responsive step).
- **Motion:** respect `prefers-reduced-motion`; Playwright runs with reduced motion, so smoke tests rely on it for determinism.
- **Docs:** evening-review morning briefs live in `docs/morning-reports/`; design/implementation specs in `docs/superpowers/specs/`.
