// The import of itineraries, events, archive and paths (task 7, spec 3.2, 3.3, 3.4), read from the real
// files of the repo.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { leggiContenuti, type Problema } from '../../src/lib/controllo-contenuti.ts';

const RADICE = join(import.meta.dirname, '..', '..');
const problemi: Problema[] = [];
const contenuti = leggiContenuti(RADICE, problemi);
interface Dati {
  stato: string;
  tipo?: string;
  origine?: string;
  credito?: string;
  file?: string;
  data?: string;
  gruppo?: string;
  tappe?: { tipo: 'opera' | 'luogo'; id: string; gruppo?: string }[];
  voci?: { percorso: string }[];
}
const dati = (voce: { dati: unknown }) => voce.dati as Dati;
const esiste = (collezione: 'opere' | 'luoghi', id: string) =>
  contenuti[collezione].some((v) => v.id === id);

describe('itineraries', () => {
  it('reads without problems', () => {
    expect(problemi).toEqual([]);
  });

  it('has the 4 itineraries of the docx, each stop pointing to an existing work or place', () => {
    expect(contenuti.itinerari).toHaveLength(4);
    for (const it of contenuti.itinerari) {
      expect(dati(it).stato, it.id).toBe('segnaposto');
      for (const t of dati(it).tappe!)
        expect(esiste(t.tipo === 'opera' ? 'opere' : 'luoghi', t.id)).toBe(true);
    }
  });

  it('splits "I portali" in a Marche group and an Abruzzo group', () => {
    const portali = contenuti.itinerari.find((i) => i.id === 'i-portali-del-sergiacomi')!;
    const gruppi = new Set(dati(portali).tappe!.map((t) => t.gruppo));
    expect([...gruppi].sort()).toEqual(['Abruzzo', 'Marche']);
  });

  it('says four itineraries, never three', () => {
    const intro = contenuti.pagine.find((p) => p.id === 'itinerari')!;
    expect(intro.corpo).toMatch(/quattro itinerari/);
  });
});

describe('events', () => {
  it('has the 2012 centenary as a dated event and the initiatives without a date', () => {
    const centenario = contenuti.eventi.find((e) => dati(e).tipo === 'evento')!;
    expect(dati(centenario).data).toBe('2012-07-27');
    const iniziative = contenuti.eventi.filter((e) => dati(e).tipo === 'iniziativa');
    expect(iniziative.length).toBeGreaterThanOrEqual(3);
    for (const e of iniziative) expect(dati(e).data).toBeUndefined();
  });
});

describe('archive', () => {
  it('has the real entries, each with a photo of the scan and an origin', () => {
    expect(contenuti.archivio.length).toBeGreaterThanOrEqual(2);
    for (const a of contenuti.archivio) {
      const d = dati(a);
      expect(d.file, a.id).toBeTruthy();
      expect(['fondazione', 'terzi']).toContain(d.origine);
      if (d.origine === 'terzi') expect(d.credito, a.id).toBeTruthy();
      const foto = contenuti.immagini.find((i) => i.id === d.file)!;
      expect(dati(foto).origine, `${a.id} scan`).toBeTruthy();
      const file = (foto.dati as { file: string }).file;
      expect(existsSync(join(RADICE, 'src/assets/foto', file)), file).toBe(true);
    }
  });

  it('credits the scans of third parties', () => {
    for (const i of contenuti.immagini.filter((i) => i.id.startsWith('archivio-'))) {
      expect(dati(i).origine).toBe('terzi');
      expect(dati(i).credito).toBeTruthy();
    }
  });
});

describe('paths', () => {
  it('has the 4 paths for the audiences, each with internal addresses', () => {
    expect(contenuti.percorsi.map((p) => p.id).sort()).toEqual([
      'con-la-scuola',
      'in-famiglia',
      'in-visita-a-offida',
      'per-studiare-sergiacomi',
    ]);
    for (const p of contenuti.percorsi) {
      expect(dati(p).voci!.length).toBeGreaterThan(0);
      for (const v of dati(p).voci!) expect(v.percorso).toMatch(/^\//);
    }
  });

  it('keeps the old site text of the 2012 events out of private data', () => {
    const testo = readFileSync(join(RADICE, 'src/content/eventi/it/centenario-2012.md'), 'utf8');
    expect(testo).not.toMatch(/Premici/);
  });
});
