import { describe, expect, it } from 'vitest';
import { builtPages } from './helpers';

// The home page (task 16): one big photo first, the entrances, the next event, the summary of
// "From the idea to the work", the visit actions. No carousel.
const d = builtPages().find((p) => p.path === 'index.html')!.document;

describe('/ (home)', () => {
  it('has one h1 and opens with the big Merlettaie photo, the only high-priority image', () => {
    expect(d.querySelectorAll('h1')).toHaveLength(1);
    const prima = d.querySelector('main img')!;
    expect(prima.getAttribute('fetchpriority')).toBe('high');
    expect(prima.getAttribute('loading')).toBe('eager');
    expect(prima.getAttribute('alt')!.length).toBeGreaterThan(10);
    expect(prima.getAttribute('src')).toContain('le-merlettaie-copertina-1');
    expect(d.querySelectorAll('img[fetchpriority="high"]')).toHaveLength(1);
    expect(d.querySelector('main')!.textContent).toContain('Fondazione Lavoroperlapersona');
  });

  it('has no carousel and no hand-written image', () => {
    expect(d.querySelector('[class*="carousel" i], [class*="slider" i]')).toBeNull();
    for (const img of d.querySelectorAll('img')) {
      expect(img.getAttribute('srcset') ?? '').not.toBe('');
      expect(img.getAttribute('width')).toBeTruthy();
    }
  });

  it('has the block "Su misura per te": four audiences with two or three direct links, no /percorsi/ pages', () => {
    const blocco = d.querySelector('section#su-misura')!;
    expect(blocco.querySelector('h2')!.textContent).toBe('Su misura per te');
    const pubblici = [...blocco.querySelectorAll(':scope > ul > li')];
    expect(pubblici).toHaveLength(4);
    for (const p of pubblici) {
      const n = p.querySelectorAll('a').length;
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(3);
    }
    const href = [...d.querySelectorAll('main a')].map((a) => a.getAttribute('href')!);
    expect(href.filter((h) => h.startsWith('/percorsi/'))).toEqual([]);
  });

  it('links the four areas of the museum and the band "Altro dal museo", all to existing pages', () => {
    const href = [...d.querySelectorAll('main a')].map((a) => a.getAttribute('href'));
    for (const a of ['/aldo-sergiacomi/', '/il-museo/', '/opere/', '/itinerari/']) {
      expect(href).toContain(a);
    }
    const altro = [...d.querySelectorAll('section.altro a')].map((a) => a.getAttribute('href'));
    expect(altro).toEqual(['/eventi/', '/archivio/', '/pubblicazioni/', '/chi-siamo/', '/sostieni/']);
  });

  it('summarises "From the idea to the work" with three photos and a link to the page', () => {
    const sezione = d.querySelector('section[aria-labelledby="idea-titolo"]')!;
    expect(sezione.querySelectorAll('img')).toHaveLength(3);
    expect(sezione.querySelector('a[href^="/opere/le-merlettaie/"]')).not.toBeNull();
  });

  it('has the visit actions as plain links and no event box while no event is ahead', () => {
    const href = [...d.querySelectorAll('main a')].map((a) => a.getAttribute('href'));
    expect(href).toContain('/visita/#prenota');
    expect(href).toContain('/visita/#orari');
    // The only dated event is from 2012: a past event is not highlighted on the home.
    expect(d.querySelector('.prossimo')).toBeNull();
  });

  it('has the Museum and the WebSite in JSON-LD, with absolute urls', () => {
    const nodi = JSON.parse(d.querySelector('script[type="application/ld+json"]')!.textContent!)[
      '@graph'
    ] as Record<string, unknown>[];
    expect(nodi.map((n) => n['@type']).sort()).toEqual(['Museum', 'WebSite']);
    for (const n of nodi) expect(n['@id']).toMatch(/^https?:\/\/.+\/#(museo|sito)$/);
  });
});
