// The itineraries as the pages read them (the astro:content side of itinerari.ts): each stop with
// its title, its page and the text Google Maps searches for.
import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import { linkGoogleMaps, type TappaPosizionata } from './itinerari.ts';
import { leggiSito } from './sito-dati.ts';

export interface TappaCompleta extends TappaPosizionata {
  comune: string;
  nota: string | undefined;
}

export interface ItinerarioCompleto {
  voce: CollectionEntry<'itinerari'>;
  slug: string;
  tappe: TappaCompleta[];
}

export const indirizzoItinerario = (slug: string): string => `/itinerari/${slug}/`;

/** Where every Google Maps route starts: the museum. */
export function origineMaps(): string {
  const { via, cap, comune, provincia } = leggiSito().museo.indirizzo;
  return `${via}, ${cap} ${comune} ${provincia}`;
}

/** Every itinerary, ordered by title, with the stops resolved. */
export async function leggiItinerari(): Promise<ItinerarioCompleto[]> {
  const luoghi = new Map((await getCollection('luoghi')).map((l) => [l.id, l.data]));
  const voci = await getCollection('itinerari');
  const completi = await Promise.all(
    voci.map(async (voce): Promise<ItinerarioCompleto> => {
      const tappe = await Promise.all(
        voce.data.tappe.map(async (tappa): Promise<TappaCompleta> => {
          const opera = tappa.tipo === 'opera' ? await getEntry('opere', tappa.id) : undefined;
          const luogoId = opera ? opera.data.luogo.id : tappa.id;
          const luogo = luoghi.get(luogoId);
          if (!luogo) throw new Error(`the stop "${tappa.id}" of "${voce.id}" has no place`);
          return {
            titolo: opera ? opera.data.titolo : luogo.nome,
            comune: luogo.comune,
            luogoId,
            luogoNome: luogo.nome,
            lat: luogo.lat,
            lon: luogo.lon,
            indicativa: luogo.precisione !== 'punto',
            href: opera ? `/opere/${opera.id}/` : undefined,
            nota: tappa.nota,
            gruppo: tappa.gruppo,
            // The route searches for the name and the town, not for the coordinates (still to be checked).
            query: [luogo.indirizzo, luogo.nome, luogo.comune].filter(Boolean).join(', '),
          };
        }),
      );
      return { voce, slug: voce.id, tappe };
    }),
  );
  return completi.sort((a, b) => a.voce.data.titolo.localeCompare(b.voce.data.titolo, 'it'));
}

/** The Google Maps link of some stops, from the museum. */
export const mappaTappe = (
  tappe: readonly { query: string }[],
  modo: CollectionEntry<'itinerari'>['data']['modo'],
): string =>
  linkGoogleMaps(
    origineMaps(),
    tappe.map((t) => t.query),
    modo,
  );
