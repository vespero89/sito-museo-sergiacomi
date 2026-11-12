import { describe, expect, it } from 'vitest';
import { cssTransizioniOpere, nomeTransizioneOpera } from '../../src/lib/transizioni.ts';

describe('nomeTransizioneOpera', () => {
  it('prefixes the slug', () => {
    expect(nomeTransizioneOpera('le-merlettaie')).toBe('opera-le-merlettaie');
  });
  it('rejects a slug that is not a valid name', () => {
    expect(() => nomeTransizioneOpera('Le Merlettaie')).toThrow();
    expect(() => nomeTransizioneOpera('a"]{}')).toThrow();
    expect(() => nomeTransizioneOpera('')).toThrow();
  });
});

describe('cssTransizioniOpere', () => {
  const css = cssTransizioniOpere(['le-merlettaie', 'il-pescatore']);

  it('has one rule per slug, inside the no-preference media query', () => {
    expect(css).toContain('@media (prefers-reduced-motion: no-preference)');
    expect(css).toContain(
      '[data-opera="le-merlettaie"] { view-transition-name: opera-le-merlettaie; }',
    );
    expect(css).toContain(
      '[data-opera="il-pescatore"] { view-transition-name: opera-il-pescatore; }',
    );
    // Every rule is after the opening of the media query.
    const inizio = css.indexOf('@media');
    expect(css.indexOf('[data-opera=')).toBeGreaterThan(inizio);
    expect(css.trim().endsWith('}')).toBe(true);
  });

  it('refuses duplicated slugs, because two equal names cancel the transition', () => {
    expect(() => cssTransizioniOpere(['a', 'a'])).toThrow(/duplicate/i);
  });
});
