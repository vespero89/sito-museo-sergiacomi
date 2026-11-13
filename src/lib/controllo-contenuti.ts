// Content checks run by `npm run content:check` (spec 3.1, 8-A): schemas, references between
// collections, sito.yaml. Astro validates the schemas in the build, but in Astro 7.4 a broken
// reference only logs an error and the build goes on, so the references are checked here.
//
// The functions that decide are pure and work on data in memory (that is how the bad-data tests
// run); `controllaRepo` reads the files and calls them.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  COLLEZIONI,
  CORPO_OBBLIGATORIO,
  FILE_ELENCO,
  FORMATO,
  creaSchemi,
  type Collezione,
} from './schemi.ts';
import { PAGINE_BLOCCANTI } from './bloccanti.ts';
import { sitoSchema } from './sito.ts';
import { parseYaml } from './yaml.ts';

/** One entry as read from disk. `etichetta` is what error messages call it (file, and item). */
export interface Voce {
  id: string;
  etichetta: string;
  dati: unknown;
  corpo: string;
}
export type Contenuti = Record<Collezione, Voce[]>;
export interface Problema {
  file: string;
  messaggio: string;
}

interface Opzioni {
  /** Does `src/assets/foto/<file>` exist? */
  fotoEsiste: (file: string) => boolean;
  /**
   * The files that are in `src/assets/foto/`. When given, each one must have an entry in the
   * `immagini` collection: that is where its `alt` is, and a photo without `alt` is not allowed.
   */
  fotoPresenti?: readonly string[];
}

const vuoto = (): Contenuti =>
  Object.fromEntries(COLLEZIONI.map((c) => [c, [] as Voce[]])) as unknown as Contenuti;

interface Riferimento {
  collezione: Collezione;
  id: string;
}

export function controllaContenuti(contenuti: Contenuti, opzioni: Opzioni): Problema[] {
  const problemi: Problema[] = [];
  const errore = (file: string, messaggio: string) => problemi.push({ file, messaggio });

  // References seen while parsing the entry being checked.
  let viste: Riferimento[] = [];
  const schemi = creaSchemi({ osserva: (collezione, id) => viste.push({ collezione, id }) });

  const esistenti = vuoto() as unknown as Record<Collezione, Set<string>>;
  for (const c of COLLEZIONI) esistenti[c] = new Set(contenuti[c].map((v) => v.id));

  const daVerificare: { voce: Voce; riferimenti: Riferimento[] }[] = [];
  for (const collezione of COLLEZIONI) {
    for (const voce of contenuti[collezione]) {
      viste = [];
      const r = schemi[collezione].safeParse(voce.dati);
      if (!r.success) {
        // No reference check for an entry that is already wrong: it would only add noise.
        for (const i of r.error.issues) {
          errore(voce.etichetta, `${i.path.join('.') || '(entry)'}: ${i.message}`);
        }
        continue;
      }
      daVerificare.push({ voce, riferimenti: viste });
      if (CORPO_OBBLIGATORIO.includes(collezione) && voce.corpo.trim() === '') {
        errore(voce.etichetta, 'corpo: the text of the entry is empty');
      }
    }
  }

  for (const { voce, riferimenti } of daVerificare) {
    for (const { collezione, id } of riferimenti) {
      if (!esistenti[collezione].has(id)) {
        errore(voce.etichetta, `points to ${collezione} "${id}", which does not exist`);
      }
    }
  }

  // Things that must be unique across the collection.
  const visti = new Map<string, string>();
  for (const voce of contenuti.immagini) {
    if (visti.has(voce.id)) {
      errore(voce.etichetta, `the image id "${voce.id}" is already used by ${visti.get(voce.id)}`);
    } else {
      visti.set(voce.id, voce.etichetta);
    }
  }
  const numeri = new Map<number, string>();
  for (const voce of contenuti.sale) {
    const numero = (voce.dati as { numero?: unknown } | null)?.numero;
    if (typeof numero !== 'number') continue;
    if (numeri.has(numero)) {
      errore(voce.etichetta, `the sala numero ${numero} is already used by ${numeri.get(numero)}`);
    } else {
      numeri.set(numero, voce.etichetta);
    }
  }

  for (const voce of contenuti.immagini) {
    const file = (voce.dati as { file?: unknown } | null)?.file;
    if (typeof file === 'string' && !opzioni.fotoEsiste(file)) {
      errore(voce.etichetta, `the file src/assets/foto/${file} does not exist`);
    }
  }
  const conVoce = new Set(
    contenuti.immagini.map((v) => (v.dati as { file?: unknown } | null)?.file),
  );
  for (const file of opzioni.fotoPresenti ?? []) {
    if (!conVoce.has(file)) {
      errore(
        `src/assets/foto/${file}`,
        'the photo has no entry in the immagini collection, so no alt: add one to immagini.yaml',
      );
    }
  }

  return problemi;
}

/** Splits a Markdown file into its YAML frontmatter and its text. */
export function dividiFrontmatter(sorgente: string): { frontmatter: unknown; corpo: string } {
  const m = /^---\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n([\s\S]*))?$/.exec(sorgente);
  if (!m) throw new Error('the file does not start with a --- frontmatter block');
  return { frontmatter: parseYaml(m[1] ?? '') ?? {}, corpo: m[2] ?? '' };
}

/** Message of an error thrown while reading a file. */
const messaggioDi = (e: unknown) => (e instanceof Error ? e.message.split('\n')[0]! : String(e));

const ESTENSIONE = { md: '.md', yaml: '.yaml' } as const;
const NOME_FILE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Reads every collection from `src/content/<collection>/it/`. */
export function leggiContenuti(radice: string, problemi: Problema[]): Contenuti {
  const contenuti = vuoto();

  for (const collezione of COLLEZIONI) {
    const relativa = `src/content/${collezione}/it`;
    const cartella = join(radice, relativa);
    if (!existsSync(cartella)) continue;
    const formato = FORMATO[collezione];

    if (formato === 'elenco') {
      const percorso = `${relativa}/${FILE_ELENCO}`;
      if (!existsSync(join(radice, percorso))) continue;
      try {
        const elenco = parseYaml(readFileSync(join(radice, percorso), 'utf8')) ?? [];
        if (!Array.isArray(elenco)) throw new Error('must be a list of items');
        elenco.forEach((dati: unknown, i) => {
          const id = (dati as { id?: unknown } | null)?.id;
          contenuti[collezione].push({
            id: typeof id === 'string' ? id : `#${i + 1}`,
            etichetta: `${percorso} (item ${i + 1}${typeof id === 'string' ? `, ${id}` : ''})`,
            dati,
            corpo: '',
          });
        });
      } catch (e) {
        problemi.push({ file: percorso, messaggio: messaggioDi(e) });
      }
      continue;
    }

    for (const nome of readdirSync(cartella).sort()) {
      if (nome.startsWith('.')) continue; // .gitkeep
      const percorso = `${relativa}/${nome}`;
      const estensione = ESTENSIONE[formato];
      if (!nome.endsWith(estensione)) {
        problemi.push({
          file: percorso,
          messaggio: `the build ignores this file: ${collezione} files end in ${estensione}`,
        });
        continue;
      }
      const id = nome.slice(0, -estensione.length);
      if (!NOME_FILE.test(id)) {
        problemi.push({
          file: percorso,
          messaggio: 'file names are lowercase ASCII with hyphens (spec 2.1)',
        });
        continue;
      }
      try {
        const sorgente = readFileSync(join(radice, percorso), 'utf8');
        if (formato === 'md') {
          const { frontmatter, corpo } = dividiFrontmatter(sorgente);
          contenuti[collezione].push({ id, etichetta: percorso, dati: frontmatter, corpo });
        } else {
          contenuti[collezione].push({
            id,
            etichetta: percorso,
            dati: parseYaml(sorgente) ?? {},
            corpo: '',
          });
        }
      } catch (e) {
        problemi.push({ file: percorso, messaggio: messaggioDi(e) });
      }
    }
  }
  return contenuti;
}

/** The photo files in `src/assets/foto/` (none when the folder does not exist yet). */
function elencaFoto(radice: string): string[] {
  const cartella = join(radice, 'src', 'assets', 'foto');
  return existsSync(cartella) ? readdirSync(cartella).filter((f) => !f.startsWith('.')) : [];
}

/** Validates the parsed sito.yaml. */
function controllaSito(dati: unknown, file: string): Problema[] {
  const r = sitoSchema.safeParse(dati);
  if (r.success) return [];
  return r.error.issues.map((i) => ({
    file,
    messaggio: `${i.path.join('.') || '(file)'}: ${i.message}`,
  }));
}

/**
 * Works of the Foundation's list (`nellElenco: true`) for each comune, from the docx and the
 * exploration (spec 3.3): 25 in all. With the two extra cards Offida has 9.
 */
export const CONTEGGIO_OPERE_PER_COMUNE: Readonly<Record<string, number>> = {
  Offida: 7,
  Teramo: 4,
  'Ascoli Piceno': 3,
  'San Benedetto del Tronto': 3,
  Fermo: 2,
  Loreto: 2,
  Grottammare: 1,
  "Montefiore dell'Aso": 1,
  "Sant'Egidio alla Vibrata": 1,
  Folignano: 1,
};

/** Prizes, exhibitions, rooms, itineraries and paths the docx lists (spec 3.3). */
export const CONTEGGIO_BIOGRAFIA = { premio: 3, mostra: 8 } as const;
export const CONTEGGIO_SALE = 4;
export const CONTEGGIO_ITINERARI = 4;
export const CONTEGGIO_PERCORSI = 4;

/**
 * Checks that the import has the number of works the docx lists (spec 3.3), in total and for each
 * comune, and the prizes, exhibitions and rooms. Only for the real repository: a small test repo has no reason to have 25 works.
 */
export function controllaConteggi(contenuti: Contenuti): Problema[] {
  const comuneDi = new Map<string, string>();
  for (const l of contenuti.luoghi) {
    const comune = (l.dati as { comune?: unknown } | null)?.comune;
    if (typeof comune === 'string') comuneDi.set(l.id, comune);
  }

  const trovate: Record<string, number> = {};
  let totale = 0;
  for (const o of contenuti.opere) {
    const dati = o.dati as { nellElenco?: unknown; luogo?: unknown } | null;
    if (dati?.nellElenco !== true) continue;
    totale += 1;
    const comune = comuneDi.get(String(dati.luogo)) ?? '(unknown place)';
    trovate[comune] = (trovate[comune] ?? 0) + 1;
  }

  const attesa = Object.values(CONTEGGIO_OPERE_PER_COMUNE).reduce((a, b) => a + b, 0);
  const problemi: Problema[] = [];
  const file = 'src/content/opere/it';
  if (totale !== attesa) {
    problemi.push({ file, messaggio: `expected ${attesa} works of the list, found ${totale}` });
  }
  for (const comune of new Set([
    ...Object.keys(CONTEGGIO_OPERE_PER_COMUNE),
    ...Object.keys(trovate),
  ])) {
    const attese = CONTEGGIO_OPERE_PER_COMUNE[comune] ?? 0;
    const viste = trovate[comune] ?? 0;
    if (attese !== viste) {
      problemi.push({ file, messaggio: `expected ${attese} works in ${comune}, found ${viste}` });
    }
  }

  for (const [tipo, attesi] of Object.entries(CONTEGGIO_BIOGRAFIA)) {
    const viste = contenuti.biografia.filter(
      (b) => (b.dati as { tipo?: unknown } | null)?.tipo === tipo,
    ).length;
    if (viste !== attesi) {
      const nome = tipo === 'premio' ? 'prizes' : 'exhibitions';
      problemi.push({
        file: 'src/content/biografia/it',
        messaggio: `expected ${attesi} ${nome}, found ${viste}`,
      });
    }
  }
  if (contenuti.sale.length !== CONTEGGIO_SALE) {
    problemi.push({
      file: 'src/content/sale/it',
      messaggio: `expected ${CONTEGGIO_SALE} rooms, found ${contenuti.sale.length}`,
    });
  }
  for (const [collezione, attesi, nome] of [
    ['itinerari', CONTEGGIO_ITINERARI, 'itineraries'],
    ['percorsi', CONTEGGIO_PERCORSI, 'paths'],
  ] as const) {
    if (contenuti[collezione].length !== attesi) {
      problemi.push({
        file: `src/content/${collezione}/it`,
        messaggio: `expected ${attesi} ${nome}, found ${contenuti[collezione].length}`,
      });
    }
  }
  return problemi;
}

interface OpzioniRepo {
  /** Also check the counts of the import (`controllaConteggi`). `npm run content:check` does. */
  conteggi?: boolean;
}

/** Every page of PAGINE_BLOCCANTI must exist, or the rule would silently protect nothing. */
export function controllaPagineBloccanti(contenuti: Contenuti): Problema[] {
  const esistenti = new Set(contenuti.pagine.map((p) => p.id));
  return PAGINE_BLOCCANTI.filter((id) => !esistenti.has(id)).map((id) => ({
    file: 'src/lib/bloccanti.ts',
    messaggio: `PAGINE_BLOCCANTI lists "${id}", which is not a page`,
  }));
}

/** Runs every check on the repository at `radice`. */
export function controllaRepo(
  radice: string,
  { conteggi = false }: OpzioniRepo = {},
): { problemi: Problema[]; voci: number } {
  const problemi: Problema[] = [];

  const contenuti = leggiContenuti(radice, problemi);
  problemi.push(
    ...controllaContenuti(contenuti, {
      fotoEsiste: (file) => existsSync(join(radice, 'src', 'assets', 'foto', file)),
      fotoPresenti: elencaFoto(radice),
    }),
  );
  if (conteggi) {
    problemi.push(...controllaConteggi(contenuti));
    problemi.push(...controllaPagineBloccanti(contenuti));
  }

  const fileSito = 'src/data/sito.yaml';
  try {
    problemi.push(
      ...controllaSito(parseYaml(readFileSync(join(radice, fileSito), 'utf8')), fileSito),
    );
  } catch (e) {
    problemi.push({ file: fileSito, messaggio: messaggioDi(e) });
  }

  const voci = COLLEZIONI.reduce((somma, c) => somma + contenuti[c].length, 0);
  return { problemi, voci };
}
