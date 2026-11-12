import { describe, expect, it } from 'vitest';
import { titoloPagina, urlAssoluto } from '../../src/lib/seo.ts';
import { leggiSito } from '../../src/lib/sito-dati.ts';

describe('titoloPagina', () => {
  it('adds the museum name after the title of the page', () => {
    expect(titoloPagina('Il Museo', 'Museo Aldo Sergiacomi')).toBe(
      'Il Museo | Museo Aldo Sergiacomi',
    );
  });

  it('uses the name alone for the home page', () => {
    expect(titoloPagina(undefined, 'Museo Aldo Sergiacomi')).toBe('Museo Aldo Sergiacomi');
    expect(titoloPagina('Museo Aldo Sergiacomi', 'Museo Aldo Sergiacomi')).toBe(
      'Museo Aldo Sergiacomi',
    );
  });
});

describe('urlAssoluto', () => {
  it('puts a path on the site origin', () => {
    expect(urlAssoluto('/opere/', 'https://esempio.test')).toBe('https://esempio.test/opere/');
    expect(urlAssoluto('/', new URL('https://esempio.test'))).toBe('https://esempio.test/');
  });
});

describe('leggiSito', () => {
  it('reads and validates sito.yaml', () => {
    const sito = leggiSito();
    expect(sito.nome).toBe('Museo Aldo Sergiacomi');
    expect(sito.navigazione.principale).toHaveLength(7);
  });
});
