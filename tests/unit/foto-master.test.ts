import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { SCARTATE, TABELLA } from '../../scripts/immagini-tabella.mjs';
import { controllaRepo } from '../../src/lib/controllo-contenuti.ts';
import { creaSchemi } from '../../src/lib/schemi.ts';
import { LATO_MAX, PESO_MAX } from '../../src/lib/master-foto.ts';
import { FOTO_OG_PREDEFINITA } from '../../src/lib/og.ts';
import { parseYaml } from '../../src/lib/yaml.ts';

const RADICE = join(import.meta.dirname, '..', '..');
const CARTELLA = join(RADICE, 'src', 'assets', 'foto');
const masters = readdirSync(CARTELLA).filter((f) => !f.startsWith('.'));
const voci = parseYaml(
  readFileSync(join(RADICE, 'src', 'content', 'immagini', 'it', 'immagini.yaml'), 'utf8'),
) as { id: string; file: string; alt: string; fileOriginale?: string }[];
const schema = creaSchemi().immagini;

describe('the master photos in src/assets/foto', () => {
  it('has the photos of the selection (spec 7)', () => {
    expect(masters.length).toBeGreaterThanOrEqual(30);
  });

  it.each(masters)('%s is a JPEG under 1 MB, at most 2400 px, without metadata', async (nome) => {
    const percorso = join(CARTELLA, nome);
    expect(nome).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*\.jpg$/);
    expect(statSync(percorso).size).toBeLessThanOrEqual(PESO_MAX);
    const meta = await sharp(percorso).metadata();
    expect(meta.format).toBe('jpeg');
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(LATO_MAX);
    expect(meta.exif).toBeUndefined();
    expect(meta.icc).toBeUndefined();
  });

  it('has an entry in immagini.yaml for each master and a master for each entry', () => {
    expect(voci.map((v) => v.file).sort()).toEqual([...masters].sort());
  });

  it('has a valid alt on every entry (15-150 characters, schema of the collection)', () => {
    for (const v of voci) {
      const r = schema.safeParse(v);
      expect(r.success, `${v.id}: ${r.success ? '' : r.error.issues[0]?.message}`).toBe(true);
    }
  });

  it('passes content:check', () => {
    expect(controllaRepo(RADICE).problemi).toEqual([]);
  });

  it('uses as default Open Graph image a photo that exists', () => {
    expect(masters).toContain(FOTO_OG_PREDEFINITA);
  });
});

describe('the original -> master table', () => {
  it('has one row for each master, and a master for each row', () => {
    expect(TABELLA.map((r: { nuovo: string }) => r.nuovo).sort()).toEqual([...masters].sort());
  });

  it('has no repeated original or new name', () => {
    const originali = TABELLA.map((r: { originale: string }) => r.originale);
    expect(new Set(originali).size).toBe(originali.length);
  });

  it('is what immagini.yaml documents as fileOriginale', () => {
    for (const riga of TABELLA as { originale: string; nuovo: string }[]) {
      const voce = voci.find((v) => v.file === riga.nuovo);
      expect(voce?.fileOriginale, riga.nuovo).toBe(`3 - Sito Web/${riga.originale}`);
    }
  });

  it('does not list a discarded original as imported', () => {
    const importati = new Set(TABELLA.map((r: { originale: string }) => r.originale));
    for (const s of SCARTATE as { originale: string; motivo: string }[]) {
      expect(importati.has(s.originale), s.originale).toBe(false);
      expect(s.motivo.length).toBeGreaterThan(0);
    }
  });

  it('only names originals that exist in materiali/ (when it is there)', () => {
    const base = join(RADICE, 'materiali', '3 - Sito Web');
    if (!existsSync(base)) return;
    for (const { originale } of [...TABELLA, ...SCARTATE] as { originale: string }[]) {
      expect(existsSync(join(base, originale)), originale).toBe(true);
    }
  });
});
