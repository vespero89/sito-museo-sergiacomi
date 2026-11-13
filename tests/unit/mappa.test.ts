import { describe, expect, it } from 'vitest';
import {
  MATERIALE_NON_INDICATO,
  conta,
  fermate,
  filtra,
  formattaKm,
  leggiStato,
  limitiAnni,
  ordinaPerDistanza,
  ordinaTabella,
  prossimaFermata,
  raggruppaPerDecennio,
  raggruppaPerLuogo,
  scriviStato,
  slugComune,
  tacche,
  tileMappa,
  type OperaMappa,
} from '../../src/lib/mappa';

const opera = (id: string, extra: Partial<OperaMappa> = {}): OperaMappa => ({
  id,
  titolo: id,
  href: `/opere/${id}/`,
  anno: 1960,
  certa: true,
  comune: 'offida',
  materiali: ['bronzo'],
  luogoId: `luogo-${id}`,
  luogoNome: `Luogo ${id}`,
  indicativa: false,
  comuneNome: 'Offida',
  categoria: 'Scultura',
  lat: 42.9,
  lon: 13.68,
  ...extra,
});

const OPERE = [
  opera('a', { anno: 1934, comune: 'fermo', materiali: ['marmo'] }),
  opera('b', { anno: 1975, comune: 'offida', materiali: ['bronzo', 'marmo'] }),
  opera('c', { anno: 1994, comune: 'teramo', materiali: [] }),
  opera('d', { anno: undefined, certa: false, comune: 'offida', materiali: ['pietra'] }),
];
const LIMITI = limitiAnni(OPERE);
const COMUNI = ['fermo', 'offida', 'teramo'];
const MATERIALI = ['bronzo', 'marmo', 'pietra', MATERIALE_NON_INDICATO];
const stato = (ricerca: string) => leggiStato(ricerca, LIMITI, COMUNI, MATERIALI);

describe('limits of the slider', () => {
  it('uses the first and last certain year, not the works with no certain year', () => {
    expect(LIMITI).toEqual({ min: 1934, max: 1994 });
  });
});

describe('state in the address', () => {
  it('reads the three values', () => {
    expect(stato('?fino=1975&comune=offida&materiale=bronzo')).toEqual({
      fino: 1975,
      comune: 'offida',
      materiale: 'bronzo',
      vista: 'luogo',
    });
  });
  it('reads the view and ignores a view that does not exist', () => {
    expect(stato('?vista=anno').vista).toBe('anno');
    expect(stato('?vista=tabella').vista).toBe('tabella');
    expect(stato('?vista=mappa').vista).toBe('luogo');
    expect(stato('').vista).toBe('luogo');
  });
  it('takes a year outside the limits to the nearest limit', () => {
    expect(stato('?fino=1912').fino).toBe(1934);
    expect(stato('?fino=2030').fino).toBe(1994);
  });
  it('ignores values that are not valid', () => {
    expect(stato('?fino=abc&comune=roma&materiale=oro')).toEqual({
      fino: 1994,
      comune: undefined,
      materiale: undefined,
      vista: 'luogo',
    });
    expect(stato('?fino=1975.5').fino).toBe(1994);
    expect(stato('?fino=').fino).toBe(1994);
    expect(stato('').fino).toBe(1994);
  });
  it('writes only what differs from the default and reads it back', () => {
    expect(scriviStato(stato(''), LIMITI)).toBe('');
    const s = stato('?fino=1975&comune=offida&materiale=non-indicato');
    expect(scriviStato(s, LIMITI)).toBe('?fino=1975&comune=offida&materiale=non-indicato');
    expect(stato(scriviStato(s, LIMITI))).toEqual(s);
  });
  it('writes the view only when it is not the default, and reads it back', () => {
    expect(scriviStato(stato('?vista=luogo'), LIMITI)).toBe('');
    const s = stato('?fino=1975&vista=tabella');
    expect(scriviStato(s, LIMITI)).toBe('?fino=1975&vista=tabella');
    expect(stato(scriviStato(s, LIMITI))).toEqual(s);
  });
});

describe('marks of the slider', () => {
  it('has one mark per decade inside the limits', () => {
    expect(tacche({ min: 1934, max: 1994 })).toEqual([1940, 1950, 1960, 1970, 1980, 1990]);
    expect(tacche({ min: 1940, max: 1950 })).toEqual([1940, 1950]);
    expect(tacche({ min: 1951, max: 1958 })).toEqual([]);
  });
});

describe('the view by decade', () => {
  it('groups by decade, oldest first, ordered by year inside, with the works of no certain year last', () => {
    const gruppi = raggruppaPerDecennio([
      opera('x', { anno: undefined, certa: false }),
      opera('b', { anno: 1967 }),
      opera('a', { anno: 1934 }),
      opera('c', { anno: 1962 }),
      opera('d', { anno: 1999 }),
    ]);
    expect(gruppi.map((g) => g.decennio)).toEqual([1930, 1960, 1990, undefined]);
    expect(gruppi[1]!.opere.map((o) => o.id)).toEqual(['c', 'b']);
    expect(gruppi[3]!.opere.map((o) => o.id)).toEqual(['x']);
  });
  it('is empty with no works', () => {
    expect(raggruppaPerDecennio([])).toEqual([]);
  });
});

describe('the table', () => {
  const T = [
    opera('b', { titolo: 'Bruno', anno: 1980, comuneNome: 'Teramo', materiali: ['marmo'] }),
    opera('a', { titolo: 'Ágata', anno: 1960, comuneNome: 'Offida', materiali: [] }),
    opera('c', { titolo: 'Carlo', anno: undefined, certa: false, comuneNome: 'Fermo' }),
    opera('d', { titolo: 'Dino', anno: 1960, comuneNome: 'Ascoli', materiali: ['bronzo'] }),
  ];
  const ids = (l: { id: string }[]) => l.map((o) => o.id).join('');
  it('sorts by year both ways, the work with no year last, ties by title', () => {
    expect(ids(ordinaTabella(T, 'anno', 'asc'))).toBe('adbc');
    expect(ids(ordinaTabella(T, 'anno', 'desc'))).toBe('badc');
  });
  it('sorts text in Italian order (accents do not break it) and the empty material last', () => {
    expect(ids(ordinaTabella(T, 'titolo', 'asc'))).toBe('abcd');
    expect(ids(ordinaTabella(T, 'titolo', 'desc'))).toBe('dcba');
    expect(ids(ordinaTabella(T, 'comune', 'asc'))).toBe('dcab');
    expect(ids(ordinaTabella(T, 'materiale', 'asc'))).toBe('cdba');
    expect(ids(ordinaTabella(T, 'materiale', 'desc'))).toBe('bcda');
  });
  it('does not change the list it is given', () => {
    const copia = [...T];
    ordinaTabella(T, 'titolo', 'desc');
    expect(T).toEqual(copia);
  });
});

describe('the stops of the animation', () => {
  const DATI = [1934, 1951, 1952, 1952, 1955, 1967, 1967, 1967].map((anno, i) =>
    opera(`o${i}`, { anno }),
  );
  const piano = fermate([...DATI, opera('senza', { anno: undefined, certa: false })]);
  it('stops only on years with works, and the work with no year adds no stop', () => {
    expect(piano.map((f) => f.anno)).toEqual([1934, 1951, 1952, 1955, 1967]);
    expect(piano.map((f) => f.nuove)).toEqual([1, 1, 2, 1, 3]);
  });
  it('is longer for two works in the year and after the long jump, and names the jump', () => {
    expect(piano.map((f) => f.durata)).toEqual([800, 1400, 1200, 800, 1800]);
    expect(piano.map((f) => f.salto)).toEqual([undefined, 17, undefined, undefined, 12]);
  });
  it('gives the next stop after a year, also from a year with no stop, and nothing at the end', () => {
    expect(prossimaFermata(piano, 1934)?.anno).toBe(1951);
    expect(prossimaFermata(piano, 1940)?.anno).toBe(1951);
    expect(prossimaFermata(piano, 1967)).toBeUndefined();
  });
  it('has no stops with no works', () => {
    expect(fermate([])).toEqual([]);
  });
});

describe('filters', () => {
  const ids = (s: string) => filtra(OPERE, stato(s)).map((o) => o.id);
  it('by year: up to the year included', () => {
    expect(ids('?fino=1975')).toEqual(['a', 'b', 'd']);
    expect(ids('?fino=1974')).toEqual(['a', 'd']);
  });
  it('a work with no certain year is always shown, but not counted', () => {
    expect(ids('?fino=1934')).toEqual(['a', 'd']);
    expect(conta(OPERE, stato('?fino=1975'))).toEqual({ visibili: 2, totale: 3 });
  });
  it('by town', () => {
    expect(ids('?comune=offida')).toEqual(['b', 'd']);
  });
  it('by material, including the works with no material', () => {
    expect(ids('?materiale=marmo')).toEqual(['a', 'b']);
    expect(ids(`?materiale=${MATERIALE_NON_INDICATO}`)).toEqual(['c']);
  });
  it('filters combine', () => {
    expect(ids('?fino=1975&comune=offida&materiale=bronzo')).toEqual(['b']);
  });
});

describe('places and distance', () => {
  it('groups the works by place: one marker per place', () => {
    const due = [opera('x', { luogoId: 'chiesa' }), opera('y', { luogoId: 'chiesa' }), opera('z')];
    const gruppi = raggruppaPerLuogo(due);
    expect(gruppi.map((g) => [g.luogoId, g.opere.map((o) => o.id)])).toEqual([
      ['chiesa', ['x', 'y']],
      ['luogo-z', ['z']],
    ]);
  });
  it('orders by distance and keeps the order of equal distances', () => {
    const opere = [
      opera('lontana', { lat: 42.35, lon: 13.4 }),
      opera('vicina', { lat: 42.86, lon: 13.58 }),
      opera('pari', { lat: 42.86, lon: 13.58 }),
    ];
    const ordinate = ordinaPerDistanza(opere, { lat: 42.85, lon: 13.57 });
    expect(ordinate.map((o) => o.id)).toEqual(['vicina', 'pari', 'lontana']);
    expect(ordinate[0]!.km).toBeLessThan(2);
    expect(ordinate[2]!.km).toBeGreaterThan(50);
  });
  it('formats the distance in Italian', () => {
    expect(formattaKm(0.44)).toBe('0,4 km');
    expect(formattaKm(23.4)).toBe('23 km');
  });
});

describe('names and tiles', () => {
  it('makes a slug from a town', () => {
    expect(slugComune('San Benedetto del Tronto')).toBe('san-benedetto-del-tronto');
    expect(slugComune('Civitella del Tronto')).toBe('civitella-del-tronto');
  });
  it('reads the tile address and the attribution from the registry, with an override for tests', () => {
    expect(tileMappa().urlTemplate).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(tileMappa().attribuzione).toContain('OpenStreetMap');
    expect(tileMappa('/__tiles/{z}/{x}/{y}.png').urlTemplate).toBe('/__tiles/{z}/{x}/{y}.png');
  });
});
