# Sito Museo Aldo Sergiacomi

Static website of the Museo Aldo Sergiacomi (LaDiMAS, Offida), built with Astro. This repository holds the
prototype: structure, content, interactions and technical foundations. Site text is in Italian.

## Requirements

- Node.js 26 (the LTS line, see `.nvmrc`); `engines` accepts Node >= 22.23.4.
- npm. Dependencies are pinned to exact versions and locked in `package-lock.json`.

## Setup

```sh
npm install
```

`npm install` also runs the `prepare` script, which sets `core.hooksPath` to `.githooks`. This setting is
local to each clone and does not travel with `git clone`, so run `npm install` once after every fresh clone
to turn the pre-commit hook on.

For the browser tests, download the browser once with `npx playwright install chromium`.

## Commands

| Command                    | What it does                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`              | Development server.                                                                                                                         |
| `npm run build`            | Build into `dist/`, index it for the search (Pagefind, `dist/pagefind/`), then write `dist/_headers` and `dist/_redirects` (see "Hosting"). |
| `npm run serve`            | Serve `dist/` with the hosting rules applied (`--port`, `--fake-tiles`), for the browser tests.                                             |
| `npm run build:production` | Production build. Stops with a list while anything is not confirmed (see "Unconfirmed content").                                            |
| `npm test`                 | Vitest: unit tests and tests on the built `dist/` (run `npm run build` first).                                                              |
| `npm run test:e2e`         | Build, then Playwright (Chromium) on `dist/`: axe, keyboard, no JS, no outside request, CSP (`tests/e2e/`).                                 |
| `npm run test:lh`          | Build, then Lighthouse CI on the home page and a work page (`lighthouserc.json`). Needs Google Chrome.                                      |
| `npm run content:check`    | Content schemas, references, import counts (25 works) and `src/data/sito.yaml`.                                                             |
| `npm run content:report`   | What is not confirmed yet, by collection and type.                                                                                          |
| `npm run images`           | Rebuild the master photos in `src/assets/foto/` from `materiali/` (see "Photos").                                                           |
| `npm run check`            | Everything the pre-commit hook runs: type check, ESLint, Prettier, content check, build and Vitest.                                         |
| `npm run format`           | Format all files with Prettier.                                                                                                             |

The `check` command grows as the project does: later tasks add their own steps to it.

## Content

Content lives in `src/content/<collection>/it/` (Markdown with frontmatter, or YAML) and the museum data in
`src/data/sito.yaml`. The schemas are in `src/lib/schemi.ts` and `src/lib/sito.ts`; the services registry
is `src/data/servizi.ts`. Astro only logs a broken reference between collections and goes on, so
`npm run content:check` checks every reference itself and lists all the bad ones.

## Photos

Photos live only in `src/assets/foto/` (JPEG masters, at most 2400 px and 1 MB, no metadata, versioned);
the originals stay in `materiali/` (not in git). `npm run images` rebuilds the masters from the originals
following the table in `scripts/immagini-tabella.mjs`, which also lists the originals that are not
imported. Every master needs an entry with its `alt` in `src/content/immagini/it/immagini.yaml`
(`content:check` fails without it). A page shows a photo with `src/components/Foto.astro` (AVIF and WebP
with a JPEG fallback, `srcset`, real `width` and `height`; `priorita` for the one largest image in view,
one per page at most). Never put a photo in `public/`. Open Graph images (1200x630) are written to
`dist/og/` for every photo, plus `/og/predefinita.jpg`. Encoder quality is set in `astro.config.mjs`; Astro
caches the transformed images by name and size only, so after changing it delete `node_modules/.astro/assets`.

The museum has four environments (rooms 1-3, the workshop, the cloister, the Foundation's spaces for the
workshops), each a page under `/il-museo/` built from `src/pages/il-museo/[ambiente].astro` and a `pagine`
entry named `ambiente-<name>.md`. The address of each page is the `slug` of its entry; the name and address
of the fourth are provisional and live only in `ambiente-spazi-fondazione.md`. `PiantaSale.astro` draws the
plan with one link per environment; `Galleria.astro` shows two or more photos as links to the image files,
and as a modal `<dialog>` when JavaScript runs (the script returns the focus to the thumbnail).
Browser tests: `npm run test:e2e`.

The works: `/opere/` lists them by town and `/opere/<slug>/` is the page of each (`src/pages/opere/`), built from
`src/content/opere/it/`. The first sentence of a page is generated by `src/lib/frase-opera.ts` (70 to 160
characters, it is also the meta description; it never uses a field listed in `daConfermare`; a `frase` in the
entry replaces it). A work without a photo shows a panel "Foto in arrivo". `npm run content:report` also lists
the work pages with fewer than 40 written words (they stay published).

Page transitions: native CSS (`@view-transition` in `src/styles/globale.css`), only without
`prefers-reduced-motion: reduce`; no script. The photo of a work grows from the card in `/opere/` to the top of its
page: both carry `data-opera="<slug>"`, and the name `opera-<slug>` is written into `/assets/vt-opere.css`
(`src/pages/assets/vt-opere.css.ts`, linked only from those pages) because the CSP forbids `style=""`. The name must
be unique on a page, so the nearby works do not carry it. The e2e tests run with one worker: with several windows
Chromium sometimes skips the transition.

## Unconfirmed content

Every entry has a `stato` (`confermato`, `da-confermare`, `segnaposto`) and a `daConfermare` list of
single doubts; inside a text a doubt is marked `[[DA CONFERMARE: reason]]`. Places have `verificato`,
images have `altVerificato`, and `src/data/sito.yaml` has its own `daConfermare` list. The preview shows
all of it with the `DaConfermare` label (a listed `sito.yaml` field shows only the label, never the
value). `npm run build:production` stops, with the list, while any of these is open. `ALLOW_OPEN_ITEMS=1`
lets a production build go on, but only as a private preview: noindex, no sitemap, no `llms.txt`.
`npm run content:report` is the working list for the content team.

## Layout, menu and addresses

`src/layouts/Base.astro` gives every page the head (`Seo.astro`), skip link, header, footer and, below
768 px, the fixed bar with the two visit actions. Menu, actions and footer links come from
`src/data/sito.yaml` (`navigazione`, `azioni`), so moving an item from `principale` to `piede` is one edit.
The menu is a native `popover`: no JavaScript. Interface texts are in `src/i18n/it.json`; `percorso()` in
`src/i18n/index.ts` builds the address for a language. Canonical and Open Graph addresses use the origin in
`SITE_URL` (a placeholder domain until the real one is decided). Pages that the menu points at but that do
not exist yet are listed in `tests/dist/pagine-future.json`: each task removes its own entries.

## Next event

The "next event" (`/eventi/` and the home page) is worked out at build time with the day in Rome (`src/lib/date.ts`): an event is next until the end of its last day. The site is static, so it shows the answer of its last build, and an event that has passed can stay on screen until the next deploy. There is no scheduled rebuild and no client code for it (accepted limit, 12/11/2026).

## Hosting

`config/hosting.mjs` is the single source of the security headers, the CSP and the 301 redirects from the
old `.htm` pages. `scripts/emit-hosting.mjs` turns it into `dist/_headers` and `dist/_redirects` for
Cloudflare Pages (it runs at the end of `npm run build`), and `scripts/serve-dist.mjs` applies the same
rules to a local server, so the CSP the tests prove is the one that ships. Do not edit the generated files.

- Which mode the build is in (noindex header, HSTS) comes from `decidiModalita` in `src/lib/modalita.ts`,
  not from the environment variables. The CSP sources of external services come from `src/data/servizi.ts`.
- `Cache-Control` is set only on `/_astro/*` (long, immutable) and `/pagefind/*` (always revalidate), never
  on the general rule: Cloudflare joins the values of a same header from every rule that matches.
- A configuration for Caddy or nginx is not generated. It is added to `scripts/` when that server is chosen.
- The www to non-www redirect is done in the DNS or in the hosting service, not in these files.
- The redirects also list the capitalised spellings of the old addresses (`/Chisiamo.htm`, `/ChiSiamo.htm`),
  because the old server ignored case and Cloudflare does not. Check them on a real preview, since a
  server can treat case differently from the local one.

### Private preview

The preview must stay private until Fabio says it is ready. The `noindex` header and meta tag are not
protection (a crawler can ignore them), so the preview needs an access control **in addition**. This is a
requirement for whoever configures the hosting: do not publish the preview address without it.

- Cloudflare Pages: put the project (the custom domain and the `*.pages.dev` addresses, preview deployments
  included) behind Cloudflare Access, with a policy that lets in only the people who review the site. This
  is set in the Cloudflare dashboard, not in code.
- Own server: a password on the whole site (for example HTTP basic auth).
- `_headers` and `_redirects` carry a "PRIVATE PREVIEW" reminder while the mode is preview.
- Do not add `Disallow` to `robots.txt` in the preview (a page Google cannot read is a page whose
  `noindex` Google cannot see); the access control is what keeps crawlers out.

## Git workflow

- Work happens on the `prototipo` branch. Nothing is committed on `main`.
- The pre-commit hook (`.githooks/pre-commit`) runs `npm run check`. Never bypass it with `--no-verify`.
- `materiali/` (original files from the Foundation) and `appunti/` (working notes) are excluded from git
  and must stay out of every commit.

## Supported browsers

Current versions of Chrome, Edge, Firefox and Safari (desktop and mobile). Newer features (`popover`,
`<dialog>`, `@view-transition`) degrade gracefully: every function has a plain HTML base, so older browsers
get a usable site without the extras.

## Handoff to the designer

`DESIGN-BRIEF.md` explains what the visual redesign may change and what must keep working;
`CONTENT-GUIDE.md` explains how the content is edited, including clearing unconfirmed items.

## Postponed

Three tasks of the prototype plan are deliberately left until after the graphic redesign and the content
review, because they would be done twice (or on content that will change):

- Task 21, SEO files: `sitemap.xml`, `robots.txt`, `llms.txt`. They depend on the final addresses and on the
  content being confirmed (they are never produced while items are open).
- Task 23, the full browser test run (every sample page with every interaction). The tests that exist today
  (`npm run test:e2e`) cover the pages and interactions built so far; the full set is written against the
  final design.
- Task 24, Lighthouse and the weight budgets. `npm run test:lh` runs on the home page and one work page
  today; the scores and thresholds for every sample page (above all `/opere/` with the map) are set once the
  design is final.

Task 22 (legal pages) was done in a reduced form: privacy, cookie, legal notes and accessibility are
placeholders, marked to be confirmed, and need a lawyer's reading.

## Licences of the dependencies

Direct dependencies, as declared in each package (`license` field). Runtime packages end up in the build or
run it; the others are tools used only while developing and testing.

| Package                                                                                                                                 | Licence         | Use                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------- |
| `astro`                                                                                                                                 | MIT             | Site generator                                                      |
| `leaflet`                                                                                                                               | BSD-2-Clause    | Map (in the public JavaScript)                                      |
| `sharp`                                                                                                                                 | Apache-2.0      | Image processing at build time                                      |
| `typescript`, `@astrojs/check`                                                                                                          | Apache-2.0, MIT | Types                                                               |
| `pagefind` (dev)                                                                                                                        | MIT             | Search index, and the search script it writes into `dist/pagefind/` |
| `vitest`, `@playwright/test`, `playwright-core`, `@lhci/cli` (dev)                                                                      | MIT, Apache-2.0 | Tests                                                               |
| `@axe-core/playwright` (dev)                                                                                                            | MPL-2.0         | Accessibility tests                                                 |
| `eslint`, `typescript-eslint`, `eslint-plugin-astro`, `eslint-plugin-jsx-a11y-x`, `prettier`, `prettier-plugin-astro`, `@types/*` (dev) | MIT             | Lint and format                                                     |
| `linkedom`, `yaml` (dev)                                                                                                                | ISC             | Test and content tooling                                            |

The code of the site is MIT. Leaflet (BSD-2-Clause) is the only library bundled into the JavaScript that
visitors download, and its licence is permissive. The content, the photos and the texts are not code and are
not covered by the MIT licence; their rights belong to the Foundation and to the third parties credited on the
pages. This list is not legal advice: a lawyer should read it with the legal pages.

## License

The code of the site is released under the MIT licence (see `LICENSE`). Leaflet is BSD-2-Clause; the other
dependencies keep their own licences, listed above. Content, photos and texts are not covered by the MIT licence.
