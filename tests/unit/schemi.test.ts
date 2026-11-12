import { describe, expect, it } from 'vitest';
import { COLLEZIONI, creaSchemi, dataValida } from '../../src/lib/schemi.ts';
import * as f from './fixtures-contenuti.ts';

const s = creaSchemi();

const VALIDE = {
  opere: f.OPERA,
  luoghi: f.LUOGO,
  itinerari: f.ITINERARIO,
  sale: f.SALA,
  archivio: f.ARCHIVIO,
  eventi: f.EVENTO,
  didattica: f.DIDATTICA,
  biografia: f.BIOGRAFIA,
  strumenti: f.STRUMENTO,
  pubblicazioni: f.PUBBLICAZIONE,
  percorsi: f.PERCORSO,
  pagine: f.PAGINA,
  immagini: f.IMMAGINE,
} as const;

/** Error messages of a parse, or an empty list when it passes. */
function errori(coll: keyof typeof VALIDE, dati: unknown): string[] {
  const r = s[coll].safeParse(dati);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
}

function rifiuta(coll: keyof typeof VALIDE, dati: unknown, parte?: string) {
  const e = errori(coll, dati);
  expect(e.length, `expected a failure, got none`).toBeGreaterThan(0);
  if (parte) expect(e.join(' | ')).toContain(parte);
}

describe('content schemas: valid minimal entries', () => {
  it('covers every collection', () => {
    expect(Object.keys(VALIDE).sort()).toEqual([...COLLEZIONI].sort());
  });

  it.each(Object.entries(VALIDE))('accepts a minimal %s entry', (nome, dati) => {
    expect(errori(nome as keyof typeof VALIDE, dati)).toEqual([]);
  });
});

describe('content schemas: fields every entry has', () => {
  it.each(Object.entries(VALIDE))('%s rejects an unknown stato', (nome, dati) => {
    rifiuta(nome as keyof typeof VALIDE, { ...dati, stato: 'pubblicato' }, 'stato');
  });

  it.each(Object.entries(VALIDE))('%s requires stato', (nome, dati) => {
    const senza = f.senza(dati as Record<string, unknown>, 'stato');
    rifiuta(nome as keyof typeof VALIDE, senza, 'stato');
  });

  it.each(Object.entries(VALIDE))('%s rejects a misspelled field', (nome, dati) => {
    rifiuta(nome as keyof typeof VALIDE, { ...dati, titollo: 'x' });
  });

  it('rejects a daConfermare item without a note', () => {
    rifiuta('opere', { ...f.OPERA, daConfermare: [{ campo: 'anno' }] }, 'nota');
  });

  it('defaults daConfermare to an empty list', () => {
    const r = s.opere.parse(f.OPERA);
    expect(r.daConfermare).toEqual([]);
  });
});

describe('opere', () => {
  it('rejects a non-numeric anno', () => {
    rifiuta('opere', { ...f.OPERA, anno: 'mille' }, 'anno');
    rifiuta('opere', { ...f.OPERA, anno: '1980' }, 'anno');
    rifiuta('opere', { ...f.OPERA, anno: 1980.5 }, 'anno');
  });

  it('allows an empty anno only with a daConfermare on anno', () => {
    const senza = f.senza(f.OPERA, 'anno');
    rifiuta('opere', senza, 'anno');
    expect(
      errori('opere', { ...senza, daConfermare: [{ campo: 'anno', nota: 'Data incerta' }] }),
    ).toEqual([]);
  });

  it('allows empty materiali only with a daConfermare on materiali', () => {
    rifiuta('opere', { ...f.OPERA, materiali: [] }, 'materiali');
    expect(
      errori('opere', {
        ...f.OPERA,
        materiali: [],
        daConfermare: [{ campo: 'materiali', nota: 'Non indicato nel docx' }],
      }),
    ).toEqual([]);
  });

  it('rejects a material outside the vocabulary', () => {
    rifiuta('opere', { ...f.OPERA, materiali: ['legno'] }, 'materiali');
  });

  it('rejects an unknown categoria and a missing luogo or nellElenco', () => {
    rifiuta('opere', { ...f.OPERA, categoria: 'dipinto' }, 'categoria');
    const senzaLuogo = f.senza(f.OPERA, 'luogo');
    rifiuta('opere', senzaLuogo, 'luogo');
    const senzaElenco = f.senza(f.OPERA, 'nellElenco');
    rifiuta('opere', senzaElenco, 'nellElenco');
  });

  it('rejects an unknown image role', () => {
    rifiuta('opere', { ...f.OPERA, immagini: [{ immagine: 'a', ruolo: 'selfie' }] }, 'ruolo');
  });

  const fase = (ruolo: string) => ({ ruolo, titolo: 'T', testo: 'Testo', immagini: ['a'] });

  it('needs at least 3 fasi when fasi is present', () => {
    rifiuta('opere', { ...f.OPERA, fasi: [fase('idea'), fase('bozzetto')] }, 'fasi');
    expect(
      errori('opere', {
        ...f.OPERA,
        fasi: [fase('bozzetto'), fase('fonderia'), fase('monumento')],
      }),
    ).toEqual([]);
  });

  it('keeps fasi in the order idea, bozzetto, fonderia, in-loco, monumento', () => {
    rifiuta(
      'opere',
      { ...f.OPERA, fasi: [fase('fonderia'), fase('bozzetto'), fase('monumento')] },
      'ordine',
    );
  });

  it('accepts a confronto and rejects one without a description', () => {
    const confronto = { prima: 'a', dopo: 'b', descrizione: 'Il gesso è più chiaro.' };
    expect(errori('opere', { ...f.OPERA, confronti: [confronto] })).toEqual([]);
    rifiuta('opere', { ...f.OPERA, confronti: [{ prima: 'a', dopo: 'b' }] }, 'descrizione');
  });
});

describe('luoghi', () => {
  it('rejects swapped coordinates (outside Italy)', () => {
    rifiuta('luoghi', { ...f.LUOGO, lat: 13.7194, lon: 43.1596 }, 'lat');
  });

  it('rejects a province that is not a two-letter code, and an unknown precisione', () => {
    rifiuta('luoghi', { ...f.LUOGO, provincia: 'Fermo' }, 'provincia');
    rifiuta('luoghi', { ...f.LUOGO, precisione: 'esatta' }, 'precisione');
  });

  it('requires verificato', () => {
    const senza = f.senza(f.LUOGO, 'verificato');
    rifiuta('luoghi', senza, 'verificato');
  });
});

describe('immagini', () => {
  it('rejects a missing alt', () => {
    const senza = f.senza(f.IMMAGINE, 'alt');
    rifiuta('immagini', senza, 'alt');
  });

  it('rejects an alt shorter than 15 or longer than 150 characters', () => {
    rifiuta('immagini', { ...f.IMMAGINE, alt: 'Una foto' }, 'alt');
    rifiuta('immagini', { ...f.IMMAGINE, alt: 'x'.repeat(151) }, 'alt');
  });

  it('allows an empty alt only for a decorative image', () => {
    rifiuta('immagini', { ...f.IMMAGINE, alt: '' }, 'alt');
    expect(errori('immagini', { ...f.IMMAGINE, alt: '', decorativa: true })).toEqual([]);
  });

  it('requires a credit for third-party images', () => {
    rifiuta('immagini', { ...f.IMMAGINE, origine: 'terzi' }, 'credito');
    rifiuta('immagini', { ...f.IMMAGINE, origine: 'terzi', credito: '  ' }, 'credito');
    expect(
      errori('immagini', { ...f.IMMAGINE, origine: 'terzi', credito: 'Archivio Sgattoni' }),
    ).toEqual([]);
  });

  it('requires altVerificato and an ASCII lowercase file name', () => {
    const senza = f.senza(f.IMMAGINE, 'altVerificato');
    rifiuta('immagini', senza, 'altVerificato');
    rifiuta('immagini', { ...f.IMMAGINE, file: 'Le Merlettaie.jpg' }, 'file');
  });

  it('accepts a subject that points to an opera or a sala only', () => {
    expect(errori('immagini', { ...f.IMMAGINE, soggetto: { tipo: 'sala', id: 'sala-3' } })).toEqual(
      [],
    );
    rifiuta('immagini', { ...f.IMMAGINE, soggetto: { tipo: 'luogo', id: 'x' } }, 'soggetto');
  });
});

describe('archivio', () => {
  it('requires a credit for third-party documents', () => {
    rifiuta('archivio', { ...f.ARCHIVIO, origine: 'terzi' }, 'credito');
  });

  it.each(['1952', '1952-07', '1952-07-06'])('accepts the date %s', (data) => {
    expect(errori('archivio', { ...f.ARCHIVIO, data })).toEqual([]);
  });

  it.each(['1952-13', '1952-02-30', '52', '6 luglio 1952', '1952-7-6'])(
    'rejects the date %s',
    (data) => {
      rifiuta('archivio', { ...f.ARCHIVIO, data }, 'data');
    },
  );

  it('rejects a numeric year and a missing date', () => {
    rifiuta('archivio', { ...f.ARCHIVIO, data: 1952 }, 'data');
    const senza = f.senza(f.ARCHIVIO, 'data');
    rifiuta('archivio', senza, 'data');
  });
});

describe('dataValida', () => {
  it('knows leap years', () => {
    expect(dataValida('2024-02-29')).toBe(true);
    expect(dataValida('2023-02-29')).toBe(false);
  });
});

describe('eventi', () => {
  it('needs a date for a dated event but not for an initiative', () => {
    const senza = f.senza(f.EVENTO, 'data');
    rifiuta('eventi', senza, 'data');
    expect(errori('eventi', { ...senza, tipo: 'iniziativa' })).toEqual([]);
  });

  it('rejects an end date before the start, and a time without a date', () => {
    rifiuta('eventi', { ...f.EVENTO, dataFine: '2012-07-26' }, 'dataFine');
    rifiuta('eventi', { ...f.EVENTO, tipo: 'iniziativa', data: undefined, ora: '10:30' }, 'ora');
    rifiuta('eventi', { ...f.EVENTO, ora: '25:00' }, 'ora');
  });

  it('wants a full day for the event date', () => {
    rifiuta('eventi', { ...f.EVENTO, data: '2012-07' }, 'data');
  });
});

describe('itinerari', () => {
  it('rejects empty tappe and an unknown tappa tipo', () => {
    rifiuta('itinerari', { ...f.ITINERARIO, tappe: [] }, 'tappe');
    rifiuta('itinerari', { ...f.ITINERARIO, tappe: [{ tipo: 'sala', id: 'x' }] }, 'tipo');
  });

  it('allows a missing modo only with a daConfermare on modo', () => {
    const senza = f.senza(f.ITINERARIO, 'modo');
    rifiuta('itinerari', senza, 'modo');
    expect(
      errori('itinerari', { ...senza, daConfermare: [{ campo: 'modo', nota: 'Da decidere' }] }),
    ).toEqual([]);
  });

  it('rejects a duration that is not a positive whole number', () => {
    rifiuta('itinerari', { ...f.ITINERARIO, durataMinuti: 0 }, 'durataMinuti');
    rifiuta('itinerari', { ...f.ITINERARIO, durataMinuti: '90 minuti' }, 'durataMinuti');
  });
});

describe('sale, biografia, pagine, percorsi', () => {
  it('limits the sala number to 1-4', () => {
    rifiuta('sale', { ...f.SALA, numero: 5 }, 'numero');
    rifiuta('sale', { ...f.SALA, numero: 0 }, 'numero');
  });

  it('keeps the year of a biography entry equal to the year of its date', () => {
    rifiuta('biografia', { ...f.BIOGRAFIA, data: '1913-07-27' }, 'data');
    expect(errori('biografia', { ...f.BIOGRAFIA, data: '1912-07-27' })).toEqual([]);
  });

  it('rejects a page slug that is not lowercase ASCII with hyphens', () => {
    rifiuta('pagine', { ...f.PAGINA, slug: 'Chi Siamo' }, 'slug');
  });

  it('rejects a percorso link that is not an internal address', () => {
    const voce = (percorso: string) => ({ titolo: 'T', descrizione: 'D', percorso });
    rifiuta('percorsi', { ...f.PERCORSO, voci: [voce('https://example.org/')] }, 'percorso');
    rifiuta('percorsi', { ...f.PERCORSO, voci: [voce('didattica')] }, 'percorso');
    expect(errori('percorsi', { ...f.PERCORSO, voci: [voce('/visita/#orari')] })).toEqual([]);
  });
});

describe('references seen while parsing', () => {
  it('reports every reference, with its target collection, to the observer', () => {
    const viste: string[] = [];
    const osservati = creaSchemi({ osserva: (c, id) => viste.push(`${c}/${id}`) });
    osservati.itinerari.parse(f.ITINERARIO);
    expect(viste).toEqual(['opere/il-portale-del-duomo', 'luoghi/duomo-di-fermo']);
  });

  it('reports plain references and nested ones too', () => {
    const viste: string[] = [];
    const osservati = creaSchemi({ osserva: (c, id) => viste.push(`${c}/${id}`) });
    osservati.opere.parse({
      ...f.OPERA,
      sala: 'sala-3',
      immagini: [{ immagine: 'a', ruolo: 'bozzetto' }],
      confronti: [{ prima: 'a', dopo: 'b', descrizione: 'Differenze' }],
    });
    expect(viste).toEqual([
      'luoghi/duomo-di-fermo',
      'immagini/a',
      'sale/sala-3',
      'immagini/a',
      'immagini/b',
    ]);
  });
});
