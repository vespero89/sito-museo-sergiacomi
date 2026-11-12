// Everything that is not confirmed (spec 3.5). One rule, used by the production block and by
// `content:report`: an entry whose stato is not `confermato`, a `daConfermare` item, a `[[...]]`
// marker, a place with `verificato: false`, an image with `altVerificato: false`, and the same
// kinds of thing in sito.yaml.
//
// The functions work on data in memory, like the content checks; `apertiDelRepo` reads the files.
import { join } from 'node:path';
import { leggiContenuti, type Contenuti, type Problema } from './controllo-contenuti.ts';
import { COLLEZIONI, type Collezione } from './schemi.ts';
import { parseYaml } from './yaml.ts';
import { readFileSync } from 'node:fs';

export type Causa =
  | 'dubbio' // an item of daConfermare
  | 'marcatore' // a [[...]] marker in a text
  | 'da-confermare' // stato: da-confermare
  | 'segnaposto' // stato: segnaposto
  | 'coordinate' // luoghi.verificato: false
  | 'alt'; // immagini.altVerificato: false

export interface Aperto {
  collezione: Collezione | 'sito';
  file: string;
  causa: Causa;
  dettaglio: string;
}

export const FILE_SITO = 'src/data/sito.yaml';

const come = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** The reason of each `[[...]]` marker in a text. An unclosed marker counts too: it is still open. */
export function trovaMarcatori(testo: string): string[] {
  const motivi: string[] = [];
  for (const m of testo.matchAll(/\[\[([\s\S]*?)(?:\]\]|$)/g)) {
    const dentro = m[1]!.trim();
    motivi.push(dentro.replace(/^DA CONFERMARE:\s*/, '').slice(0, 100));
  }
  return motivi;
}

/** Every string inside a value, at any depth. */
function* testiIn(valore: unknown): Generator<string> {
  if (typeof valore === 'string') yield valore;
  else if (Array.isArray(valore)) for (const v of valore) yield* testiIn(v);
  else if (typeof valore === 'object' && valore !== null)
    for (const v of Object.values(valore)) yield* testiIn(v);
}

function dubbiDi(dati: Record<string, unknown>): string[] {
  const elenco = dati.daConfermare;
  if (!Array.isArray(elenco)) return [];
  return elenco.map((d) => {
    const { campo, nota } = come(d);
    return `${String(campo)}: ${String(nota)}`;
  });
}

function marcatoriDi(dati: unknown, corpo: string): string[] {
  return [...testiIn(dati), corpo].flatMap(trovaMarcatori);
}

/** All the open items of the content and of sito.yaml. */
export function trovaAperti(contenuti: Contenuti, sito: unknown): Aperto[] {
  const aperti: Aperto[] = [];

  for (const collezione of COLLEZIONI) {
    for (const voce of contenuti[collezione]) {
      const dati = come(voce.dati);
      const nuovo = (causa: Causa, dettaglio: string) =>
        aperti.push({ collezione, file: voce.etichetta, causa, dettaglio });

      if (dati.stato !== 'confermato') {
        const stato = dati.stato === 'segnaposto' ? 'segnaposto' : 'da-confermare';
        nuovo(stato, `stato: ${String(dati.stato)}`);
      }
      for (const dubbio of dubbiDi(dati)) nuovo('dubbio', dubbio);
      for (const motivo of marcatoriDi(voce.dati, voce.corpo)) nuovo('marcatore', motivo);
      if (collezione === 'luoghi' && dati.verificato !== true) {
        nuovo('coordinate', 'coordinates not verified (verificato: false)');
      }
      if (collezione === 'immagini' && dati.altVerificato !== true) {
        nuovo('alt', 'alt text not verified (altVerificato: false)');
      }
    }
  }

  const dati = come(sito);
  for (const dubbio of dubbiDi(dati)) {
    aperti.push({ collezione: 'sito', file: FILE_SITO, causa: 'dubbio', dettaglio: dubbio });
  }
  for (const motivo of marcatoriDi(sito, '')) {
    aperti.push({ collezione: 'sito', file: FILE_SITO, causa: 'marcatore', dettaglio: motivo });
  }
  return aperti;
}

/** One line per open item, for the error of the production build. */
export function formattaAperti(aperti: Aperto[]): string {
  return aperti.map((a) => `  ${a.file}\n    ${a.causa}: ${a.dettaglio}`).join('\n');
}

/** Reads the repository at `radice` and returns its open items (and the files it could not read). */
export function apertiDelRepo(radice: string): { aperti: Aperto[]; problemi: Problema[] } {
  const problemi: Problema[] = [];
  const contenuti = leggiContenuti(radice, problemi);
  let sito: unknown;
  try {
    sito = parseYaml(readFileSync(join(radice, FILE_SITO), 'utf8'));
  } catch (e) {
    problemi.push({ file: FILE_SITO, messaggio: e instanceof Error ? e.message : String(e) });
  }
  return { aperti: trovaAperti(contenuti, sito), problemi };
}
