import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { intestazioniPer, leggiHeaders } from '../../config/hosting.mjs';
import { DIST, builtPages } from './helpers.ts';

describe('search index (Pagefind) and search page', () => {
  const pagine = builtPages();
  const indicizzate = pagine.filter((p) => p.document.querySelector('[data-pagefind-body]'));

  it('the index is built in dist/pagefind/', () => {
    expect(existsSync(join(DIST, 'pagefind', 'pagefind.js'))).toBe(true);
    expect(existsSync(join(DIST, 'pagefind', 'pagefind-entry.json'))).toBe(true);
  });

  it('indexes only the main content: the body marker is on <main>, once per page', () => {
    expect(indicizzate.length).toBeGreaterThan(20);
    for (const { path, document } of indicizzate) {
      const marcati = document.querySelectorAll('[data-pagefind-body]');
      expect(marcati, path).toHaveLength(1);
      expect(marcati[0]!.tagName, path).toBe('MAIN');
      // The menu, the footer and the action bar sit outside <main>, so outside the index.
      for (const fuori of document.querySelectorAll('header, footer, nav[popover]')) {
        expect(marcati[0]!.contains(fuori), path).toBe(false);
      }
      for (const nav of marcati[0]!.querySelectorAll('nav')) {
        expect(nav.hasAttribute('data-pagefind-ignore'), path).toBe(true);
      }
    }
  });

  it('keeps the search page and the 404 out of the index', () => {
    const fuori = pagine.filter((p) => !indicizzate.includes(p)).map((p) => p.path);
    expect(fuori).toContain(join('ricerca', 'index.html'));
    expect(fuori).toContain('404.html');
  });

  it('the search page has a labelled field and explains the alternative without JavaScript', () => {
    const { document } = pagine.find((p) => p.path === join('ricerca', 'index.html'))!;
    const campo = document.querySelector('input[type="search"]')!;
    expect(document.querySelector(`label[for="${campo.id}"]`)).not.toBeNull();
    expect(document.querySelector('[data-senza-js]')?.textContent).toContain('JavaScript');
    expect(document.querySelectorAll('[data-sezioni] a').length).toBeGreaterThan(3);
  });

  it('the generated _headers give /pagefind/ no long cache, and the CSP allows wasm', () => {
    const regole = leggiHeaders(readFileSync(join(DIST, '_headers'), 'utf8'));
    const cache = intestazioniPer(regole, '/pagefind/pagefind.wasm')['Cache-Control']!;
    expect(cache).toBe('public, max-age=0, must-revalidate');
    expect(cache).not.toContain('immutable');
    expect(intestazioniPer(regole, '/ricerca/')['Content-Security-Policy']).toContain(
      "script-src 'self' 'wasm-unsafe-eval'",
    );
  });
});
