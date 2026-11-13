# Content guide

How to add and change the content of the site. This guide is in English; **the content itself is
Italian** (titles, descriptions, body text, notes to confirm). Keep the field names as they are (they
are Italian too: `titolo`, `descrizione`, `tappe`) and write all page text in plain Italian.

Rules for all text:

- No em dash and no en dash. Use commas, colons, brackets or a full stop.
- Short sentences, concrete words. The first sentence of a work page is also its search description.
- Do not invent facts. If you are not sure, mark it (see "Clearing items to confirm").
- File names: ASCII, lowercase, hyphens (`la-retara.md`). The file name is the id and, for most
  collections, the address (`/opere/la-retara/`).

## Where things are

| What                                          | Where                                                                                | Format                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------- |
| Works                                         | `src/content/opere/it/<slug>.md`                                                     | Markdown with frontmatter              |
| Places (with coordinates)                     | `src/content/luoghi/it/<id>.yaml`                                                    | YAML                                   |
| Itineraries                                   | `src/content/itinerari/it/<slug>.md`                                                 | Markdown                               |
| Events and initiatives                        | `src/content/eventi/it/<slug>.md`                                                    | Markdown                               |
| Archive items                                 | `src/content/archivio/it/<slug>.md`                                                  | Markdown                               |
| Photos (data, not files)                      | `src/content/immagini/it/immagini.yaml`                                              | One YAML list                          |
| Photo files                                   | `src/assets/foto/`                                                                   | JPEG masters, made by `npm run images` |
| Other collections                             | `sale`, `didattica`, `biografia`, `strumenti`, `pubblicazioni`, `percorsi`, `pagine` | see the schemas                        |
| Museum data (hours, contacts, menu, donation) | `src/data/sito.yaml`                                                                 | YAML                                   |
| Interface texts                               | `src/i18n/it.json`                                                                   | JSON                                   |

The rules for every field are in `src/lib/schemi.ts` (it refuses unknown fields and bad values).
After each edit run `npm run content:check`: it lists every broken reference and field at once.
Then `npm run check` before a commit.

## Add a work

1. Add the photos first (see "Photos" below), so the work can point to them.
2. Make sure its place exists in `src/content/luoghi/it/` (copy a file such as
   `offida-monumento-alle-merlettaie.yaml`; give `lat` and `lon`; leave `verificato: false` until
   someone has checked the coordinates).
3. Create `src/content/opere/it/<slug>.md`. Look at `le-merlettaie.md` (many photos, phases) and a
   simple one for the shape:

```yaml
---
titolo: 'Monumento alle Merlettaie'
categoria: monumento # one of the values in CATEGORIE_OPERA
anno: 1983 # leave out if unknown, and say so in daConfermare
nellElenco: true # true if it is one of the 25 works of the official list
materiali: []
luogo: offida-monumento-alle-merlettaie
immagini:
  - immagine: le-merlettaie-ritratto-1
    ruolo: ritratto
stato: confermato
daConfermare: []
---
Body text in Italian.
```

4. The first sentence of the page is generated from the fields (`src/lib/frase-opera.ts`); it never
   uses a field you listed in `daConfermare`. To write your own, add `frase:` (70 to 160 characters).
5. A work with no photo shows the "Foto in arrivo" panel; that is fine.
6. The counts of the import (25 works in the official list, per town) are checked by `content:check`
   (`src/lib/controllo-contenuti.ts`). If you add a work that is not in the list, set
   `nellElenco: false` so the count stays right; if the list itself changes, update the counts there.

To edit a work, change its file. To remove one, delete the file and every reference to it
(`content:check` lists them: itineraries, `continua`, rooms, photos).

## Photos

1. Put the original in `materiali/` (outside git) and add a line for it in
   `scripts/immagini-tabella.mjs`; run `npm run images`. It writes the master (at most 2400 px and
   1 MB, no metadata) into `src/assets/foto/`.
2. Add an entry to `src/content/immagini/it/immagini.yaml` with `id`, `file`, `alt` (what is seen, in
   Italian, not "immagine di"), `didascalia`, `origine` (`fondazione` or `terzi`), `stato`,
   `altVerificato` and `soggetto`. For a photo from a third party, `credito` is required.
3. Use the `id` in the `immagini` list of the work, room or archive item. Pages show photos only through
   `Foto.astro`; never put a picture in `public/`.

## Add or edit an event

Create `src/content/eventi/it/<slug>.md`:

```yaml
---
titolo: 'Le domeniche di Sergiacomi'
tipo: evento # evento (has a date) or iniziativa (no date yet)
data: '2027-05-09' # day as text, AAAA-MM-GG; dataFine for a range
dataTesto: '9 maggio 2027' # how the date is written on the page
luogo: 'Museo Sergiacomi, Offida'
descrizione: 'One or two sentences.'
stato: confermato
---
```

- An initiative with no date stays an `iniziativa` with `stato: segnaposto` until the Foundation gives
  one. Do not invent dates.
- **"Next event" is computed when the site is built**, with the day in Rome. An event stays "next" until
  the end of its last day, but the page only changes at the next build. After an event passes, rebuild
  and deploy, or the old event can stay on the home page.
- Past events move by themselves to the "passati" list of `/eventi/`.

## Add an archive item

Create `src/content/archivio/it/<slug>.md` (see `pergamena-offida-1992.md`):

- `tipo`: `foto`, `lettera`, `articolo` or `documento`; `data` as `AAAA`, `AAAA-MM` or `AAAA-MM-GG`.
- `file`: the `id` of the scan in `immagini.yaml` (add the photo first).
- `fonte`, `origine` (`fondazione` or `terzi`). For `terzi` the `credito` is required: the check fails
  without it.
- The filters of `/archivio/` (type, decade) read these fields, so fill them in.

## Itineraries

An itinerary is `src/content/itinerari/it/<slug>.md`:

```yaml
---
titolo: 'Dalla collina al mare: Offida, Grottammare e San Benedetto del Tronto'
descrizione: 'One sentence.'
modo: auto # a-piedi, auto or misto
durataMinuti: 240 # optional
tappe:
  - { tipo: opera, id: le-merlettaie, nota: 'Offida' }
  - { tipo: luogo, id: offida }
  - { tipo: opera, id: la-retara, gruppo: Marche } # gruppo splits the page into sub-lists
stato: confermato
---
Text in Italian.
```

A stop is an existing work (`tipo: opera`) or place (`tipo: luogo`). The order is the order of the
numbered stops on the page and on the map.

### How to split an itinerary

Do this when one itinerary is too long, or the Foundation wants two (for example "I portali del
Sergiacomi" has the groups Marche and Abruzzo).

1. Copy the file to a new one with its own slug (`i-portali-marche.md`, `i-portali-abruzzo.md`). Give
   each its own `titolo`, `descrizione`, `modo` and, if you know it, `durataMinuti`.
2. Move each stop to the file it now belongs to. Remove `gruppo` if a file no longer needs it. Every
   stop must stay in exactly the file you intend; none is lost.
3. Delete the old file, or keep it as a short overview only if a page with that address is still wanted.
   If you delete it, the old address `/itinerari/<old-slug>/` disappears: add a `301` redirect to
   the new page in `config/hosting.mjs` (the only place for redirects), and fix links that pointed at
   it (`continua` lists, `percorsi` YAML, texts).
4. Update what counts itineraries: `CONTEGGIO_ITINERARI` in `src/lib/controllo-contenuti.ts`, the test
   `tests/unit/import-itinerari.test.ts` (it expects four and the word "quattro"), and the texts that
   say "quattro itinerari" (`src/content/pagine/it/itinerari.md`, `src/content/percorsi/it/*.yaml`,
   `src/i18n/it.json`).
5. Run `npm run check`.

## Clearing items to confirm

Everything that is not confirmed is marked, and the production build refuses to run while anything is
open (see "Content gate" in `README.md`). To clear an item you need the confirmed fact from the
Foundation; then:

| Marker                                      | Where                               | To clear it                                                                                 |
| ------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------- |
| `stato: segnaposto` or `da-confermare`      | top of a file                       | check the whole entry, then set `stato: confermato`                                         |
| `daConfermare: [{ campo, nota }]`           | top of a file                       | fix the field named in `campo`, then delete that line (an empty list is `daConfermare: []`) |
| `[[DA CONFERMARE: reason]]`                 | inside body text                    | correct the sentence, then delete the whole marker                                          |
| `verificato: false`                         | a place in `luoghi`                 | after checking the coordinates, set `true`                                                  |
| `altVerificato: false`                      | a photo in `immagini.yaml`          | after someone reads the `alt` against the photo, set `true`                                 |
| `daConfermare` list in `src/data/sito.yaml` | museum data (hours, contacts, IBAN) | confirm the value, then delete its line                                                     |

Change a doubt only when the fact is confirmed. A listed `sito.yaml` field shows only the label, never
the value, in the preview, so a wrong IBAN or phone number never goes out by accident.

## The list of what is still open

```sh
npm run content:report
```

It prints every open item by collection and type, and the work pages with fewer than 40 written
words. To save it as the shared list for the content team:

```sh
{ echo "# Elenco unico delle cose da confermare"; echo; echo "Generato da \`npm run content:report\` il $(date +%d/%m/%Y). Si rigenera a fine di ogni compito."; echo; npm run -s content:report; } > appunti/da-confermare.md
```

(`appunti/` is not in git; the list is a working note.) When the report is empty, `npm run build:production`
passes the gate.

## Before you commit

```sh
npm run content:check   # only the content
npm run check           # types, lint, format, content, build, unit tests
```

The pre-commit hook runs `npm run check`; never skip it.
