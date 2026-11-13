import { describe, expect, it } from 'vitest';
import { continua, type Catalogo, type Scheda } from '../../src/lib/continua.ts';

const opera = (id: string, comune: string, lat: number, lon: number, extra = {}) => ({
  tipo: 'opera' as const,
  id,
  titolo: id,
  href: `/opere/${id}/`,
  comune,
  lat,
  lon,
  ...extra,
});
const scheda = (tipo: Scheda['tipo'], id: string, href: string): Scheda => ({
  tipo,
  titolo: id,
  href,
});

const cat: Catalogo = {
  opere: [
    opera('a', 'Offida', 42.93, 13.69, { sala: 'sala-2', anno: 1950 }),
    opera('b', 'Offida', 42.94, 13.7, { anno: 1960 }),
    opera('c', 'Fermo', 43.16, 13.72, { anno: 1970 }),
    opera('d', 'Teramo', 42.66, 13.7),
    opera('e', 'Offida', 42.931, 13.691, { anno: 1980 }),
  ],
  sale: [{ ...scheda('sala', 'sala-2', '/il-museo/le-sale/#sala-2'), id: 'sala-2' }],
  itinerari: [
    { ...scheda('itinerario', 'i1', '/itinerari/i1/'), id: 'i1', opere: ['a', 'c'] },
    { ...scheda('itinerario', 'i2', '/itinerari/i2/'), id: 'i2', opere: ['d'] },
    { ...scheda('itinerario', 'i3', '/itinerari/i3/'), id: 'i3', opere: [] },
  ],
  archivio: [
    { ...scheda('archivio', 'd1', '/archivio/d1/'), id: 'd1', anno: 1992, opere: ['a'], sale: [] },
    {
      ...scheda('archivio', 'd2', '/archivio/d2/'),
      id: 'd2',
      anno: 1995,
      opere: [],
      sale: ['sala-2'],
    },
  ],
  predefinite: [
    scheda('pagina', 'Opere', '/opere/'),
    scheda('pagina', 'Visita', '/visita/'),
    scheda('pagina', 'Archivio', '/archivio/'),
  ],
  museo: scheda('pagina', 'Il Museo', '/il-museo/'),
  visita: scheda('pagina', 'Visita', '/visita/'),
};
const href = (s: Scheda[]) => s.map((x) => x.href);

describe('continua: a work', () => {
  it('proposes its room, its itinerary and its document, in that order', () => {
    expect(href(continua({ tipo: 'opera', id: 'a' }, '/opere/a/', cat))).toEqual([
      '/il-museo/le-sale/#sala-2',
      '/itinerari/i1/',
      '/archivio/d1/',
    ]);
  });
  it('fills with works of the same town first, nearest first', () => {
    expect(href(continua({ tipo: 'opera', id: 'b' }, '/opere/b/', cat))).toEqual([
      '/opere/e/',
      '/opere/a/',
      '/opere/c/',
    ]);
  });
  it('falls back on the nearest works when the town has no other', () => {
    expect(href(continua({ tipo: 'opera', id: 'c' }, '/opere/c/', cat))).toEqual([
      '/itinerari/i1/',
      '/opere/b/',
      '/opere/e/',
    ]);
  });
  it('never proposes itself and has 2 or 3 cards without repeats', () => {
    for (const o of cat.opere) {
      const h = href(continua({ tipo: 'opera', id: o.id }, o.href, cat));
      expect(h).not.toContain(o.href);
      expect(new Set(h).size).toBe(h.length);
      expect(h.length).toBeGreaterThanOrEqual(2);
      expect(h.length).toBeLessThanOrEqual(3);
    }
  });
  it('throws for a work that is not in the catalogue', () => {
    expect(() => continua({ tipo: 'opera', id: 'zz' }, '/opere/zz/', cat)).toThrow(/zz/);
  });
  it('uses the next work by year when it is the only thing left', () => {
    const solo: Catalogo = {
      ...cat,
      opere: cat.opere.slice(0, 2),
      itinerari: [],
      archivio: [],
      sale: [],
      predefinite: [],
    };
    expect(
      href(
        continua({ tipo: 'opera', id: 'b' }, '/opere/b/', { ...solo, predefinite: [cat.museo] }),
      ),
    ).toEqual(['/opere/a/', '/il-museo/']);
  });
});

describe('continua: rooms, itineraries, archive', () => {
  it('a room page: the works shown, the itinerary, the museum', () => {
    expect(href(continua({ tipo: 'sale', ids: ['sala-2'] }, '/il-museo/le-sale/', cat))).toEqual([
      '/opere/a/',
      '/itinerari/i1/',
      '/il-museo/',
    ]);
  });
  it('a room page with no works shown still has 2 cards', () => {
    const h = href(continua({ tipo: 'sale', ids: ['sala-4'] }, '/il-museo/il-laboratorio/', cat));
    expect(h).toEqual(['/il-museo/', '/opere/', '/visita/']);
  });
  it('an itinerary: the visit and the museum, never the other itineraries (the page lists them)', () => {
    expect(href(continua({ tipo: 'itinerario', id: 'i1' }, '/itinerari/i1/', cat))).toEqual([
      '/visita/',
      '/il-museo/',
      '/opere/',
    ]);
  });
  it('a document: its works, its room, documents of the same decade', () => {
    expect(href(continua({ tipo: 'archivio', id: 'd1' }, '/archivio/d1/', cat))).toEqual([
      '/opere/a/',
      '/archivio/d2/',
      '/opere/',
    ]);
    expect(href(continua({ tipo: 'archivio', id: 'd2' }, '/archivio/d2/', cat))).toEqual([
      '/il-museo/le-sale/#sala-2',
      '/archivio/d1/',
      '/opere/',
    ]);
  });
});

describe('continua: manual pages', () => {
  it('keeps the written pointers, drops the page itself and a repeat, then fills with defaults', () => {
    const rimandi = [
      scheda('opera', 'a', '/opere/a/'),
      scheda('pagina', 'me', '/eventi/x/'),
      scheda('opera', 'a', '/opere/a/'),
    ];
    expect(href(continua({ tipo: 'manuale', rimandi }, '/eventi/x/', cat))).toEqual([
      '/opere/a/',
      '/opere/',
      '/visita/',
    ]);
  });
  it('with no pointers it is the defaults, minus the page itself', () => {
    expect(href(continua({ tipo: 'manuale', rimandi: [] }, '/visita/', cat))).toEqual([
      '/opere/',
      '/archivio/',
    ]);
  });
  it('throws if fewer than 2 cards are possible', () => {
    expect(() =>
      continua({ tipo: 'manuale', rimandi: [] }, '/opere/', {
        ...cat,
        predefinite: [cat.predefinite[0]!],
      }),
    ).toThrow(/only 0/);
  });
});
