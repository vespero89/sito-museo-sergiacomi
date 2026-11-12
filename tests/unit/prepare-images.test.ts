import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';
import { preparaTutte } from '../../scripts/prepare-images.mjs';
import { TABELLA } from '../../scripts/immagini-tabella.mjs';

const cartelle: string[] = [];
const cartellaTemporanea = () => {
  const c = mkdtempSync(join(tmpdir(), 'prepare-images-'));
  cartelle.push(c);
  return c;
};
afterEach(() => {
  for (const c of cartelle.splice(0)) rmSync(c, { recursive: true, force: true });
});

/** A folder of "originals" with every file of the table, as small PNG or JPEG images. */
async function originaliFinti(): Promise<string> {
  const base = cartellaTemporanea();
  for (const { originale } of TABELLA as { originale: string }[]) {
    const percorso = join(base, originale);
    mkdirSync(dirname(percorso), { recursive: true });
    const immagine = sharp({
      create: { width: 300, height: 200, channels: 3, background: { r: 90, g: 80, b: 70 } },
    });
    await (originale.endsWith('.png') ? immagine.png() : immagine.jpeg()).toFile(percorso);
  }
  return base;
}

describe('preparaTutte', () => {
  it('writes one master for each row of the table, with the new name', async () => {
    const destinazione = join(cartellaTemporanea(), 'foto');
    const esito = await preparaTutte(await originaliFinti(), destinazione);
    expect(esito.fatte).toBe(TABELLA.length);
    expect(readdirSync(destinazione).sort()).toEqual(
      (TABELLA as { nuovo: string }[]).map((r) => r.nuovo).sort(),
    );
  });

  it('can be run again: the masters are overwritten, not duplicated', async () => {
    const originali = await originaliFinti();
    const destinazione = join(cartellaTemporanea(), 'foto');
    await preparaTutte(originali, destinazione);
    await preparaTutte(originali, destinazione);
    expect(readdirSync(destinazione)).toHaveLength(TABELLA.length);
  });

  it('stops with a clear message when the folder of the originals is missing', async () => {
    await expect(preparaTutte('/does/not/exist', cartellaTemporanea())).rejects.toThrow(
      /materiali/,
    );
  });

  it('lists the originals that are missing and writes nothing', async () => {
    const originali = await originaliFinti();
    rmSync(join(originali, (TABELLA as { originale: string }[])[0]!.originale));
    const destinazione = join(cartellaTemporanea(), 'foto');
    await expect(preparaTutte(originali, destinazione)).rejects.toThrow(/Le Merlettaie - Aldo/);
    expect(existsSync(destinazione)).toBe(false);
  });
});
