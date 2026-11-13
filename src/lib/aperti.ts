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
import { eBloccante, type Candidato } from './bloccanti.ts';
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
  /** The production build stops for it (see bloccanti.ts). */
  bloccante: boolean;
}

export const FILE_SITO = 'src/data/sito.yaml';

const come = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

interface Marcatore {
  motivo: string;
  /** The text between `[[` and `]]`, untouched. */
  testo: string;
  nonChiuso: boolean;
}

function leggiMarcatori(testo: string): Marcatore[] {
  return [...testo.matchAll(/\[\[([\s\S]*?)(\]\]|$)/g)].map((m) => {
    const dentro = m[1]!.trim();
    return {
      motivo: dentro.replace(/^DA CONFERMARE:\s*/, '').slice(0, 100),
      testo: dentro,
      nonChiuso: m[2] === '',
    };
  });
}

/** The reason of each `[[...]]` marker in a text. An unclosed marker counts too: it is still open. */
export function trovaMarcatori(testo: string): string[] {
  return leggiMarcatori(testo).map((m) => m.motivo);
}

/** Every string inside a value, at any depth. */
function* testiIn(valore: unknown): Generator<string> {
  if (typeof valore === 'string') yield valore;
  else if (Array.isArray(valore)) for (const v of valore) yield* testiIn(v);
  else if (typeof valore === 'object' && valore !== null)
    for (const v of Object.values(valore)) yield* testiIn(v);
}

interface Dubbio {
  campo: string;
  dettaglio: string;
  bloccante: boolean;
}

function dubbiDi(dati: Record<string, unknown>): Dubbio[] {
  const elenco = dati.daConfermare;
  if (!Array.isArray(elenco)) return [];
  return elenco.map((d) => {
    const { campo, nota, bloccante } = come(d);
    return {
      campo: String(campo),
      dettaglio: `${String(campo)}: ${String(nota)}`,
      bloccante: bloccante === true,
    };
  });
}

function marcatoriDi(dati: unknown, corpo: string): Marcatore[] {
  return [...testiIn(dati), corpo].flatMap(leggiMarcatori);
}

/** All the open items of the content and of sito.yaml. */
export function trovaAperti(contenuti: Contenuti, sito: unknown): Aperto[] {
  const aperti: Aperto[] = [];

  for (const collezione of COLLEZIONI) {
    for (const voce of contenuti[collezione]) {
      const dati = come(voce.dati);
      const nuovo = (causa: Causa, dettaglio: string, extra: Partial<Candidato> = {}) =>
        aperti.push({
          collezione,
          file: voce.etichetta,
          causa,
          dettaglio,
          bloccante: eBloccante({ collezione, id: voce.id, causa, ...extra }),
        });

      if (dati.stato !== 'confermato') {
        const stato = dati.stato === 'segnaposto' ? 'segnaposto' : 'da-confermare';
        nuovo(stato, `stato: ${String(dati.stato)}`);
      }
      for (const d of dubbiDi(dati)) {
        nuovo('dubbio', d.dettaglio, { campo: d.campo, bloccante: d.bloccante });
      }
      for (const m of marcatoriDi(voce.dati, voce.corpo)) {
        nuovo('marcatore', m.motivo, { testoMarcatore: m.testo, nonChiuso: m.nonChiuso });
      }
      if (collezione === 'luoghi' && dati.verificato !== true) {
        nuovo('coordinate', 'coordinates not verified (verificato: false)');
      }
      if (collezione === 'immagini' && dati.altVerificato !== true) {
        nuovo('alt', 'alt text not verified (altVerificato: false)');
      }
    }
  }

  const dati = come(sito);
  const nuovoSito = (causa: Causa, dettaglio: string, extra: Partial<Candidato>) =>
    aperti.push({
      collezione: 'sito',
      file: FILE_SITO,
      causa,
      dettaglio,
      bloccante: eBloccante({ collezione: 'sito', id: 'sito', causa, ...extra }),
    });
  for (const d of dubbiDi(dati)) {
    nuovoSito('dubbio', d.dettaglio, { campo: d.campo, bloccante: d.bloccante });
  }
  for (const m of marcatoriDi(sito, '')) {
    nuovoSito('marcatore', m.motivo, { testoMarcatore: m.testo, nonChiuso: m.nonChiuso });
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
