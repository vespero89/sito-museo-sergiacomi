// Relations between works and places, as pure functions (spec 12): which photo leads a work page,
// which works are near, which work pages have little written text.

/** The photo that leads the page of a work: the finished work if there is a photo of it, else the first. */
export function fotoPrincipale(
  immagini: readonly { immagine: string; ruolo: string }[],
): string | undefined {
  return (immagini.find((i) => i.ruolo === 'monumento') ?? immagini[0])?.immagine;
}

export interface Posizione {
  lat: number;
  lon: number;
}

/** Distance in km on the surface of the Earth (haversine). */
export function distanzaKm(a: Posizione, b: Posizione): number {
  const R = 6371;
  const rad = (g: number) => (g * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * The works nearest to `id`, closest first, at most `quante`. Works in the same place come first
 * (distance zero), then by distance; ties keep the order of `opere`. The coordinates are still to
 * be checked, so this is "near enough", not a measure.
 */
export function opereVicine<T extends Posizione & { id: string }>(
  id: string,
  opere: readonly T[],
  quante = 3,
): T[] {
  const questa = opere.find((o) => o.id === id);
  if (!questa) throw new Error(`opereVicine: there is no work "${id}"`);
  return opere
    .filter((o) => o.id !== id)
    .map((o, i) => ({ o, i, d: distanzaKm(questa, o) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .slice(0, quante)
    .map(({ o }) => o);
}

/** Pages with fewer written words than this go in the report for the Foundation (spec 3.6). */
export const SOGLIA_PAROLE_SCHEDA = 40;

export const contaParole = (testo: string): number => testo.split(/\s+/).filter(Boolean).length;

/** The ids of the works whose written text is below the threshold. They stay published. */
export function schedeConPocoTesto(opere: readonly { id: string; corpo: string }[]): string[] {
  return opere.filter((o) => contaParole(o.corpo) < SOGLIA_PAROLE_SCHEDA).map((o) => o.id);
}
