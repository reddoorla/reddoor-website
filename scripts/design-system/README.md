# Design system producer

Builds the component bundle of the **Reddoor Creative** design system artifact
(https://claude.ai/artifact/LE8CeEy2T5AeuLLfEuYXTC) from this repo's real Svelte
components, and renders its preview cards headlessly. The artifact holds everything
else — tokens, the brand book, component READMEs and previews, assets — and is edited
there; only the bundle comes from here.

## What it produces

`components/bundle.js` — one classic IIFE script that assigns `window.Reddoor`. Every
entry in `components.json` is the compiled Svelte component wrapped as a React
component (`react.js`):

- props pass through a Svelte `$state` proxy, so a React re-render updates the mounted
  component in place instead of remounting it;
- `children` and any prop given a React element become Svelte snippets, rendered through
  React portals; a snippet that takes arguments is `Reddoor.snippet((...args) => node)`;
- `Reddoor.svelte` exposes the raw components, `mount`, `unmount` and `createRawSnippet`;
- `Reddoor.report` exposes `toReportView`, `unwrap`, `allFixes`, `healthFixes`,
  `headlineFinding`, `passes` and three report fixtures (`extras.js`).

`SliceZone.svelte` is the one component that is not in `src/`: it is the page
composition from `src/routes/[[preview=preview]]/[uid]/+page.svelte` (a `contents` div
carrying `data-band-rhythm`, then `@prismicio/svelte`'s SliceZone), so that slices
composed through React keep the industry band-rhythm selectors (`> section`,
`section + section`) that a wrapper element would otherwise break.

`components/bundle.css` — `src/app.css` compiled by Tailwind over the whole of `src/`,
with the paper-texture URLs rewritten to the artifact's uploaded files (`textures.json`)
and the AVIF sources dropped (the artifact's asset store does not take AVIF).

SvelteKit modules the components import are stubbed (`stubs/`): `$app/state` is a static
page at `https://reddoorla.com/`, `$app/navigation` and `$app/environment` are no-ops.

## Running it

```sh
pnpm install
node_modules/.bin/svelte-kit sync
node scripts/design-system/build.mjs --out <dir>/project --textures scripts/design-system/textures.json
```

`<dir>/project` is a local copy of the artifact's files (read them with the Artifact
tool); the build writes `components/bundle.js` and `components/bundle.css` into it, and
they are republished to the artifact from there. It refuses a bundle containing
`<!--`, `</script`, `eval(` or `new Function(`, and a stylesheet containing `</style`.

To add a component, add `{ name, source, group }` to `components.json`, rebuild, and give
it a card (`preview.html`, `README.md`, `<Name>.d.ts`) in the artifact.

## Render check

```sh
node scripts/design-system/render.mjs --project <dir>/project --out <renders> [--blobs map.json] [--motion no-preference] [Name ...]
```

It emulates the artifact's preview frame (tokens.css compiled from `tokens.json`,
`bundle.css`, React 18, `bundle.js`) at the width and height in each card's marker,
answers `/_blob/<id>` from a local `{ id: file }` map, blocks every other host except
Google Fonts and the script CDNs, and prints `ok` or `!!` with every console error, page
error, 404 and blocked request. It writes a PNG per card. Set `CHROMIUM_PATH` to use a
specific Chromium. Reduced motion is the default; `--motion no-preference` renders what
the card really shows (`animateIn` takes 2.4s, the render waits 3s).
