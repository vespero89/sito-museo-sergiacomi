// "Continua il percorso" (spec 5.4), as pure functions: given the page and a plain catalogue of the
// site, the two or three cards that lead on. Only links that already exist in the collections; no
// text of its own. The order is stable: the same input always gives the same cards.
import { distanzaKm } from './relazioni.ts';

export type TipoScheda =
  'opera' | 'sala' | 'itinerario' | 'archivio' | 'evento' | 'didattica' | 'pagina' | 'percorso';

export interface Scheda {
  tipo: TipoScheda;
  titolo: string;
  href: string;
}

export const MIN_SCHEDE = 2;
export const MAX_SCHEDE = 3;

export interface OperaCatalogo extends Scheda {
  id: string;
  comune: string;
  lat: number;
  lon: number;
  anno?: number | undefined;
  /** Id of the room that keeps the sketch. */
  sala?: string | undefined;
}
export interface SalaCatalogo extends Scheda {
  id: string;
}
export interface ItinerarioCatalogo extends Scheda {
  id: string;
  /** Ids of the works among the stops. */
  opere: string[];
}
export interface ArchivioCatalogo extends Scheda {
  id: string;
  /** Year of the document, when known. */
  anno?: number | undefined;
  opere: string[];
  sale: string[];
}

/** Every page that can be proposed, each list in the order the site shows it. */
export interface Catalogo {
  opere: OperaCatalogo[];
  sale: SalaCatalogo[];
  itinerari: ItinerarioCatalogo[];
  archivio: ArchivioCatalogo[];
  /** The pages every other page can fall back on: the works, the visit, the archive. */
  predefinite: Scheda[];
  /** The page about the museum, proposed after a room. */
  museo: Scheda;
  /** The visit page, proposed after an itinerary. */
  visita: Scheda;
}

export type Pagina =
  | { tipo: 'opera'; id: string }
  /** A page that describes some rooms (the rooms page, the workshop). */
  | { tipo: 'sale'; ids: string[] }
  | { tipo: 'itinerario'; id: string }
  | { tipo: 'archivio'; id: string }
  /** Event, teaching, text pages: the pointers written in the entry, already resolved. */
  | { tipo: 'manuale'; rimandi: Scheda[] };

const senzaAncora = (href: string) => href.split('#')[0]!;
const decennio = (anno: number) => Math.floor(anno / 10);

function trova<T extends { id: string }>(elenco: readonly T[], id: string, cosa: string): T {
  const voce = elenco.find((v) => v.id === id);
  if (!voce) throw new Error(`continua: there is no ${cosa} "${id}"`);
  return voce;
}

/** Other works, same town first, then the rest; each group by distance, ties in catalogue order. */
function opereVicine(questa: OperaCatalogo, opere: readonly OperaCatalogo[]): OperaCatalogo[] {
  const altre = opere
    .map((o, i) => ({ o, i, d: distanzaKm(questa, o) }))
    .filter(({ o }) => o.id !== questa.id)
    .sort((a, b) => a.d - b.d || a.i - b.i);
  const stessoComune = (o: OperaCatalogo) => o.comune === questa.comune;
  return [
    ...altre.filter(({ o }) => stessoComune(o)),
    ...altre.filter(({ o }) => !stessoComune(o)),
  ].map(({ o }) => o);
}

/** The work after this one by year (the one before, for the latest). */
function opereDopoPerAnno(questa: OperaCatalogo, opere: readonly OperaCatalogo[]): OperaCatalogo[] {
  if (questa.anno === undefined) return [];
  const conAnno = opere
    .filter((o) => o.anno !== undefined)
    .sort((a, b) => a.anno! - b.anno! || a.titolo.localeCompare(b.titolo, 'it'));
  const i = conAnno.findIndex((o) => o.id === questa.id);
  const prossima = conAnno[i + 1] ?? conAnno[i - 1];
  return prossima ? [prossima] : [];
}

function candidati(pagina: Pagina, cat: Catalogo): Scheda[] {
  switch (pagina.tipo) {
    case 'opera': {
      const opera = trova(cat.opere, pagina.id, 'work');
      const sala = opera.sala ? cat.sale.find((s) => s.id === opera.sala) : undefined;
      return [
        ...(sala ? [sala] : []),
        ...cat.itinerari.filter((i) => i.opere.includes(opera.id)).slice(0, 1),
        ...cat.archivio.filter((a) => a.opere.includes(opera.id)).slice(0, 1),
        ...opereVicine(opera, cat.opere),
        ...opereDopoPerAnno(opera, cat.opere),
      ];
    }
    case 'sale': {
      const esposte = cat.opere.filter((o) => o.sala !== undefined && pagina.ids.includes(o.sala));
      const ids = new Set(esposte.map((o) => o.id));
      return [
        ...esposte.slice(0, 2),
        ...cat.itinerari.filter((i) => i.opere.some((o) => ids.has(o))),
        cat.museo,
        ...esposte.slice(2),
      ];
    }
    case 'itinerario': {
      const i = cat.itinerari.findIndex((it) => it.id === pagina.id);
      if (i < 0) throw new Error(`continua: there is no itinerary "${pagina.id}"`);
      const n = cat.itinerari.length;
      // The stops are already on the page: lead to the neighbours in the list, then the visit.
      return [
        cat.itinerari[(i + n - 1) % n]!,
        cat.itinerari[(i + 1) % n]!,
        cat.visita,
        ...cat.itinerari,
      ];
    }
    case 'archivio': {
      const doc = trova(cat.archivio, pagina.id, 'document');
      const opere = doc.opere.map((id) => trova(cat.opere, id, 'work'));
      const sale = doc.sale.map((id) => trova(cat.sale, id, 'room'));
      const stessoDecennio =
        doc.anno === undefined
          ? []
          : cat.archivio.filter(
              (a) => a.anno !== undefined && decennio(a.anno) === decennio(doc.anno!),
            );
      return [...opere.slice(0, 2), ...sale, ...stessoDecennio, ...opere.slice(2)];
    }
    case 'manuale':
      return pagina.rimandi;
  }
}

/**
 * The cards of "Continua il percorso" for a page at `href`: two or three, never the page itself, no
 * repeats. When the rules of the page give fewer than two, the defaults fill in.
 */
export function continua(pagina: Pagina, href: string, cat: Catalogo): Scheda[] {
  const stessa = senzaAncora(href);
  const viste = new Set<string>();
  const scelte: Scheda[] = [];
  for (const s of [...candidati(pagina, cat), ...cat.predefinite]) {
    if (scelte.length === MAX_SCHEDE) break;
    if (senzaAncora(s.href) === stessa || viste.has(s.href)) continue;
    viste.add(s.href);
    scelte.push({ tipo: s.tipo, titolo: s.titolo, href: s.href });
  }
  if (scelte.length < MIN_SCHEDE) {
    throw new Error(`continua: only ${scelte.length} card(s) for ${href}`);
  }
  return scelte;
}
