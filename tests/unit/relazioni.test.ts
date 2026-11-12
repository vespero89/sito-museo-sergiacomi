import { describe, expect, it } from 'vitest';
import {
  contaParole,
  distanzaKm,
  fotoPrincipale,
  opereVicine,
  schedeConPocoTesto,
  SOGLIA_PAROLE_SCHEDA,
} from '../../src/lib/relazioni.ts';

describe('fotoPrincipale', () => {
  it('prefers the finished work, then the first photo, then nothing', () => {
    expect(
      fotoPrincipale([
        { immagine: 'a', ruolo: 'bozzetto' },
        { immagine: 'b', ruolo: 'monumento' },
      ]),
    ).toBe('b');
    expect(fotoPrincipale([{ immagine: 'a', ruolo: 'bozzetto' }])).toBe('a');
    expect(fotoPrincipale([])).toBeUndefined();
  });
});

describe('distanzaKm', () => {
  it('is zero for the same point and about 17 km from Offida to Ascoli', () => {
    const offida = { lat: 42.9391, lon: 13.6937 };
    const ascoli = { lat: 42.8536, lon: 13.5749 };
    expect(distanzaKm(offida, offida)).toBe(0);
    expect(distanzaKm(offida, ascoli)).toBeGreaterThan(12);
    expect(distanzaKm(offida, ascoli)).toBeLessThan(17);
  });
});

describe('opereVicine', () => {
  const opere = [
    { id: 'a', lat: 43, lon: 13 },
    { id: 'lontana', lat: 45, lon: 13 },
    { id: 'stesso-luogo', lat: 43, lon: 13 },
    { id: 'vicina', lat: 43.1, lon: 13 },
  ];

  it('puts the same place first, then by distance, and leaves out the work itself', () => {
    expect(opereVicine('a', opere).map((o) => o.id)).toEqual(['stesso-luogo', 'vicina', 'lontana']);
  });

  it('gives at most the number asked for and refuses an unknown work', () => {
    expect(opereVicine('a', opere, 1)).toHaveLength(1);
    expect(() => opereVicine('manca', opere)).toThrow(/manca/);
  });
});

describe('schedeConPocoTesto', () => {
  it('lists the works under the threshold', () => {
    const parole = (n: number) => Array.from({ length: n }, () => 'parola').join(' ');
    expect(contaParole(' due  parole\n')).toBe(2);
    expect(
      schedeConPocoTesto([
        { id: 'breve', corpo: parole(SOGLIA_PAROLE_SCHEDA - 1) },
        { id: 'giusta', corpo: parole(SOGLIA_PAROLE_SCHEDA) },
        { id: 'vuota', corpo: '' },
      ]),
    ).toEqual(['breve', 'vuota']);
  });
});
