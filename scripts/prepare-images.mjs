// `npm run images`: regenerates the master photos in src/assets/foto/ from the originals in
// materiali/3 - Sito Web/ (git-excluded), following the table in scripts/immagini-tabella.mjs.
// The masters are versioned; the originals never are (spec 7).
//
// Usage: node scripts/prepare-images.mjs [folder-of-the-originals]
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preparaMaster } from '../src/lib/master-foto.ts';
import { SCARTATE, TABELLA } from './immagini-tabella.mjs';

/**
 * @param {string} originali folder of the originals (materiali/3 - Sito Web)
 * @param {string} destinazione folder of the masters (src/assets/foto)
 * @param {(riga: string) => void} [scrivi] where the progress goes
 */
export async function preparaTutte(originali, destinazione, scrivi = () => {}) {
  if (!existsSync(originali)) {
    throw new Error(`${originali} not found: the originals live in materiali/ (not in git)`);
  }
  const mancanti = TABELLA.filter((r) => !existsSync(join(originali, r.originale)));
  if (mancanti.length > 0) {
    throw new Error(`originals not found:\n  ${mancanti.map((r) => r.originale).join('\n  ')}`);
  }
  mkdirSync(destinazione, { recursive: true });
  let totale = 0;
  for (const riga of TABELLA) {
    const origine = join(originali, riga.originale);
    const m = await preparaMaster(origine, { correzione: riga.correzione });
    writeFileSync(join(destinazione, riga.nuovo), m.buffer);
    totale += m.buffer.length;
    scrivi(
      `${riga.nuovo.padEnd(48)} ${String(m.width).padStart(4)}x${String(m.height).padEnd(4)} ` +
        `q${m.qualita} ${String(Math.round(m.buffer.length / 1024)).padStart(4)} KB ` +
        `(original ${Math.round(statSync(origine).size / 1024)} KB)`,
    );
  }
  for (const s of SCARTATE) scrivi(`skipped: ${s.originale} (${s.motivo})`);
  return { fatte: TABELLA.length, scartate: SCARTATE.length, byte: totale };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const radice = fileURLToPath(new URL('..', import.meta.url));
  const originali = resolve(process.argv[2] ?? join(radice, 'materiali', '3 - Sito Web'));
  const { fatte, scartate, byte } = await preparaTutte(
    originali,
    join(radice, 'src', 'assets', 'foto'),
    console.log,
  );
  console.log(
    `prepare-images: ${fatte} masters, ${Math.round(byte / 1024 / 1024)} MB in total, ${scartate} skipped`,
  );
}
