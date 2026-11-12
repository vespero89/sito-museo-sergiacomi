import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { creaHosting, renderHeaders, renderRedirects } from '../../config/hosting.mjs';
import { emettiHosting } from '../../scripts/emit-hosting.mjs';

const RADICE = join(import.meta.dirname, '..', '..');
const cartelle: string[] = [];

function distVuota() {
  const dist = mkdtempSync(join(tmpdir(), 'emit-hosting-'));
  cartelle.push(dist);
  return dist;
}

afterEach(() => {
  for (const c of cartelle.splice(0)) rmSync(c, { recursive: true, force: true });
});

describe('emettiHosting', () => {
  it('writes _headers and _redirects exactly as the single source renders them', () => {
    const dist = distVuota();
    emettiHosting(dist, {});
    const { modalita, intestazioni, redirect } = creaHosting({}, { https: true });
    expect(readFileSync(join(dist, '_headers'), 'utf8')).toBe(
      renderHeaders(intestazioni, modalita),
    );
    expect(readFileSync(join(dist, '_redirects'), 'utf8')).toBe(
      renderRedirects(redirect, modalita),
    );
  });

  it('writes the production rules when SITE_ENV=production (HSTS on, no noindex)', () => {
    const dist = distVuota();
    emettiHosting(dist, { SITE_ENV: 'production' });
    const testo = readFileSync(join(dist, '_headers'), 'utf8');
    expect(testo).toContain('Strict-Transport-Security');
    expect(testo).not.toContain('X-Robots-Tag');
  });

  it('writes the preview rules by default (noindex, no HSTS)', () => {
    const dist = distVuota();
    emettiHosting(dist, {});
    const testo = readFileSync(join(dist, '_headers'), 'utf8');
    expect(testo).toContain('X-Robots-Tag: noindex');
    expect(testo).not.toContain('Strict-Transport-Security');
  });

  it('stops when dist/ does not exist instead of creating it', () => {
    const dist = join(distVuota(), 'missing');
    expect(() => emettiHosting(dist, {})).toThrow(/not found/);
    expect(existsSync(dist)).toBe(false);
  });

  it('works as a command: node scripts/emit-hosting.mjs <dist>', () => {
    const dist = distVuota();
    mkdirSync(join(dist, 'x'));
    const r = spawnSync('node', ['scripts/emit-hosting.mjs', dist], {
      cwd: RADICE,
      encoding: 'utf8',
      env: { ...process.env, SITE_ENV: '', ALLOW_OPEN_ITEMS: '' },
    });
    expect(r.status).toBe(0);
    expect(existsSync(join(dist, '_headers'))).toBe(true);
    expect(existsSync(join(dist, '_redirects'))).toBe(true);
  });
});
