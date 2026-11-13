import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DIST, builtPages } from './helpers';

// The list of the works and the 27 work pages (task 12): structure, description, JSON-LD, links.
const pagine = builtPages();
const documento = (indirizzo: string) =>
  pagine.find((p) => p.path === `${indirizzo.slice(1)}index.html`)!.document;
const slugs = readdirSync(join(DIST, 'opere'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);
interface Nodo {
  '@type': string;
  name: string;
  url: string;
  dateCreated?: string;
  creator: { '@id': string };
  itemListElement: { name: string; item: string }[];
}
const grafo = (d: Document): Nodo[] =>
  JSON.parse(d.querySelector('script[type="application/ld+json"]')!.textContent!)['@graph'];

describe('/opere/', () => {
  const d = documento('/opere/');

  it('has one h1, a description and a breadcrumb Home, Le opere', () => {
    expect(d.querySelectorAll('h1')).toHaveLength(1);
    expect(d.querySelector('h1')!.textContent!.trim()).toBe('Le opere');
    expect(d.querySelector('meta[name="description"]')!.getAttribute('content')!.length).toBeGreaterThan(69);
    expect([...d.querySelectorAll('.briciole li')].map((li) => li.textContent!.trim())).toEqual(['Home', 'Le opere']);
    expect(grafo(d).find((n) => n['@type'] === 'BreadcrumbList')!.itemListElement).toHaveLength(2);
  });

  it('lists the 27 works once each, in sections by town, with the map block', () => {
    const link = [...d.querySelectorAll('.schede h3 a')].map((a) => a.getAttribute('href'));
    expect(slugs).toHaveLength(27);
    expect([...link].sort()).toEqual(slugs.map((s) => `/opere/${s}/`).sort());
    expect(d.querySelectorAll('section.comune').length).toBeGreaterThan(5);
    expect(d.querySelector('[data-mappa]')).not.toBeNull();
  });

  it('keeps the works with no certain year in the list, with a label', () => {
    const carta = d.querySelector('a[href="/opere/stemmi-palazzo-comunale-offida/"]')!.closest('article')!;
    expect(carta.querySelector('.da-confermare')).not.toBeNull();
  });
});

describe.each(slugs)('/opere/%s/', (slug) => {
  const indirizzo = `/opere/${slug}/`;
  const d = documento(indirizzo);
  const titolo = d.querySelector('h1')!.textContent!.trim();

  it('has one h1, a description of 70 to 160 characters that is also the lead sentence', () => {
    expect(d.querySelectorAll('h1')).toHaveLength(1);
    const descrizione = d.querySelector('meta[name="description"]')!.getAttribute('content')!;
    expect(descrizione.length).toBeGreaterThanOrEqual(70);
    expect(descrizione.length).toBeLessThanOrEqual(160);
    expect(d.querySelector('.frase')!.textContent!.trim()).toBe(descrizione);
    expect(descrizione).not.toMatch(/undefined|null|\[\[/);
  });

  it('has a breadcrumb Home, Le opere, the work, in the page and in the JSON-LD', () => {
    expect([...d.querySelectorAll('.briciole li')].map((li) => li.textContent!.trim())).toEqual([
      'Home',
      'Le opere',
      titolo,
    ]);
    const lista = grafo(d).find((n) => n['@type'] === 'BreadcrumbList')!;
    expect(lista.itemListElement.map((v) => v.name)).toEqual(['Home', 'Le opere', titolo]);
    expect(lista.itemListElement[1]!.item.endsWith('/opere/')).toBe(true);
    expect(lista.itemListElement[2]!.item.endsWith(indirizzo)).toBe(true);
  });

  it('has a Sculpture with the sculptor by @id and no location of creation or content', () => {
    const nodo = grafo(d).find((n) => n['@type'] === 'Sculpture')!;
    expect(nodo.name).toBe(titolo);
    expect(nodo.url.endsWith(indirizzo)).toBe(true);
    expect(nodo.creator['@id'].endsWith('/aldo-sergiacomi/#persona')).toBe(true);
    expect(JSON.stringify(nodo)).not.toMatch(/locationCreated|contentLocation|\[\[/);
  });

  it('has the facts, the directions link and three nearby works', () => {
    expect(d.querySelector('dl dt')!.textContent).toBe('Anno');
    const indicazioni = d.querySelector('a.pulsante')!.getAttribute('href')!;
    expect(indicazioni).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=/);
    const vicine = [...d.querySelectorAll('.vicine h3 a')].map((a) => a.getAttribute('href')!);
    expect(vicine).toHaveLength(3);
    expect(vicine).not.toContain(indirizzo);
    for (const v of vicine) expect(slugs).toContain(v.split('/')[2]);
  });

  it('shows a photo or the panel "Foto in arrivo", never an empty space', () => {
    const figura = d.querySelector('figure')!;
    expect(figura.querySelector('picture img') || figura.querySelector('.segnaposto')).not.toBeNull();
  });
});

describe('details of single works', () => {
  it('leaves the year of the Stemmi out of the JSON-LD and the sentence', () => {
    const d = documento('/opere/stemmi-palazzo-comunale-offida/');
    expect(JSON.stringify(grafo(d))).not.toContain('dateCreated');
    expect(d.querySelector('.frase')!.textContent).not.toMatch(/\d{4}/);
    expect(d.querySelector('dl .da-confermare')).not.toBeNull();
  });

  it('gives the Merlettaie a photo, a gallery and the year', () => {
    const d = documento('/opere/le-merlettaie/');
    expect(d.querySelector('figure picture img')).not.toBeNull();
    expect(d.querySelectorAll('[data-galleria] a.apri').length).toBe(9);
    expect(grafo(d).find((n) => n['@type'] === 'Sculpture')!.dateCreated).toBe('1983');
  });

  it('links a work to its room of the museum', () => {
    const d = documento('/opere/monumento-sisto-v-grottammare/');
    expect(d.querySelector('a[href="/il-museo/le-sale/#sala-1"]')).not.toBeNull();
  });

  it('has the Portale di Fermo without a photo and says so', () => {
    const d = documento('/opere/portale-duomo-di-fermo/');
    expect(d.querySelector('figure .segnaposto')!.textContent).toContain('Foto in arrivo');
    expect(d.querySelector('meta[property="og:image"]')).not.toBeNull();
  });

  it('is linked from the page of the cloister', () => {
    const d = documento('/il-museo/il-chiostro/');
    expect(d.querySelector('a[href="/opere/le-merlettaie/"]')).not.toBeNull();
  });
});
