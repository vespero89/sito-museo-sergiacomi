// Rules of the filters of the archive (spec 5.7, task 20), pure so that unit tests can check them.
// The page lists every item in the HTML; the browser script hides the ones that do not match.

export interface VoceArchivio {
  tipo: string;
  /** Decade of the item as text, like "1980". */
  decennio: string;
  /** Title and description, already passed through `normalizza`. */
  testo: string;
}

export interface StatoArchivio {
  tipo: string | undefined;
  decennio: string | undefined;
  /** The words typed, as typed. */
  q: string;
}

/** Lower case and no accents, so that "Citta" finds "Città" and "MERLETTAIE" finds "Merlettaie". */
export function normalizza(testo: string): string {
  return testo.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** "1992-07-27" -> "1990". Anything that does not start with a four digit year gives "". */
export function decennio(data: string): string {
  const anno = /^(\d{4})/.exec(data)?.[1];
  return anno ? `${Math.floor(Number(anno) / 10) * 10}` : '';
}

/** The state from the query string (`?tipo=foto&decennio=1980&q=pergamena`). Unknown values are ignored. */
export function leggiStato(
  ricerca: string,
  tipi: readonly string[],
  decenni: readonly string[],
): StatoArchivio {
  const parametri = new URLSearchParams(ricerca);
  const tipo = parametri.get('tipo') ?? '';
  const dec = parametri.get('decennio') ?? '';
  return {
    tipo: tipi.includes(tipo) ? tipo : undefined,
    decennio: decenni.includes(dec) ? dec : undefined,
    q: (parametri.get('q') ?? '').trim(),
  };
}

/** The query string of a state ("" when nothing is set, otherwise "?..."). */
export function scriviStato(stato: StatoArchivio): string {
  const parametri = new URLSearchParams();
  if (stato.tipo) parametri.set('tipo', stato.tipo);
  if (stato.decennio) parametri.set('decennio', stato.decennio);
  if (stato.q.trim()) parametri.set('q', stato.q.trim());
  const testo = parametri.toString();
  return testo ? `?${testo}` : '';
}

/** Does the item pass the type and decade filters and contain every typed word (any order)? */
export function passa(voce: VoceArchivio, stato: StatoArchivio): boolean {
  if (stato.tipo && voce.tipo !== stato.tipo) return false;
  if (stato.decennio && voce.decennio !== stato.decennio) return false;
  return normalizza(stato.q)
    .split(' ')
    .filter(Boolean)
    .every((parola) => voce.testo.includes(parola));
}

/** The distinct decades of the items, oldest first (items with no year are left out). */
export function decenniPresenti(voci: readonly { decennio: string }[]): string[] {
  return [...new Set(voci.map((v) => v.decennio).filter(Boolean))].sort();
}
