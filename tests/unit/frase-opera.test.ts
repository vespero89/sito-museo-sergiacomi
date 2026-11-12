import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { leggiContenuti, type Problema } from '../../src/lib/controllo-contenuti.ts';
import {
  elencoItaliano,
  FRASE_MAX,
  FRASE_MIN,
  fraseOpera,
  type DatiFrase,
} from '../../src/lib/frase-opera.ts';

const RADICE = join(import.meta.dirname, '..', '..');
const contenuti = leggiContenuti(RADICE, [] as Problema[]);
const luoghi = new Map(
  contenuti.luoghi.map((v) => [v.id, v.dati as { nome: string; comune: string }]),
);

interface OperaGrezza {
  titolo: string;
  anno?: number;
  materiali: string[];
  luogo: string;
  daConfermare?: { campo: string }[];
  frase?: string;
}
const opere = contenuti.opere.map((v) => ({ id: v.id, dati: v.dati as OperaGrezza }));

const datiFrase = (o: OperaGrezza): DatiFrase => ({
  titolo: o.titolo,
  autore: 'Aldo Sergiacomi',
  anno: o.anno,
  materiali: o.materiali ?? [],
  daConfermare: o.daConfermare ?? [],
  luogo: luoghi.get(o.luogo)!.nome,
  comune: luoghi.get(o.luogo)!.comune,
  frase: o.frase,
});

const base: DatiFrase = {
  titolo: 'Portale del Duomo di Fermo',
  autore: 'Aldo Sergiacomi',
  anno: 1980,
  materiali: ['bronzo'],
  daConfermare: [],
  luogo: 'Duomo di Fermo',
  comune: 'Fermo',
};

describe('fraseOpera on the real works', () => {
  it('has the 27 works', () => {
    expect(opere).toHaveLength(27);
  });

  it.each(opere.map((o) => [o.id, o.dati] as const))(
    '%s: a sentence of 70 to 160 characters with no gaps',
    (_id, dati) => {
      const frase = fraseOpera(datiFrase(dati));
      expect(frase.length).toBeGreaterThanOrEqual(FRASE_MIN);
      expect(frase.length).toBeLessThanOrEqual(FRASE_MAX);
      expect(frase).not.toMatch(/undefined|null|NaN|\[\[|\s{2}|\(\)|,\s*\./);
      expect(frase).toContain('Aldo Sergiacomi');
      expect(frase).toContain(luoghi.get(dati.luogo)!.comune);
    },
  );

  it('leaves out the year of the Stemmi, which is doubtful', () => {
    const stemmi = opere.find((o) => o.id === 'stemmi-palazzo-comunale-offida')!;
    expect(fraseOpera(datiFrase(stemmi.dati))).not.toMatch(/\d{4}/);
  });

  it('names no material for the works that have none', () => {
    const senza = opere.filter((o) => o.dati.materiali.length === 0);
    expect(senza.length).toBeGreaterThan(0);
    for (const o of senza) expect(fraseOpera(datiFrase(o.dati))).not.toMatch(/ in /);
  });
});

describe('fraseOpera', () => {
  it('writes the example of the spec', () => {
    expect(fraseOpera(base)).toBe(
      'Portale del Duomo di Fermo: opera in bronzo dello scultore Aldo Sergiacomi, 1980. Si trova a Fermo.',
    );
  });

  it('adds the place when the title does not name it', () => {
    const frase = fraseOpera({
      ...base,
      titolo: 'Il trionfo di Bacco e Arianna',
      materiali: ['stucco'],
      luogo: 'Pasticceria Giammarini',
      comune: 'San Benedetto del Tronto',
    });
    expect(frase).toContain('Si trova a San Benedetto del Tronto (Pasticceria Giammarini).');
  });

  it('says "ad" before a town that starts with A, and keeps brackets out of brackets', () => {
    const frase = fraseOpera({
      ...base,
      titolo: 'Reliquiario a forma di braccio benedicente',
      luogo: 'Chiesa di S. Agostino (Santuario Eucaristico)',
      comune: 'Ascoli Piceno',
    });
    expect(frase).toContain('Si trova ad Ascoli Piceno (Chiesa di S. Agostino).');
  });

  it('does not use a year or a material that is to be confirmed', () => {
    const frase = fraseOpera({
      ...base,
      daConfermare: [{ campo: 'anno' }, { campo: 'materiali' }],
    });
    expect(frase).not.toMatch(/1980|bronzo/);
  });

  it('drops the place, then "dello scultore", when the sentence is too long', () => {
    const lungo = {
      ...base,
      titolo: 'Portale centrale e portali laterali della Chiesa del Cuore Immacolato di Maria',
      luogo: 'Una chiesa con un nome molto lungo che non è nel titolo',
      comune: 'Sant’Egidio alla Vibrata',
    };
    const frase = fraseOpera(lungo);
    expect(frase.length).toBeLessThanOrEqual(FRASE_MAX);
    expect(frase).not.toContain('(');
  });

  it('uses the sentence written by hand', () => {
    expect(fraseOpera({ ...base, frase: 'Una frase scritta a mano.' })).toBe(
      'Una frase scritta a mano.',
    );
  });

  it('lists materials in Italian', () => {
    expect(elencoItaliano(['bronzo'])).toBe('bronzo');
    expect(elencoItaliano(['bronzo', 'travertino'])).toBe('bronzo e travertino');
    expect(elencoItaliano(['marmo', 'pietra', 'stucco'])).toBe('marmo, pietra e stucco');
  });
});
