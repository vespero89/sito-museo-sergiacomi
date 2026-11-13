// Which open items stop a production build and which only wait (spec "voci bloccanti"). One
// classification, used by the block, by the error message and by `content:report`.
//
// Rules, in order:
// - `dubbio`: blocks when the item has `bloccante: true`, or when its field in sito.yaml (or the
//   parent of it, like `contatti` for `contatti.telefono`) is in CAMPI_BLOCCANTI;
// - `marcatore`: blocks when it is `[[BLOCCANTE: ...]]`, when it is not closed (fail-safe), or when
//   it sits in a page of PAGINE_BLOCCANTI;
// - `segnaposto` (stato): always blocks. It means "generated text, not approved yet";
// - `da-confermare` (stato): blocks only in a page of PAGINE_BLOCCANTI;
// - `coordinate`, `alt`: never block.
import type { Causa } from './aperti.ts';

/** Fields of sito.yaml where a doubt always blocks. A parent covers its sub-fields. */
export const CAMPI_BLOCCANTI: readonly string[] = [
  'orari',
  'contatti',
  'sostegno',
  'artista.nascita',
  'artista.morte',
  'museo.indirizzo',
  'fondazione.sede',
];

/** Ids of the legal pages (collection `pagine`): anything open in them blocks. */
export const PAGINE_BLOCCANTI: readonly string[] = [
  'privacy',
  'note-legali',
  'cookie',
  'accessibilita',
];

/** What `eBloccante` needs to know about an open item. */
export interface Candidato {
  collezione: string;
  /** Id of the entry (the page id for the collection `pagine`). */
  id: string;
  causa: Causa;
  /** `dubbio`: the field of the item. */
  campo?: string;
  /** `dubbio`: the item has `bloccante: true`. */
  bloccante?: boolean;
  /** `marcatore`: the text between `[[` and `]]`. */
  testoMarcatore?: string;
  /** `marcatore`: the marker has no closing `]]`. */
  nonChiuso?: boolean;
}

export function eCampoBloccante(campo: string): boolean {
  return CAMPI_BLOCCANTI.some((b) => campo === b || campo.startsWith(`${b}.`));
}

export const eMarcatoreBloccante = (testo: string): boolean => /^\s*BLOCCANTE\s*:/.test(testo);

export function eBloccante(c: Candidato): boolean {
  const inPaginaLegale = c.collezione === 'pagine' && PAGINE_BLOCCANTI.includes(c.id);
  switch (c.causa) {
    case 'dubbio':
      return c.bloccante === true || (c.collezione === 'sito' && eCampoBloccante(c.campo ?? ''));
    case 'marcatore':
      return inPaginaLegale || c.nonChiuso === true || eMarcatoreBloccante(c.testoMarcatore ?? '');
    case 'segnaposto':
      return true;
    case 'da-confermare':
      return inPaginaLegale;
    default:
      return false;
  }
}
