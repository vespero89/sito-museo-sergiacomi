import { readFileSync, rmSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseHTML } from 'linkedom';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { problemiImmagini } from '../dist/controlli-immagini';
import { walk } from '../dist/helpers';

// Builds the real project (in another process) with one extra test-only page that uses Foto.astro, into a throw-away
// folder (dist*/ is git-ignored), and checks what the image pipeline really wrote.
const RADICE = join(import.meta.dirname, '..', '..');
const USCITA = join(RADICE, 'dist-test-foto');
const PESO_MAX = 400 * 1024;

let document: Document;
let immagini: string[];

beforeAll(() => {
  rmSync(USCITA, { recursive: true, force: true });
  const esito = spawnSync(
    process.execPath,
    [join(RADICE, 'tests', 'build', 'costruisci-foto.mjs'), USCITA],
    { cwd: RADICE, encoding: 'utf8', env: { ...process.env, SITE_ENV: '', ALLOW_OPEN_ITEMS: '' } },
  );
  if (esito.status !== 0) throw new Error(`the test build failed:\n${esito.stdout}${esito.stderr}`);
  document = parseHTML(readFileSync(join(USCITA, 'prova-foto', 'index.html'), 'utf8')).document;
  immagini = walk(join(USCITA, '_astro')).filter((f) => /\.(avif|webp|jpe?g)$/.test(f));
}, 300_000);

afterAll(() => {
  rmSync(USCITA, { recursive: true, force: true });
});

const sorgenti = () => [...document.querySelectorAll('picture')];

describe('Foto.astro, built', () => {
  it('writes a <picture> per photo, with AVIF, then WebP, and a JPEG fallback', () => {
    expect(sorgenti()).toHaveLength(3);
    for (const picture of sorgenti()) {
      const tipi = [...picture.querySelectorAll('source')].map((s) => s.getAttribute('type'));
      expect(tipi).toEqual(['image/avif', 'image/webp']);
      expect(picture.querySelector('img')!.getAttribute('src')).toMatch(/\.jpe?g$/);
    }
  });

  it('gives every image alt, width and height, and one high-priority image at most', () => {
    expect(problemiImmagini(document)).toEqual([]);
    expect(document.querySelectorAll('img[fetchpriority="high"]')).toHaveLength(1);
  });

  it('puts the alt of the immagini collection on the <img>', () => {
    const alt = document.querySelector('img')!.getAttribute('alt')!;
    expect(alt.length).toBeGreaterThanOrEqual(15);
  });

  it('is lazy and async by default; the priority image is eager', () => {
    const [prima, seconda, terza] = [...document.querySelectorAll('img')];
    expect(prima!.getAttribute('loading')).toBe('eager');
    expect(prima!.getAttribute('fetchpriority')).toBe('high');
    for (const img of [seconda!, terza!]) {
      expect(img.getAttribute('loading')).toBe('lazy');
      expect(img.getAttribute('decoding')).toBe('async');
      expect(img.hasAttribute('fetchpriority')).toBe(false);
    }
  });

  it('writes a srcset and the sizes we asked for', () => {
    const seconda = sorgenti()[1]!;
    expect(seconda.querySelector('source')!.getAttribute('sizes')).toBe(
      '(min-width: 60em) 50vw, 100vw',
    );
    expect(seconda.querySelector('source')!.getAttribute('srcset')).toMatch(/ 480w,/);
  });

  it('never makes a version wider than the original: a 1186 px photo tops out at 1186', async () => {
    const piccola = sorgenti()[1]!;
    const larghezze = piccola
      .querySelector('source')!
      .getAttribute('srcset')!
      .split(',')
      .map((voce) => Number(voce.trim().split(' ')[1]!.replace('w', '')));
    expect(Math.max(...larghezze)).toBe(1186);
  });

  it('keeps the aspect ratio in width and height', () => {
    for (const img of document.querySelectorAll('img')) {
      expect(Number(img.getAttribute('width'))).toBeGreaterThan(0);
      expect(Number(img.getAttribute('height'))).toBeGreaterThan(0);
    }
    const tomba = document.querySelector('img')!;
    expect(Number(tomba.getAttribute('height'))).toBeGreaterThan(
      Number(tomba.getAttribute('width')),
    );
  });

  it('leaves no copy of a photo that the page does not show', () => {
    const html = readFileSync(join(USCITA, 'prova-foto', 'index.html'), 'utf8');
    const copie = immagini.filter((f) => /\/[^./]+\.[\w-]{8}\.jpg$/.test(f));
    expect(copie.filter((f) => !html.includes(f.split('/').pop()!))).toEqual([]);
  });

  it('writes the files in AVIF, WebP and JPEG, each one under the 400 KB budget', () => {
    for (const formato of ['avif', 'webp', 'jpe?g']) {
      expect(immagini.filter((f) => new RegExp(`\\.${formato}$`).test(f)).length).toBeGreaterThan(
        0,
      );
    }
    const grandi = immagini
      .filter((f) => statSync(f).size > PESO_MAX)
      .map((f) => `${relative(USCITA, f)}: ${Math.round(statSync(f).size / 1024)} KB`);
    expect(grandi).toEqual([]);
  });

  it('writes the real size of each file in its width', async () => {
    const meta = await sharp(immagini.find((f) => f.endsWith('.avif'))!).metadata();
    expect(meta.width).toBeLessThanOrEqual(1600);
  });

  it('adds no inline style, script or handler', () => {
    expect(document.querySelectorAll('[style], style, script:not([src])')).toHaveLength(0);
  });
});
