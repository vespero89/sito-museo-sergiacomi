# Design brief: Museo Aldo Sergiacomi

You are redoing the visual design of a working prototype. The structure, the content model, the
behaviour and the tests are done. The look is deliberately plain, and it is yours to replace. This
brief says what the site is, what you may change, and what must keep working.

Read `README.md` for commands and `CONTENT-GUIDE.md` for how content is edited. The site text is
Italian; this brief is in English because everything committed to the repository is.

## 1. What the site is, and for whom

The Museo Aldo Sergiacomi is a museum-workshop in Offida (Marche, Italy), run by a foundation. It is
the studio of the sculptor Aldo Sergiacomi (1912 to 1994), who worked in plaster, bronze and marble:
altars, portals, monuments in squares and churches across Marche and Abruzzo. The museum is small:
four rooms (three rooms and the workshop), a cloister, and spaces for school workshops.

The thread of the site is the sculptor's work: from the idea to the work (sketch, plaster model,
foundry, monument in the square). Every page ends by pointing to the next step of that path.

Audience, in no fixed order (the Foundation has not said which comes first): school groups and
teachers, families, tourists passing through Offida, scholars and archive readers.

Tone: warm, direct, local, a craft and a place more than an institution. Plain Italian, short
sentences. Not a marble-and-gold monument site.

Reference sites (from `appunti/spunti-ux.md`; screenshots in `appunti/riferimenti-grafici/`):

| Site                        | Take                                                                                                                                                                                                                       | Avoid                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| uffizi.it                   | Service bar with notices on opening; entries by type of visitor (school, families, accessibility, scholars); events as dated cards                                                                                         | Automatic carousel on the home; a dense two-level menu, too much for a small museum |
| centrostudiosvaldolicini.it | The closest case (house museum of a Marche artist in a village); two buttons always in view, "Prenotazioni" and "Info e orari"; mosaic home of photo tiles with one accent colour; works split by period; footer in groups | Heavy WordPress page builder; a non-compliant cookie banner                         |
| arnaldopomodoro.it          | Home as a visual index of large tiles; a "works in the world" map with "near me" and search by town                                                                                                                        | A map that stays blank without cookie consent; an archive behind registration       |

Logo: there are two versions (arrows, circles), not yet decided. Until then the site shows the text
"Museo Aldo Sergiacomi". The logo is not a photo; it goes in as an SVG you add (not in `src/assets/foto/`).

## 2. Site map as it is now

Main menu (six entries, from `src/data/sito.yaml`, key `navigazione.principale`):

| Entry           | Address             | Notes                                                                                                                               |
| --------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Aldo Sergiacomi | `/aldo-sergiacomi/` | Biography, timeline 1912 to 1998                                                                                                    |
| Il museo        | `/il-museo/`        | Plan of the rooms; one page per room under `/il-museo/<room>/` (rooms 1 to 3, workshop, cloister, Foundation spaces)                |
| Opere           | `/opere/`           | Three views: by place, by decade, sortable table; map with a year slider and a "Play" button; filters. 27 works at `/opere/<slug>/` |
| Itinerari       | `/itinerari/`       | Four itineraries at `/itinerari/<slug>/`, numbered stops on a small map, printable                                                  |
| Didattica       | `/didattica/`       | Schools and workshops                                                                                                               |
| Visita          | `/visita/`          | Opening, how to get there, booking, contacts                                                                                        |

Also in the header: search (`/ricerca/`), one booking button. On a phone (below 768 px) a fixed bar at the
bottom carries the two visit actions.

Footer, group "Approfondisci": Eventi (`/eventi/`, `/eventi/<slug>/`), Archivio (`/archivio/`,
`/archivio/<slug>/`, with filters), Pubblicazioni, Chi siamo, Sostieni il museo, Cerca nel sito.
Group "Note": Privacy, Cookie, Note legali, Accessibilita (all placeholders, to be confirmed by a lawyer).

Home (`/`): strong photo, next event (only if it is in the future), mosaic of four areas, the block
"Su misura per te" (`#su-misura`, the audience paths: school, family, visit, study), a band "Altro dal
museo". A work page (`/opere/<slug>/`) can have "Dall'idea all'opera" (phases with a fixed image that
changes while scrolling) and a before/after slider (sketch against monument). Every page ends with
"Continua il percorso" and "Vedi anche".

There are also `/404.html` and the 12 old `.htm` addresses, which redirect with `301` (see
`config/hosting.mjs`; addresses and redirects must not change).

## 3. What to redo

Everything visual: tokens, component CSS, layout, fonts, colours, decorative images, logo, motion, the
visual order of the tiles, the plan of the rooms. The prototype's look is neutral on purpose.

From the UX review (what was left for the new design):

- The cards and the "Foto in arrivo" panel (today the same beige panel for 19 works with no photo).
- The header on a phone (today "Menu" sits on a line of its own).
- The style of the map markers and of the numbered stops. The rule on what they show is fixed: a group
  shows its count, a single work shows an icon, the year goes in the popup.
- The perceived length of the home (about 6,400 px on a phone): rhythm, alternation of photo and text.
- Hero, typography, colours; and repeated photos (the same Merlettaie photo is in the home and in Chi siamo).

Open UX points, offered as suggestions (the structure may change if the addresses do not):

- **A3, schools first.** `/didattica/` opens with an essay; "Visite e laboratori su richiesta" is at the
  bottom. Suggestion: what we offer and how to book first, then past projects, then the text on the
  value of the museum. Rename the entry "Scuole e laboratori" (not decided; see below).
- **A5, a more readable biography.** A wall of text without subheads; the works it mentions (Merlettaie,
  portals of Fermo, Sogno del Pescatore) have no links. Suggestion: three or four subheads (training,
  Offida, bronze, the large commissions), links to the work pages, one photo per period in the timeline,
  the link "the works up to YEAR" once per year, not on every line.
- **A7, more inviting itineraries.** Cards without a photo or an overview map; on the page some stops
  overlap; the museum is not a stop. Suggestion: photo of the first stop on the card, duration and
  length, the museum as stop 0 where it makes sense, initial zoom fitted to the stops.
- **A9, one style for placeholders.** Today there is a "Da confermare" badge, the text
  `[[DA CONFERMARE: ...]]` and a "Segnaposto" label. On `/visita/` the square brackets look like an
  error. Suggestion: one component for all of them.
- **A10, dates in one format.** In the archive "1983" and "1992-07-27" both appear. Suggestion: "27 luglio 1992".

Open choices left to you:

- "Chi siamo" may stay in the main menu or sit in the footer only. Move it by editing `sito.yaml`
  (`principale` or `piede`); its address `/chi-siamo/` does not change.
- The menu label "Didattica" or "Scuole e laboratori" is waiting for Fabio; do not decide it in code
  without asking. "LaDiMAS" stays: it is the brand agreed with the Foundation (decided 13/11/2026). Our
  advice: not a menu entry, but a small subtitle under the museum name, in the footer and in "Chi siamo".

### Hints from the project review (13/11/2026)

Each point says what to design and why. They are suggestions, not constraints.

1. **Top of the home: one sentence and one button.** A sentence that says what the museum is, and a large
   "Prenota la visita" button. The box with address and hours must look fine when the hours say only
   "Solo su prenotazione" (today it is a single line and looks like a gap).
2. **A "Prenota" box.** Not a paragraph: a box people notice, with the email address, two words on what
   to write in the mail and how soon they get an answer. The same box goes in the home, in Visita and in
   the schools page. Booking is by email only (there is no phone or form, and no museum social accounts).
3. **Works without a photo.** Today 19 of 27 works share the same beige "Foto in arrivo" panel. Replace
   it with a simple drawing that changes with the type of work (outline of a monument, a portal, an
   altar), so it looks intentional. It is needed only until the photos arrive.
4. **A small mark for "drawing, plaster, bronze".** The three steps from sketch to statue are the theme of
   the site. Design a small mark that recalls them (three shapes, three colours, or an icon) for section
   titles, for the phases of a work and for the single-work marker on the map.
5. **A box for practical data.** For schools: age of the children, duration, cost, how to book. For
   itineraries: duration, walking length, difficulty. Same design, different data.
6. **Colours from the workshop.** Plaster white, bronze green or brown, wood and iron of the tools. The
   photos of the tools exist already (collection `strumenti`) and can serve as backgrounds or details.
7. **A place for a quote.** In the home and in the schools page, a slot for a sentence from a teacher or a
   visitor. If the Foundation has none yet, the slot stays empty without harm.
8. **The header without a logo.** The logo is not chosen yet: the header must work with the name alone,
   "Museo Aldo Sergiacomi", and a small "LaDiMAS" under it. Leave room for an "English" button, which
   comes later.
9. **The tinted map.** If the map tiles take the colours of the site, check that town names stay
   readable and that the markers stand out, both the numbered ones (groups) and the icon ones (single
   work).
10. **Photos of children in the workshops.** They may never exist (parents' consent). The cards of the
    school projects must look good with photos of hands, materials and works, with no faces.

## 4. Visual quality matters (request of the owner)

Fabio gave priority to a beautiful, striking result. Where the technical choice was between something
beautiful and something simple, the beautiful one was kept, always inside the CSP and accessibility.
The prototype has the hooks; the look is for you:

- Map with real gesture handling on a phone (two fingers move the map, one finger scrolls the page, with
  an overlaid message) and hand-drawn `divIcon` markers, not the default ones.
- OpenStreetMap tiles tinted to the palette with a CSS filter built from the tokens, and a "Play" button
  that fills the map year by year.
- "Dall'idea all'opera" with a fixed image that changes while scrolling, and a before/after slider
  (sketch against monument), usable with the keyboard.
- Page transitions where the photo of a work grows from the card to the top of its page; a mosaic home
  with one strong full-width photo.
- Your own fonts are allowed, hosted locally (`font-display: swap`), never from an outside service;
  polished animation, switched off under `prefers-reduced-motion`.

## 5. Photos and their limits

- Masters live only in `src/assets/foto/` (JPEG, at most 2400 px and 1 MB; made by `npm run images`).
  Pages show them only through `src/components/Foto.astro`, never an `<img>` by hand and never `public/`.
- Some photos are small (the Merlettaie "monument" is 1186 x 749 px): they are never upscaled, so design
  for a maximum size per photo. Room 1 is dark (phone photo); it may stay out.
- 19 of the 27 works have no photo yet. The "Foto in arrivo" panel must look intentional. The Foundation
  is preparing the photos (decided 13/11/2026); until they arrive, design for both cases.
- The phases sketch, foundry, monument are a theme in themselves (Merlettaie: 10 photos; Sogno del
  pescatore: 5). Use them.
- Budgets (enforced by tests on `dist/`): no served image over 400 KB, `dist/` under 25 MB (temporarily
  32 MB while photos are not optimised), the largest image of a page marked `priorita` (one per page).

## 6. Constraints that must not break

The pre-commit checks and the tests defend these. If one fails, change your design, not the test,
unless you have a reason you can state.

1. **CSP without inline code.** No `<style>`, no `style=""`, no inline `<script>`, no `on*` attributes in
   the built pages. Keep `build.inlineStylesheets: 'never'` and `assetsInlineLimit: 0`. Per-page dynamic
   values go in a generated stylesheet (see `src/pages/assets/vt-opere.css.ts`) or in classes. A new
   outside domain is not allowed unless it goes through the services registry (`src/data/servizi.ts`).
   Headers, CSP and redirects live only in `config/hosting.mjs`.
2. **Tokens.** `src/styles/tokens.css` is the only place for raw colours and sizes. Media queries cannot
   use `var()`, so the breakpoints are written in `em` in the components: 48em (768 px, header actions
   against the bottom bar), 56em, 64em. Reduced motion sets the motion tokens to zero.
3. **Photos.** `Foto.astro` only; every photo has an `alt` in `src/content/immagini/it/immagini.yaml`
   (the schema refuses an empty one); real `width` and `height`; no layout jump.
4. **Accessibility.** WCAG 2.2 AA; axe has no violations on the sample pages (phone and wide). One `h1` per
   page, headings in order, landmarks, "Salta al contenuto" link, visible and never covered focus,
   everything usable with the keyboard, links with text, `lang`. 200% zoom and a screen reader pass are
   done by hand by Fabio on the main path.
5. **Works without JavaScript.** The list of works, the sequence of phases, the archive grid and the menu
   (a native `popover`) have an HTML base. The map is never the only way to reach a work.
6. **Reduced motion.** With `prefers-reduced-motion: reduce`: no page transition, no map animation, no
   fades, no "Play" button.
7. **Content gate and modes.** Every entry can be `confermato`, `da-confermare` or `segnaposto`. The
   preview shows open items with the `DaConfermare` label; `npm run build:production` stops while any is
   open. Keep the label (restyle it, do not remove it). Which mode the build is in comes from
   `decidiModalita` (`src/lib/modalita.ts`), never from an environment variable in a component.
8. **View transitions.** The names `opera-<slug>` come from `/assets/vt-opere.css` (linked only from
   `/opere/` and the work pages) and must be unique on a page; the rule `@view-transition` is in
   `src/styles/globale.css`. Do not give a second element the same name.
9. **Map.** Leaflet 1.9.4 with our own gesture code (`src/scripts/mappa-gesti.ts`), loaded only on the pages that have a map, with local
   tiles in the tests (`--fake-tiles`); no cookie and no request to any host other than OpenStreetMap
   tiles. Marker drawing is in `src/scripts/mappa-opere.ts` (`creaMarcatore`).
10. **Semantics and head.** Titles, descriptions, canonical, Open Graph and JSON-LD come from `Seo.astro`
    and `src/lib/`. Do not rewrite content inside components; change it in the content files.
11. **Italian text.** No em dash and no en dash in any Italian text (use commas, colons, brackets or a
    full stop). Page text is data, not code: do not retype it into components.
12. **Names.** Content files and folders: ASCII, lowercase, hyphens. Code identifiers are mostly
    Italian (`Testata`, `PiedeSito`); keep the surrounding style.

What may change: the whole look, the inside of components, the plan of the rooms, new components. What
may not: the content model and schemas, addresses and redirects, the head and JSON-LD, HTML semantics,
keyboard and no-JavaScript behaviour, the CSP, the weight budgets, the text of the content.

## 7. Components and tokens

Components are in `src/components/`, each with its own style, and receive ready data (they do not know
the collections): `Testata`, `Menu`, `BarraAzioni`, `PiedeSito`, `Seo`, `Foto`, `FotoOpera`,
`CartaOpera`, `CartaVoce`, `SchedaOpera`, `Fasi`, `Confronto`, `Galleria`, `MappaOpere`, `MappaPiccola`,
`LineaTempo`, `PiantaSale`, `SezioneSala`, `Continua`, `Breadcrumb`, `DaConfermare`, `Dubbi`,
`ProssimoEvento`, `ListaStrumenti`, `DatoSito`. The layout is `src/layouts/Base.astro` (head, header,
main, footer, skip link). Global rules are in `src/styles/globale.css`, map styles in
`src/styles/mappa-leaflet.css`. Tokens: colours, typography, spacing, radii, shadows, widths, motion
durations and curves.

Keep, restyled if you wish: the `DaConfermare` labels, the "Salta al contenuto" link, the bottom bar
on a phone.

## 8. How to work and check

```sh
npm install                          # also turns the pre-commit hook on
npx playwright install chromium      # once, for the browser tests
npm run dev                          # development server
npm run check                        # types, ESLint, Prettier, content, build, Vitest
npm run test:e2e                     # build, then Playwright on dist/: axe, keyboard, no JS, CSP, no outside request
npm run test:lh                      # build, then Lighthouse CI on mobile (needs Google Chrome)
```

Work on a branch from `prototipo` (for example `claude-design`); never on `main`. Run `npm run check`
before each commit; the hook runs it too, never skip it. Do not commit `materiali/` or `appunti/`. Do
not push without Fabio's approval.

Two things to know about the browser tests: they run with one worker, and the page transition test
checks that the browser accepted a transition on the `pageswap` event, because the paint of the new page
in headless Chromium is timing dependent. Lighthouse targets 100 in the four categories; `/opere/` with
the map is the riskiest page, so measure it early.
