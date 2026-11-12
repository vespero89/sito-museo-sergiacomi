import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CONTEGGIO_OPERE_PER_COMUNE,
  controllaConteggi,
  controllaContenuti,
  controllaRepo,
  dividiFrontmatter,
  type Contenuti,
  type Voce,
} from '../../src/lib/controllo-contenuti.ts';
import { COLLEZIONI } from '../../src/lib/schemi.ts';
import * as f from './fixtures-contenuti.ts';

const voce = (id: string, dati: unknown, corpo = ''): Voce => ({
  id,
  etichetta: `${id}.md`,
  dati,
  corpo,
});

/** A small consistent set of entries: every reference points to something that exists. */
function mondo(): Contenuti {
  const vuoto = Object.fromEntries(COLLEZIONI.map((c) => [c, [] as Voce[]]));
  return {
    ...vuoto,
    luoghi: [voce('duomo-di-fermo', f.LUOGO)],
    opere: [voce('il-portale-del-duomo', f.OPERA)],
    itinerari: [voce('i-portali', f.ITINERARIO)],
    sale: [voce('sala-1', f.SALA, 'Testo della sala.')],
    immagini: [voce('le-merlettaie-bozzetto-1', f.IMMAGINE)],
  } as Contenuti;
}

const tuttoPresente = () => true;

/** Problems of a set of entries, as text. */
function problemi(contenuti: Contenuti, fotoEsiste = tuttoPresente): string[] {
  return controllaContenuti(contenuti, { fotoEsiste }).map((p) => `${p.file}: ${p.messaggio}`);
}

describe('controllaContenuti', () => {
  it('passes a consistent set', () => {
    expect(problemi(mondo())).toEqual([]);
  });

  it('passes when there is no content at all', () => {
    const vuoto = Object.fromEntries(COLLEZIONI.map((c) => [c, []])) as unknown as Contenuti;
    expect(problemi(vuoto)).toEqual([]);
  });

  it('fails on a reference to a missing entry, naming the file and the target', () => {
    const c = mondo();
    c.opere = [voce('il-portale-del-duomo', { ...f.OPERA, luogo: 'chiesa-che-non-c-e' })];
    const e = problemi(c);
    expect(e).toHaveLength(1);
    expect(e[0]).toContain('il-portale-del-duomo.md');
    expect(e[0]).toContain('luoghi');
    expect(e[0]).toContain('chiesa-che-non-c-e');
  });

  it('fails on an itinerary stop whose id does not exist', () => {
    const c = mondo();
    c.itinerari = [
      voce('i-portali', {
        ...f.ITINERARIO,
        tappe: [{ tipo: 'opera', id: 'opera-inventata' }],
      }),
    ];
    const e = problemi(c);
    expect(e).toHaveLength(1);
    expect(e[0]).toContain('opera-inventata');
  });

  it('looks for a "luogo" stop among the places, not among the works', () => {
    const c = mondo();
    c.itinerari = [
      voce('i-portali', {
        ...f.ITINERARIO,
        tappe: [{ tipo: 'luogo', id: 'il-portale-del-duomo' }], // this id is a work
      }),
    ];
    expect(problemi(c)).toHaveLength(1);
  });

  it('fails on a missing image in a photo list, a phase and a comparison', () => {
    const c = mondo();
    const fase = (ruolo: string, immagine: string) => ({
      ruolo,
      titolo: 'T',
      testo: 'Testo',
      immagini: [immagine],
    });
    c.opere = [
      voce('il-portale-del-duomo', {
        ...f.OPERA,
        immagini: [{ immagine: 'foto-1', ruolo: 'bozzetto' }],
        fasi: [
          fase('bozzetto', 'le-merlettaie-bozzetto-1'),
          fase('fonderia', 'foto-2'),
          fase('monumento', 'le-merlettaie-bozzetto-1'),
        ],
        confronti: [
          { prima: 'le-merlettaie-bozzetto-1', dopo: 'foto-3', descrizione: 'Differenze' },
        ],
      }),
    ];
    const e = problemi(c).join('\n');
    expect(e).toContain('foto-1');
    expect(e).toContain('foto-2');
    expect(e).toContain('foto-3');
  });

  it('fails on a missing image subject and a missing `continua` target', () => {
    const c = mondo();
    c.immagini = [
      voce('le-merlettaie-bozzetto-1', { ...f.IMMAGINE, soggetto: { tipo: 'sala', id: 'sala-9' } }),
    ];
    c.eventi = [
      voce('centenario', { ...f.EVENTO, continua: [{ tipo: 'itinerario', id: 'non-esiste' }] }),
    ];
    const e = problemi(c).join('\n');
    expect(e).toContain('sala-9');
    expect(e).toContain('non-esiste');
  });

  it('reports a schema failure with the file name, and no reference noise for that entry', () => {
    const c = mondo();
    c.opere = [voce('il-portale-del-duomo', { ...f.OPERA, anno: 'mille', luogo: 'nessuno' })];
    const e = problemi(c);
    expect(e).toHaveLength(1);
    expect(e[0]).toContain('il-portale-del-duomo.md');
    expect(e[0]).toContain('anno');
  });

  it('fails on a missing alt, a third-party image without credit and an unknown stato', () => {
    const c = mondo();
    c.immagini = [
      voce('a-uno', { ...f.IMMAGINE, id: 'a-uno', alt: undefined }),
      voce('a-due', { ...f.IMMAGINE, id: 'a-due', origine: 'terzi' }),
    ];
    c.luoghi = [voce('duomo-di-fermo', { ...f.LUOGO, stato: 'pubblicato' })];
    const e = problemi(c).join('\n');
    expect(e).toContain('alt');
    expect(e).toContain('credito');
    expect(e).toContain('stato');
  });

  it('fails on two photos with the same id and on two sale with the same number', () => {
    const c = mondo();
    c.immagini = [
      voce('le-merlettaie-bozzetto-1', f.IMMAGINE),
      voce('le-merlettaie-bozzetto-1', f.IMMAGINE),
    ];
    c.sale = [voce('sala-1', f.SALA, 'Testo.'), voce('sala-uno', f.SALA, 'Testo.')];
    const e = problemi(c).join('\n');
    expect(e).toContain('le-merlettaie-bozzetto-1');
    expect(e).toContain('numero 1');
  });

  it('fails on a sala without text', () => {
    const c = mondo();
    c.sale = [voce('sala-1', f.SALA, '  \n')];
    expect(problemi(c).join('\n')).toContain('corpo');
  });

  it('fails when the photo file is not in src/assets/foto', () => {
    const e = problemi(mondo(), () => false);
    expect(e).toHaveLength(1);
    expect(e[0]).toContain('le-merlettaie-bozzetto-1.jpg');
  });

  it('fails on a master photo that has no entry (so no alt) in the immagini collection', () => {
    const e = controllaContenuti(mondo(), {
      fotoEsiste: tuttoPresente,
      fotoPresenti: ['le-merlettaie-bozzetto-1.jpg', 'senza-alt-1.jpg'],
    }).map((p) => `${p.file}: ${p.messaggio}`);
    expect(e).toHaveLength(1);
    expect(e[0]).toContain('src/assets/foto/senza-alt-1.jpg');
    expect(e[0]).toContain('alt');
  });

  it('does not check unlisted master photos when the list of files is not given', () => {
    expect(problemi(mondo())).toEqual([]);
  });
});

describe('controllaConteggi (import counts, spec 3.3)', () => {
  const comuni = Object.entries(CONTEGGIO_OPERE_PER_COMUNE);

  /** The expected import: one place per comune, and the works of the list spread as expected. */
  function importCompleto(): Contenuti {
    const c = mondo();
    c.luoghi = comuni.map(([comune]) =>
      voce(`luogo-${comune}`, { ...f.LUOGO, nome: comune, comune }),
    );
    c.opere = comuni.flatMap(([comune, quante]) =>
      Array.from({ length: quante }, (_, i) =>
        voce(`opera-${comune}-${i}`, { ...f.OPERA, luogo: `luogo-${comune}` }),
      ),
    );
    c.biografia = [
      ...Array.from({ length: 3 }, (_, i) =>
        voce(`premio-${i}`, { ...f.BIOGRAFIA, tipo: 'premio' }),
      ),
      ...Array.from({ length: 8 }, (_, i) =>
        voce(`mostra-${i}`, { ...f.BIOGRAFIA, tipo: 'mostra' }),
      ),
      voce('nascita', f.BIOGRAFIA),
    ];
    c.sale = [1, 2, 3, 4].map((numero) => voce(`sala-${numero}`, { ...f.SALA, numero }));
    c.itinerari = Array.from({ length: 4 }, (_, i) => voce(`itinerario-${i}`, f.ITINERARIO));
    c.percorsi = Array.from({ length: 4 }, (_, i) => voce(`percorso-${i}`, f.PERCORSO));
    return c;
  }
  const messaggi = (c: Contenuti) => controllaConteggi(c).map((p) => p.messaggio);

  it('expects 25 works of the list, spread over the comuni of the exploration', () => {
    expect(comuni.reduce((somma, [, n]) => somma + n, 0)).toBe(25);
    expect(CONTEGGIO_OPERE_PER_COMUNE['Offida']).toBe(7);
    expect(CONTEGGIO_OPERE_PER_COMUNE['Teramo']).toBe(4);
  });

  it('passes the expected import', () => {
    expect(messaggi(importCompleto())).toEqual([]);
  });

  it('does not count the works outside the list (the two extra cards)', () => {
    const c = importCompleto();
    c.opere.push(
      voce('stemmi', { ...f.OPERA, nellElenco: false, luogo: 'luogo-Offida' }),
      voce('palmucci', { ...f.OPERA, nellElenco: false, luogo: 'luogo-Offida' }),
    );
    expect(messaggi(c)).toEqual([]);
  });

  it('fails on a missing work, naming the number found', () => {
    const c = importCompleto();
    c.opere.pop();
    const e = messaggi(c);
    expect(e.some((m) => m.includes('25') && m.includes('24'))).toBe(true);
  });

  it('fails when a comune has the wrong number of works', () => {
    const c = importCompleto();
    const i = c.opere.findIndex((o) => o.id.startsWith('opera-Teramo'));
    c.opere[i] = voce('opera-spostata', { ...f.OPERA, luogo: 'luogo-Offida' });
    const e = messaggi(c).join('\n');
    expect(e).toContain('Teramo');
    expect(e).toContain('Offida');
  });
});

describe('controllaConteggi: prizes, exhibitions and rooms (spec 3.3)', () => {
  const messaggi = (c: Contenuti) => controllaConteggi(c).map((p) => p.messaggio);
  const senzaOpere = (): Contenuti => {
    const c = mondo();
    c.biografia = [
      ...Array.from({ length: 3 }, (_, i) =>
        voce(`premio-${i}`, { ...f.BIOGRAFIA, tipo: 'premio' }),
      ),
      ...Array.from({ length: 8 }, (_, i) =>
        voce(`mostra-${i}`, { ...f.BIOGRAFIA, tipo: 'mostra' }),
      ),
    ];
    c.sale = [1, 2, 3, 4].map((numero) => voce(`sala-${numero}`, { ...f.SALA, numero }));
    c.itinerari = Array.from({ length: 4 }, (_, i) => voce(`itinerario-${i}`, f.ITINERARIO));
    c.percorsi = Array.from({ length: 4 }, (_, i) => voce(`percorso-${i}`, f.PERCORSO));
    return c;
  };
  const tutti = (c: Contenuti) => messaggi(c).filter((m) => !/works/.test(m));

  it('passes 3 prizes, 8 exhibitions, 4 rooms, 4 itineraries and 4 paths', () => {
    expect(tutti(senzaOpere())).toEqual([]);
  });

  it('fails on a missing prize, exhibition or room, naming what it found', () => {
    for (const [tolto, parola] of [
      ['premio-0', 'prizes'],
      ['mostra-0', 'exhibitions'],
    ] as const) {
      const c = senzaOpere();
      c.biografia = c.biografia.filter((b) => b.id !== tolto);
      expect(tutti(c).join('\n')).toContain(parola);
    }
    const c = senzaOpere();
    c.sale.pop();
    expect(tutti(c).join('\n')).toContain('rooms');
    const i = senzaOpere();
    i.itinerari.pop();
    expect(tutti(i).join('\n')).toContain('itineraries');
    const p = senzaOpere();
    p.percorsi.pop();
    expect(tutti(p).join('\n')).toContain('paths');
  });
});

describe('dividiFrontmatter', () => {
  it('splits the frontmatter from the body', () => {
    const r = dividiFrontmatter('---\ntitolo: A\n---\nCorpo.\n');
    expect(r.frontmatter).toEqual({ titolo: 'A' });
    expect(r.corpo).toBe('Corpo.\n');
  });

  it('accepts an empty frontmatter and Windows line endings', () => {
    expect(dividiFrontmatter('---\n---\nTesto').frontmatter).toEqual({});
    expect(dividiFrontmatter('---\r\na: 1\r\n---\r\nTesto').frontmatter).toEqual({ a: 1 });
  });

  it('reports a file without frontmatter', () => {
    expect(() => dividiFrontmatter('Solo testo')).toThrow(/frontmatter/);
  });
});

describe('controllaRepo', () => {
  const cartelle: string[] = [];
  afterEach(() => {
    while (cartelle.length) rmSync(cartelle.pop()!, { recursive: true, force: true });
  });

  /** A temporary repo layout: the files map a relative path to its text. */
  function repo(files: Record<string, string>): string {
    const radice = mkdtempSync(join(tmpdir(), 'content-check-'));
    cartelle.push(radice);
    for (const [percorso, testo] of Object.entries(files)) {
      mkdirSync(join(radice, percorso, '..'), { recursive: true });
      writeFileSync(join(radice, percorso), testo);
    }
    return radice;
  }

  const SITO = join(import.meta.dirname, '..', '..', 'src', 'data', 'sito.yaml');
  const sitoReale = () => readFileSync(SITO, 'utf8');

  const base = (extra: Record<string, string> = {}) =>
    repo({
      'src/data/sito.yaml': sitoReale(),
      'src/assets/foto/le-merlettaie-bozzetto-1.jpg': 'x',
      'src/content/immagini/it/immagini.yaml': [
        '- id: le-merlettaie-bozzetto-1',
        '  file: le-merlettaie-bozzetto-1.jpg',
        '  alt: Bozzetto in gesso della bambina delle Merlettaie, ripreso di tre quarti',
        '  origine: fondazione',
        '  altVerificato: false',
        '  stato: da-confermare',
      ].join('\n'),
      'src/content/luoghi/it/duomo-di-fermo.yaml': Object.entries(f.LUOGO)
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join('\n'),
      'src/content/opere/it/il-portale-del-duomo.md': [
        '---',
        ...Object.entries(f.OPERA).map(([k, v]) => `${k}: ${JSON.stringify(v)}`),
        '---',
        'Testo.',
      ].join('\n'),
      ...extra,
    });

  it('passes a small valid repo', () => {
    expect(controllaRepo(base()).problemi).toEqual([]);
  });

  it('counts the entries it read', () => {
    const r = controllaRepo(base());
    expect(r.voci).toBe(3);
  });

  it('fails on a broken reference found in the files', () => {
    const radice = base({
      'src/content/opere/it/altra.md':
        '---\ntitolo: A\ncategoria: altro\nanno: 1950\nnellElenco: true\nmateriali: [gesso]\nluogo: nessuno\nstato: confermato\n---\n',
    });
    const e = controllaRepo(radice).problemi.map((p) => `${p.file}: ${p.messaggio}`);
    expect(e).toHaveLength(1);
    expect(e[0]).toContain('src/content/opere/it/altra.md');
    expect(e[0]).toContain('nessuno');
  });

  it('fails on an unquoted date, which YAML reads as a date and not as text', () => {
    const radice = base({
      'src/content/eventi/it/centenario.md':
        '---\ntitolo: Centenario\ntipo: evento\ndata: 2012-07-27\nstato: confermato\n---\n',
    });
    const e = controllaRepo(radice).problemi.map((p) => p.messaggio);
    expect(e.join('\n')).toContain('data');
  });

  it('flags a file the build would ignore and a file name that is not lowercase ASCII', () => {
    const radice = base({
      'src/content/opere/it/senza-estensione.yml': 'a: 1',
      'src/content/opere/it/Le Merlettaie.md': '---\n---\n',
    });
    const e = controllaRepo(radice).problemi.map((p) => `${p.file}: ${p.messaggio}`);
    expect(e.join('\n')).toContain('senza-estensione.yml');
    expect(e.join('\n')).toContain('Le Merlettaie.md');
  });

  it('reports broken YAML as a problem instead of crashing', () => {
    const radice = base({ 'src/content/luoghi/it/rotto.yaml': 'nome: [aperta' });
    const e = controllaRepo(radice).problemi.map((p) => p.file);
    expect(e).toContain('src/content/luoghi/it/rotto.yaml');
  });

  it('reports a photo list that is not a list', () => {
    const radice = base({ 'src/content/immagini/it/immagini.yaml': 'id: a' });
    expect(controllaRepo(radice).problemi.length).toBeGreaterThan(0);
  });

  it('fails on an invalid sito.yaml, naming the field', () => {
    const radice = base({
      'src/data/sito.yaml': sitoReale().replace('info@lavoroperlapersona.it', 'info@'),
    });
    const e = controllaRepo(radice).problemi.map((p) => `${p.file}: ${p.messaggio}`);
    expect(e).toHaveLength(1);
    expect(e[0]).toContain('src/data/sito.yaml');
    expect(e[0]).toContain('contatti.email');
  });

  it('fails when sito.yaml is missing', () => {
    const radice = base();
    rmSync(join(radice, 'src/data/sito.yaml'));
    expect(controllaRepo(radice).problemi.map((p) => p.file)).toContain('src/data/sito.yaml');
  });

  it('passes on the real repository, counts of the import included', () => {
    const radice = join(import.meta.dirname, '..', '..');
    expect(controllaRepo(radice, { conteggi: true }).problemi).toEqual([]);
  });

  it('checks the import counts only when asked', () => {
    expect(controllaRepo(base()).problemi).toEqual([]);
    expect(controllaRepo(base(), { conteggi: true }).problemi.length).toBeGreaterThan(0);
  });
});
