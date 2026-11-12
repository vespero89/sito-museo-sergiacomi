import { parseHTML } from 'linkedom';
import { describe, expect, it } from 'vitest';
import { problemiImmagini } from './controlli-immagini';
import { builtPages } from './helpers';

const pagina = (html: string) => parseHTML(`<!doctype html><html><body>${html}</body></html>`).document;

describe('problemiImmagini (the check applied to every built page)', () => {
  it('passes an image with alt, width and height', () => {
    expect(problemiImmagini(pagina('<img src="/a.jpg" alt="Una statua" width="10" height="8">'))).toEqual([]);
  });

  it('accepts an empty alt, which is how a decorative image is marked', () => {
    expect(problemiImmagini(pagina('<img src="/a.jpg" alt="" width="10" height="8">'))).toEqual([]);
  });

  it('fails on an <img> without alt', () => {
    const problemi = problemiImmagini(pagina('<img src="/a.jpg" width="10" height="8">'));
    expect(problemi).toHaveLength(1);
    expect(problemi[0]).toContain('without alt');
    expect(problemi[0]).toContain('/a.jpg');
  });

  it('fails on an <img> without width or height (the layout would jump)', () => {
    expect(problemiImmagini(pagina('<img src="/a.jpg" alt="x" width="10">'))).toHaveLength(1);
    expect(problemiImmagini(pagina('<img src="/a.jpg" alt="x" height="10">'))).toHaveLength(1);
  });

  it('fails when two images ask for high priority', () => {
    const html =
      '<img src="/a.jpg" alt="x" width="1" height="1" fetchpriority="high">' +
      '<img src="/b.jpg" alt="x" width="1" height="1" fetchpriority="high">';
    expect(problemiImmagini(pagina(html))[0]).toContain('only one per page');
  });
});

describe('images in the built pages', () => {
  it.each(builtPages().map((p) => [p.path, p.document] as const))(
    '%s: every <img> has alt, width and height, one high priority at most',
    (_percorso, document) => {
      expect(problemiImmagini(document)).toEqual([]);
    },
  );
});
