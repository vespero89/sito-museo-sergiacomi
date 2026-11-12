// JSON-LD of the pages (spec 6.2): pure functions, one per type. Every value passes through
// `clean`, so a doubtful or empty value never reaches the page (spec 3.5). The `@id` of each
// node is stable and absolute, so the nodes can point at each other.
import { scostamentoRoma } from './date.ts';
import { urlAssoluto } from './seo.ts';
import { campoSito, type Sito } from './sito.ts';

export type NodoJsonLd = Record<string, unknown>;

/** Facts about the sculptor that sito.yaml does not hold (spec 6.2). The dates are in sito.yaml, where they are listed as to confirm. */
const PERSONA = {
  alternateName: 'Romoaldo Sergiacomi',
  luogoNascita: 'Offida',
  professione: 'scultore',
};

export const percorsoMuseo = '/#museo';
export const percorsoSito = '/#sito';
export const percorsoPersona = '/aldo-sergiacomi/#persona';
export const percorsoFondazione = '/chi-siamo/#fondazione';

const isOggetto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Removes, at any depth: null and undefined, empty or blank texts, empty lists and objects, texts
 * with a `[[...]]` marker, `daConfermare` fields, and objects left with only a `@type`.
 * Returns undefined when nothing is left.
 */
export function clean<T>(valore: T): T | undefined {
  if (typeof valore === 'string') {
    return valore.trim() === '' || valore.includes('[[') ? undefined : valore;
  }
  if (Array.isArray(valore)) {
    const voci = valore.map((v) => clean(v)).filter((v) => v !== undefined);
    return (voci.length ? voci : undefined) as T | undefined;
  }
  if (isOggetto(valore)) {
    const pulito: Record<string, unknown> = {};
    for (const [chiave, v] of Object.entries(valore)) {
      if (chiave === 'daConfermare') continue;
      const c = clean(v);
      if (c !== undefined) pulito[chiave] = c;
    }
    const chiavi = Object.keys(pulito);
    if (chiavi.length === 0 || (chiavi.length === 1 && chiavi[0] === '@type')) return undefined;
    return pulito as T;
  }
  return valore ?? undefined;
}

const pulito = (nodo: NodoJsonLd): NodoJsonLd => clean(nodo) ?? {};

/** A text of sito.yaml, or undefined when the field is still to confirm (or empty). */
function testoSicuro(sito: Sito, percorso: string): string | undefined {
  const campo = campoSito(sito, percorso);
  return campo.visibile && typeof campo.valore === 'string' ? campo.valore : undefined;
}

function indirizzoPostale(i: Sito['museo']['indirizzo']): NodoJsonLd {
  return {
    '@type': 'PostalAddress',
    streetAddress: i.via,
    postalCode: i.cap,
    addressLocality: i.comune,
    addressRegion: i.provincia,
    addressCountry: i.paese,
  };
}

/** The Museum is a place, not an organisation: the link to the Foundation is on the Foundation. */
export function museo(
  sito: Sito,
  origine: string | URL,
  coordinate?: { lat: number; lon: number; verificato: boolean },
): NodoJsonLd {
  const social = campoSito(sito, 'social');
  return pulito({
    '@type': 'Museum',
    '@id': urlAssoluto(percorsoMuseo, origine),
    name: sito.nome,
    url: urlAssoluto('/', origine),
    address: indirizzoPostale(sito.museo.indirizzo),
    telephone: testoSicuro(sito, 'contatti.telefono'),
    geo:
      coordinate?.verificato === true
        ? { '@type': 'GeoCoordinates', latitude: coordinate.lat, longitude: coordinate.lon }
        : undefined,
    sameAs: social.visibile ? sito.social.map((s) => s.url) : undefined,
  });
}

/** The site itself. No search action: the site search is a static page with a client-side index. */
export function sitoWeb(sito: Sito, origine: string | URL): NodoJsonLd {
  return {
    '@type': 'WebSite',
    '@id': urlAssoluto(percorsoSito, origine),
    url: urlAssoluto('/', origine),
    name: sito.nome,
    inLanguage: 'it',
    publisher: { '@id': urlAssoluto(percorsoMuseo, origine) },
  };
}

export function persona(sito: Sito, origine: string | URL): NodoJsonLd {
  return pulito({
    '@type': 'Person',
    '@id': urlAssoluto(percorsoPersona, origine),
    url: urlAssoluto('/aldo-sergiacomi/', origine),
    name: sito.artista.nome,
    alternateName: PERSONA.alternateName,
    birthDate: testoSicuro(sito, 'artista.nascita'),
    birthPlace: { '@type': 'Place', name: PERSONA.luogoNascita },
    deathDate: testoSicuro(sito, 'artista.morte'),
    jobTitle: PERSONA.professione,
    sameAs: [`https://www.wikidata.org/wiki/${sito.artista.wikidata}`],
  });
}

/** The Foundation, with the Museum as its `location` (by `@id`). No tax data until confirmed. */
export function fondazione(sito: Sito, origine: string | URL): NodoJsonLd {
  return pulito({
    '@type': 'Organization',
    '@id': urlAssoluto(percorsoFondazione, origine),
    legalName: sito.fondazione.denominazione,
    url: urlAssoluto('/chi-siamo/', origine),
    email: sito.contatti.email,
    telephone: testoSicuro(sito, 'contatti.telefono'),
    address: indirizzoPostale(sito.fondazione.sede),
    location: { '@id': urlAssoluto(percorsoMuseo, origine) },
  });
}

export interface DatiOperaJsonLd {
  slug: string;
  titolo: string;
  /** Category of the work: a painting is a `VisualArtwork`, everything else a `Sculpture`. */
  categoria: string;
  /** Year, or undefined when it is missing or doubtful. */
  anno?: number | undefined;
  /** Materials, only when known. */
  materiali: readonly string[];
  /** Address of the main photo, absolute or not. */
  immagine?: string | undefined;
  descrizione: string;
}

/**
 * A work (spec 6.2). The `@type` comes from the category, not from the material. There is no
 * `locationCreated` and no `contentLocation`: they say where a work was made or what it shows,
 * not where it stands. The place is in the text, the facts and the breadcrumb.
 */
export function opera(dati: DatiOperaJsonLd, origine: string | URL): NodoJsonLd {
  const url = urlAssoluto(`/opere/${dati.slug}/`, origine);
  return pulito({
    '@type': dati.categoria === 'dipinto' ? 'VisualArtwork' : 'Sculpture',
    '@id': `${url}#opera`,
    url,
    name: dati.titolo,
    description: dati.descrizione,
    creator: { '@id': urlAssoluto(percorsoPersona, origine) },
    dateCreated: dati.anno === undefined ? undefined : String(dati.anno),
    material: dati.materiali.length > 0 ? [...dati.materiali] : undefined,
    image: dati.immagine === undefined ? undefined : urlAssoluto(dati.immagine, origine),
  });
}

export interface DatiItinerarioJsonLd {
  slug: string;
  titolo: string;
  descrizione: string;
  /** How people move: shown as `touristType`. */
  modo?: string | undefined;
  /** The stops in order. */
  tappe: readonly { nome: string; url?: string | undefined }[];
}

/** An itinerary (spec 6.2): a `TouristTrip` whose `itinerary` lists the stops in order. */
export function itinerario(dati: DatiItinerarioJsonLd, origine: string | URL): NodoJsonLd {
  const url = urlAssoluto(`/itinerari/${dati.slug}/`, origine);
  return pulito({
    '@type': 'TouristTrip',
    '@id': `${url}#itinerario`,
    url,
    name: dati.titolo,
    description: dati.descrizione,
    touristType: dati.modo,
    itinerary: {
      '@type': 'ItemList',
      itemListElement: dati.tappe.map((tappa, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: tappa.nome,
        url: tappa.url === undefined ? undefined : urlAssoluto(tappa.url, origine),
      })),
    },
  });
}

export interface DatiEventoJsonLd {
  slug: string;
  titolo: string;
  descrizione: string;
  /** Day AAAA-MM-GG. Without a confirmed day there is no Event: the function gives `{}`. */
  data?: string | undefined;
  dataFine?: string | undefined;
  /** HH:MM in Rome. */
  ora?: string | undefined;
  luogo?: string | undefined;
}

/**
 * An event (spec 6.2), only with a confirmed day: the date carries the offset of Rome when the
 * time is known. The organiser is the Foundation, by `@id`.
 */
export function evento(dati: DatiEventoJsonLd, origine: string | URL): NodoJsonLd {
  if (dati.data === undefined) return {};
  const url = urlAssoluto(`/eventi/${dati.slug}/`, origine);
  return pulito({
    '@type': 'Event',
    '@id': `${url}#evento`,
    url,
    name: dati.titolo,
    description: dati.descrizione,
    startDate:
      dati.ora === undefined
        ? dati.data
        : `${dati.data}T${dati.ora}:00${scostamentoRoma(dati.data)}`,
    endDate: dati.dataFine,
    eventStatus: 'https://schema.org/EventScheduled',
    location: dati.luogo === undefined ? undefined : { '@type': 'Place', name: dati.luogo },
    organizer: { '@id': urlAssoluto(percorsoFondazione, origine) },
  });
}

/** Breadcrumb trail: the last item is the current page (`indirizzoCorrente`). */
export function briciole(
  voci: { titolo: string; href?: string }[],
  indirizzoCorrente: string,
  origine: string | URL,
): NodoJsonLd {
  return pulito({
    '@type': 'BreadcrumbList',
    itemListElement: voci.map((voce, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: voce.titolo,
      item: urlAssoluto(
        i === voci.length - 1 ? indirizzoCorrente : (voce.href ?? indirizzoCorrente),
        origine,
      ),
    })),
  });
}

/** The text of a `<script type="application/ld+json">`: one `@graph`, safe inside a script tag. */
export function serializza(nodi: NodoJsonLd[]): string {
  const grafo = nodi.map((n) => clean(n)).filter((n) => n !== undefined);
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': grafo }).replace(
    /</g,
    '\\u003c',
  );
}
