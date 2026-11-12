import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { LATO_MAX, preparaMaster } from '../../src/lib/master-foto.ts';

/** A flat grey JPEG of the given size, optionally with an EXIF block (orientation and GPS). */
async function jpeg(width: number, height: number, exif = false): Promise<Buffer> {
  const base = sharp({
    create: { width, height, channels: 3, background: { r: 120, g: 120, b: 120 } },
  });
  return (
    exif
      ? base
          .withExif({
            IFD0: { Copyright: 'someone' },
            IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '43/1 0/1 0/1' },
          })
          .withMetadata({ orientation: 6 })
      : base
  )
    .jpeg()
    .toBuffer();
}

/** Random noise: it compresses badly, so it forces the quality ladder. */
async function rumore(width: number, height: number): Promise<Buffer> {
  const dati = Buffer.alloc(width * height * 3);
  for (let i = 0; i < dati.length; i++) dati[i] = Math.floor(Math.random() * 256);
  return sharp(dati, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer();
}

describe('preparaMaster', () => {
  it('shrinks a landscape photo to 2400 px on the long side', async () => {
    const m = await preparaMaster(await jpeg(4000, 3000));
    expect([m.width, m.height]).toEqual([LATO_MAX, 1800]);
  });

  it('shrinks a portrait photo to 2400 px on the long side', async () => {
    const m = await preparaMaster(await jpeg(3000, 4000));
    expect([m.width, m.height]).toEqual([1800, LATO_MAX]);
  });

  it('never enlarges a small photo', async () => {
    const m = await preparaMaster(await jpeg(1186, 749));
    expect([m.width, m.height]).toEqual([1186, 749]);
  });

  it('applies the EXIF orientation: a landscape photo tagged "rotate 90" comes out portrait', async () => {
    const m = await preparaMaster(await jpeg(300, 200, true));
    expect([m.width, m.height]).toEqual([200, 300]);
    expect((await sharp(m.buffer).metadata()).orientation).toBeUndefined();
  });

  it('strips every metadata block, GPS position included', async () => {
    const entrata = await jpeg(300, 200, true);
    expect((await sharp(entrata).metadata()).exif).toBeDefined();
    const meta = await sharp((await preparaMaster(entrata)).buffer).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.icc).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
    expect(meta.iptc).toBeUndefined();
  });

  it('writes a JPEG in sRGB, also from a PNG', async () => {
    const meta = await sharp((await preparaMaster(await rumore(64, 64))).buffer).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.space).toBe('srgb');
    expect(meta.channels).toBe(3);
  });

  it('converts a wide-gamut photo to sRGB instead of just dropping its profile', async () => {
    const p3 = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 200, g: 100, b: 50 } },
    })
      .withIccProfile('p3')
      .png()
      .toBuffer();
    const { data } = await sharp((await preparaMaster(p3)).buffer)
      .raw()
      .toBuffer({ resolveWithObject: true });
    // Read as sRGB, the same numbers would be (200, 100, 50): converted, they are not.
    expect([data[0], data[1], data[2]]).not.toEqual([200, 100, 50]);
  });

  it('flattens transparency onto white', async () => {
    const trasparente = await sharp({
      create: { width: 8, height: 8, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();
    const { data } = await sharp((await preparaMaster(trasparente)).buffer)
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect([data[0], data[1], data[2]]).toEqual([255, 255, 255]);
  });

  it('lowers the quality until the file fits under the weight limit', async () => {
    const entrata = await rumore(900, 600);
    const alta = await preparaMaster(entrata, { pesoMax: Infinity });
    const limite = Math.floor(alta.buffer.length * 0.8);
    const m = await preparaMaster(entrata, { pesoMax: limite });
    expect(m.buffer.length).toBeLessThanOrEqual(limite);
    expect(m.qualita).toBeLessThan(alta.qualita);
  });

  it('refuses a photo that cannot fit even at the lowest quality', async () => {
    await expect(preparaMaster(await rumore(400, 400), { pesoMax: 100 })).rejects.toThrow(
      /does not fit/,
    );
  });

  it('brightens a photo when a correction asks for it', async () => {
    const entrata = await jpeg(64, 64);
    const media = async (b: Buffer) => (await sharp(b).stats()).channels[0]!.mean;
    const piu = await preparaMaster(entrata, { correzione: { luminosita: 1.5 } });
    expect(await media(piu.buffer)).toBeGreaterThan(
      await media((await preparaMaster(entrata)).buffer),
    );
  });
});
