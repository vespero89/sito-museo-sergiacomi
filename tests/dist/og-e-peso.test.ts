import { readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { parseYaml } from '../../src/lib/yaml.ts';
import { DIST, walk } from './helpers';

const PESO_MAX_IMMAGINE = 400 * 1024; // spec 7: no served image file above 400 KB
// Spec 7 says 25 MB. Raised to 32 MB in task 14 (Fabio: build first, optimise later); bring it back to 25 when the photos are optimised.
const PESO_MAX_DIST = 32 * 1024 * 1024;
const ESTENSIONI_IMMAGINE = /\.(jpe?g|png|webp|avif|gif|svg|ico)$/i;

describe('image budget on dist/ (spec 7)', () => {
  const immagini = walk(DIST).filter((f) => ESTENSIONI_IMMAGINE.test(f));

  it('serves no image file above 400 KB', () => {
    const grandi = immagini
      .filter((f) => statSync(f).size > PESO_MAX_IMMAGINE)
      .map((f) => `${relative(DIST, f)}: ${Math.round(statSync(f).size / 1024)} KB`);
    expect(grandi).toEqual([]);
  });

  it('weighs less than 32 MB in total', () => {
    const totale = walk(DIST).reduce((somma, f) => somma + statSync(f).size, 0);
    expect(totale).toBeLessThan(PESO_MAX_DIST);
  });
});

describe('Open Graph images in dist/og', () => {
  const og = walk(join(DIST, 'og')).filter((f) => f.endsWith('.jpg'));

  it('has the default image', () => {
    expect(og.map((f) => relative(DIST, f))).toContain(join('og', 'predefinita.jpg'));
  });

  it('has one image for every photo that is not decorative', () => {
    const voci = parseYaml(
      readFileSync(join(DIST, '..', 'src', 'content', 'immagini', 'it', 'immagini.yaml'), 'utf8'),
    ) as { id: string; decorativa?: boolean }[];
    const attesi = voci.filter((v) => !v.decorativa).map((v) => `og/${v.id}.jpg`);
    expect(og.map((f) => relative(DIST, f)).sort()).toEqual(
      [...attesi, 'og/predefinita.jpg'].sort(),
    );
  });

  it.each(og.map((f) => [relative(DIST, f), f] as const))('%s is 1200x630', async (_nome, file) => {
    const meta = await sharp(file).metadata();
    expect([meta.width, meta.height]).toEqual([1200, 630]);
  });
});
