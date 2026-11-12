// Registry of external services (spec 6.5). One place for what leaves the site's own origin:
// the CSP (config/hosting.mjs) and the /cookie/ page read from here. Nothing but the OpenStreetMap
// tiles is active. A consent banner is needed only once a non-necessary service is switched on.

export type CategoriaServizio = 'necessario' | 'statistiche' | 'esterni';

export type DirettivaCsp =
  'connect-src' | 'font-src' | 'frame-src' | 'img-src' | 'script-src' | 'style-src';

/** A source allowed in one CSP directive when the service is active. Bare https origin. */
export interface DominioCsp {
  direttiva: DirettivaCsp;
  dominio: string;
}

export interface Servizio {
  id: string;
  nome: string;
  fornitore: string;
  categoria: CategoriaServizio;
  finalita: string;
  dominiCsp: DominioCsp[];
  attivo: boolean;
}

/** Map tiles: the URL template and the attribution live here and nowhere else (spec 5.3). */
export interface TileMappa {
  urlTemplate: string;
  attribuzione: string;
  attribuzioneUrl: string;
}

const DOMINIO_TILE_OSM = 'https://tile.openstreetmap.org';

const TILE_OSM: TileMappa = {
  urlTemplate: `${DOMINIO_TILE_OSM}/{z}/{x}/{y}.png`,
  attribuzione: '© OpenStreetMap contributors',
  attribuzioneUrl: 'https://www.openstreetmap.org/copyright',
};

export const SERVIZI: readonly Servizio[] = [
  {
    id: 'osm-tile',
    nome: 'Mappa (tessere OpenStreetMap)',
    fornitore: 'OpenStreetMap Foundation',
    categoria: 'necessario',
    finalita: 'Mostrare la mappa delle opere. Il fornitore riceve l’indirizzo IP, senza cookie.',
    dominiCsp: [{ direttiva: 'img-src', dominio: DOMINIO_TILE_OSM }],
    attivo: true,
  },
  {
    id: 'statistiche',
    nome: 'Statistiche di visita',
    fornitore: 'Da scegliere',
    categoria: 'statistiche',
    finalita: 'Contare le visite al sito.',
    dominiCsp: [],
    attivo: false,
  },
  {
    id: 'mappa-google',
    nome: 'Mappa incorporata di Google',
    fornitore: 'Google',
    categoria: 'esterni',
    finalita: 'Mostrare una mappa di Google dentro la pagina.',
    dominiCsp: [{ direttiva: 'frame-src', dominio: 'https://www.google.com' }],
    attivo: false,
  },
  {
    id: 'video',
    nome: 'Video incorporati',
    fornitore: 'Da scegliere',
    categoria: 'esterni',
    finalita: 'Mostrare video dentro la pagina.',
    dominiCsp: [],
    attivo: false,
  },
  {
    id: 'social',
    nome: 'Contenuti dei social',
    fornitore: 'Da scegliere',
    categoria: 'esterni',
    finalita: 'Mostrare contenuti dei social dentro la pagina.',
    dominiCsp: [],
    attivo: false,
  },
  {
    id: 'newsletter',
    nome: 'Iscrizione alla newsletter',
    fornitore: 'Da scegliere',
    categoria: 'esterni',
    finalita: 'Raccogliere le iscrizioni alla newsletter.',
    dominiCsp: [],
    attivo: false,
  },
];

export function servizio(id: string): Servizio {
  const trovato = SERVIZI.find((s) => s.id === id);
  if (!trovato) throw new Error(`Unknown service: ${id}`);
  return trovato;
}

export function serviziAttivi(): Servizio[] {
  return SERVIZI.filter((s) => s.attivo);
}

/** CSP sources of the active services, grouped by directive, without duplicates. */
export function dominiCspAttivi(): Partial<Record<DirettivaCsp, string[]>> {
  const out: Partial<Record<DirettivaCsp, string[]>> = {};
  for (const { direttiva, dominio } of serviziAttivi().flatMap((s) => s.dominiCsp)) {
    const lista = (out[direttiva] ??= []);
    if (!lista.includes(dominio)) lista.push(dominio);
  }
  return out;
}

/** The banner is needed only if a service that is not "necessario" is active (spec 6.5). */
export function serveBanner(): boolean {
  return serviziAttivi().some((s) => s.categoria !== 'necessario');
}

export function tileOsm(): TileMappa {
  return TILE_OSM;
}
