import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creaCsp, creaRedirect } from '../../config/hosting.mjs';
import { creaServer } from '../../scripts/serve-dist.mjs';

let radice: string;
let dist: string;
const aperti: Server[] = [];

beforeEach(() => {
  radice = mkdtempSync(join(tmpdir(), 'serve-dist-'));
  dist = join(radice, 'dist');
  mkdirSync(join(dist, 'opere'), { recursive: true });
  mkdirSync(join(dist, '_astro'));
  mkdirSync(join(dist, 'pagefind'));
  writeFileSync(join(dist, 'index.html'), '<h1>home</h1>');
  writeFileSync(join(dist, '404.html'), '<h1>non trovata</h1>');
  writeFileSync(join(dist, 'opere', 'index.html'), '<h1>opere</h1>');
  writeFileSync(join(dist, '_astro', 'site.abc.js'), 'export {};');
  writeFileSync(join(dist, 'pagefind', 'pagefind.wasm'), 'wasm');
  writeFileSync(join(dist, 'pagefind', 'index.pf_index'), 'idx');
  writeFileSync(join(radice, 'secret.txt'), 'outside dist');
});

afterEach(async () => {
  for (const s of aperti.splice(0)) {
    s.closeAllConnections();
    await new Promise((fine) => s.close(fine));
  }
  rmSync(radice, { recursive: true, force: true });
});

/** Starts the server on a free port and returns its base URL. */
async function avvia(opzioni: { env?: Record<string, string>; tileFinto?: boolean } = {}) {
  const server = creaServer({
    dist,
    env: opzioni.env ?? {},
    tileFinto: opzioni.tileFinto ?? false,
  });
  aperti.push(server);
  await new Promise<void>((fine) => server.listen(0, '127.0.0.1', fine));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const manuale = { redirect: 'manual' } as const;

describe('serve-dist: redirects', () => {
  it('answers 301 to every old address, with the new place in Location', async () => {
    const base = await avvia();
    const redirect = creaRedirect();
    expect(redirect.length).toBeGreaterThanOrEqual(13);
    for (const { da, a } of redirect) {
      const r = await fetch(base + da, manuale);
      expect(r.status, da).toBe(301);
      expect(r.headers.get('location'), da).toBe(a);
    }
  });

  it('treats the spelling of an old address as a different address, as Cloudflare does', async () => {
    const base = await avvia();
    expect((await fetch(`${base}/ChiSiamo.htm`, manuale)).status).toBe(301);
    expect((await fetch(`${base}/CHISIAMO.HTM`, manuale)).status).toBe(404);
  });

  it('sends a folder without the final slash to the one with it', async () => {
    const base = await avvia();
    const r = await fetch(`${base}/opere`, manuale);
    expect(r.status).toBe(308);
    expect(r.headers.get('location')).toBe('/opere/');
  });
});

describe('serve-dist: files, 404 and safety', () => {
  it('serves index.html for the home and for a folder, with the right type', async () => {
    const base = await avvia();
    const home = await fetch(`${base}/`);
    expect(home.status).toBe(200);
    expect(home.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(await home.text()).toBe('<h1>home</h1>');
    expect(await (await fetch(`${base}/opere/`)).text()).toBe('<h1>opere</h1>');
    expect((await fetch(`${base}/_astro/site.abc.js`)).headers.get('content-type')).toBe(
      'text/javascript; charset=utf-8',
    );
    expect((await fetch(`${base}/pagefind/pagefind.wasm`)).headers.get('content-type')).toBe(
      'application/wasm',
    );
  });

  it('serves the 404 page with status 404, with the security headers too', async () => {
    const base = await avvia();
    const r = await fetch(`${base}/non-esiste/`);
    expect(r.status).toBe(404);
    expect(await r.text()).toBe('<h1>non trovata</h1>');
    expect(r.headers.get('content-security-policy')).toBe(creaCsp());
  });

  it('does not serve the hosting files themselves', async () => {
    writeFileSync(join(dist, '_headers'), '/*');
    writeFileSync(join(dist, '_redirects'), '/a /b 301');
    const base = await avvia();
    expect((await fetch(`${base}/_headers`)).status).toBe(404);
    expect((await fetch(`${base}/_redirects`)).status).toBe(404);
  });

  it('answers 404 in plain text when there is no 404.html', async () => {
    rmSync(join(dist, '404.html'));
    const r = await fetch(`${await avvia()}/nope/`);
    expect(r.status).toBe(404);
  });

  it('never serves a file outside dist/', async () => {
    const base = await avvia();
    for (const percorso of ['/../secret.txt', '/%2e%2e/secret.txt', '/..%2fsecret.txt', '/%00']) {
      const r = await fetch(base + percorso);
      expect(r.status, percorso).not.toBe(200);
      expect(await r.text(), percorso).not.toContain('outside dist');
    }
    // fetch normalises "/../"; send the raw request line too.
    const { request } = await import('node:http');
    const stato = await new Promise<number>((fine) => {
      const url = new URL(base);
      request({ host: url.hostname, port: url.port, path: '/../secret.txt' }, (res) => {
        res.resume();
        fine(res.statusCode ?? 0);
      }).end();
    });
    expect(stato).toBe(404);
  });

  it('answers HEAD without a body and refuses other methods', async () => {
    const base = await avvia();
    const head = await fetch(`${base}/`, { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
    expect((await fetch(`${base}/`, { method: 'POST' })).status).toBe(405);
  });
});

describe('serve-dist: headers come from the same config as _headers', () => {
  it('preview: CSP, noindex, no HSTS, and Cache-Control only where the rules say so', async () => {
    const base = await avvia();
    const home = await fetch(`${base}/`);
    expect(home.headers.get('content-security-policy')).toBe(creaCsp());
    expect(home.headers.get('x-robots-tag')).toBe('noindex');
    expect(home.headers.get('strict-transport-security')).toBeNull();
    expect(home.headers.get('cache-control')).toBeNull();

    const astro = await fetch(`${base}/_astro/site.abc.js`);
    expect(astro.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    const pagefind = await fetch(`${base}/pagefind/index.pf_index`);
    expect(pagefind.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate');
  });

  it('production: indexable, and still no HSTS because the test server is plain http', async () => {
    const r = await fetch(`${await avvia({ env: { SITE_ENV: 'production' } })}/`);
    expect(r.headers.get('x-robots-tag')).toBeNull();
    expect(r.headers.get('strict-transport-security')).toBeNull();
    expect(r.headers.get('content-security-policy')).toBe(creaCsp());
  });

  it('ALLOW_OPEN_ITEMS=1 on production: noindex again', async () => {
    const env = { SITE_ENV: 'production', ALLOW_OPEN_ITEMS: '1' };
    expect((await fetch(`${await avvia({ env })}/`)).headers.get('x-robots-tag')).toBe('noindex');
  });
});

describe('serve-dist: fake map tiles', () => {
  it('are off unless asked for', async () => {
    expect((await fetch(`${await avvia()}/__tiles/5/16/12.png`)).status).toBe(404);
  });

  it('are a 256x256 PNG from the same origin when asked for', async () => {
    const base = await avvia({ tileFinto: true });
    const r = await fetch(`${base}/__tiles/12/2200/1500.png`);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('image/png');
    const png = Buffer.from(await r.arrayBuffer());
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(png.readUInt32BE(16)).toBe(256);
    expect(png.readUInt32BE(20)).toBe(256);
    // Not a tile path: not served.
    expect((await fetch(`${base}/__tiles/x/y/z.png`)).status).toBe(404);
  });
});

describe('serve-dist as a command', () => {
  it('starts on the given port, prints its address and answers the redirects', async () => {
    const { spawn } = await import('node:child_process');
    const figlio = spawn('node', ['scripts/serve-dist.mjs', '--dir', dist, '--port', '0'], {
      cwd: join(import.meta.dirname, '..', '..'),
      env: { ...process.env, SITE_ENV: '', ALLOW_OPEN_ITEMS: '' },
    });
    try {
      const indirizzo = await new Promise<string>((fine, errore) => {
        let uscita = '';
        figlio.stdout.on('data', (pezzo) => {
          uscita += pezzo;
          const trovato = /on (http:\/\/127\.0\.0\.1:\d+\/)/.exec(uscita);
          if (trovato?.[1]) fine(trovato[1]);
        });
        figlio.on('exit', () => errore(new Error(`server exited early: ${uscita}`)));
      });
      const r = await fetch(`${indirizzo}chisiamo.htm`, manuale);
      expect(r.status).toBe(301);
      expect(r.headers.get('location')).toBe('/chi-siamo/');
    } finally {
      figlio.kill();
    }
  });
});
