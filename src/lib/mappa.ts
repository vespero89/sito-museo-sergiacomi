// The map of the works as pure functions (spec 5.3, task 17): the year limits, the filters, the state
// in the address, the grouping by place and the order by distance. The browser code
// (src/scripts/mappa-opere.ts) only wires these to the page. No Leaflet and no DOM here.
import { tileOsm, type TileMappa } from '../data/servizi.ts';
import { distanzaKm, type Posizione } from './relazioni.ts';

/** Value of the material filter for the works with no material. */
export const MATERIALE_NON_INDICATO = 'non-indicato';

export interface OperaMappa extends Posizione {
  id: string;
  titolo: string;
  href: string;
  /** The year, or undefined when it is not certain. */
  anno: number | undefined;
  /** True for the works counted by the slider: in the list and with a certain year. */
  certa: boolean;
  /** Slug of the town. */
  comune: string;
  materiali: string[];
  luogoId: string;
  luogoNome: string;
  /** The position is the centre of the town or an approximation. */
  indicativa: boolean;
  /** Name of the town and label of the category, for the table. */
  comuneNome: string;
  categoria: string;
}

/** The ways to show the list: grouped by town (the default), by decade, or as a sortable table. */
export const VISTE = ['luogo', 'anno', 'tabella'] as const;
export type Vista = (typeof VISTE)[number];

export interface StatoMappa {
  fino: number;
  comune: string | undefined;
  materiale: string | undefined;
  vista: Vista;
}

export interface LimitiAnni {
  min: number;
  max: number;
}

/** Slug of a town name: `Offida` becomes `offida`, `San Benedetto` becomes `san-benedetto`. */
export function slugComune(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** First and last year among the works with a certain year. */
export function limitiAnni(opere: readonly OperaMappa[]): LimitiAnni {
  const anni = opere.filter((o) => o.certa && o.anno !== undefined).map((o) => o.anno!);
  if (anni.length === 0) throw new Error('no work has a certain year');
  return { min: Math.min(...anni), max: Math.max(...anni) };
}

/** The decades with a mark on the slider: 1940, 1950... inside the limits. */
export function tacche(limiti: LimitiAnni): number[] {
  const anni: number[] = [];
  for (let d = Math.ceil(limiti.min / 10) * 10; d <= limiti.max; d += 10) anni.push(d);
  return anni;
}

/** An integer year from text, or undefined for anything else ("1975.5", "abc", "", "1e3"). */
function leggiAnno(testo: string | null): number | undefined {
  return testo !== null && /^\d{1,4}$/.test(testo) ? Number(testo) : undefined;
}

/**
 * The state from the query string (`?fino=1975&comune=offida&materiale=bronzo&vista=anno`). A value that is not
 * valid is ignored; a year outside the limits goes to the nearest limit. No year means the last one.
 */
export function leggiStato(
  ricerca: string,
  limiti: LimitiAnni,
  comuni: readonly string[],
  materiali: readonly string[],
): StatoMappa {
  const parametri = new URLSearchParams(ricerca);
  const anno = leggiAnno(parametri.get('fino'));
  const comune = parametri.get('comune') ?? '';
  const materiale = parametri.get('materiale') ?? '';
  return {
    fino: anno === undefined ? limiti.max : Math.min(limiti.max, Math.max(limiti.min, anno)),
    comune: comuni.includes(comune) ? comune : undefined,
    materiale: materiali.includes(materiale) ? materiale : undefined,
    vista: VISTE.find((v) => v === parametri.get('vista')) ?? 'luogo',
  };
}

/** The query string of a state ("" when nothing differs from the default, otherwise "?..."). */
export function scriviStato(stato: StatoMappa, limiti: LimitiAnni): string {
  const parametri = new URLSearchParams();
  if (stato.fino !== limiti.max) parametri.set('fino', String(stato.fino));
  if (stato.comune) parametri.set('comune', stato.comune);
  if (stato.materiale) parametri.set('materiale', stato.materiale);
  if (stato.vista !== 'luogo') parametri.set('vista', stato.vista);
  const testo = parametri.toString();
  return testo ? `?${testo}` : '';
}

/** Does the work pass the town and material filters? The year is not looked at. */
function passaFiltri(opera: OperaMappa, stato: StatoMappa): boolean {
  if (stato.comune && opera.comune !== stato.comune) return false;
  if (stato.materiale) {
    const materiali = opera.materiali.length > 0 ? opera.materiali : [MATERIALE_NON_INDICATO];
    if (!materiali.includes(stato.materiale)) return false;
  }
  return true;
}

/** Is the work shown? A work with no certain year is always shown (flagged "to confirm"). */
export function visibile(opera: OperaMappa, stato: StatoMappa): boolean {
  if (!passaFiltri(opera, stato)) return false;
  return !opera.certa || opera.anno! <= stato.fino;
}

export const filtra = (opere: readonly OperaMappa[], stato: StatoMappa): OperaMappa[] =>
  opere.filter((o) => visibile(o, stato));

/** The numbers of "Works made up to 1975: 12 of 25": only the works with a certain year count. */
export function conta(
  opere: readonly OperaMappa[],
  stato: StatoMappa,
): { visibili: number; totale: number } {
  const certe = opere.filter((o) => o.certa);
  return { visibili: certe.filter((o) => visibile(o, stato)).length, totale: certe.length };
}

export interface GruppoLuogo extends Posizione {
  luogoId: string;
  luogoNome: string;
  indicativa: boolean;
  opere: OperaMappa[];
}

/** One group per place, in the order the places first appear: a place is one marker. */
export function raggruppaPerLuogo(opere: readonly OperaMappa[]): GruppoLuogo[] {
  const gruppi = new Map<string, GruppoLuogo>();
  for (const o of opere) {
    const gruppo = gruppi.get(o.luogoId);
    if (gruppo) gruppo.opere.push(o);
    else {
      const { luogoId, luogoNome, indicativa, lat, lon } = o;
      gruppi.set(o.luogoId, { luogoId, luogoNome, indicativa, lat, lon, opere: [o] });
    }
  }
  return [...gruppi.values()];
}

/** The works from the nearest to the farthest, each with its distance in km. Ties keep the order. */
export function ordinaPerDistanza<T extends Posizione>(
  opere: readonly T[],
  da: Posizione,
): (T & { km: number })[] {
  return opere
    .map((o, i) => ({ o, i, km: distanzaKm(da, o) }))
    .sort((a, b) => a.km - b.km || a.i - b.i)
    .map(({ o, km }) => ({ ...o, km }));
}

/** A distance for the page: "0,4 km" under 10 km, "23 km" above. */
export function formattaKm(km: number): string {
  return `${km < 10 ? (Math.round(km * 10) / 10).toString().replace('.', ',') : Math.round(km)} km`;
}

/** The map tiles: `PUBLIC_TILE_URL` replaces the registry address (tests serve a fake tile). */
export function tileMappa(urlSostitutivo?: string): TileMappa {
  const registro = tileOsm();
  return urlSostitutivo ? { ...registro, urlTemplate: urlSostitutivo } : registro;
}

export interface GruppoDecennio {
  /** The first year of the decade (1960), or undefined for the works with no certain year. */
  decennio: number | undefined;
  opere: OperaMappa[];
}

/** The decade of a work: 1967 gives 1960; no certain year gives undefined. */
export const decennioDi = (opera: OperaMappa): number | undefined =>
  opera.certa && opera.anno !== undefined ? Math.floor(opera.anno / 10) * 10 : undefined;

/** One group per decade, oldest first, the works with no certain year last. Inside: by year, then title. */
export function raggruppaPerDecennio(opere: readonly OperaMappa[]): GruppoDecennio[] {
  const gruppi = new Map<number | undefined, OperaMappa[]>();
  for (const o of ordinaPerAnno(opere)) {
    const chiave = decennioDi(o);
    gruppi.set(chiave, [...(gruppi.get(chiave) ?? []), o]);
  }
  return [...gruppi.entries()]
    .sort(([a], [b]) => (a ?? Infinity) - (b ?? Infinity))
    .map(([decennio, lista]) => ({ decennio, opere: lista }));
}

function ordinaPerAnno(opere: readonly OperaMappa[]): OperaMappa[] {
  return [...opere].sort(
    (a, b) => (a.anno ?? Infinity) - (b.anno ?? Infinity) || a.titolo.localeCompare(b.titolo, 'it'),
  );
}

export const COLONNE = ['titolo', 'anno', 'comune', 'categoria', 'materiale'] as const;
export type Colonna = (typeof COLONNE)[number];
export type Direzione = 'asc' | 'desc';

/** The materials of a work as one text for the table ("" when none). */
export const testoMateriali = (opera: OperaMappa): string => opera.materiali.join(', ');

/**
 * The works sorted by a column of the table, Italian alphabetical order for text. Empty values
 * (no year, no material) go last in both directions; ties are ordered by title.
 */
export function ordinaTabella(
  opere: readonly OperaMappa[],
  colonna: Colonna,
  direzione: Direzione,
): OperaMappa[] {
  const segno = direzione === 'asc' ? 1 : -1;
  const valore = (o: OperaMappa): string | number | undefined => {
    switch (colonna) {
      case 'titolo':
        return o.titolo;
      case 'anno':
        return o.certa ? o.anno : undefined;
      case 'comune':
        return o.comuneNome;
      case 'categoria':
        return o.categoria;
      case 'materiale':
        return testoMateriali(o) || undefined;
    }
  };
  return [...opere].sort((a, b) => {
    const x = valore(a);
    const y = valore(b);
    if (x === undefined || y === undefined) {
      if (x !== y) return x === undefined ? 1 : -1;
    } else {
      const c = typeof x === 'number' ? x - (y as number) : x.localeCompare(y as string, 'it');
      if (c !== 0) return c * segno;
    }
    return a.titolo.localeCompare(b.titolo, 'it');
  });
}

/** A stop of the animation: a year with at least one new work. */
export interface Fermata {
  anno: number;
  /** Works that appear in this year. */
  nuove: number;
  /** Years since the previous stop when the jump is long (`SOGLIA_SALTO` or more), else undefined. */
  salto: number | undefined;
  /** How long the animation stays here, in milliseconds. */
  durata: number;
}

export const DURATA_FERMATA = 800;
export const DURATA_EXTRA_DUE_OPERE = 400;
export const DURATA_EXTRA_SALTO = 600;
/** A jump of this many years or more gets a note ("17 anni dopo"). */
export const SOGLIA_SALTO = 10;

/**
 * The stops of "Riproduci": only the years with works counted by the slider, oldest first. A stop is
 * longer when two or more works appear, and when it comes after a long jump (the note is read there).
 */
export function fermate(opere: readonly OperaMappa[]): Fermata[] {
  const perAnno = new Map<number, number>();
  for (const o of opere) {
    if (o.certa && o.anno !== undefined) perAnno.set(o.anno, (perAnno.get(o.anno) ?? 0) + 1);
  }
  const anni = [...perAnno.keys()].sort((a, b) => a - b);
  return anni.map((anno, i) => {
    const nuove = perAnno.get(anno)!;
    const distanza = i === 0 ? 0 : anno - anni[i - 1]!;
    const salto = distanza >= SOGLIA_SALTO ? distanza : undefined;
    const durata =
      DURATA_FERMATA +
      (nuove >= 2 ? DURATA_EXTRA_DUE_OPERE : 0) +
      (salto !== undefined ? DURATA_EXTRA_SALTO : 0);
    return { anno, nuove, salto, durata };
  });
}

/** The first stop after a year, or undefined at the end. */
export const prossimaFermata = (piano: readonly Fermata[], anno: number): Fermata | undefined =>
  piano.find((f) => f.anno > anno);
