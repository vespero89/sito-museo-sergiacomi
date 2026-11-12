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

## Commands

| Command                 | What it does                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| `npm run dev`           | Development server.                                                                                 |
| `npm run build`         | Build into `dist/`.                                                                                 |
| `npm test`              | Vitest: unit tests and tests on the built `dist/` (run `npm run build` first).                      |
| `npm run content:check` | Content schemas, references between collections and `src/data/sito.yaml`.                           |
| `npm run check`         | Everything the pre-commit hook runs: type check, ESLint, Prettier, content check, build and Vitest. |
| `npm run format`        | Format all files with Prettier.                                                                     |

The `check` command grows as the project does: later tasks add their own steps to it.

## Content

Content lives in `src/content/<collection>/it/` (Markdown with frontmatter, or YAML) and the museum data in
`src/data/sito.yaml`. The schemas are in `src/lib/schemi.ts` and `src/lib/sito.ts`; the services registry
is `src/data/servizi.ts`. Astro only logs a broken reference between collections and goes on, so
`npm run content:check` checks every reference itself and lists all the bad ones.

## Git workflow

- Work happens on the `prototipo` branch. Nothing is committed on `main`.
- The pre-commit hook (`.githooks/pre-commit`) runs `npm run check`. Never bypass it with `--no-verify`.
- `materiali/` (original files from the Foundation) and `appunti/` (working notes) are excluded from git
  and must stay out of every commit.

## Supported browsers

Current versions of Chrome, Edge, Firefox and Safari (desktop and mobile). Newer features (`popover`,
`<dialog>`, `@view-transition`) degrade gracefully: every function has a plain HTML base, so older browsers
get a usable site without the extras.

## License

The front-end code of the site is distributed under the GPL-3.0 terms, because the map gesture plugin
(`@raruto/leaflet-gesture-handling`, GPL-3.0) is bundled into the public JavaScript. The source is made
available through the source maps that ship with the build (`vite.build.sourcemap: true`).
