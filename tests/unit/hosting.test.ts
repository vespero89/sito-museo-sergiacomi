import { describe, expect, it } from 'vitest';
import {
  MAX_REDIRECT,
  MAX_REGOLE_HEADERS,
  MAX_RIGA_HEADERS,
  creaCsp,
  creaHosting,
  creaIntestazioni,
  creaRedirect,
  intestazioniPer,
  leggiHeaders,
  renderHeaders,
  renderRedirects,
  variantiMaiuscole,
} from '../../config/hosting.mjs';
import { decidiModalita } from '../../src/lib/modalita.ts';
import { dominiCspAttivi } from '../../src/data/servizi.ts';

const PREVIEW = {};
const PRODUZIONE = { SITE_ENV: 'production' };

/** The generated `_headers` text, read back the way Cloudflare reads it. */
function generato(env: Record<string, string>, https = true) {
  const { modalita, intestazioni } = creaHosting(env, { https });
  return { modalita, regole: leggiHeaders(renderHeaders(intestazioni, modalita)) };
}

describe('CSP', () => {
  it('is the base policy plus the tile domain read from the services registry', () => {
    const tile = dominiCspAttivi()['img-src'];
    expect(tile).toEqual(['https://tile.openstreetmap.org']);
    expect(creaCsp()).toBe(
      [
        "default-src 'self'",
        "script-src 'self' 'wasm-unsafe-eval'",
        "style-src 'self'",
        "img-src 'self' data: https://tile.openstreetmap.org",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-src 'none'",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "manifest-src 'self'",
      ].join('; '),
    );
  });

  it('allows wasm for Pagefind but never inline code or eval', () => {
    const csp = creaCsp();
    expect(csp).toContain("'wasm-unsafe-eval'");
    expect(csp).not.toContain("'unsafe-inline'");
    expect(csp).not.toMatch(/'unsafe-eval'/);
  });

  it('adds the domains of an active service and drops none for a frame', () => {
    const csp = creaCsp({
      'frame-src': ['https://www.google.com'],
      'script-src': ['https://stats.example'],
      'img-src': ['https://tile.openstreetmap.org', 'https://tile.openstreetmap.org'],
    });
    expect(csp).toContain('frame-src https://www.google.com;');
    expect(csp).not.toContain("frame-src 'none'");
    expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval' https://stats.example;");
    // No duplicate source.
    expect(csp.match(/tile\.openstreetmap\.org/g)).toHaveLength(1);
  });
});

describe('_headers generated from the single source', () => {
  it('stays inside the Cloudflare limits', () => {
    for (const env of [PREVIEW, PRODUZIONE]) {
      const { regole } = generato(env);
      expect(regole.length).toBeLessThanOrEqual(MAX_REGOLE_HEADERS);
      const testo = renderHeaders(
        creaHosting(env, { https: true }).intestazioni,
        decidiModalita(env),
      );
      for (const riga of testo.split('\n')) expect(riga.length).toBeLessThan(MAX_RIGA_HEADERS);
    }
  });

  it('survives the round trip through the text', () => {
    const { modalita, intestazioni } = creaHosting(PREVIEW, { https: true });
    expect(leggiHeaders(renderHeaders(intestazioni, modalita))).toEqual(intestazioni);
  });

  it('puts no Cache-Control on the general rule', () => {
    const { regole } = generato(PRODUZIONE);
    const generale = regole.find((r) => r.percorso === '/*');
    expect(generale).toBeDefined();
    expect(Object.keys(generale!.intestazioni).map((n) => n.toLowerCase())).not.toContain(
      'cache-control',
    );
  });

  it('merges Cache-Control the Cloudflare way: HTML short, /_astro/ long, /pagefind/ not long', () => {
    const { regole } = generato(PRODUZIONE);
    const cache = (percorso: string) => intestazioniPer(regole, percorso)['Cache-Control'];

    for (const pagina of ['/', '/opere/', '/opere/le-merlettaie/', '/404.html']) {
      expect(cache(pagina)).toBeUndefined();
    }
    expect(cache('/_astro/index.abc123.css')).toBe('public, max-age=31536000, immutable');
    const pagefind = cache('/pagefind/pagefind.js');
    expect(pagefind).toBe('public, max-age=0, must-revalidate');
    expect(pagefind).not.toContain('immutable');
  });

  it('applies the security headers to every kind of path, built files included', () => {
    const { regole } = generato(PRODUZIONE);
    for (const percorso of ['/', '/opere/', '/_astro/a.js', '/pagefind/pagefind.wasm', '/nope']) {
      const h = intestazioniPer(regole, percorso);
      expect(h['Content-Security-Policy']).toBe(creaCsp());
      expect(h['X-Content-Type-Options']).toBe('nosniff');
      expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
      expect(h['Cross-Origin-Opener-Policy']).toBe('same-origin');
      expect(h['Permissions-Policy']).toBe(
        'camera=(), microphone=(), payment=(), usb=(), geolocation=(self)',
      );
    }
  });

  it('joins a repeated header with a comma, and matches the splat like Cloudflare', () => {
    const regole = [
      { percorso: '/*', intestazioni: { 'X-A': 'one' } },
      { percorso: '/b/*', intestazioni: { 'x-a': 'two', 'X-B': 'x' } },
    ];
    expect(intestazioniPer(regole, '/b/c.js')).toEqual({ 'X-A': 'one, two', 'X-B': 'x' });
    expect(intestazioniPer(regole, '/a/c.js')).toEqual({ 'X-A': 'one' });
    // The dot is a dot, not any character.
    expect(intestazioniPer([{ percorso: '/a.html', intestazioni: { X: '1' } }], '/aXhtml')).toEqual(
      {},
    );
  });
});

describe('modes: the decisions come from decidiModalita', () => {
  it('preview: noindex header, HSTS off even on https', () => {
    const { modalita, regole } = generato(PREVIEW, true);
    expect(modalita.anteprima).toBe(true);
    const h = intestazioniPer(regole, '/');
    expect(h['X-Robots-Tag']).toBe('noindex');
    expect(h['Strict-Transport-Security']).toBeUndefined();
  });

  it('production on https: HSTS on, no noindex', () => {
    const h = intestazioniPer(generato(PRODUZIONE, true).regole, '/');
    expect(h['Strict-Transport-Security']).toBe('max-age=31536000');
    expect(h['X-Robots-Tag']).toBeUndefined();
  });

  it('production over plain http (the local test server): no HSTS', () => {
    const h = intestazioniPer(generato(PRODUZIONE, false).regole, '/');
    expect(h['Strict-Transport-Security']).toBeUndefined();
    expect(h['X-Robots-Tag']).toBeUndefined();
  });

  it('ALLOW_OPEN_ITEMS=1 on production behaves as a preview: noindex, no HSTS', () => {
    const h = intestazioniPer(generato({ ...PRODUZIONE, ALLOW_OPEN_ITEMS: '1' }, true).regole, '/');
    expect(h['X-Robots-Tag']).toBe('noindex');
    expect(h['Strict-Transport-Security']).toBeUndefined();
  });

  it('follows whatever decidiModalita says, not the variables', () => {
    const finta = {
      anteprima: false,
      noindex: true,
      sitemap: false,
      llmsTxt: false,
      bloccaAperti: false,
    };
    const h = intestazioniPer(creaIntestazioni(finta, { https: true }), '/');
    expect(h['X-Robots-Tag']).toBe('noindex');
    expect(h['Strict-Transport-Security']).toBeDefined();
  });

  it('refuses an unknown SITE_ENV', () => {
    expect(() => creaHosting({ SITE_ENV: 'prod' }, { https: true })).toThrow(/SITE_ENV/);
  });

  it('the preview files remind that the preview must be private', () => {
    const preview = creaHosting(PREVIEW, { https: true });
    const testo = renderHeaders(preview.intestazioni, preview.modalita);
    expect(testo).toMatch(/PRIVATE PREVIEW/);
    expect(renderRedirects(preview.redirect, preview.modalita)).toMatch(/PRIVATE PREVIEW/);
    const produzione = creaHosting(PRODUZIONE, { https: true });
    expect(renderHeaders(produzione.intestazioni, produzione.modalita)).not.toMatch(
      /PRIVATE PREVIEW/,
    );
  });
});

const DODICI = [
  ['/index.htm', '/'],
  ['/chisiamo.htm', '/chi-siamo/'],
  ['/lartista.htm', '/aldo-sergiacomi/'],
  ['/immagini_dellartista.htm', '/aldo-sergiacomi/'],
  ['/articolo_camilli.htm', '/archivio/articolo-camilli-flash/'],
  ['/pergamena_ricordo_dono_della_com.htm', '/archivio/pergamena-offida-1992/'],
  ['/ilmuseo.htm', '/il-museo/'],
  ['/immaginimuseo.htm', '/il-museo/'],
  ['/iniziative.htm', '/eventi/'],
  ['/dovesiamo.htm', '/visita/'],
  ['/contatti.htm', '/contatti/'],
  ['/centenario_aldo_sergiacomi.htm', '/eventi/centenario-2012/'],
] as const;

describe('_redirects generated from the single source', () => {
  const { modalita, redirect } = creaHosting(PREVIEW, { https: true });
  const righe = renderRedirects(redirect, modalita)
    .split('\n')
    .filter((r) => r !== '' && !r.startsWith('#'));

  it('maps the 12 old .htm pages and /index.html as in spec 4.1', () => {
    const mappa = new Map(redirect.map((r) => [r.da, r.a]));
    for (const [da, a] of DODICI) expect(mappa.get(da)).toBe(a);
    expect(mappa.get('/index.html')).toBe('/');
  });

  it('ends every line with an explicit 301', () => {
    expect(righe.length).toBe(redirect.length);
    for (const riga of righe) expect(riga).toMatch(/^\/\S+ \/\S* 301$/);
  });

  it('has the case variants that were decided', () => {
    const da = redirect.map((r) => r.da);
    for (const v of [
      '/Index.htm',
      '/Index.html',
      '/Chisiamo.htm',
      '/ChiSiamo.htm',
      '/IlMuseo.htm',
    ]) {
      expect(da).toContain(v);
    }
    expect(variantiMaiuscole('/contatti.htm')).toEqual(['/contatti.htm', '/Contatti.htm']);
  });

  it('has no duplicate source, no loop, and stays far below the Cloudflare limit', () => {
    const sorgenti = redirect.map((r) => r.da);
    expect(new Set(sorgenti).size).toBe(sorgenti.length);
    for (const { da, a } of redirect) expect(da).not.toBe(a);
    expect(creaRedirect().length).toBeLessThan(MAX_REDIRECT);
  });

  it('sends every variant of a page to the same place', () => {
    const verso = new Set(redirect.filter((r) => /^\/chisiamo\.htm$/i.test(r.da)).map((r) => r.a));
    expect([...verso]).toEqual(['/chi-siamo/']);
  });
});
