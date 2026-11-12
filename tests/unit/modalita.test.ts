import { describe, expect, it } from 'vitest';
import { decidiModalita } from '../../src/lib/modalita.ts';

const ANTEPRIMA = {
  anteprima: true,
  noindex: true,
  sitemap: false,
  llmsTxt: false,
  bloccaAperti: false,
};

describe('decidiModalita', () => {
  it('is a preview when nothing is set', () => {
    expect(decidiModalita({})).toEqual(ANTEPRIMA);
  });

  it('is a preview with SITE_ENV=preview, with or without ALLOW_OPEN_ITEMS', () => {
    expect(decidiModalita({ SITE_ENV: 'preview' })).toEqual(ANTEPRIMA);
    expect(decidiModalita({ SITE_ENV: 'preview', ALLOW_OPEN_ITEMS: '1' })).toEqual(ANTEPRIMA);
  });

  it('production is indexable, has sitemap and llms.txt, and blocks open items', () => {
    expect(decidiModalita({ SITE_ENV: 'production' })).toEqual({
      anteprima: false,
      noindex: false,
      sitemap: true,
      llmsTxt: true,
      bloccaAperti: true,
    });
  });

  it('ALLOW_OPEN_ITEMS=1 turns production into a preview: noindex, no sitemap, no llms.txt', () => {
    expect(decidiModalita({ SITE_ENV: 'production', ALLOW_OPEN_ITEMS: '1' })).toEqual(ANTEPRIMA);
  });

  it('ALLOW_OPEN_ITEMS off values keep production strict', () => {
    for (const valore of [undefined, '', '0']) {
      expect(
        decidiModalita({ SITE_ENV: 'production', ALLOW_OPEN_ITEMS: valore }).bloccaAperti,
      ).toBe(true);
    }
  });

  it('refuses values it does not know instead of guessing', () => {
    expect(() => decidiModalita({ SITE_ENV: 'prod' })).toThrow(/SITE_ENV/);
    expect(() => decidiModalita({ SITE_ENV: 'production', ALLOW_OPEN_ITEMS: 'true' })).toThrow(
      /ALLOW_OPEN_ITEMS/,
    );
  });
});
