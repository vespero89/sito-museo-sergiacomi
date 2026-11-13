import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DIST, builtPages, walk } from './helpers';

// Itineraries, events, archive and the four paths (task 14), on the built pages.
const pagine = builtPages();
const documento = (indirizzo: string) =>
  pagine.find((p) => p.path === `${indirizzo.slice(1)}index.html`)!.document;
const figli = (cartella: string) =>
  readdirSync(join(DIST, cartella), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
const grafo = (d: Document): { '@type': string; [chiave: string]: unknown }[] =>
  JSON.parse(d.querySelector('script[type="application/ld+json"]')!.textContent!)['@graph'];
const tipi = (d: Document) => grafo(d).map((n) => n['@type']);

describe('/itinerari/', () => {
  const slugs = figli('itinerari');
  const d = documento('/itinerari/');

  it('lists the four itineraries', () => {
    expect(slugs).toHaveLength(4);
    const link = [...d.querySelectorAll('article h2 a')].map((a) => a.getAttribute('href'));
    expect([...link].sort()).toEqual(slugs.map((s) => `/itinerari/${s}/`).sort());
  });

  describe.each(slugs)('/itinerari/%s/', (slug) => {
    const pagina = documento(`/itinerari/${slug}/`);

    it('has a TouristTrip with the stops in order and a numbered list', () => {
      expect(tipi(pagina)).toEqual(expect.arrayContaining(['TouristTrip', 'BreadcrumbList']));
      const viaggio = grafo(pagina).find((n) => n['@type'] === 'TouristTrip') as unknown as {
        itinerary: { itemListElement: { position: number }[] };
      };
      const voci = viaggio.itinerary.itemListElement;
      expect(voci.map((v) => v.position)).toEqual(voci.map((_, i) => i + 1));
      expect(pagina.querySelectorAll('ol.tappe li')).toHaveLength(voci.length);
    });

    it('links to Google Maps from the museum, through the stops in the order of the list', () => {
      const link = [...pagina.querySelectorAll('a[href^="https://www.google.com/maps/dir/"]')];
      expect(link.length).toBeGreaterThan(0);
      const nomi: string[] = [];
      for (const a of link) {
        const p = new URL(a.getAttribute('href')!).searchParams;
        expect(p.get('origin')).toContain('via Ischia 24');
        nomi.push(...(p.get('waypoints')?.split('|') ?? []), p.get('destination')!);
      }
      expect(nomi).toHaveLength(pagina.querySelectorAll('ol.tappe li').length);
    });
  });

  it('shows the groups Marche and Abruzzo of "I portali"', () => {
    const p = documento('/itinerari/i-portali-del-sergiacomi/');
    expect([...p.querySelectorAll('.gruppo h3')].map((h) => h.textContent!.trim())).toEqual([
      'Marche',
      'Abruzzo',
    ]);
    const partenze = [...p.querySelectorAll('ol.tappe')].map((ol) => ol.getAttribute('start'));
    expect(partenze).toEqual(['1', '4']);
  });
});

describe('print rules', () => {
  it('hide the header, footer and bars, and let the numbered stops print', () => {
    const css = walk(join(DIST, '_astro'))
      .filter((f) => f.endsWith('.css'))
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    const stampa = /@media print\{(.*?)\}\}/s.exec(css)?.[1] ?? '';
    for (const classe of ['.testata', '.piede', '.barra', '.no-stampa']) expect(stampa).toContain(classe);
    expect(stampa).toContain('display:none');
    const p = documento('/itinerari/i-portali-del-sergiacomi/');
    expect(p.querySelectorAll('.tappe').length).toBeGreaterThan(0);
    expect(p.querySelectorAll('.mappa.no-stampa').length).toBeGreaterThan(0);
  });
});

describe('/eventi/', () => {
  const d = documento('/eventi/');
  it('has the passed centenario in the past events and its own page', () => {
    const passati = [...d.querySelectorAll('section.gruppo')].find(
      (s) => s.querySelector('h2')!.textContent!.trim() === 'Eventi passati',
    )!;
    expect(passati.querySelector('a[href="/eventi/centenario-2012/"]')).not.toBeNull();
    expect(figli('eventi')).toContain('centenario-2012');
  });

  it('shows the latest event as "Ultimo evento" when none is ahead (the only dated one is from 2012)', () => {
    expect(d.querySelector('.prossimo .etichetta')!.textContent!.trim()).toBe('Ultimo evento');
  });

  it('gives an Event JSON-LD only to dated events', () => {
    for (const slug of figli('eventi')) {
      const datato = tipi(documento(`/eventi/${slug}/`)).includes('Event');
      expect(datato, slug).toBe(slug === 'centenario-2012');
    }
  });
});

describe('/archivio/', () => {
  it('lists every document and each page links its works', () => {
    const slugs = figli('archivio');
    expect(slugs.length).toBeGreaterThan(1);
    const d = documento('/archivio/');
    for (const slug of slugs) expect(d.querySelector(`a[href="/archivio/${slug}/"]`), slug).not.toBeNull();
    const scheda = documento('/archivio/articolo-camilli-flash/');
    expect(scheda.querySelector('a[href="/opere/le-merlettaie/"]')).not.toBeNull();
  });
});

describe('the audience paths', () => {
  const esiste = (indirizzo: string) => pagine.some((p) => p.path === `${indirizzo.slice(1)}index.html`);

  it('have no pages of their own: they are the block "Per chi viene" of the home', () => {
    expect(existsSync(join(DIST, 'percorsi'))).toBe(false);
  });

  it('only link to pages that exist', () => {
    const link = [...documento('/').querySelectorAll('#per-chi-viene li li a')].map((a) => a.getAttribute('href')!);
    expect(link.length).toBeGreaterThanOrEqual(8);
    for (const l of link) expect(esiste(l.replace(/#.*$/, '')), l).toBe(true);
  });
});
