import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MAX_REGOLE_HEADERS,
  creaHosting,
  intestazioniPer,
  leggiHeaders,
  renderHeaders,
  renderRedirects,
} from '../../config/hosting.mjs';
import { DIST } from './helpers.ts';

// `npm run build` runs emit-hosting.mjs after astro build, so dist/ carries the Cloudflare files.
// The build of the prototype is always a preview (spec 6.4).
const { modalita, intestazioni, redirect } = creaHosting({}, { https: true });

describe('hosting files in dist/', () => {
  const headers = readFileSync(join(DIST, '_headers'), 'utf8');
  const redirects = readFileSync(join(DIST, '_redirects'), 'utf8');

  it('are the ones generated from config/hosting.mjs', () => {
    expect(headers).toBe(renderHeaders(intestazioni, modalita));
    expect(redirects).toBe(renderRedirects(redirect, modalita));
  });

  it('give the built pages noindex and no HSTS, and long cache only to /_astro/', () => {
    const regole = leggiHeaders(headers);
    expect(regole.length).toBeLessThanOrEqual(MAX_REGOLE_HEADERS);
    const pagina = intestazioniPer(regole, '/');
    expect(pagina['X-Robots-Tag']).toBe('noindex');
    expect(pagina['Strict-Transport-Security']).toBeUndefined();
    expect(pagina['Cache-Control']).toBeUndefined();
    expect(intestazioniPer(regole, '/_astro/x.js')['Cache-Control']).toContain('immutable');
  });

  it('end every redirect with 301', () => {
    const righe = redirects.split('\n').filter((r) => r !== '' && !r.startsWith('#'));
    expect(righe.length).toBeGreaterThan(0);
    for (const riga of righe) expect(riga).toMatch(/ 301$/);
  });

  it('send every redirect to a page that exists in dist/', () => {
    const righe = redirects.split('\n').filter((r) => r !== '' && !r.startsWith('#'));
    const mancanti = righe
      .map((riga) => riga.split(' ')[1]!)
      .filter((verso) => !existsSync(join(DIST, verso.replace(/#.*$/, ''), 'index.html')));
    expect(mancanti).toEqual([]);
  });
});
