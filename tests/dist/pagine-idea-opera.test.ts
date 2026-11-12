import { describe, expect, it } from 'vitest';
import { builtPages } from './helpers';

// "Dall'idea all'opera" and the comparison (task 19): the plain, no-JavaScript markup.
const pagine = builtPages();
const documento = (slug: string) =>
  pagine.find((p) => p.path === `opere/${slug}/index.html`)!.document;

describe.each([
  ['le-merlettaie', 4, 9, 'pulsanti'],
  ['il-sogno-del-pescatore', 3, 5, 'cursore'],
])('/opere/%s/', (slug, fasi, foto, modo) => {
  const d = documento(slug);

  it('has the phases in order, each a labelled section with a title, a text and photos with alt', () => {
    const sezioni = [...d.querySelectorAll('[data-fasi] section[aria-labelledby]')];
    expect(sezioni).toHaveLength(fasi);
    for (const s of sezioni) {
      const titolo = d.getElementById(s.getAttribute('aria-labelledby')!);
      expect(titolo!.textContent!.trim().length).toBeGreaterThan(0);
      expect(s.querySelector('.testo')!.textContent!.trim().length).toBeGreaterThan(20);
    }
    const immagini = [...d.querySelectorAll('[data-fasi] section img')];
    expect(immagini).toHaveLength(foto);
    expect(immagini.every((i) => (i.getAttribute('alt') ?? '').length > 10)).toBe(true);
    expect(d.querySelectorAll('[data-fasi] figcaption').length).toBe(foto);
  });

  it('has the stage hidden and aria-hidden until the script shows it, with no aria-live', () => {
    const riquadro = d.querySelector('[data-fasi] [data-riquadro]')!;
    expect(riquadro.hasAttribute('hidden')).toBe(true);
    expect(riquadro.getAttribute('aria-hidden')).toBe('true');
    expect(d.querySelector('[data-fasi] [aria-live]')).toBeNull();
  });

  it('has the comparison with two figures, a description and the right controls', () => {
    const c = d.querySelector('[data-confronto]')!;
    expect(c.getAttribute('data-modo')).toBe(modo);
    expect(c.querySelectorAll('figure img')).toHaveLength(2);
    expect(c.querySelector('.descrizione')!.textContent!.trim().length).toBeGreaterThan(40);
    const comando = c.querySelector(modo === 'cursore' ? 'input[type="range"]' : 'button[aria-pressed]');
    expect(comando).not.toBeNull();
    expect(c.querySelector('[data-controlli]')!.hasAttribute('hidden')).toBe(true);
  });
});

describe('other works', () => {
  it('have neither phases nor comparison', () => {
    const d = documento('la-retara');
    expect(d.querySelector('[data-fasi], [data-confronto]')).toBeNull();
  });
});
