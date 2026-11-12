// The works as the pages read them (the astro:content side of frase-opera.ts and relazioni.ts):
// each work with its place, its generated sentence and the photo that leads its page.
import { getCollection, type CollectionEntry } from 'astro:content';
import { fraseOpera } from './frase-opera.ts';
import { fotoPrincipale } from './relazioni.ts';
import { leggiSito } from './sito-dati.ts';

export interface OperaCompleta {
  voce: CollectionEntry<'opere'>;
  /** Last part of the address: /opere/<slug>/. */
  slug: string;
  luogo: CollectionEntry<'luoghi'>['data'];
  /** The sentence written by hand, or the generated one. It is also the meta description. */
  frase: string;
  /** Id of the photo that leads the page, if the work has photos. */
  foto: string | undefined;
}

/** Every work, ordered by title. */
export async function leggiOpere(): Promise<OperaCompleta[]> {
  const autore = leggiSito().artista.nome;
  const luoghi = new Map((await getCollection('luoghi')).map((l) => [l.id, l.data]));
  const voci = await getCollection('opere');
  return voci
    .map((voce): OperaCompleta => {
      const luogo = luoghi.get(voce.data.luogo.id);
      if (!luogo) throw new Error(`the work "${voce.id}" has no place "${voce.data.luogo.id}"`);
      const { titolo, anno, materiali, daConfermare, frase } = voce.data;
      return {
        voce,
        slug: voce.id,
        luogo,
        frase: fraseOpera({
          titolo,
          autore,
          anno,
          materiali,
          daConfermare,
          luogo: luogo.nome,
          comune: luogo.comune,
          frase,
        }),
        foto: fotoPrincipale(voce.data.immagini.map((i) => ({ ...i, immagine: i.immagine.id }))),
      };
    })
    .sort((a, b) => a.voce.data.titolo.localeCompare(b.voce.data.titolo, 'it'));
}

export const indirizzoOpera = (slug: string): string => `/opere/${slug}/`;
