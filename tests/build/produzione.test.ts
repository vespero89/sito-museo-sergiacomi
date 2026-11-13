import { spawnSync } from 'node:child_process';
import { cpSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { apertiDelRepo } from '../../src/lib/aperti.ts';
import { walk } from '../dist/helpers';

// The safety net of the open items (spec 3.5): a real production build (SITE_ENV=production,
// ALLOW_OPEN_ITEMS not set) must not carry any trace of an open item. The real content cannot be
// built in production while a blocking item is open, so the test builds a throw-away copy of the
// project (dist*/ is git-ignored, and node_modules is linked) whose content has the
// blocking items resolved and everything else left open: that is exactly the case the build lets
// through. It also adds a marker to a title in the frontmatter, which the real content has not.
const RADICE = join(import.meta.dirname, '..', '..');
const COPIA = join(RADICE, 'dist-test-produzione');
const DIST = join(COPIA, 'dist');

const PAGINE_LEGALI = ['privacy', 'note-legali', 'cookie', 'accessibilita'];

/** Resolves the blocking items of the copy; the non-blocking ones stay open. */
function risolviBloccanti(radice: string): void {
  const contenuti = join(radice, 'src', 'content');
  for (const file of walk(contenuti).filter((f) => /\.(md|yaml)$/.test(f))) {
    const id = file
      .replace(/\.(md|yaml)$/, '')
      .split('/')
      .pop()!;
    const legale = file.includes('/pagine/') && PAGINE_LEGALI.includes(id);
    let testo = readFileSync(file, 'utf8');
    testo = testo
      .replace(/^stato: segnaposto$/gm, legale ? 'stato: confermato' : 'stato: da-confermare')
      .replace(/^stato: da-confermare$/gm, legale ? 'stato: confermato' : 'stato: da-confermare')
      .replace(/bloccante: true/g, 'bloccante: false')
      .replace(/\[\[BLOCCANTE:/g, '[[DA CONFERMARE:');
    // A legal page may not carry any open item: the markers of its text become plain words.
    if (legale) testo = testo.replace(/\s*\[\[[\s\S]*?\]\]/g, '');
    writeFileSync(file, testo);
  }
  // The doubts of sito.yaml on blocking fields (phone, IBAN, birth...) are cleared; `social` stays.
  const sito = join(radice, 'src', 'data', 'sito.yaml');
  const righe = readFileSync(sito, 'utf8').split('\n');
  const fuori: string[] = [];
  for (let i = 0; i < righe.length; i++) {
    const campo = /^ {2}- campo: (\S+)/.exec(righe[i]!)?.[1];
    if (campo && campo !== 'social' && righe[i + 1]?.startsWith('    nota:')) {
      i += 1; // the item takes two lines: campo and nota
      continue;
    }
    fuori.push(righe[i]!);
  }
  writeFileSync(sito, fuori.join('\n'));
}

beforeAll(() => {
  rmSync(COPIA, { recursive: true, force: true });
  for (const voce of ['src', 'public', 'config', 'scripts']) {
    cpSync(join(RADICE, voce), join(COPIA, voce), { recursive: true });
  }
  for (const file of ['astro.config.mjs', 'package.json', 'tsconfig.json', '.npmrc']) {
    cpSync(join(RADICE, file), join(COPIA, file));
  }
  // The config points at ./node_modules (the alias of the gesture handling): the copy shares it.
  symlinkSync(join(RADICE, 'node_modules'), join(COPIA, 'node_modules'), 'dir');
  risolviBloccanti(COPIA);

  // A marker in the frontmatter of a page that is not legal.
  const visita = join(COPIA, 'src', 'content', 'pagine', 'it', 'visita.md');
  writeFileSync(
    visita,
    readFileSync(visita, 'utf8').replace(
      /^descrizione: '/m,
      "descrizione: '[[DA CONFERMARE: frase da rivedere]]",
    ),
  );

  const { aperti, problemi } = apertiDelRepo(COPIA);
  if (problemi.length > 0 || aperti.some((a) => a.bloccante)) {
    throw new Error(
      `the copy still has blocking items:\n${JSON.stringify(aperti.filter((a) => a.bloccante))}`,
    );
  }
  if (aperti.length === 0)
    throw new Error('the copy has no open item: the test would prove nothing');

  const esito = spawnSync(
    process.execPath,
    [join(RADICE, 'node_modules', 'astro', 'bin', 'astro.mjs'), 'build'],
    {
      cwd: COPIA,
      encoding: 'utf8',
      env: { ...process.env, SITE_ENV: 'production', ALLOW_OPEN_ITEMS: '' },
    },
  );
  if (esito.status !== 0)
    throw new Error(`the production build failed:\n${esito.stdout}${esito.stderr}`);
}, 600_000);

afterAll(() => {
  rmSync(COPIA, { recursive: true, force: true });
});

const testi = () =>
  walk(DIST)
    .filter((f) => /\.(html|txt|xml|json)$/.test(f))
    .map((f) => ({ file: f.slice(DIST.length), testo: readFileSync(f, 'utf8') }));

describe('a production build with only non-blocking open items', () => {
  it('has built the pages', () => {
    expect(readdirSync(DIST)).toContain('index.html');
    expect(testi().some((t) => t.file.endsWith('/visita/index.html'))).toBe(true);
  });

  it('has no [[...]] marker in any page (the [[ of map coordinates is not one)', () => {
    expect(testi().filter((t) => /\[\[\s*[\p{L}]/u.test(t.testo))).toEqual([]);
  });

  it('has no "da confermare" label or box, and no generated-text label', () => {
    const trovati = testi().filter((t) =>
      /da-confermare|Da confermare|Testo generato, da approvare|class="dubbi"/.test(t.testo),
    );
    expect(trovati.map((t) => t.file)).toEqual([]);
  });

  it('keeps the text around the removed markers and the cleaned title', () => {
    const visita = testi().find((t) => t.file.endsWith('/visita/index.html'))!.testo;
    expect(visita).toContain('Il museo si visita solo su prenotazione');
    expect(visita).toMatch(/content="Come prenotare una visita/);
  });

  it('leaves out the social block and the phone, which are doubtful', () => {
    const visita = testi().find((t) => t.file.endsWith('/visita/index.html'))!.testo;
    expect(visita).not.toContain('Social');
    expect(visita).not.toContain('Telefono');
  });
});
