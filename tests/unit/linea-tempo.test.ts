import { describe, expect, it } from 'vitest';
import { LIMITI_OPERE, indirizzoOpere, ordinaVoci } from '../../src/lib/linea-tempo.ts';

const voce = (id: string, anno: number, data?: string) => ({ id, data: { anno, data } });

describe('ordinaVoci', () => {
  it('orders by year, then by date, then by id, without touching the input', () => {
    const entrata = [
      voce('b', 1992, '1992-12-01'),
      voce('z', 1998),
      voce('a', 1992, '1992-07-27'),
      voce('m', 1912),
      voce('c', 1992),
    ];
    const copia = [...entrata];
    expect(ordinaVoci(entrata).map((v) => v.id)).toEqual(['m', 'c', 'a', 'b', 'z']);
    expect(entrata).toEqual(copia);
  });

  it('keeps an empty list empty', () => {
    expect(ordinaVoci([])).toEqual([]);
  });
});

describe('indirizzoOpere', () => {
  it('links the years inside 1934-1994, boundaries included', () => {
    expect(LIMITI_OPERE).toEqual({ da: 1934, a: 1994 });
    expect(indirizzoOpere(1934)).toBe('/opere/?fino=1934');
    expect(indirizzoOpere(1970)).toBe('/opere/?fino=1970');
    expect(indirizzoOpere(1994)).toBe('/opere/?fino=1994');
  });

  it('gives no link outside that range', () => {
    expect(indirizzoOpere(1912)).toBeUndefined();
    expect(indirizzoOpere(1926)).toBeUndefined();
    expect(indirizzoOpere(1933)).toBeUndefined();
    expect(indirizzoOpere(1995)).toBeUndefined();
    expect(indirizzoOpere(1998)).toBeUndefined();
  });
});
