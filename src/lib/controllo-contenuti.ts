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
function leggiContenuti(radice: string, problemi: Problema[]): Contenuti {
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

/** Validates the parsed sito.yaml. */
function controllaSito(dati: unknown, file: string): Problema[] {
  const r = sitoSchema.safeParse(dati);
  if (r.success) return [];
  return r.error.issues.map((i) => ({
    file,
    messaggio: `${i.path.join('.') || '(file)'}: ${i.message}`,
  }));
}

/** Runs every check on the repository at `radice`. */
export function controllaRepo(radice: string): { problemi: Problema[]; voci: number } {
  const problemi: Problema[] = [];

  const contenuti = leggiContenuti(radice, problemi);
  problemi.push(
    ...controllaContenuti(contenuti, {
      fotoEsiste: (file) => existsSync(join(radice, 'src', 'assets', 'foto', file)),
    }),
  );

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
