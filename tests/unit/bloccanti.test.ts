import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { trovaAperti } from '../../src/lib/aperti.ts';
import { bloccoProduzione } from '../../src/lib/blocco-produzione.ts';
import {
  CAMPI_BLOCCANTI,
  PAGINE_BLOCCANTI,
  eBloccante,
  type Candidato,
} from '../../src/lib/bloccanti.ts';
import {
  controllaPagineBloccanti,
  type Contenuti,
  type Voce,
} from '../../src/lib/controllo-contenuti.ts';
import { COLLEZIONI, creaSchemi } from '../../src/lib/schemi.ts';

const base = { collezione: 'opere', id: 'a' } as const;
const blocca = (c: Partial<Candidato> & Pick<Candidato, 'causa'>) => eBloccante({ ...base, ...c });

describe('eBloccante', () => {
  it('dubbio: blocks with bloccante: true, in any collection', () => {
    expect(blocca({ causa: 'dubbio', campo: 'anno', bloccante: true })).toBe(true);
    expect(blocca({ causa: 'dubbio', campo: 'anno', bloccante: false })).toBe(false);
    expect(blocca({ causa: 'dubbio', campo: 'anno' })).toBe(false);
  });

  it('dubbio: a listed sito.yaml field blocks, and so do its sub-fields', () => {
    for (const campo of ['contatti.telefono', 'sostegno.iban', 'artista.nascita', 'orari.testo']) {
      expect(eBloccante({ collezione: 'sito', id: 'sito', causa: 'dubbio', campo })).toBe(true);
    }
    expect(eBloccante({ collezione: 'sito', id: 'sito', causa: 'dubbio', campo: 'social' })).toBe(
      false,
    );
    expect(
      eBloccante({ collezione: 'sito', id: 'sito', causa: 'dubbio', campo: 'artista.luogo' }),
    ).toBe(false);
  });

  it('dubbio: the list of sito.yaml fields does not apply to other collections', () => {
    expect(blocca({ causa: 'dubbio', campo: 'contatti' })).toBe(false);
  });

  it('marcatore: [[BLOCCANTE: ...]] and an unclosed marker block, the others do not', () => {
    expect(blocca({ causa: 'marcatore', testoMarcatore: 'BLOCCANTE: prezzo' })).toBe(true);
    expect(
      blocca({ causa: 'marcatore', testoMarcatore: 'DA CONFERMARE: x', nonChiuso: true }),
    ).toBe(true);
    expect(blocca({ causa: 'marcatore', testoMarcatore: 'DA CONFERMARE: x' })).toBe(false);
    expect(blocca({ causa: 'marcatore', testoMarcatore: 'verificare' })).toBe(false);
  });

  it('marcatore, da-confermare: block only in a legal page', () => {
    for (const id of PAGINE_BLOCCANTI) {
      for (const causa of ['marcatore', 'da-confermare'] as const) {
        expect(eBloccante({ collezione: 'pagine', id, causa, testoMarcatore: 'x' })).toBe(true);
      }
    }
    expect(eBloccante({ collezione: 'pagine', id: 'visita', causa: 'da-confermare' })).toBe(false);
    expect(eBloccante({ collezione: 'opere', id: 'privacy', causa: 'da-confermare' })).toBe(false);
  });

  it('segnaposto always blocks, in every collection', () => {
    for (const collezione of COLLEZIONI) {
      expect(eBloccante({ collezione, id: 'x', causa: 'segnaposto' })).toBe(true);
    }
  });

  it('coordinate and alt never block, not even in a legal page', () => {
    expect(eBloccante({ collezione: 'pagine', id: 'privacy', causa: 'coordinate' })).toBe(false);
    expect(eBloccante({ collezione: 'immagini', id: 'i', causa: 'alt' })).toBe(false);
  });

  it('the fixed lists are what the decision says', () => {
    expect(PAGINE_BLOCCANTI).toEqual(['privacy', 'note-legali', 'cookie', 'accessibilita']);
    expect(CAMPI_BLOCCANTI).toContain('sostegno');
  });
});

const voce = (id: string, dati: unknown, corpo = ''): Voce => ({
  id,
  etichetta: `${id}.md`,
  dati,
  corpo,
});
const vuoti = () =>
  Object.fromEntries(COLLEZIONI.map((c) => [c, [] as Voce[]])) as unknown as Contenuti;

describe('trovaAperti sets the flag', () => {
  it('marks a daConfermare item with bloccante: true', () => {
    const c = vuoti();
    c.opere.push(
      voce('a', {
        stato: 'confermato',
        daConfermare: [
          { campo: 'anno', nota: 'grave', bloccante: true },
          { campo: 'materiali', nota: 'lieve', bloccante: false },
        ],
      }),
    );
    expect(trovaAperti(c, {}).map((a) => a.bloccante)).toEqual([true, false]);
  });

  it('flags a marker, an unclosed marker and a [[BLOCCANTE]] marker', () => {
    const c = vuoti();
    c.opere.push(
      voce('a', { stato: 'confermato' }, 'A [[DA CONFERMARE: x]] B [[BLOCCANTE: prezzo]] C [[fine'),
    );
    expect(trovaAperti(c, {}).map((a) => a.bloccante)).toEqual([false, true, true]);
  });

  it('segnaposto blocks, da-confermare does not, a legal page does', () => {
    const c = vuoti();
    c.opere.push(voce('a', { stato: 'segnaposto' }), voce('b', { stato: 'da-confermare' }));
    c.pagine.push(voce('privacy', { stato: 'da-confermare' }));
    expect(trovaAperti(c, {}).map((a) => a.bloccante)).toEqual([true, false, true]);
  });

  it('sito.yaml: iban blocks, social does not', () => {
    const sito = {
      daConfermare: [
        { campo: 'sostegno.iban', nota: 'x' },
        { campo: 'social', nota: 'y' },
      ],
    };
    expect(trovaAperti(vuoti(), sito).map((a) => a.bloccante)).toEqual([true, false]);
  });
});

describe('schema of daConfermare', () => {
  it('accepts an optional bloccante', () => {
    const schemi = creaSchemi({ osserva: () => {} });
    const { daConfermare } = schemi.opere.shape as unknown as {
      daConfermare: { safeParse: (v: unknown) => { success: boolean } };
    };
    expect(daConfermare.safeParse([{ campo: 'a', nota: 'b', bloccante: true }]).success).toBe(true);
    expect(daConfermare.safeParse([{ campo: 'a', nota: 'b' }]).success).toBe(true);
    expect(daConfermare.safeParse([{ campo: 'a', nota: 'b', bloccante: 'si' }]).success).toBe(
      false,
    );
  });
});

describe('controllaPagineBloccanti', () => {
  it('reports a listed page that does not exist', () => {
    const c = vuoti();
    c.pagine.push(...['privacy', 'note-legali', 'cookie'].map((id) => voce(id, {})));
    const p = controllaPagineBloccanti(c);
    expect(p).toHaveLength(1);
    expect(p[0]!.messaggio).toContain('accessibilita');
  });
});

describe('production build hook', () => {
  const cartelle: string[] = [];
  afterEach(() => {
    for (const c of cartelle.splice(0)) rmSync(c, { recursive: true, force: true });
    delete process.env.SITE_ENV;
    delete process.env.ALLOW_OPEN_ITEMS;
  });

  function repo(opera: string): string {
    const radice = mkdtempSync(join(tmpdir(), 'bloccanti-'));
    cartelle.push(radice);
    const files: Record<string, string> = {
      'src/data/sito.yaml': 'daConfermare: []\nnome: Museo\n',
      'src/content/opere/it/a.md': opera,
    };
    for (const [nome, testo] of Object.entries(files)) {
      mkdirSync(dirname(join(radice, nome)), { recursive: true });
      writeFileSync(join(radice, nome), testo);
    }
    return radice;
  }
  const opera = (extra: string) =>
    `---\ntitolo: Il portale\ncategoria: portale\nanno: 1980\nnellElenco: true\nmateriali: [bronzo]\nluogo: duomo\nstato: confermato\n${extra}---\nTesto.\n`;

  function esegui(radice: string, env: Record<string, string>): void {
    Object.assign(process.env, env);
    const hook = bloccoProduzione().hooks['astro:config:setup'] as unknown as (a: unknown) => void;
    const logger = { warn: () => {} };
    hook({
      command: 'build',
      config: { root: pathToFileURL(resolve(radice) + '/') },
      logger,
    });
  }

  it('does not stop for not blocking items only', () => {
    const r = repo(opera('daConfermare:\n  - { campo: anno, nota: lieve }\n'));
    expect(() => esegui(r, { SITE_ENV: 'production' })).not.toThrow();
  });

  it('stops for a blocking item and lists only the blocking ones', () => {
    const r = repo(
      opera(
        'daConfermare:\n  - { campo: anno, nota: lieve }\n  - { campo: materiali, nota: grave, bloccante: true }\n',
      ),
    );
    let messaggio = '';
    try {
      esegui(r, { SITE_ENV: 'production' });
    } catch (e) {
      messaggio = (e as Error).message;
    }
    expect(messaggio).toContain('1 blocking item(s)');
    expect(messaggio).toContain('1 more open item(s) do not block');
    expect(messaggio).toContain('materiali: grave');
    expect(messaggio).not.toContain('lieve');
  });

  it('ALLOW_OPEN_ITEMS=1 does not stop for anything', () => {
    const r = repo(opera('daConfermare:\n  - { campo: anno, nota: x, bloccante: true }\n'));
    expect(() => esegui(r, { SITE_ENV: 'production', ALLOW_OPEN_ITEMS: '1' })).not.toThrow();
  });
});
