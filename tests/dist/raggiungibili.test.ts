import { describe, expect, it } from 'vitest';
import { builtPages } from './helpers';

// Every built page can be reached from the home page by following internal links: a page with no
// way in (the environments under /il-museo/ for one) would be lost to visitors and to search.
describe('every built page is reachable from the home page', () => {
  const pagine = builtPages().filter((p) => p.path !== '404.html');
  const indirizzo = (percorso: string) => `/${percorso.replace(/index\.html$/, '')}`;
  const collegamenti = new Map(
    pagine.map((p) => [
      indirizzo(p.path),
      [...p.document.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute('href')!.replace(/[#?].*$/, '')),
    ]),
  );

  it('reaches all of them', () => {
    const viste = new Set<string>(['/']);
    const coda = ['/'];
    while (coda.length) {
      for (const verso of collegamenti.get(coda.shift()!) ?? []) {
        if (!viste.has(verso)) {
          viste.add(verso);
          coda.push(verso);
        }
      }
    }
    expect([...collegamenti.keys()].filter((i) => !viste.has(i))).toEqual([]);
  });
});
