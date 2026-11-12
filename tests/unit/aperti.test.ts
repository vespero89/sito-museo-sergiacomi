import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import {
  apertiDelRepo,
  formattaAperti,
  trovaAperti,
  trovaMarcatori,
  type Aperto,
} from '../../src/lib/aperti.ts';
import type { Contenuti, Voce } from '../../src/lib/controllo-contenuti.ts';
import { COLLEZIONI } from '../../src/lib/schemi.ts';
import * as f from './fixtures-contenuti.ts';

const RADICE = join(import.meta.dirname, '..', '..');

const voce = (id: string, dati: unknown, corpo = ''): Voce => ({
  id,
  etichetta: `${id}.md`,
  dati,
  corpo,
});

function contenuti(parziale: Partial<Record<string, Voce[]>>): Contenuti {
  const vuoto = Object.fromEntries(COLLEZIONI.map((c) => [c, [] as Voce[]]));
  return { ...vuoto, ...parziale } as Contenuti;
}

const confermata = { ...f.OPERA, stato: 'confermato', daConfermare: [] };
const sitoPulito = { daConfermare: [], nome: 'Museo' };

/** The causes found, as "collection:cause". */
const cause = (aperti: Aperto[]) => aperti.map((a) => `${a.collezione}:${a.causa}`);

describe('trovaAperti', () => {
  it('finds nothing when everything is confirmed', () => {
    const c = contenuti({
      opere: [voce('a', confermata, 'Un testo pulito.')],
      luoghi: [voce('l', { ...f.LUOGO, stato: 'confermato', verificato: true })],
      immagini: [voce('i', { ...f.IMMAGINE, stato: 'confermato', altVerificato: true })],
    });
    expect(trovaAperti(c, sitoPulito)).toEqual([]);
  });

  it('flags an entry whose stato is not confermato', () => {
    const c = contenuti({
      opere: [voce('a', { ...confermata, stato: 'da-confermare' })],
      sale: [voce('s', { ...f.SALA, stato: 'segnaposto' }, 'Testo.')],
    });
    expect(cause(trovaAperti(c, sitoPulito))).toEqual(['opere:da-confermare', 'sale:segnaposto']);
  });

  it('flags an entry with no stato at all', () => {
    const senzaStato: Record<string, unknown> = { ...confermata };
    delete senzaStato.stato;
    expect(cause(trovaAperti(contenuti({ opere: [voce('a', senzaStato)] }), sitoPulito))).toEqual([
      'opere:da-confermare',
    ]);
  });

  it('flags every item of a non-empty daConfermare, with its field and note', () => {
    const dati = {
      ...confermata,
      daConfermare: [
        { campo: 'anno', nota: 'Sul vecchio sito 1923' },
        { campo: 'materiali', nota: 'Non indicati' },
      ],
    };
    const aperti = trovaAperti(contenuti({ opere: [voce('a', dati)] }), sitoPulito);
    expect(cause(aperti)).toEqual(['opere:dubbio', 'opere:dubbio']);
    expect(aperti[0]!.dettaglio).toContain('anno');
    expect(aperti[0]!.dettaglio).toContain('Sul vecchio sito 1923');
  });

  it('flags a [[...]] marker in the text', () => {
    const c = contenuti({
      opere: [voce('a', confermata, 'Fu realizzata nel 1952 [[DA CONFERMARE: data incerta]].')],
    });
    const aperti = trovaAperti(c, sitoPulito);
    expect(cause(aperti)).toEqual(['opere:marcatore']);
    expect(aperti[0]!.dettaglio).toContain('data incerta');
  });

  it('flags a marker in a frontmatter text and an unclosed marker', () => {
    const c = contenuti({
      opere: [voce('a', { ...confermata, descrizione: 'Ok [[DA CONFERMARE: x]]' })],
      sale: [voce('s', { ...f.SALA, stato: 'confermato' }, 'Testo [[DA CONFERMARE: senza fine')],
    });
    expect(cause(trovaAperti(c, sitoPulito))).toEqual(['opere:marcatore', 'sale:marcatore']);
  });

  it('flags a place with verificato: false', () => {
    const c = contenuti({ luoghi: [voce('l', { ...f.LUOGO, stato: 'confermato' })] });
    expect(cause(trovaAperti(c, sitoPulito))).toEqual(['luoghi:coordinate']);
  });

  it('flags an image with altVerificato: false', () => {
    const c = contenuti({ immagini: [voce('i', { ...f.IMMAGINE, stato: 'confermato' })] });
    expect(cause(trovaAperti(c, sitoPulito))).toEqual(['immagini:alt']);
  });

  it('flags a doubtful field of sito.yaml', () => {
    const sito = { daConfermare: [{ campo: 'sostegno.iban', nota: 'Da riprendere' }] };
    const aperti = trovaAperti(contenuti({}), sito);
    expect(cause(aperti)).toEqual(['sito:dubbio']);
    expect(aperti[0]!.dettaglio).toContain('sostegno.iban');
  });

  it('flags a marker inside sito.yaml', () => {
    const sito = { ...sitoPulito, nome: 'Museo [[DA CONFERMARE: nome]]' };
    expect(cause(trovaAperti(contenuti({}), sito))).toEqual(['sito:marcatore']);
  });

  it('does not crash on data of the wrong shape (the schema reports those)', () => {
    const c = contenuti({
      opere: [voce('a', null), voce('b', 'testo'), voce('c', { daConfermare: 3 })],
    });
    expect(() => trovaAperti(c, undefined)).not.toThrow();
  });

  it('lists every cause of one entry', () => {
    const dati = {
      ...f.LUOGO,
      stato: 'segnaposto',
      daConfermare: [{ campo: 'lat', nota: 'Scritta da me' }],
    };
    expect(cause(trovaAperti(contenuti({ luoghi: [voce('l', dati)] }), sitoPulito))).toEqual([
      'luoghi:segnaposto',
      'luoghi:dubbio',
      'luoghi:coordinate',
    ]);
  });
});

describe('trovaMarcatori', () => {
  it('returns the reason of each marker', () => {
    expect(trovaMarcatori('A [[DA CONFERMARE: uno]] e B [[DA CONFERMARE: due]].')).toEqual([
      'uno',
      'due',
    ]);
  });

  it('keeps the text of a marker that is not in the standard form', () => {
    expect(trovaMarcatori('Frase [[verificare]].')).toEqual(['verificare']);
  });

  it('is empty when there is no marker', () => {
    expect(trovaMarcatori('Un testo [con parentesi] normale.')).toEqual([]);
  });
});

describe('formattaAperti', () => {
  it('prints one line per open item, with file and reason', () => {
    const testo = formattaAperti([
      { collezione: 'opere', file: 'a.md', causa: 'dubbio', dettaglio: 'anno: x' },
    ]);
    expect(testo).toContain('a.md');
    expect(testo).toContain('anno: x');
  });
});

describe('production block on a repository on disk', () => {
  const cartelle: string[] = [];
  afterEach(() => {
    for (const c of cartelle.splice(0)) rmSync(c, { recursive: true, force: true });
  });

  /** A repo with a clean sito.yaml and the given content files. */
  function repo(files: Record<string, string>): string {
    const radice = mkdtempSync(join(tmpdir(), 'aperti-'));
    cartelle.push(radice);
    const pulito = readFileSync(join(RADICE, 'src/data/sito.yaml'), 'utf8').replace(
      /^daConfermare:\n(?: {2}.*\n)+/m,
      'daConfermare: []\n',
    );
    const tutti = { 'src/data/sito.yaml': pulito, ...files };
    for (const [nome, testo] of Object.entries(tutti)) {
      mkdirSync(dirname(join(radice, nome)), { recursive: true });
      writeFileSync(join(radice, nome), testo);
    }
    return radice;
  }

  const opera = (extra: string, corpo = '') =>
    `---\ntitolo: Il portale\ncategoria: portale\nanno: 1980\nnellElenco: true\nmateriali: [bronzo]\nluogo: duomo\nstato: confermato\n${extra}---\n${corpo}\n`;
  const luogo = (verificato: boolean) =>
    `nome: Duomo\ncomune: Fermo\nprovincia: FM\nregione: Marche\nlat: 43.1\nlon: 13.7\nprecisione: punto\nverificato: ${verificato}\nstato: confermato\n`;

  it('lets a fully confirmed repo through', () => {
    const r = repo({
      'src/content/opere/it/il-portale.md': opera('', 'Testo.'),
      'src/content/luoghi/it/duomo.yaml': luogo(true),
    });
    expect(apertiDelRepo(r).aperti).toEqual([]);
  });

  const casi: [string, Record<string, string>, string][] = [
    [
      'an entry that is not confermato',
      {
        'src/content/opere/it/a.md': opera('').replace('stato: confermato', 'stato: da-confermare'),
      },
      'opere:da-confermare',
    ],
    [
      'a daConfermare item',
      { 'src/content/opere/it/a.md': opera('daConfermare:\n  - { campo: anno, nota: dubbio }\n') },
      'opere:dubbio',
    ],
    [
      'a [[...]] marker',
      { 'src/content/opere/it/a.md': opera('', 'Frase [[DA CONFERMARE: x]].') },
      'opere:marcatore',
    ],
    [
      'verificato: false',
      { 'src/content/luoghi/it/duomo.yaml': luogo(false) },
      'luoghi:coordinate',
    ],
    [
      'altVerificato: false',
      {
        'src/content/immagini/it/immagini.yaml':
          '- id: a\n  file: a.jpg\n  alt: Una foto\n  origine: fondazione\n  altVerificato: false\n  stato: confermato\n',
      },
      'immagini:alt',
    ],
    [
      'a doubtful sito.yaml field',
      {
        'src/data/sito.yaml': readFileSync(join(RADICE, 'src/data/sito.yaml'), 'utf8'),
      },
      'sito:dubbio',
    ],
  ];
  for (const [nome, files, atteso] of casi) {
    it(`stops production for ${nome}`, () => {
      const r = repo(files);
      const { aperti, problemi } = apertiDelRepo(r);
      expect(problemi).toEqual([]);
      expect(cause(aperti)).toContain(atteso);
    });
  }
});

describe('build:production on the real content', () => {
  it('fails with the list of open items', () => {
    const r = spawnSync('npm', ['run', 'build:production'], {
      cwd: RADICE,
      encoding: 'utf8',
      env: { ...process.env, ALLOW_OPEN_ITEMS: '' },
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('sostegno.iban');
    expect(r.stderr).toContain('src/data/sito.yaml');
  }, 60_000);
});
