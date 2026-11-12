// The generated first sentence of a work page (spec 3.6). It answers "what is it, by whom, when,
// where" from the data, so that a work with one line of text still has a page that stands on its
// own. It is also the meta description of the page, so it is 70 to 160 characters long. It never
// uses a field listed in `daConfermare`: a doubtful year or material is left out. A sentence
// written by hand (`frase`) replaces it.

export const FRASE_MIN = 70;
export const FRASE_MAX = 160;

export interface DatiFrase {
  titolo: string;
  /** Name of the sculptor, from sito.yaml. */
  autore: string;
  anno?: number | undefined;
  materiali: readonly string[];
  daConfermare: readonly { campo: string }[];
  /** Name of the place and its town. */
  luogo: string;
  comune: string;
  /** A sentence written by hand: used as it is. */
  frase?: string | undefined;
}

const dubbio = (d: DatiFrase, campo: string) => d.daConfermare.some((v) => v.campo === campo);
const minuscole = (testo: string) => testo.toLocaleLowerCase('it');
/** "Chiesa di S. Agostino (Santuario Eucaristico)" -> "Chiesa di S. Agostino": no brackets inside brackets. */
const senzaParentesi = (testo: string) => testo.replace(/\s*\([^)]*\)/g, '').trim();

/** "bronzo", "bronzo e travertino", "marmo, pietra e stucco". */
export function elencoItaliano(voci: readonly string[]): string {
  if (voci.length <= 1) return voci.join('');
  return `${voci.slice(0, -1).join(', ')} e ${voci[voci.length - 1]}`;
}

/**
 * Example: "Portale del Duomo di Fermo: opera in bronzo dello scultore Aldo Sergiacomi, 1980. Si
 * trova a Fermo." The title already says what the work is, and a title can be plural, so the
 * sentence hangs on "opera" and not on the title. The place is added in brackets unless it is
 * the town itself or the title already names it. If the sentence is too long it loses the place,
 * then "dello scultore".
 */
export function fraseOpera(d: DatiFrase): string {
  if (d.frase) return d.frase;

  const materiali = d.materiali.length > 0 && !dubbio(d, 'materiali') ? d.materiali : [];
  const materiale = materiali.length > 0 ? ` in ${elencoItaliano(materiali)}` : '';
  const anno = d.anno !== undefined && !dubbio(d, 'anno') ? `, ${d.anno}` : '';
  const luogo = senzaParentesi(d.luogo);
  const luogoUtile =
    minuscole(luogo) !== minuscole(d.comune) && !minuscole(d.titolo).includes(minuscole(luogo));
  // "a Fermo", but "ad Ascoli Piceno".
  const a = d.comune.startsWith('A') ? 'ad' : 'a';

  const componi = (conLuogo: boolean, autore: string) =>
    `${d.titolo}: opera${materiale} ${autore} ${d.autore}${anno}. ` +
    `Si trova ${a} ${d.comune}${conLuogo ? ` (${luogo})` : ''}.`;

  for (const [conLuogo, autore] of [
    [luogoUtile, 'dello scultore'],
    [false, 'dello scultore'],
    [false, 'di'],
  ] as const) {
    const frase = componi(conLuogo, autore);
    if (frase.length <= FRASE_MAX) return frase;
  }
  return componi(false, 'di');
}
