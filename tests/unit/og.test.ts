import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { OG_ALTEZZA, OG_LARGHEZZA, OG_PESO_MAX, creaOg, percorsoOg } from '../../src/lib/og.ts';

async function foto(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 90, g: 60, b: 40 } } })
    .jpeg()
    .toBuffer();
}

describe('creaOg', () => {
  it.each([
    ['landscape', 1600, 1066],
    ['portrait', 800, 1200],
    ['small', 600, 400],
    ['very wide', 3000, 500],
  ])('makes a 1200x630 JPEG from a %s photo', async (_nome, larghezza, altezza) => {
    const buffer = await creaOg(await foto(larghezza, altezza));
    const meta = await sharp(buffer).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', OG_LARGHEZZA, OG_ALTEZZA]);
    expect(meta.exif).toBeUndefined();
    expect(buffer.length).toBeLessThanOrEqual(OG_PESO_MAX);
  });

  it('is 1200x630', () => {
    expect([OG_LARGHEZZA, OG_ALTEZZA]).toEqual([1200, 630]);
  });
});

describe('percorsoOg', () => {
  it('gives the path of the image of a photo and the default one', () => {
    expect(percorsoOg('tomba-palmucci-intera')).toBe('/og/tomba-palmucci-intera.jpg');
    expect(percorsoOg()).toBe('/og/predefinita.jpg');
  });
});
