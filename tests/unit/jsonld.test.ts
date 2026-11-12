import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { briciole, clean, fondazione, museo, persona, serializza } from '../../src/lib/jsonld.ts';
import { sitoSchema, type Sito } from '../../src/lib/sito.ts';
import { parseYaml } from '../../src/lib/yaml.ts';

const ORIGINE = 'https://esempio.test';
const FILE = join(import.meta.dirname, '..', '..', 'src', 'data', 'sito.yaml');
const reale = (): Sito => sitoSchema.parse(parseYaml(readFileSync(FILE, 'utf8')));

/** The real data with some confirmed social profiles and a confirmed phone number. */
function sitoConfermato(): Sito {
  const sito = reale();
  sito.daConfermare = sito.daConfermare.filter(
    (d) => d.campo !== 'social' && d.campo !== 'contatti.telefono',
  );
  sito.social = [{ nome: 'Facebook', url: 'https://www.facebook.com/esempio' }];
  sito.contatti.telefono = '+39 0735 000000';
  return sito;
}

describe('clean', () => {
  it('drops empty values, daConfermare fields and placeholder texts at any depth', () => {
    const sporco = {
      a: 'ok',
      vuoto: '',
      nullo: null,
      indefinito: undefined,
      lista: [],
      oggetto: {},
      daConfermare: [{ campo: 'x', nota: 'y' }],
      annidato: { b: 'ok', c: '  ', daConfermare: [], profondo: { d: '[[DA CONFERMARE: x]]' } },
      elenco: ['uno', '', '[[DA CONFERMARE: due]]', { e: [] }, 'tre'],
    };
    expect(clean(sporco)).toEqual({ a: 'ok', annidato: { b: 'ok' }, elenco: ['uno', 'tre'] });
  });

  it('keeps zero, false and numbers', () => {
    expect(clean({ a: 0, b: false, c: 5 })).toEqual({ a: 0, b: false, c: 5 });
  });

  it('keeps an @id reference but drops an object that only has a type', () => {
    expect(
      clean({ location: { '@id': 'https://e.test/#m' }, address: { '@type': 'PostalAddress' } }),
    ).toEqual({
      location: { '@id': 'https://e.test/#m' },
    });
  });

  it('returns undefined when nothing is left', () => {
    expect(clean({ a: '', b: [] })).toBeUndefined();
  });
});

describe('museo', () => {
  it('is a Museum with a stable @id, address and absolute url', () => {
    const m = museo(reale(), ORIGINE) as Record<string, unknown>;
    expect(m['@type']).toBe('Museum');
    expect(m['@id']).toBe('https://esempio.test/#museo');
    expect(m['url']).toBe('https://esempio.test/');
    expect(m['name']).toBe('Museo Aldo Sergiacomi');
    expect(m['address']).toEqual({
      '@type': 'PostalAddress',
      streetAddress: 'via Ischia 24',
      postalCode: '63073',
      addressLocality: 'Offida',
      addressRegion: 'AP',
      addressCountry: 'IT',
    });
  });

  it('has no parentOrganization, no geo and no hours without verified coordinates', () => {
    const m = museo(reale(), ORIGINE) as Record<string, unknown>;
    expect(m).not.toHaveProperty('parentOrganization');
    expect(m).not.toHaveProperty('geo');
    expect(m).not.toHaveProperty('openingHoursSpecification');
    expect(m).not.toHaveProperty('isAccessibleForFree');
  });

  it('leaves out geo when the coordinates are not verified, adds it when they are', () => {
    const non = museo(reale(), ORIGINE, { lat: 42.93, lon: 13.69, verificato: false });
    expect(non).not.toHaveProperty('geo');
    const si = museo(reale(), ORIGINE, { lat: 42.93, lon: 13.69, verificato: true }) as Record<
      string,
      unknown
    >;
    expect(si['geo']).toEqual({ '@type': 'GeoCoordinates', latitude: 42.93, longitude: 13.69 });
  });

  it('hides the phone and the social profiles that are still to confirm', () => {
    const m = museo(reale(), ORIGINE) as Record<string, unknown>;
    expect(m).not.toHaveProperty('telephone');
    expect(m).not.toHaveProperty('sameAs');
  });

  it('shows the phone and the social profiles once confirmed', () => {
    const m = museo(sitoConfermato(), ORIGINE) as Record<string, unknown>;
    expect(m['telephone']).toBe('+39 0735 000000');
    expect(m['sameAs']).toEqual(['https://www.facebook.com/esempio']);
  });
});

describe('persona', () => {
  it('is a Person with the facts of the spec and the Wikidata link', () => {
    const p = persona(reale(), ORIGINE) as Record<string, unknown>;
    expect(p).toMatchObject({
      '@type': 'Person',
      '@id': 'https://esempio.test/aldo-sergiacomi/#persona',
      url: 'https://esempio.test/aldo-sergiacomi/',
      name: 'Aldo Sergiacomi',
      alternateName: 'Romoaldo Sergiacomi',
      jobTitle: 'scultore',
      sameAs: ['https://www.wikidata.org/wiki/Q105686429'],
    });
    expect(p['birthPlace']).toEqual({ '@type': 'Place', name: 'Offida' });
  });

  it('leaves out the birth and death dates while sito.yaml lists them in daConfermare', () => {
    const p = persona(reale(), ORIGINE);
    expect(p).not.toHaveProperty('birthDate');
    expect(p).not.toHaveProperty('deathDate');
  });

  it('adds the dates once they are confirmed', () => {
    const sito = reale();
    sito.daConfermare = sito.daConfermare.filter((d) => !d.campo.startsWith('artista.'));
    expect(persona(sito, ORIGINE)).toMatchObject({
      birthDate: '1912-07-27',
      deathDate: '1994-08-05',
    });
  });
});

describe('fondazione', () => {
  it('is an Organization whose location is the @id of the Museum', () => {
    const o = fondazione(reale(), ORIGINE) as Record<string, unknown>;
    expect(o).toMatchObject({
      '@type': 'Organization',
      '@id': 'https://esempio.test/chi-siamo/#fondazione',
      legalName: 'Fondazione Lavoroperlapersona',
      url: 'https://esempio.test/chi-siamo/',
      email: 'info@lavoroperlapersona.it',
      location: { '@id': 'https://esempio.test/#museo' },
    });
    expect(o['address']).toMatchObject({ postalCode: '63073' });
    expect(o).not.toHaveProperty('taxID');
    expect(o).not.toHaveProperty('telephone');
  });
});

describe('briciole', () => {
  it('numbers the items from 1 with absolute urls, the last one being the current page', () => {
    const b = briciole(
      [
        { titolo: 'Home', href: '/' },
        { titolo: 'Il Museo', href: '/il-museo/' },
        { titolo: 'Sala 1' },
      ],
      '/il-museo/sale/sala-1/',
      ORIGINE,
    ) as { itemListElement: Record<string, unknown>[] };
    expect(b).toMatchObject({ '@type': 'BreadcrumbList' });
    expect(b.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://esempio.test/' },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Il Museo',
        item: 'https://esempio.test/il-museo/',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Sala 1',
        item: 'https://esempio.test/il-museo/sale/sala-1/',
      },
    ]);
  });
});

describe('serializza', () => {
  it('writes valid JSON with a context and cannot close the script tag', () => {
    const testo = serializza([{ '@type': 'Thing', name: 'a </script><b>' }]);
    expect(testo).not.toContain('</script');
    const dati = JSON.parse(testo);
    expect(dati['@context']).toBe('https://schema.org');
    expect(dati['@graph'][0].name).toBe('a </script><b>');
  });

  it('never carries a daConfermare value, whatever is passed in', () => {
    const testo = serializza([
      { '@type': 'Thing', name: 'x', daConfermare: [{ campo: 'a', nota: 'b' }] },
    ]);
    expect(testo).not.toContain('daConfermare');
  });

  it('holds only absolute urls for the real pages', () => {
    const sito = reale();
    const testo = serializza([
      museo(sito, ORIGINE),
      persona(sito, ORIGINE),
      fondazione(sito, ORIGINE),
    ]);
    const urls = [...testo.matchAll(/"(?:url|@id|item)":"([^"]+)"/g)].map((m) => m[1]!);
    expect(urls.length).toBeGreaterThan(3);
    for (const u of urls) expect(u).toMatch(/^https:\/\/esempio\.test\//);
  });
});
