// The master photos as images Astro can optimise. Photos live only in src/assets/foto/ (spec 7):
// nothing goes in public/ without passing through here, except the favicon and the logo.
import type { ImageMetadata } from 'astro';

// Lazy on purpose: an eager glob would copy every master to dist/ even when no page uses it.
const sorgenti = import.meta.glob<ImageMetadata>('../assets/foto/*.jpg', { import: 'default' });

/** The image of a master photo, from its file name in `immagini` (for example `via-crucis-1.jpg`). */
export async function sorgenteFoto(file: string): Promise<ImageMetadata> {
  const carica = sorgenti[`../assets/foto/${file}`];
  if (!carica) throw new Error(`src/assets/foto/${file} not found`);
  return carica();
}
