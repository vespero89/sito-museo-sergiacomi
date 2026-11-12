// The single source of the hosting rules: security headers, CSP and redirects (spec 4.1, 6.4, 6.6).
// `scripts/emit-hosting.mjs` turns it into `dist/_headers` and `dist/_redirects` (Cloudflare Pages)
// and `scripts/serve-dist.mjs` applies the same rules, so the CSP that the tests prove is the CSP
// that ships. A configuration for another server (Caddy, nginx) is generated only when that server
// is chosen (spec 6.6): add a generator next to `emit-hosting.mjs` then, not before.
//
// What is indexable, and whether HSTS is sent, comes from `decidiModalita` (src/lib/modalita.ts),
// never from the environment variables directly. The CSP sources of external services come from the
// services registry (src/data/servizi.ts).
//
// PRIVATE PREVIEW (spec 6.4, requirement of Fabio, 12/11/2026): while the site is a preview, the
// noindex header is not enough. The preview must also sit behind an access control (Cloudflare
// Access, or a password on Fabio's own server) before anyone is given the address. See README.md.
import { decidiModalita } from '../src/lib/modalita.ts';
import { dominiCspAttivi } from '../src/data/servizi.ts';

/** Cloudflare Pages accepts at most 100 rules in `_headers`. */
export const MAX_REGOLE_HEADERS = 100;
/** Cloudflare Pages accepts at most 2000 static redirects. */
export const MAX_REDIRECT = 2000;
/** Cloudflare Pages ignores a `_headers` line longer than this. */
export const MAX_RIGA_HEADERS = 2000;

const UN_ANNO = 60 * 60 * 24 * 365;

// ---------------------------------------------------------------------------------------------
// Redirects from the old site (spec 4.1). Every rule carries an explicit 301: Cloudflare uses 302
// when the code is missing.

/**
 * @typedef {{ da: string, a: string, codice: 301 }} Redirect
 * @typedef {{ percorso: string, intestazioni: Record<string, string> }} RegolaHeaders
 * @typedef {import('../src/lib/modalita.ts').Modalita} Modalita
 * @typedef {Partial<Record<string, string[]>>} DominiCsp
 */

/**
 * Old page -> new page. The old site ran on IIS and its file names were lower case.
 * @type {ReadonlyArray<readonly [string, string]>}
 */
const VECCHIE_PAGINE = [
  ['/index.htm', '/'],
  ['/index.html', '/'],
  ['/chisiamo.htm', '/chi-siamo/'],
  ['/lartista.htm', '/aldo-sergiacomi/'],
  ['/immagini_dellartista.htm', '/aldo-sergiacomi/'],
  ['/articolo_camilli.htm', '/archivio/'],
  ['/pergamena_ricordo_dono_della_com.htm', '/archivio/'],
  ['/ilmuseo.htm', '/il-museo/'],
  ['/immaginimuseo.htm', '/il-museo/'],
  ['/iniziative.htm', '/eventi/'],
  ['/dovesiamo.htm', '/visita/'],
  ['/contatti.htm', '/contatti/'],
  ['/centenario_aldo_sergiacomi.htm', '/eventi/centenario-2012/'],
];

/**
 * Writings of the old addresses that links in the wild may use, besides the lower case one. IIS
 * ignores case, Cloudflare does not, so each spelling is its own rule. Decided here (spec 4.1):
 * the capitalised file name (`/Chisiamo.htm`) and the camel case spelling of the names made of
 * several words (`/ChiSiamo.htm`). The list is short on purpose: it can grow if a real link shows up.
 */
/** @type {Record<string, string[]>} */
const NOMI_COMPOSTI = {
  '/chisiamo.htm': ['ChiSiamo'],
  '/ilmuseo.htm': ['IlMuseo'],
  '/immaginimuseo.htm': ['ImmaginiMuseo'],
  '/dovesiamo.htm': ['DoveSiamo'],
  '/lartista.htm': ['LArtista'],
};

/**
 * All the spellings of an old address: lower case, capitalised, and the camel case ones.
 * @param {string} percorso
 * @returns {string[]}
 */
export function variantiMaiuscole(percorso) {
  const nome = percorso.slice(1, percorso.lastIndexOf('.'));
  const estensione = percorso.slice(percorso.lastIndexOf('.'));
  const maiuscola = nome.charAt(0).toUpperCase() + nome.slice(1);
  const camel = NOMI_COMPOSTI[percorso] ?? [];
  return [
    ...new Set([percorso, `/${maiuscola}${estensione}`, ...camel.map((n) => `/${n}${estensione}`)]),
  ];
}

/**
 * Every redirect, with the case variants.
 * @returns {Redirect[]}
 */
export function creaRedirect() {
  return VECCHIE_PAGINE.flatMap(([da, a]) =>
    variantiMaiuscole(da).map((variante) => ({ da: variante, a, codice: 301 })),
  );
}

// ---------------------------------------------------------------------------------------------
// Content Security Policy (spec 6.6).

/**
 * Sources every page needs. The registry adds the ones of the active services.
 * @type {Record<string, string[]>}
 */
const CSP_BASE = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'wasm-unsafe-eval'"],
  'style-src': ["'self'"],
  'img-src': ["'self'", 'data:'],
  'font-src': ["'self'"],
  'connect-src': ["'self'"],
  'frame-src': [],
  'frame-ancestors': ["'none'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'manifest-src': ["'self'"],
};

/**
 * The CSP as one string. `domini` maps a directive to the sources of the active services (default:
 * the registry). A directive without sources is `'none'`: that is how `frame-src` starts, and
 * `'none'` is dropped as soon as a service needs a frame.
 * @param {DominiCsp} [domini]
 * @returns {string}
 */
export function creaCsp(domini = dominiCspAttivi()) {
  const parti = Object.entries(CSP_BASE).map(([direttiva, fonti]) => {
    const tutte = [...new Set([...fonti, ...(domini[direttiva] ?? [])])];
    return `${direttiva} ${tutte.length > 0 ? tutte.join(' ') : "'none'"}`;
  });
  return parti.join('; ');
}

// ---------------------------------------------------------------------------------------------
// Headers.

/**
 * The rules of `_headers`, in order: `[{ percorso, intestazioni: { Nome: valore } }]`.
 * `modalita` is the answer of `decidiModalita`. `https` says whether the site is served over
 * https (Cloudflare always is, the local test server is not): HSTS needs both https and a
 * production build.
 *
 * `Cache-Control` is NOT on the general rule: Cloudflare joins the values of the same header from
 * every rule that matches, so a general value would be glued to the long one of `/_astro/*`.
 * @param {Modalita} modalita
 * @param {{ https: boolean, csp?: string }} opzioni
 * @returns {RegolaHeaders[]}
 */
export function creaIntestazioni(modalita, { https, csp = creaCsp() }) {
  /** @type {Record<string, string>} */
  const generali = {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), payment=(), usb=(), geolocation=(self)',
    'Cross-Origin-Opener-Policy': 'same-origin',
  };
  if (modalita.noindex) generali['X-Robots-Tag'] = 'noindex';
  if (https && !modalita.anteprima) {
    generali['Strict-Transport-Security'] = `max-age=${UN_ANNO}`;
  }
  return [
    { percorso: '/*', intestazioni: generali },
    // Built files carry a hash in the name: they never change.
    {
      percorso: '/_astro/*',
      intestazioni: { 'Cache-Control': `public, max-age=${UN_ANNO}, immutable` },
    },
    // The search index is rebuilt with the site under the same names: always revalidate.
    {
      percorso: '/pagefind/*',
      intestazioni: { 'Cache-Control': 'public, max-age=0, must-revalidate' },
    },
  ];
}

/** @param {string} percorso */
function perCloudflare(percorso) {
  return new RegExp(`^${percorso.split('*').map(escapaRegex).join('.*')}$`);
}

/** @param {string} testo */
function escapaRegex(testo) {
  return testo.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The headers a path gets, merging the rules the way Cloudflare Pages does: every matching rule
 * applies, and the values of a same header are joined with a comma. Returns `{ nome: valore }`
 * with the names as written in the first rule that sets them.
 * @param {RegolaHeaders[]} regole
 * @param {string} percorso
 * @returns {Record<string, string>}
 */
export function intestazioniPer(regole, percorso) {
  const out = new Map();
  for (const regola of regole) {
    if (!perCloudflare(regola.percorso).test(percorso)) continue;
    for (const [nome, valore] of Object.entries(regola.intestazioni)) {
      const chiave = nome.toLowerCase();
      const prima = out.get(chiave);
      out.set(
        chiave,
        prima ? { nome: prima.nome, valore: `${prima.valore}, ${valore}` } : { nome, valore },
      );
    }
  }
  return Object.fromEntries([...out.values()].map(({ nome, valore }) => [nome, valore]));
}

// ---------------------------------------------------------------------------------------------
// Files.

const NOTA_ANTEPRIMA = [
  '# PRIVATE PREVIEW. This build is for review only (spec 6.4).',
  '# noindex is not protection: put the site behind Cloudflare Access (or a password on the server)',
  '# before anyone is given the address. See README.md, "Private preview".',
];

/**
 * The text of `_headers`.
 * @param {RegolaHeaders[]} regole
 * @param {Modalita} modalita
 */
export function renderHeaders(regole, modalita) {
  const righe = [
    '# Generated by scripts/emit-hosting.mjs from config/hosting.mjs. Do not edit.',
    ...(modalita.anteprima ? NOTA_ANTEPRIMA : []),
    '',
  ];
  for (const { percorso, intestazioni } of regole) {
    righe.push(percorso);
    for (const [nome, valore] of Object.entries(intestazioni)) righe.push(`  ${nome}: ${valore}`);
  }
  return `${righe.join('\n')}\n`;
}

/**
 * Reads a `_headers` text back into rules (what Cloudflare does), to test the generated file.
 * @param {string} testo
 * @returns {RegolaHeaders[]}
 */
export function leggiHeaders(testo) {
  /** @type {RegolaHeaders[]} */
  const regole = [];
  for (const riga of testo.split('\n')) {
    if (riga.trim() === '' || riga.startsWith('#')) continue;
    if (!/^\s/.test(riga)) {
      regole.push({ percorso: riga.trim(), intestazioni: {} });
      continue;
    }
    const corrente = regole.at(-1);
    const due = riga.indexOf(':');
    if (!corrente || due < 0) throw new Error(`Bad line in _headers: "${riga}"`);
    corrente.intestazioni[riga.slice(0, due).trim()] = riga.slice(due + 1).trim();
  }
  return regole;
}

/**
 * The text of `_redirects`: `from to code`, one per line.
 * @param {Redirect[]} redirect
 * @param {Modalita} modalita
 */
export function renderRedirects(redirect, modalita) {
  const righe = [
    '# Generated by scripts/emit-hosting.mjs from config/hosting.mjs. Do not edit.',
    ...(modalita.anteprima ? NOTA_ANTEPRIMA : []),
    ...redirect.map(({ da, a, codice }) => `${da} ${a} ${codice}`),
  ];
  return `${righe.join('\n')}\n`;
}

/**
 * Everything the hosting needs for one build: `{ modalita, intestazioni, redirect }`.
 * `env` is `process.env` (or a test object); it is only given to `decidiModalita`.
 * @param {Record<string, string | undefined>} env
 * @param {{ https: boolean }} opzioni
 */
export function creaHosting(env, { https }) {
  const modalita = decidiModalita(env);
  return {
    modalita,
    intestazioni: creaIntestazioni(modalita, { https }),
    redirect: creaRedirect(),
  };
}
