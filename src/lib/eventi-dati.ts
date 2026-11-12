// The events as the pages read them: the dates in Italian and the split into next, other
// initiatives and past (spec 5.8). The reference day is the one of the build, in Rome.
import { getCollection, type CollectionEntry } from 'astro:content';
import { oggiRoma, prossimoEvento, ultimoGiorno } from './date.ts';

export type VoceEvento = CollectionEntry<'eventi'>;

export const indirizzoEvento = (slug: string): string => `/eventi/${slug}/`;

const formato = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const giorno = (aaaammgg: string) => formato.format(new Date(`${aaaammgg}T00:00:00Z`));

/** The date as people read it: the written text if there is one, else the day or the two days. */
export function testoData(e: VoceEvento['data']): string | undefined {
  if (e.dataTesto) return e.dataTesto;
  if (!e.data) return undefined;
  return e.dataFine && e.dataFine !== e.data
    ? `${giorno(e.data)} - ${giorno(e.dataFine)}`
    : giorno(e.data);
}

export interface ElencoEventi {
  /** Events not yet over, soonest first. */
  prossimi: VoceEvento[];
  /** Initiatives with no date. */
  iniziative: VoceEvento[];
  /** Events that are over, latest first. */
  passati: VoceEvento[];
  /** The one to highlight: the next, or the latest past; undefined if there is no dated event. */
  evidenza: { evento: VoceEvento; passato: boolean } | undefined;
}

export async function leggiEventi(oggi: string = oggiRoma()): Promise<ElencoEventi> {
  const tutti = await getCollection('eventi');
  const datati = tutti.filter((e) => e.data.data !== undefined);
  const finito = (e: VoceEvento) => ultimoGiorno(e.data)! < oggi;
  const evidenza = prossimoEvento(
    datati.map((voce) => ({ voce, data: voce.data.data, dataFine: voce.data.dataFine })),
    oggi,
  );
  return {
    prossimi: datati
      .filter((e) => !finito(e))
      .sort((a, b) => a.data.data!.localeCompare(b.data.data!)),
    iniziative: tutti
      .filter((e) => e.data.data === undefined)
      .sort((a, b) => a.data.titolo.localeCompare(b.data.titolo, 'it')),
    passati: datati
      .filter(finito)
      .sort((a, b) => ultimoGiorno(b.data)!.localeCompare(ultimoGiorno(a.data)!)),
    evidenza: evidenza ? { evento: evidenza.evento.voce, passato: evidenza.passato } : undefined,
  };
}
