import { describe, expect, it } from 'vitest';
import { alternative, percorso, t } from '../../src/i18n/index.ts';

describe('i18n', () => {
  it('reads an interface text from it.json', () => {
    expect(t('salta')).toBe('Vai al contenuto');
  });

  it('leaves the default language without a prefix and prefixes the others', () => {
    expect(percorso('/visita/')).toBe('/visita/');
    expect(percorso('/visita/', 'it')).toBe('/visita/');
    expect(percorso('/visita/', 'en')).toBe('/en/visita/');
    expect(percorso('/')).toBe('/');
    expect(percorso('/', 'en')).toBe('/en/');
  });

  it('refuses an address that is not absolute', () => {
    expect(() => percorso('visita/')).toThrow(/must start with/);
  });

  it('adds no hreflang while only one language is published', () => {
    expect(alternative('/visita/')).toEqual([]);
    expect(alternative('/visita/', ['it'])).toEqual([]);
  });

  it('adds hreflang with x-default when two languages are published', () => {
    expect(alternative('/visita/', ['it', 'en'])).toEqual([
      { hreflang: 'it', percorso: '/visita/' },
      { hreflang: 'en', percorso: '/en/visita/' },
      { hreflang: 'x-default', percorso: '/visita/' },
    ]);
  });
});
