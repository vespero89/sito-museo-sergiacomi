import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DIST, builtPages, walk } from './helpers';

// Page transitions (task 13, spec 5.9): native CSS, the name of the photo of a work generated
// into a stylesheet because the CSP forbids `style=""`.
const pagine = builtPages();
const slugs = readdirSync(join(DIST, 'opere'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);
const FOGLIO = '/assets/vt-opere.css';
const collegaFoglio = (d: Document) =>
  [...d.querySelectorAll('link[rel="stylesheet"]')].some((l) => l.getAttribute('href') === FOGLIO);

describe('the stylesheet of the names', () => {
  const css = readFileSync(join(DIST, FOGLIO), 'utf8');

  it('has one rule for each of the work pages and only in the no-preference media query', () => {
    expect(css.startsWith('@media (prefers-reduced-motion: no-preference)')).toBe(true);
    for (const slug of slugs) {
      expect(css).toContain(`[data-opera="${slug}"] { view-transition-name: opera-${slug}; }`);
    }
    expect(css.match(/view-transition-name/g)).toHaveLength(slugs.length);
  });
});

describe('the global stylesheet', () => {
  it('turns on the page transitions only without a reduced-motion preference', () => {
    const files = walk(join(DIST, '_astro')).filter((f) => f.endsWith('.css'));
    const css = files.map((f) => readFileSync(f, 'utf8')).join('\n');
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*no-preference\)\s*\{\s*@view-transition\s*\{\s*navigation:\s*auto/,
    );
    // The name is never set outside the media query.
    expect(css).not.toContain('view-transition-name');
  });
});

describe('the pages', () => {
  it('/opere/ has one named card per work, with no duplicated name', () => {
    const d = pagine.find((p) => p.path === 'opere/index.html')!.document;
    expect(collegaFoglio(d)).toBe(true);
    const nomi = [...d.querySelectorAll('[data-opera]')].map((e) => e.getAttribute('data-opera'));
    expect(nomi.sort()).toEqual([...slugs].sort());
    expect(new Set(nomi).size).toBe(nomi.length);
  });

  it('each work page names exactly one element, its own, and the nearby cards have no name', () => {
    for (const slug of slugs) {
      const d = pagine.find((p) => p.path === `opere/${slug}/index.html`)!.document;
      expect(collegaFoglio(d), slug).toBe(true);
      const nomi = [...d.querySelectorAll('[data-opera]')].map((e) => e.getAttribute('data-opera'));
      expect(nomi, slug).toEqual([slug]);
      expect(d.querySelector('h1')!.closest('[data-opera]'), slug).toBeNull();
    }
  });

  it('the other pages do not load the stylesheet nor carry a name', () => {
    for (const p of pagine) {
      if (p.path === 'opere/index.html' || /^opere\/[^/]+\/index\.html$/.test(p.path)) continue;
      expect(collegaFoglio(p.document), p.path).toBe(false);
      expect(p.document.querySelector('[data-opera]'), p.path).toBeNull();
    }
  });
});
