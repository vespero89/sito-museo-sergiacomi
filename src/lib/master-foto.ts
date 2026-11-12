// Turns an original photo into a master for src/assets/foto/ (spec 7): EXIF orientation applied,
// every metadata block removed (GPS position included), sRGB, at most 2400 px on the long side
// (never enlarged), JPEG quality 85 and under 1 MB. Used by `scripts/prepare-images.mjs`.
import sharp from 'sharp';

/** Longest side of a master, in pixels. */
export const LATO_MAX = 2400;
/** Starting JPEG quality. */
export const QUALITA = 85;
/** A master must weigh less than this (bytes): the checks and the tests refuse more. */
export const PESO_MAX = 1_000_000;
/** The quality ladder stops here: below it a photo is too damaged to be useful. */
const QUALITA_MINIMA = 60;

/** A light correction for a photo that was taken badly (for example a dark phone photo). */
export interface CorrezioneFoto {
  /** Multiplier of the brightness: 1 leaves the photo as it is, 1.3 is a light brightening. */
  luminosita?: number;
}

export interface OpzioniMaster {
  latoMax?: number;
  qualita?: number;
  pesoMax?: number;
  correzione?: CorrezioneFoto;
}

export interface Master {
  buffer: Buffer;
  width: number;
  height: number;
  /** The JPEG quality that made the file fit under the weight limit. */
  qualita: number;
}

/** Reads `entrata` (a file path or the bytes of an image) and returns the master JPEG. */
export async function preparaMaster(
  entrata: Buffer | string,
  { latoMax = LATO_MAX, qualita = QUALITA, pesoMax = PESO_MAX, correzione }: OpzioniMaster = {},
): Promise<Master> {
  for (let q = qualita; q >= QUALITA_MINIMA; q -= 5) {
    let immagine = sharp(entrata)
      .rotate() // applies the EXIF orientation, then forgets it
      .flatten({ background: '#ffffff' }) // a transparent PNG would turn black in a JPEG
      .resize({ width: latoMax, height: latoMax, fit: 'inside', withoutEnlargement: true });
    if (correzione?.luminosita) immagine = immagine.modulate({ brightness: correzione.luminosita });
    // No `withMetadata`: sharp drops EXIF, XMP, IPTC and the ICC profile (after converting to sRGB).
    const { data, info } = await immagine
      .toColourspace('srgb')
      .jpeg({ quality: q, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    if (data.length <= pesoMax) {
      return { buffer: data, width: info.width, height: info.height, qualita: q };
    }
  }
  throw new Error(`the photo does not fit in ${pesoMax} bytes even at quality ${QUALITA_MINIMA}`);
}
