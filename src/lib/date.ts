// The one reference date of the site and the "next event" (spec 5.8). The date is the day in
// Rome, computed once at build time: the site is static, so the answer is the one of the last build.

export const FUSO = 'Europe/Rome';

/** The day in Rome (AAAA-MM-GG) of an instant. The build passes no argument and gets "today". */
export function oggiRoma(adesso: Date = new Date()): string {
  const parti = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(adesso);
  const valore = (tipo: string) => parti.find((p) => p.type === tipo)!.value;
  return `${valore('year')}-${valore('month')}-${valore('day')}`;
}

/** The offset of Rome on a day, like `+02:00`, taken at noon so a clock change never matters. */
export function scostamentoRoma(giorno: string): string {
  const parti = new Intl.DateTimeFormat('en-GB', { timeZone: FUSO, timeZoneName: 'longOffset' })
    .formatToParts(new Date(`${giorno}T12:00:00Z`))
    .find((p) => p.type === 'timeZoneName')!.value;
  const trovato = /GMT([+-]\d{2}:\d{2})/.exec(parti);
  return trovato ? trovato[1]! : '+00:00';
}

export interface EventoDate {
  data?: string | undefined;
  dataFine?: string | undefined;
}

/** An event is "next" until the end of its last day (`dataFine`, or `data`). */
export const ultimoGiorno = (e: EventoDate): string | undefined => e.dataFine ?? e.data;

export interface ProssimoEvento<T> {
  evento: T;
  /** True when no event is ahead and this is the latest one that has passed. */
  passato: boolean;
}

/**
 * The next event on `oggi` (a day in Rome): the earliest one that has not ended. If none is
 * ahead, the latest one that passed. Events with no date never count. Nothing at all gives undefined.
 */
export function prossimoEvento<T extends EventoDate>(
  eventi: readonly T[],
  oggi: string,
): ProssimoEvento<T> | undefined {
  const datati = eventi.filter((e) => e.data !== undefined);
  const avanti = datati
    .filter((e) => ultimoGiorno(e)! >= oggi)
    .sort((a, b) => a.data!.localeCompare(b.data!));
  if (avanti[0]) return { evento: avanti[0], passato: false };
  const indietro = datati.sort((a, b) => ultimoGiorno(b)!.localeCompare(ultimoGiorno(a)!));
  return indietro[0] ? { evento: indietro[0], passato: true } : undefined;
}
