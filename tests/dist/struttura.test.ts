import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseHTML } from 'linkedom';
import { describe, expect, it } from 'vitest';
import { decidiModalita } from '../../src/lib/modalita';
import { ORIGINE_PREDEFINITA } from '../../src/lib/seo';
import {
  fileDi,
  indirizzoDi,
  linkRotti,
  problemiPagina,
  riferimentiInterni,
  titoliDoppi,
  type ContestoPagina,
} from './controlli-struttura';
import { DIST, builtPages } from './helpers';

const ORIGINE = process.env['SITE_URL'] || ORIGINE_PREDEFINITA;
const noindex = decidiModalita(process.env).noindex;
const future: string[] = JSON.parse(readFileSync(join(import.meta.dirname, 'pagine-future.json'), 'utf8'));

const pagina = (html: string) => parseHTML(html).document;
const contesto = (extra: Partial<ContestoPagina> = {}): ContestoPagina => ({
  indirizzo: '/prova/',
  origine: 'https://esempio.test',
  errore: false,
  noindex: false,
  ...extra,
});

const DESCRIZIONE = 'Una descrizione di prova abbastanza lunga da stare tra i settanta e i centosessanta caratteri.';
function paginaBuona(corpo = '<h1>Titolo</h1><h2>Sezione</h2>', head = ''): string {
  const og = ['site_name', 'type', 'title', 'description', 'url', 'locale', 'image']
    .map((k) => `<meta property="og:${k}" content="${k === 'url' ? 'https://esempio.test/prova/' : 'x'}">`)
    .join('');
  const tw = ['card', 'title', 'description', 'image']
    .map((k) => `<meta name="twitter:${k}" content="x">`)
    .join('');
  return `<!doctype html><html lang="it"><head><title>Prova</title>
    <meta name="description" content="${DESCRIZIONE}">
    <link rel="canonical" href="https://esempio.test/prova/">${og}${tw}${head}</head><body>${corpo}</body></html>`;
}

describe('problemiPagina (the check applied to every built page)', () => {
  it('passes a good page', () => {
    expect(problemiPagina(pagina(paginaBuona()), contesto())).toEqual([]);
  });

  it('fails on a missing lang, title or a description out of range', () => {
    const html = paginaBuona().replace('lang="it"', '').replace('<title>Prova</title>', '');
    const problemi = problemiPagina(pagina(html.replace(DESCRIZIONE, 'Troppo corta')), contesto());
    expect(problemi).toEqual(
      expect.arrayContaining(['<html lang="it"> missing', 'no <title>', expect.stringContaining('wanted 70-160')]),
    );
  });

  it('fails on zero or two h1 and on a skipped heading level', () => {
    expect(problemiPagina(pagina(paginaBuona('<h2>Solo</h2>')), contesto())).toEqual(
      expect.arrayContaining([expect.stringContaining('0 <h1>')]),
    );
    expect(problemiPagina(pagina(paginaBuona('<h1>A</h1><h1>B</h1>')), contesto())).toEqual(
      expect.arrayContaining([expect.stringContaining('2 <h1>')]),
    );
    expect(problemiPagina(pagina(paginaBuona('<h1>A</h1><h3>B</h3>')), contesto())).toEqual([
      'heading jumps from h1 to h3',
    ]);
  });

  it('fails when the canonical is missing, relative or for another page', () => {
    const senza = paginaBuona().replace(/<link rel="canonical"[^>]*>/, '');
    expect(problemiPagina(pagina(senza), contesto())[0]).toContain('0 canonical');
    const altra = paginaBuona().replace('esempio.test/prova/">', 'esempio.test/altra/">');
    expect(problemiPagina(pagina(altra), contesto())[0]).toContain('canonical is');
  });

  it('fails when an Open Graph or Twitter tag is missing', () => {
    const html = paginaBuona().replace(/<meta name="twitter:card"[^>]*>/, '');
    expect(problemiPagina(pagina(html), contesto())).toEqual(['twitter:card missing']);
  });

  it('wants noindex exactly when the mode asks for it', () => {
    const con = paginaBuona('<h1>A</h1>', '<meta name="robots" content="noindex">');
    expect(problemiPagina(pagina(con), contesto({ noindex: true }))).toEqual([]);
    expect(problemiPagina(pagina(con), contesto({ noindex: false }))).toEqual([
      'noindex on an indexable build',
    ]);
    expect(problemiPagina(pagina(paginaBuona()), contesto({ noindex: true }))).toEqual(['noindex missing']);
  });

  it('wants the error page with noindex and without canonical or social cards', () => {
    const errore = `<!doctype html><html lang="it"><head><title>x</title><meta name="description" content="${DESCRIZIONE}"><meta name="robots" content="noindex"></head><body><h1>A</h1></body></html>`;
    expect(problemiPagina(pagina(errore), contesto({ errore: true }))).toEqual([]);
    expect(problemiPagina(pagina(paginaBuona()), contesto({ errore: true }))).toEqual(
      expect.arrayContaining(['the error page must have no canonical', 'noindex missing']),
    );
  });

  it('fails on a link without text, a duplicate id and a dead anchor', () => {
    const corpo = '<h1 id="a">A</h1><a href="/x/"> </a><p id="a">B</p><a href="#manca">Vai</a>';
    expect(problemiPagina(pagina(paginaBuona(corpo)), contesto())).toEqual([
      'link without text: /x/',
      'duplicate id "a"',
      'anchor #manca points at nothing',
    ]);
  });

  it('accepts a link named by aria-label or by the alt of its image', () => {
    const corpo = '<h1>A</h1><a href="/x/" aria-label="Vai"><svg></svg></a><a href="/y/"><img alt="Logo" src="/l.png"></a>';
    expect(problemiPagina(pagina(paginaBuona(corpo)), contesto())).toEqual([]);
  });
});

describe('titoliDoppi', () => {
  it('reports a title used by two pages', () => {
    const p = (path: string, titolo: string) => ({
      path,
      document: pagina(`<title>${titolo}</title>`),
    });
    expect(titoliDoppi([p('a.html', 'Uno'), p('b.html', 'Due')])).toEqual([]);
    expect(titoliDoppi([p('a.html', 'Uno'), p('b.html', 'Uno')])).toEqual([
      'title "Uno" is on a.html, b.html',
    ]);
  });
});

describe('internal links', () => {
  it('names the address of a built file', () => {
    expect(indirizzoDi('index.html')).toBe('/');
    expect(indirizzoDi('il-museo/index.html')).toBe('/il-museo/');
    expect(indirizzoDi('404.html')).toBe('/404.html');
  });

  it('collects links, scripts, styles, images and preview images on the same origin only', () => {
    const html = paginaBuona(
      '<h1>A</h1><a href="/a/">a</a><a href="https://altro.test/">x</a><a href="mailto:a@b.it">m</a><a href="#qui">q</a><img src="/i.jpg" srcset="/i-1.jpg 480w, /i-2.jpg 800w" alt="">',
      '<link rel="stylesheet" href="/_astro/a.css">',
    );
    const percorsi = riferimentiInterni(pagina(html), 'https://esempio.test', '/prova/').map(
      (u) => u.pathname + u.hash,
    );
    expect(percorsi).toEqual(
      expect.arrayContaining(['/a/', '/prova/#qui', '/i.jpg', '/i-1.jpg', '/i-2.jpg', '/_astro/a.css', '/prova/x']),
    );
    expect(percorsi).not.toContain('/');
    expect(percorsi.some((p) => p.includes('altro'))).toBe(false);
  });

  it('reports a link to a page that is neither built nor in the list of future pages', () => {
    const rif = [new URL('/nuova/', 'https://esempio.test'), new URL('/manca/', 'https://esempio.test')];
    expect(linkRotti(rif, DIST, ['/nuova/'], () => undefined)).toEqual(['broken link: /manca/']);
  });

  it('reports an anchor that the built target page does not have', () => {
    const rif = [new URL('/#non-esiste', 'https://esempio.test')];
    expect(linkRotti(rif, DIST, [], () => new Set(['contenuto']))).toEqual([
      'broken anchor: /#non-esiste',
    ]);
    expect(linkRotti([new URL('/#contenuto', 'https://esempio.test')], DIST, [], () => new Set(['contenuto']))).toEqual([]);
  });
});

describe('the built pages', () => {
  const pagine = builtPages();

  it.each(pagine.map((p) => [p.path, p.document] as const))(
    '%s: structure, head and heading order',
    (path, document) => {
      const indirizzo = indirizzoDi(path);
      expect(
        problemiPagina(document, { indirizzo, origine: ORIGINE, errore: path === '404.html', noindex }),
      ).toEqual([]);
    },
  );

  it('has no title used twice', () => {
    expect(titoliDoppi(pagine)).toEqual([]);
  });

  it('has no broken internal link, apart from the pages still to come', () => {
    const idPerFile = new Map(
      pagine.map((p) => [
        join(DIST, p.path),
        new Set([...p.document.querySelectorAll('[id]')].map((e) => e.getAttribute('id')!)),
      ]),
    );
    const problemi = pagine.flatMap((p) =>
      linkRotti(
        riferimentiInterni(p.document, ORIGINE, indirizzoDi(p.path)),
        DIST,
        future,
        (file) => idPerFile.get(file),
      ).map((riga) => `${p.path}: ${riga}`),
    );
    expect(problemi).toEqual([]);
  });
});

describe('pagine-future.json', () => {
  it('lists only addresses of pages that do not exist yet', () => {
    const esistenti = future.filter((indirizzo) => fileDi(DIST, indirizzo));
    expect(esistenti, 'built pages: remove them from the list').toEqual([]);
  });

  it('lists each address once, with a final slash', () => {
    expect(new Set(future).size).toBe(future.length);
    expect(future.every((i) => i.startsWith('/') && i.endsWith('/'))).toBe(true);
  });
});
