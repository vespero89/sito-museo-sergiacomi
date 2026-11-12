import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { potaOriginali } from '../../src/lib/pota-originali.ts';

const cartelle: string[] = [];
afterEach(() => {
  for (const c of cartelle.splice(0)) rmSync(c, { recursive: true, force: true });
});

/** A fake dist/ with the given files in `_astro` and the given HTML page. */
function dist(file: string[], html: string): string {
  const base = mkdtempSync(join(tmpdir(), 'pota-'));
  cartelle.push(base);
  mkdirSync(join(base, '_astro'));
  for (const f of file) writeFileSync(join(base, '_astro', f), 'x');
  writeFileSync(join(base, 'index.html'), html);
  return base;
}

const MASTER = ['le-merlettaie-monumento-1.jpg', 'via-crucis-1.jpg'];

describe('potaOriginali', () => {
  it('removes the copy of a master photo that no page uses', () => {
    const d = dist(['via-crucis-1.AbCdEf12.jpg'], '<p>nothing</p>');
    expect(potaOriginali(d, MASTER)).toEqual(['_astro/via-crucis-1.AbCdEf12.jpg']);
    expect(existsSync(join(d, '_astro', 'via-crucis-1.AbCdEf12.jpg'))).toBe(false);
  });

  it('keeps a copy that a page uses', () => {
    const d = dist(
      ['le-merlettaie-monumento-1.AbCdEf12.jpg'],
      '<img src="/_astro/le-merlettaie-monumento-1.AbCdEf12.jpg">',
    );
    expect(potaOriginali(d, MASTER)).toEqual([]);
    expect(readdirSync(join(d, '_astro'))).toHaveLength(1);
  });

  it('keeps a copy that only a stylesheet or a script mentions', () => {
    const d = dist(['via-crucis-1.AbCdEf12.jpg'], '<p>x</p>');
    writeFileSync(join(d, '_astro', 'a.css'), 'a{background:url(via-crucis-1.AbCdEf12.jpg)}');
    expect(potaOriginali(d, MASTER)).toEqual([]);
  });

  it('never touches the optimised versions, other files or other photos', () => {
    const file = [
      'via-crucis-1.AbCdEf12_Z1x2y3.jpeg',
      'via-crucis-1.AbCdEf12_Z1x2y3.avif',
      'via-crucis-1.AbCdEf12_Z1x2y3.webp',
      'logo.AbCdEf12.jpg',
      'client.Zz9Yy8Xx.js',
    ];
    const d = dist(file, '<p>x</p>');
    expect(potaOriginali(d, MASTER)).toEqual([]);
    expect(readdirSync(join(d, '_astro')).sort()).toEqual([...file].sort());
  });

  it('does nothing when there is no _astro folder', () => {
    const base = mkdtempSync(join(tmpdir(), 'pota-'));
    cartelle.push(base);
    expect(potaOriginali(base, MASTER)).toEqual([]);
  });
});
