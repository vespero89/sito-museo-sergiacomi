// The import of the texts of the docx (task 6, spec 3.2, 3.3, 3.4): pages, biography, rooms,
// didactics, tools, publications and sito.yaml, read from the real files of the repo.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { leggiContenuti, type Problema } from '../../src/lib/controllo-contenuti.ts';
import { campoSito, sitoSchema } from '../../src/lib/sito.ts';
import { parseYaml } from '../../src/lib/yaml.ts';

const RADICE = join(import.meta.dirname, '..', '..');
const problemi: Problema[] = [];
const contenuti = leggiContenuti(RADICE, problemi);
interface Dati {
  slug: string;
  descrizione: string;
  tipo: string;
  anno: number;
  numero: number;
  stato: string;
  sala?: string;
}
const dati = (voce: { dati: unknown }) => voce.dati as Dati;
const sito = sitoSchema.parse(parseYaml(readFileSync(join(RADICE, 'src/data/sito.yaml'), 'utf8')));

/** Every content file as text, to look for words that must not be there. */
function fileDiContenuto(cartella: string): string[] {
  return readdirSync(cartella).flatMap((nome) => {
    const percorso = join(cartella, nome);
    return statSync(percorso).isDirectory() ? fileDiContenuto(percorso) : [percorso];
  });
}
const testi = fileDiContenuto(join(RADICE, 'src', 'content')).map((f) => ({
  f,
  testo: readFileSync(f, 'utf8'),
}));

describe('the pages', () => {
  it('reads without problems', () => {
    expect(problemi).toEqual([]);
  });

  it('has the five pages of the menu, each with a neutral description', () => {
    const slug = contenuti.pagine.map((p) => dati(p).slug).sort();
    for (const atteso of ['chi-siamo', 'contatti', 'il-museo', 'sostieni', 'visita']) {
      expect(slug).toContain(atteso);
    }
    for (const p of contenuti.pagine) expect(dati(p).descrizione.length).toBeGreaterThan(20);
  });

  it('sends the visitor to the sections the actions of sito.yaml point to', () => {
    const visita = contenuti.pagine.find((p) => dati(p).slug === 'visita')!;
    expect(visita.corpo).toMatch(/^## Prenota$/m);
    expect(visita.corpo).toMatch(/^## Orari$/m);
  });
});

describe('the texts of the docx', () => {
  it('keeps none of the known typos of the docx', () => {
    const refusi = [
      /realizzante/,
      /gli è scelto/,
      /\bancore\b/,
      /\[5\]/,
      /LAVOROPERLPERSONA/i,
      /lavorperlapersona/,
      /\binsegnate\b/,
      /tre itinerari/i,
    ];
    for (const { f, testo } of testi) {
      for (const r of refusi) expect(testo, `${f} ${r}`).not.toMatch(r);
    }
  });

  it('has no personal phone number of the old site', () => {
    for (const { f, testo } of testi) {
      expect(testo, f).not.toMatch(/338[\s.]?4240410/);
      expect(testo, f).not.toMatch(/Giancarlo|Premici/);
    }
  });

  it('writes the IBAN only in sito.yaml, listed as to be confirmed and never shown', () => {
    for (const { f, testo } of testi) {
      expect(testo, f).not.toMatch(/\bIT\s?\d{2}\s?[A-Z]\s?\d{4}/);
    }
    expect(sito.sostegno.iban).toMatch(/^IT\d{2}[A-Z]\d{22}$/);
    expect(campoSito(sito, 'sostegno.iban').visibile).toBe(false);
  });
});

describe('biography, rooms, didactics, tools and publications', () => {
  it('has 3 prizes, 8 exhibitions and the stages of life', () => {
    const per = (tipo: string) => contenuti.biografia.filter((b) => dati(b).tipo === tipo);
    expect(
      per('premio')
        .map((b) => dati(b).anno)
        .sort(),
    ).toEqual([1982, 1989, 1994]);
    expect(per('mostra')).toHaveLength(8);
    expect(per('vita').map((b) => dati(b).anno)).toEqual(expect.arrayContaining([1912, 1994]));
    expect(per('museo').map((b) => dati(b).anno)).toEqual(expect.arrayContaining([1930, 1998]));
    const anni = per('mostra').map((b) => dati(b).anno);
    expect(Math.min(...anni)).toBe(1947);
    expect(Math.max(...anni)).toBe(1998);
  });

  it('has 4 rooms with a body, and the works of each room point to it', () => {
    expect(contenuti.sale.map((s) => dati(s).numero).sort()).toEqual([1, 2, 3, 4]);
    for (const s of contenuti.sale) expect(s.corpo.trim().length).toBeGreaterThan(50);
    const sala = (id: string) => dati(contenuti.opere.find((o) => o.id === id)!).sala;
    expect(sala('monumento-sisto-v-grottammare')).toBe('sala-1');
    expect(sala('portale-sant-agostino-offida')).toBe('sala-2');
    expect(sala('il-sogno-del-pescatore')).toBe('sala-3');
    expect(sala('portale-duomo-di-fermo')).toBe('sala-4');
  });

  it('has the three didactic projects and a proposal', () => {
    const per = (tipo: string) => contenuti.didattica.filter((d) => dati(d).tipo === tipo);
    expect(per('progetto-svolto')).toHaveLength(3);
    expect(per('proposta').length).toBeGreaterThanOrEqual(1);
  });

  it('has 3 placeholder tools and 1 placeholder publication', () => {
    expect(contenuti.strumenti).toHaveLength(3);
    expect(contenuti.pubblicazioni).toHaveLength(1);
    for (const v of [...contenuti.strumenti, ...contenuti.pubblicazioni]) {
      expect(dati(v).stato).toBe('segnaposto');
    }
  });
});
