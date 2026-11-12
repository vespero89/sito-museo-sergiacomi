// The four environments as the site reads them (the astro:content side of ambienti.ts).
import { getCollection } from 'astro:content';
import { AMBIENTI, idVoceAmbiente, indirizzoAmbiente, type Ambiente } from './ambienti.ts';

/**
 * An environment: its `pagine` entry and its address, which comes from the entry's `slug`. The
 * entry is found by file name: the id of an entry is its `slug`, and the slug is what may change.
 */
export async function leggiAmbiente(ambiente: Ambiente) {
  const file = `/${idVoceAmbiente(ambiente)}.md`;
  const voce = (await getCollection('pagine')).find((v) => v.filePath?.endsWith(file));
  if (!voce) throw new Error(`no pagine entry "${file}" for the environment`);
  return { ambiente, voce, indirizzo: indirizzoAmbiente(voce.data.slug) };
}

/** The four environments, in the order of the museum. */
export const leggiAmbienti = () => Promise.all(AMBIENTI.map(leggiAmbiente));
