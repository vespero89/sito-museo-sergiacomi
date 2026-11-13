import { describe, expect, it } from 'vitest';
import { builtPages } from './helpers';

// The four environments of the museum (task 11): the pages, their breadcrumbs, their sections and
// the links between the Foundation's spaces and Didattica.
const AMBIENTI = [
  ['/il-museo/le-sale/', 'Le sale'],
  ['/il-museo/il-laboratorio/', 'Il laboratorio di Aldo'],
  ['/il-museo/il-chiostro/', 'Il chiostro'],
  ['/il-museo/gli-spazi-dei-laboratori/', 'Gli spazi dei laboratori'],
] as const;
const pagine = builtPages();
const documento = (indirizzo: string) =>
  pagine.find((p) => p.path === `${indirizzo.slice(1)}index.html`)!.document;
const etichette = (indirizzo: string) =>
  [...documento(indirizzo).querySelectorAll('.da-confermare')].map((e) => e.textContent!.trim());

describe.each(AMBIENTI)('%s', (indirizzo, titolo) => {
  it('has one h1, a description and a breadcrumb Home, Il Museo, the environment', () => {
    const d = documento(indirizzo);
    expect(d.querySelectorAll('h1')).toHaveLength(1);
    expect(d.querySelector('h1')!.textContent!.trim()).toBe(titolo);
    expect(d.querySelector('meta[name="description"]')!.getAttribute('content')!.length).toBeGreaterThan(69);
    const voci = [...d.querySelectorAll('.briciole li')].map((li) => li.textContent!.trim());
    expect(voci).toEqual(['Home', 'Il Museo', titolo]);
    expect(d.querySelector('.briciole a[href="/il-museo/"]')).not.toBeNull();
  });

  it('has a BreadcrumbList that ends on the page', () => {
    const dati = JSON.parse(
      documento(indirizzo).querySelector('script[type="application/ld+json"]')!.textContent!,
    );
    const lista = dati['@graph'].find((n: { '@type': string }) => n['@type'] === 'BreadcrumbList');
    expect(lista.itemListElement.map((v: { name: string }) => v.name)).toEqual(['Home', 'Il Museo', titolo]);
    expect(lista.itemListElement.at(-1).item.endsWith(indirizzo)).toBe(true);
  });
});

describe('the page of the rooms', () => {
  const d = documento('/il-museo/le-sale/');

  it('has a section for each of the rooms 1, 2 and 3, and none for room 4', () => {
    expect([...d.querySelectorAll('section.sala')].map((s) => s.id)).toEqual(['sala-1', 'sala-2', 'sala-3']);
    expect(d.querySelector('#sala-4')).toBeNull();
  });
});

describe('the page of the workshop', () => {
  const d = documento('/il-museo/il-laboratorio/');

  it('has room 4 and the three tools, and there is no page of the tools', () => {
    expect(d.querySelector('section.sala')!.id).toBe('sala-4');
    expect(d.querySelectorAll('.strumenti > li')).toHaveLength(3);
    expect(pagine.some((p) => p.path.startsWith('il-museo/gli-strumenti'))).toBe(false);
  });

  it('shows the two photos of room 4 as a gallery that links to the image files', () => {
    const link = [...d.querySelectorAll('[data-galleria] a.apri')];
    expect(link).toHaveLength(2);
    for (const a of link) expect(a.getAttribute('href')).toMatch(/\.jpe?g$/);
  });
});

describe('the page of the cloister', () => {
  const d = documento('/il-museo/il-chiostro/');

  it('is marked as a placeholder and shows the photos of the Merlettaie', () => {
    expect(etichette('/il-museo/il-chiostro/')).toContain('Testo generato, da approvare');
    expect(d.querySelectorAll('[data-galleria] a.apri').length).toBeGreaterThanOrEqual(2);
  });

  it('links to the work page only when that page is built', () => {
    const esiste = pagine.some((p) => p.path === 'opere/le-merlettaie/index.html');
    const link = d.querySelector('a[href="/opere/le-merlettaie/"]');
    expect(link !== null).toBe(esiste);
  });
});

describe('the Foundation spaces and Didattica', () => {
  const indirizzo = '/il-museo/gli-spazi-dei-laboratori/';

  it('is marked as provisional, with the name and the address to confirm', () => {
    const testi = etichette(indirizzo);
    expect(testi).toContain('Testo generato, da approvare');
    expect(testi.some((e) => e.startsWith('Da confermare: Nome provvisorio'))).toBe(true);
    expect(testi.some((e) => e.startsWith('Da confermare: Indirizzo provvisorio'))).toBe(true);
  });

  it('links to Didattica, and Didattica links back', () => {
    expect(documento(indirizzo).querySelector('a[href="/didattica/"]')).not.toBeNull();
    expect(documento('/didattica/').querySelector(`a[href="${indirizzo}"]`)).not.toBeNull();
  });
});

describe('the plan on /il-museo/', () => {
  const d = documento('/il-museo/');
  const href = (el: Element) => el.getAttribute('href');

  it('is an SVG with a title and a description and four links to the four environments', () => {
    const svg = d.querySelector('svg.pianta')!;
    expect(svg.querySelector('title')!.textContent!.trim().length).toBeGreaterThan(3);
    expect(svg.querySelector('desc')!.textContent!.trim().length).toBeGreaterThan(20);
    expect([...svg.querySelectorAll('a')].map(href)).toEqual(AMBIENTI.map(([indirizzo]) => indirizzo));
    // The name of each link is its visible text: the title of the environment.
    const nomi = [...svg.querySelectorAll('a')].map((a) => a.textContent!.replace(/\s+/g, ' ').trim());
    nomi.forEach((nome, i) => expect(nome).toContain(AMBIENTI[i]![1].replaceAll('  ', ' ')));
  });

  it('labels the rooms with their numbers: Sala 1, 2, 3 and Sala 4', () => {
    const sigle = [...d.querySelectorAll('svg.pianta text.sigla')].map((t) => t.textContent!.trim());
    expect(sigle).toEqual(['Sala 1, 2, 3', 'Sala 4']);
  });

  it('has the same four links as a text list under the plan', () => {
    const elenco = [...d.querySelectorAll('ul.elenco-ambienti a')];
    expect(elenco.map(href)).toEqual(AMBIENTI.map(([indirizzo]) => indirizzo));
    expect(elenco.map((a) => a.textContent!.trim())).toEqual(AMBIENTI.map(([, titolo]) => titolo));
  });

  it('is marked as a placeholder', () => {
    expect(etichette('/il-museo/')).toContain('Testo generato, da approvare');
  });
});
