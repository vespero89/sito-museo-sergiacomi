// Open Graph images (spec 6.1, 7): 1200x630 JPEG made from a master photo, one for each photo
// plus a default one, written to dist/og/ by the endpoint src/pages/og/[id].jpg.ts.
import sharp from 'sharp';

export const OG_LARGHEZZA = 1200;
export const OG_ALTEZZA = 630;
/** Social networks skip or crop heavy previews: stay well under 300 KB. */
export const OG_PESO_MAX = 300 * 1024;
/** The master used for pages that have no photo of their own. */
export const FOTO_OG_PREDEFINITA = 'le-merlettaie-monumento-1.jpg';
export const ID_OG_PREDEFINITA = 'predefinita';

/** Path of the Open Graph image of a photo (by its id in `immagini`), or of the default one. */
export const percorsoOg = (id: string = ID_OG_PREDEFINITA) => `/og/${id}.jpg`;

/**
 * Crops the photo to 1200x630, keeping the most interesting part, and saves a JPEG that fits
 * the weight limit. A small photo is enlarged a little: the format asks for exactly this size.
 */
export async function creaOg(entrata: Buffer | string): Promise<Buffer> {
  for (let qualita = 82; qualita >= 50; qualita -= 8) {
    const buffer = await sharp(entrata)
      .rotate()
      .flatten({ background: '#ffffff' })
      .resize(OG_LARGHEZZA, OG_ALTEZZA, { fit: 'cover', position: sharp.strategy.attention })
      .toColourspace('srgb')
      .jpeg({ quality: qualita, mozjpeg: true })
      .toBuffer();
    if (buffer.length <= OG_PESO_MAX) return buffer;
  }
  throw new Error(`the Open Graph image does not fit in ${OG_PESO_MAX} bytes`);
}
