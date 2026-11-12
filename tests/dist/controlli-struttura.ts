// Structure checks on a built page (spec 8-A). Each function returns readable lines; empty when
// all is well. The dist tests apply them to every page, and test them on bad HTML first.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface ContestoPagina {
  /** Address of the page, like `/il-museo/`. */
  indirizzo: string;
  /** Origin the canonical and Open Graph addresses must carry. */
  origine: string;
  /** The error page: no canonical, no Open Graph, always noindex. */
  errore: boolean;
  /** Does the build mode ask for `noindex` on every page? */
  noindex: boolean;
}

const OG = ['og:site_name', 'og:type', 'og:title', 'og:description', 'og:url', 'og:locale', 'og:image'];
const TWITTER = ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'];

/** The address of a built file: `a/b/index.html` is `/a/b/`, `404.html` is `/404.html`. */
export function indirizzoDi(percorsoFile: string): string {
  const unix = percorsoFile.split('\\').join('/');
  if (unix === 'index.html') return '/';
  if (unix.endsWith('/index.html')) return `/${unix.slice(0, -'index.html'.length)}`;
  return `/${unix}`;
}

const meta = (document: Document, chiave: string) =>
  [...document.querySelectorAll('meta')].filter(
    (m) => m.getAttribute('property') === chiave || m.getAttribute('name') === chiave,
  );

export function problemiPagina(document: Document, contesto: ContestoPagina): string[] {
  const problemi: string[] = [];
  const html = document.documentElement;

  if (html.getAttribute('lang') !== 'it') problemi.push('<html lang="it"> missing');

  const titolo = document.querySelector('title')?.textContent?.trim();
  if (!titolo) problemi.push('no <title>');

  const descrizione = meta(document, 'description')[0]?.getAttribute('content')?.trim() ?? '';
  if (descrizione.length < 70 || descrizione.length > 160) {
    problemi.push(`description has ${descrizione.length} characters, wanted 70-160`);
  }

  // Headings: one h1, no skipped level.
  const titoli = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')];
  const livelli = titoli.map((h) => Number(h.tagName[1]));
  const numeroH1 = livelli.filter((l) => l === 1).length;
  if (numeroH1 !== 1) problemi.push(`${numeroH1} <h1>, wanted exactly one`);
  livelli.forEach((livello, i) => {
    const prima = i === 0 ? 0 : livelli[i - 1]!;
    if (livello > prima + 1) problemi.push(`heading jumps from h${prima} to h${livello}`);
  });

  // Canonical and social cards.
  const canonical = [...document.querySelectorAll('link[rel="canonical"]')];
  if (contesto.errore) {
    if (canonical.length > 0) problemi.push('the error page must have no canonical');
    for (const chiave of [...OG, ...TWITTER]) {
      if (meta(document, chiave).length > 0) problemi.push(`the error page must have no ${chiave}`);
    }
  } else {
    const atteso = new URL(contesto.indirizzo, contesto.origine).href;
    if (canonical.length !== 1) problemi.push(`${canonical.length} canonical links, wanted one`);
    else if (canonical[0]!.getAttribute('href') !== atteso) {
      problemi.push(`canonical is ${canonical[0]!.getAttribute('href')}, wanted ${atteso}`);
    }
    for (const chiave of [...OG, ...TWITTER]) {
      if (!meta(document, chiave)[0]?.getAttribute('content')) problemi.push(`${chiave} missing`);
    }
    if (meta(document, 'og:url')[0]?.getAttribute('content') !== atteso) {
      problemi.push('og:url differs from the canonical address');
    }
  }

  // Robots follows the build mode; the error page is always noindex.
  const noindex = meta(document, 'robots').some((m) => /noindex/.test(m.getAttribute('content') ?? ''));
  if (noindex !== (contesto.noindex || contesto.errore)) {
    problemi.push(noindex ? 'noindex on an indexable build' : 'noindex missing');
  }

  // Links need a name (text, aria-label or the alt of an image inside).
  for (const a of document.querySelectorAll('a[href]')) {
    const nome =
      a.textContent?.trim() ||
      a.getAttribute('aria-label')?.trim() ||
      [...a.querySelectorAll('img')].map((i) => i.getAttribute('alt')?.trim()).join('');
    if (!nome) problemi.push(`link without text: ${a.getAttribute('href')}`);
  }

  // Ids are unique and same-page anchors point at one.
  const visti = new Set<string>();
  for (const el of document.querySelectorAll('[id]')) {
    const id = el.getAttribute('id')!;
    if (visti.has(id)) problemi.push(`duplicate id "${id}"`);
    visti.add(id);
  }
  for (const a of document.querySelectorAll('a[href^="#"]')) {
    const id = decodeURIComponent(a.getAttribute('href')!.slice(1));
    if (id && !visti.has(id)) problemi.push(`anchor #${id} points at nothing`);
  }
  return problemi;
}

/** Titles that appear on more than one page. */
export function titoliDoppi(pagine: { path: string; document: Document }[]): string[] {
  const perTitolo = new Map<string, string[]>();
  for (const { path, document } of pagine) {
    const titolo = document.querySelector('title')?.textContent?.trim() ?? '';
    perTitolo.set(titolo, [...(perTitolo.get(titolo) ?? []), path]);
  }
  return [...perTitolo]
    .filter(([, percorsi]) => percorsi.length > 1)
    .map(([titolo, percorsi]) => `title "${titolo}" is on ${percorsi.join(', ')}`);
}

/** Every internal address a page points at (links, scripts, styles, images, preview image). */
export function riferimentiInterni(document: Document, origine: string, indirizzo: string): URL[] {
  const grezzi: string[] = [];
  for (const el of document.querySelectorAll('a[href], link[href], script[src], img[src], source[src]')) {
    // Canonical and hreflang carry the public address, not a file of this build: checked elsewhere.
    if (el.tagName === 'LINK' && ['canonical', 'alternate'].includes(el.getAttribute('rel') ?? '')) {
      continue;
    }
    grezzi.push(el.getAttribute('href') ?? el.getAttribute('src')!);
  }
  for (const el of document.querySelectorAll('img[srcset], source[srcset]')) {
    for (const parte of el.getAttribute('srcset')!.split(',')) grezzi.push(parte.trim().split(/\s+/)[0]!);
  }
  for (const chiave of ['og:image', 'twitter:image']) {
    const valore = meta(document, chiave)[0]?.getAttribute('content');
    if (valore) grezzi.push(valore);
  }
  return grezzi
    .filter((r) => r !== '' && !/^(mailto:|tel:|data:|javascript:)/.test(r))
    .map((r) => new URL(r, new URL(indirizzo, origine)))
    .filter((url) => url.origin === new URL(origine).origin);
}

/** The built file a pathname answers with, or undefined when there is none. */
export function fileDi(dist: string, pathname: string): string | undefined {
  const relativo = decodeURIComponent(pathname).replace(/^\//, '');
  const file = pathname.endsWith('/') ? join(dist, relativo, 'index.html') : join(dist, relativo);
  return existsSync(file) ? file : undefined;
}

/**
 * Broken internal links of a page: the target is not built and not in the list of pages that later
 * tasks still have to create. A link with an anchor also needs the anchor in the target page.
 */
export function linkRotti(
  riferimenti: URL[],
  dist: string,
  future: readonly string[],
  idDi: (file: string) => ReadonlySet<string> | undefined,
): string[] {
  const problemi: string[] = [];
  for (const url of riferimenti) {
    if (future.includes(url.pathname)) continue;
    const file = fileDi(dist, url.pathname);
    if (!file) {
      problemi.push(`broken link: ${url.pathname}`);
      continue;
    }
    const ancora = decodeURIComponent(url.hash.slice(1));
    if (ancora && file.endsWith('.html') && !idDi(file)?.has(ancora)) {
      problemi.push(`broken anchor: ${url.pathname}#${ancora}`);
    }
  }
  return problemi;
}
