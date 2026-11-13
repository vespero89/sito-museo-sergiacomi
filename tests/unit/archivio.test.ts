import { describe, expect, it } from 'vitest';
import {
  decennio,
  decenniPresenti,
  leggiStato,
  normalizza,
  passa,
  scriviStato,
  type StatoArchivio,
  type VoceArchivio,
} from '../../src/lib/archivio';

const voce = (tipo: string, data: string, testo: string): VoceArchivio => ({
  tipo,
  decennio: decennio(data),
  testo: normalizza(testo),
});

const VOCI = [
  voce('documento', '1992-07-27', 'Pergamena della Città di Offida'),
  voce('articolo', '1983', 'Articolo sul Maestro Sergiacomi'),
  voce('foto', '1985-05-01', 'Le Merlettaie in cantiere'),
  voce('foto', '', 'Foto senza data'),
];
const TIPI = ['foto', 'lettera', 'articolo', 'documento'];
const DECENNI = ['1980', '1990'];
const vuoto: StatoArchivio = { tipo: undefined, decennio: undefined, q: '' };

describe('normalizza', () => {
  it('drops accents, case and extra spaces', () => {
    expect(normalizza('  Città   di  OFFIDA ')).toBe('citta di offida');
    expect(normalizza('Perché')).toBe('perche');
  });
});

describe('decennio', () => {
  it('gives the decade of a year or a full date', () => {
    expect(decennio('1992-07-27')).toBe('1990');
    expect(decennio('1983')).toBe('1980');
    expect(decennio('2000-01-01')).toBe('2000');
  });
  it('gives an empty text when there is no year', () => {
    expect(decennio('')).toBe('');
    expect(decennio('s.d.')).toBe('');
  });
});

describe('passa', () => {
  const quali = (stato: Partial<StatoArchivio>) =>
    VOCI.filter((v) => passa(v, { ...vuoto, ...stato })).length;
  it('shows everything with no filter', () => expect(quali({})).toBe(4));
  it('filters by type', () => expect(quali({ tipo: 'foto' })).toBe(2));
  it('filters by decade, leaving out items with no year', () => {
    expect(quali({ decennio: '1980' })).toBe(2);
    expect(quali({ decennio: '1990' })).toBe(1);
  });
  it('combines type, decade and words', () => {
    expect(quali({ tipo: 'foto', decennio: '1980' })).toBe(1);
    expect(quali({ tipo: 'articolo', decennio: '1990' })).toBe(0);
  });
  it('finds words without accents or case, in any order', () => {
    expect(quali({ q: 'citta' })).toBe(1);
    expect(quali({ q: 'CITTÀ offida' })).toBe(1);
    expect(quali({ q: 'offida pergamena' })).toBe(1);
    expect(quali({ q: 'merlettaie' })).toBe(1);
  });
  it('finds nothing for a word that is not there, and ignores blank text', () => {
    expect(quali({ q: 'zzz' })).toBe(0);
    expect(quali({ q: '   ' })).toBe(4);
  });
});

describe('state in the address', () => {
  it('reads valid values and ignores the others', () => {
    expect(leggiStato('?tipo=foto&decennio=1980&q=%20merlettaie%20', TIPI, DECENNI)).toEqual({
      tipo: 'foto',
      decennio: '1980',
      q: 'merlettaie',
    });
    expect(leggiStato('?tipo=video&decennio=1700', TIPI, DECENNI)).toEqual(vuoto);
    expect(leggiStato('', TIPI, DECENNI)).toEqual(vuoto);
  });
  it('writes only what is set, and round-trips', () => {
    expect(scriviStato(vuoto)).toBe('');
    const stato = { tipo: 'foto', decennio: '1980', q: 'città di offida' };
    const testo = scriviStato(stato);
    expect(testo).toBe('?tipo=foto&decennio=1980&q=citt%C3%A0+di+offida');
    expect(leggiStato(testo, TIPI, DECENNI)).toEqual(stato);
  });
});

describe('decenniPresenti', () => {
  it('lists the decades once, oldest first', () => {
    expect(decenniPresenti(VOCI)).toEqual(['1980', '1990']);
  });
});
