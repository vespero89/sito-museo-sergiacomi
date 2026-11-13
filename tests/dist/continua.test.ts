import { describe, expect, it } from 'vitest';
import { builtPages } from './helpers';

// "Vedi anche" (task 15): every content page ends with 2 or 3 valid links, never to the
// page itself, no repeats. Lists, the home, the 404, search and the legal pages have no block.
const pagine = builtPages();
const indirizzo = (path: string) => `/${path.replace(/index\.html$/, '')}`;
const esistono = new Set(pagine.map((p) => indirizzo(p.path)));

const DETTAGLIO = /^\/(opere|itinerari|eventi|archivio)\/[^/]+\/$/;
const TESTO = [
  '/aldo-sergiacomi/',
  '/il-museo/',
  '/il-museo/le-sale/',
  '/il-museo/il-laboratorio/',
  '/il-museo/il-chiostro/',
  '/il-museo/gli-spazi-dei-laboratori/',
  '/didattica/',
  '/chi-siamo/',
  '/visita/',
  '/sostieni/',
  '/pubblicazioni/',
];
const contenuto = pagine.filter((p) => {
  const a = indirizzo(p.path);
  return DETTAGLIO.test(a) || TESTO.includes(a);
});
const link = (document: Document) =>
  [...document.querySelectorAll('.continua h3 a')].map((a) => a.getAttribute('href')!);

describe('Vedi anche', () => {
  it('covers every kind of content page', () => {
    expect(contenuto.length).toBeGreaterThanOrEqual(27 + 4 + 4 + 2 + 11);
  });

  it.each(contenuto.map((p) => [indirizzo(p.path), p] as const))('%s', (a, p) => {
    const sezione = p.document.querySelectorAll('.continua');
    expect(sezione).toHaveLength(1);
    expect(sezione[0]!.querySelector('h2')!.textContent!.trim()).toBe('Vedi anche');
    const href = link(p.document);
    expect(href.length).toBeGreaterThanOrEqual(2);
    expect(href.length).toBeLessThanOrEqual(3);
    expect(new Set(href).size).toBe(href.length);
    for (const h of href) {
      expect(h.split('#')[0]).not.toBe(a);
      expect(esistono.has(h.split('#')[0]!), `${h} does not exist`).toBe(true);
    }
  });

  it('the page of a work with a room, an itinerary and a document proposes those, in that order', () => {
    const href = link(pagine.find((p) => indirizzo(p.path) === '/opere/portale-duomo-di-fermo/')!.document);
    expect(href[0]).toMatch(/^\/il-museo\/(le-sale\/#sala-\d|il-laboratorio\/)$/);
    expect(href[1]).toMatch(/^\/itinerari\/[^/]+\/$/);
    expect(href[2]).toMatch(/^\/archivio\/[^/]+\/$/);
  });

  it('the pages without the block do not have it', () => {
    for (const a of ['/', '/404.html', '/ricerca/', '/privacy/', '/opere/', '/eventi/', '/archivio/']) {
      const p = pagine.find((x) => indirizzo(x.path) === a || x.path === a.slice(1));
      if (p) expect(p.document.querySelector('.continua'), a).toBeNull();
    }
  });
});
