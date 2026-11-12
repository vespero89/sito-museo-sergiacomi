// JSON-LD of the pages (spec 6.2): pure functions, one per type. Every value passes through
// `clean`, so a doubtful or empty value never reaches the page (spec 3.5). The `@id` of each
// node is stable and absolute, so the nodes can point at each other.
import { urlAssoluto } from './seo.ts';
import { campoSito, type Sito } from './sito.ts';

export type NodoJsonLd = Record<string, unknown>;

/** Facts about the sculptor that sito.yaml does not hold (spec 6.2; dates from Wikidata, to be confirmed with the biography). */
const PERSONA = {
  alternateName: 'Romoaldo Sergiacomi',
  nascita: '1912-07-27',
  luogoNascita: 'Offida',
  morte: '1994-08-05',
  professione: 'scultore',
};

export const percorsoMuseo = '/#museo';
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

export function persona(sito: Sito, origine: string | URL): NodoJsonLd {
  return pulito({
    '@type': 'Person',
    '@id': urlAssoluto(percorsoPersona, origine),
    url: urlAssoluto('/aldo-sergiacomi/', origine),
    name: sito.artista.nome,
    alternateName: PERSONA.alternateName,
    birthDate: PERSONA.nascita,
    birthPlace: { '@type': 'Place', name: PERSONA.luogoNascita },
    deathDate: PERSONA.morte,
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
