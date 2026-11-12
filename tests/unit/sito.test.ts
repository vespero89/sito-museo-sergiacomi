import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { campoPresente, campoSito, sitoSchema } from '../../src/lib/sito.ts';
import { parseYaml } from '../../src/lib/yaml.ts';

const FILE = join(import.meta.dirname, '..', '..', 'src', 'data', 'sito.yaml');
const reale = (): Dati => parseYaml(readFileSync(FILE, 'utf8')) as never;

type Dati = Record<string, unknown>;

/** Sets the value at a dotted path (array indexes are numbers in the path). */
function imposta(dati: Dati, percorso: string, valore: unknown) {
  const parti = percorso.split('.');
  const ultimo = parti.pop()!;
  let nodo: unknown = dati;
  for (const parte of parti) nodo = (nodo as Record<string, unknown>)[parte];
  (nodo as Record<string, unknown>)[ultimo] = valore;
}

/** Appends an item to the array at a dotted path. */
function aggiungi(dati: Dati, percorso: string, voce: unknown) {
  let nodo: unknown = dati;
  for (const parte of percorso.split('.')) nodo = (nodo as Record<string, unknown>)[parte];
  (nodo as unknown[]).push(voce);
}

/** Parses a modified copy of the real file and returns the error messages. */
function errori(modifica: (dati: Dati) => void): string[] {
  const dati = reale();
  modifica(dati);
  const r = sitoSchema.safeParse(dati);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
}

function rifiuta(modifica: (dati: Dati) => void, parte: string) {
  const e = errori(modifica).join(' | ');
  expect(e, 'expected a failure').not.toBe('');
  expect(e).toContain(parte);
}

describe('src/data/sito.yaml', () => {
  it('passes its own schema', () => {
    expect(errori(() => {})).toEqual([]);
  });

  it('has the 7 main menu entries of the spec, in order', () => {
    const titoli = sitoSchema.parse(reale()).navigazione.principale.map((v) => v.titolo);
    expect(titoli).toEqual([
      'Aldo Sergiacomi',
      'Il Museo',
      'Opere e itinerari',
      'Didattica',
      'Eventi',
      'Archivio',
      'Chi siamo',
    ]);
  });

  it('uses the confirmed postal code 63073', () => {
    expect(sitoSchema.parse(reale()).museo.indirizzo.cap).toBe('63073');
  });

  it('does not carry the personal mobile number of the old site', () => {
    expect(sitoSchema.parse(reale()).contatti.telefono).toBe('');
  });
});

describe('sito schema: bad data', () => {
  it('rejects an unknown top-level field', () => {
    rifiuta((d) => imposta(d, 'orarii', {}), 'orarii');
  });

  it('rejects an invalid email and a postal code that is not 5 digits', () => {
    rifiuta((d) => imposta(d, 'contatti.email', 'info@'), 'contatti.email');
    rifiuta((d) => imposta(d, 'museo.indirizzo.cap', '6307'), 'museo.indirizzo.cap');
  });

  it('accepts an empty IBAN but rejects a malformed one', () => {
    expect(errori((d) => imposta(d, 'sostegno.iban', ''))).toEqual([]);
    expect(errori((d) => imposta(d, 'sostegno.iban', 'IT60 X054 2811 1010 0000 0123 456'))).toEqual(
      [],
    );
    rifiuta((d) => imposta(d, 'sostegno.iban', 'non un iban'), 'sostegno.iban');
  });

  it('rejects a Wikidata id that is not a Q number', () => {
    rifiuta((d) => imposta(d, 'artista.wikidata', 'Q'), 'artista.wikidata');
  });

  it('rejects a birth or death date that is not a real day', () => {
    rifiuta((d) => imposta(d, 'artista.nascita', '1912-02-30'), 'artista.nascita');
    rifiuta((d) => imposta(d, 'artista.morte', '05/08/1994'), 'artista.morte');
  });

  it('lists the birth and death dates as to confirm', () => {
    const campi = sitoSchema.parse(reale()).daConfermare.map((d) => d.campo);
    expect(campi).toEqual(expect.arrayContaining(['artista.nascita', 'artista.morte']));
  });

  it('rejects a menu link that is not an internal address', () => {
    rifiuta((d) => imposta(d, 'navigazione.principale.0.href', 'https://example.org/'), 'href');
    rifiuta((d) => imposta(d, 'navigazione.principale.0.href', '/aldo-sergiacomi'), 'href');
  });

  it('rejects an empty main menu or an empty footer group', () => {
    rifiuta((d) => imposta(d, 'navigazione.principale', []), 'principale');
    rifiuta((d) => imposta(d, 'navigazione.piede.0.voci', []), 'voci');
  });

  it('rejects a social link that is not https', () => {
    rifiuta(
      (d) => imposta(d, 'social', [{ nome: 'Facebook', url: 'http://example.org/x' }]),
      'url',
    );
  });
});

describe('sito schema: the daConfermare list', () => {
  it('rejects a path that does not exist, so a typo cannot show a doubtful value', () => {
    rifiuta(
      (d) => aggiungi(d, 'daConfermare', { campo: 'sostegno.ibam', nota: 'Typo' }),
      'sostegno.ibam',
    );
  });

  it('accepts a path that exists even when its value is empty', () => {
    expect(
      errori((d) => {
        imposta(d, 'sostegno.iban', '');
        aggiungi(d, 'daConfermare', { campo: 'sostegno.iban', nota: 'Da confermare' });
      }),
    ).toEqual([]);
  });

  it('rejects an item without a note', () => {
    rifiuta((d) => aggiungi(d, 'daConfermare', { campo: 'orari' }), 'nota');
  });
});

describe('campoPresente', () => {
  const dati = { a: { b: [{ c: 1 }, { c: 2 }] }, vuoto: '', nullo: null };

  it('follows dotted paths and array indexes', () => {
    expect(campoPresente(dati, 'a.b.1.c')).toBe(true);
    expect(campoPresente(dati, 'a.b.2')).toBe(false);
    expect(campoPresente(dati, 'a.x')).toBe(false);
  });

  it('counts an empty string as present', () => {
    expect(campoPresente(dati, 'vuoto')).toBe(true);
  });

  it('does not walk into inherited properties', () => {
    expect(campoPresente(dati, 'toString')).toBe(false);
    expect(campoPresente(dati, 'a.constructor')).toBe(false);
  });
});

describe('campoSito', () => {
  it('shows only the label, not the value, for a field listed in daConfermare', () => {
    const dati = reale();
    (dati.sostegno as Record<string, unknown>).iban = 'IT60X0542811101000000123456';
    dati.daConfermare = [{ campo: 'sostegno.iban', nota: 'Da confermare con la Fondazione' }];
    const r = campoSito(dati as never, 'sostegno.iban');
    expect(r).toEqual({ visibile: false, nota: 'Da confermare con la Fondazione' });
    expect(JSON.stringify(r)).not.toContain('IT60');
  });

  it('hides everything under a listed parent field', () => {
    const dati = reale();
    dati.social = [{ nome: 'Facebook', url: 'https://example.org/museo' }];
    dati.daConfermare = [{ campo: 'social', nota: 'Profili da verificare' }];
    expect(campoSito(dati as never, 'social.0.url')).toEqual({
      visibile: false,
      nota: 'Profili da verificare',
    });
  });

  it('returns the value of a field that is not listed', () => {
    const dati = reale();
    expect(campoSito(dati as never, 'contatti.email')).toEqual({
      visibile: true,
      valore: 'info@lavoroperlapersona.it',
    });
  });

  it('does not hide a field only because a sibling is listed', () => {
    const dati = reale();
    dati.daConfermare = [{ campo: 'sostegno.iban', nota: 'x' }];
    expect(campoSito(dati as never, 'sostegno.intestatario').visibile).toBe(true);
  });
});
