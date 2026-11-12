import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { apertiDelRepo } from '../../src/lib/aperti';
import { DIST, builtPages, walk } from './helpers';

// The text pages of task 10: who is on which page, the JSON-LD, the timeline and the labels of
// content that is not confirmed.
const PAGINE = [
  '/aldo-sergiacomi/',
  '/chi-siamo/',
  '/contatti/',
  '/didattica/',
  '/il-museo/',
  '/pubblicazioni/',
  '/sostieni/',
  '/visita/',
];
const pagine = builtPages();
const documento = (indirizzo: string) =>
  pagine.find((p) => p.path === `${indirizzo.slice(1)}index.html`)!.document;

/** The nodes of the JSON-LD `@graph` of a page. */
function grafo(indirizzo: string): Record<string, unknown>[] {
  const scripts = documento(indirizzo).querySelectorAll('script[type="application/ld+json"]');
  expect(scripts).toHaveLength(1);
  const dati = JSON.parse(scripts[0]!.textContent!);
  expect(dati['@context']).toBe('https://schema.org');
  return dati['@graph'];
}
const tipi = (indirizzo: string) => grafo(indirizzo).map((n) => n['@type']);

describe('the text pages exist', () => {
  it.each(PAGINE)('%s has one h1 and a description', (indirizzo) => {
    const d = documento(indirizzo);
    expect(d.querySelectorAll('h1')).toHaveLength(1);
    expect(d.querySelector('h1')!.textContent!.trim().length).toBeGreaterThan(2);
    expect(d.querySelector('meta[name="description"]')!.getAttribute('content')!.length).toBeGreaterThan(69);
  });
});

describe('JSON-LD of the text pages', () => {
  it.each([
    ['/aldo-sergiacomi/', ['Person', 'BreadcrumbList']],
    ['/chi-siamo/', ['Organization', 'BreadcrumbList']],
    ['/contatti/', ['Organization', 'BreadcrumbList']],
    ['/visita/', ['Museum', 'BreadcrumbList']],
    ['/il-museo/', ['BreadcrumbList']],
    ['/didattica/', ['BreadcrumbList']],
    ['/pubblicazioni/', ['BreadcrumbList']],
    ['/sostieni/', ['BreadcrumbList']],
  ] as const)('%s has %j', (indirizzo, attesi) => {
    expect(tipi(indirizzo)).toEqual(attesi);
  });

  it('has a Museum with no parentOrganization and no geo, and nothing marked daConfermare', () => {
    const museo = grafo('/visita/').find((n) => n['@type'] === 'Museum')!;
    expect(museo).not.toHaveProperty('parentOrganization');
    expect(museo).not.toHaveProperty('geo');
    for (const indirizzo of PAGINE) {
      const testo = JSON.stringify(grafo(indirizzo));
      expect(testo).not.toMatch(/daConfermare|DA CONFERMARE|\[\[/);
    }
  });

  it('has an Organization located at the Museum of the home page', () => {
    const org = grafo('/chi-siamo/').find((n) => n['@type'] === 'Organization')!;
    expect(org['location']).toEqual({ '@id': expect.stringMatching(/\/#museo$/) });
  });

  it('has absolute urls and a breadcrumb that ends on the page', () => {
    for (const indirizzo of PAGINE) {
      const lista = grafo(indirizzo).find((n) => n['@type'] === 'BreadcrumbList')!;
      const voci = lista['itemListElement'] as { position: number; item: string }[];
      expect(voci.map((v) => v.position)).toEqual(voci.map((_, i) => i + 1));
      for (const v of voci) expect(v.item).toMatch(/^https?:\/\//);
      expect(voci.at(-1)!.item.endsWith(indirizzo)).toBe(true);
    }
  });
});

describe('the biography timeline', () => {
  const voci = [...documento('/aldo-sergiacomi/').querySelectorAll('.linea-tempo > li')];
  const anni = voci.map((li) => Number(li.querySelector('.anno')!.textContent));

  it('shows 1912 to 1998 in order', () => {
    expect(voci).toHaveLength(16);
    expect(anni[0]).toBe(1912);
    expect(anni.at(-1)).toBe(1998);
    expect(anni).toEqual([...anni].sort((a, b) => a - b));
  });

  it('links to /opere/?fino= only for the years from 1934 to 1994', () => {
    for (const [i, li] of voci.entries()) {
      const link = li.querySelector('a[href^="/opere/"]');
      const dentro = anni[i]! >= 1934 && anni[i]! <= 1994;
      expect(link?.getAttribute('href') ?? null).toBe(dentro ? `/opere/?fino=${anni[i]}` : null);
    }
  });
});

describe('content that is not confirmed', () => {
  const etichette = (indirizzo: string) =>
    [...documento(indirizzo).querySelectorAll('.da-confermare')].map((e) => e.textContent!.trim());

  it('shows the placeholder label on /pubblicazioni/ and /sostieni/', () => {
    expect(etichette('/pubblicazioni/')).toContain('Segnaposto');
    expect(etichette('/sostieni/')).toContain('Segnaposto');
  });

  it('shows only the label of the IBAN, and the IBAN is nowhere in dist', () => {
    expect(etichette('/sostieni/').some((e) => e.startsWith('Da confermare: IBAN'))).toBe(true);
    const iban = readFileSync(join(DIST, '..', 'src', 'data', 'sito.yaml'), 'utf8').match(
      /iban:\s*([A-Z]{2}\d{2}[A-Z0-9]+)/,
    )?.[1];
    expect(iban).toBeTruthy();
    const html = walk(DIST).filter((f) => f.endsWith('.html'));
    for (const file of html) expect(readFileSync(file, 'utf8')).not.toContain(iban!);
  });

  it('stops a production build: both pages carry open items', () => {
    const { aperti } = apertiDelRepo(join(DIST, '..'));
    const file = (parte: string) => aperti.some((a) => a.file.includes(parte));
    expect(file('pagine/it/sostieni.md')).toBe(true);
    expect(file('pubblicazioni/it/segnaposto.yaml')).toBe(true);
  });
});
