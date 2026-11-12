// Serves `dist/` the way the real hosting will, for the browser tests (e2e, Lighthouse) and for a
// look by hand. It applies the same config as `_headers` and `_redirects` (config/hosting.mjs), so
// the CSP the tests prove is the CSP that ships. It imitates Cloudflare Pages on the points that
// matter to the tests: redirects before files, a folder without the final slash goes to the one
// with it, a missing page gets `404.html` with status 404, `_headers` and `_redirects` are not
// served. It is plain http on localhost, so HSTS is never sent here.
//
// The fake tile (`--fake-tiles`) is a grey 256x256 PNG at /__tiles/{z}/{x}/{y}.png on the same
// origin, so a test can point the map at it (PUBLIC_TILE_URL) and never call OpenStreetMap.
//
// Usage: node scripts/serve-dist.mjs [--dir dist] [--port 4321] [--fake-tiles]
// The mode comes from SITE_ENV and ALLOW_OPEN_ITEMS like the build (use the same as the build).
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { crc32, deflateSync } from 'node:zlib';
import { creaHosting, intestazioniPer } from '../config/hosting.mjs';

const TIPI = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm',
};

/** Files at the root that the hosting reads and never serves. */
const NON_SERVITI = new Set(['/_headers', '/_redirects']);

const TILE = /^\/__tiles\/\d+\/\d+\/\d+\.png$/;

/** @type {Buffer | undefined} */
let tilePng;

/** A flat grey 256x256 PNG, built once. */
function tileGrigio() {
  if (tilePng) return tilePng;
  const lato = 256;
  /** @param {string} tipo @param {Buffer} dati */
  const chunk = (tipo, dati) => {
    const corpo = Buffer.concat([Buffer.from(tipo, 'latin1'), dati]);
    const testa = Buffer.alloc(4);
    testa.writeUInt32BE(dati.length);
    const coda = Buffer.alloc(4);
    coda.writeUInt32BE(crc32(corpo));
    return Buffer.concat([testa, corpo, coda]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lato, 0);
  ihdr.writeUInt32BE(lato, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // grey
  // Each scanline: filter byte 0, then 256 grey pixels.
  const riga = Buffer.concat([Buffer.from([0]), Buffer.alloc(lato, 0xe6)]);
  const pixel = Buffer.concat(Array.from({ length: lato }, () => riga));
  tilePng = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(pixel)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return tilePng;
}

/**
 * The server, not yet listening.
 * @param {{ dist: string, env: Record<string, string | undefined>, tileFinto?: boolean }} opzioni
 */
export function creaServer({ dist, env, tileFinto = false }) {
  const radice = resolve(dist);
  // Plain http: no HSTS, whatever the mode.
  const { intestazioni, redirect } = creaHosting(env, { https: false });
  const spostamenti = new Map(redirect.map((r) => [r.da, r]));

  /** @param {import('node:http').ServerResponse} res @param {number} stato @param {string} verso */
  function sposta(res, stato, verso) {
    res.writeHead(stato, { Location: verso });
    res.end();
  }

  /**
   * @param {import('node:http').ServerResponse} res
   * @param {string} pathname the requested path, used to pick the headers
   * @param {number} stato
   * @param {string} tipo
   * @param {string | Buffer | undefined} corpo a body, or undefined for a file given in `file`
   * @param {string} [file]
   * @param {boolean} [soloTesta]
   */
  function invia(res, pathname, stato, tipo, corpo, file, soloTesta = false) {
    for (const [nome, valore] of Object.entries(intestazioniPer(intestazioni, pathname))) {
      res.setHeader(nome, valore);
    }
    res.setHeader('Content-Type', tipo);
    res.statusCode = stato;
    if (soloTesta) return res.end();
    if (file) {
      return createReadStream(file)
        .on('error', () => res.destroy())
        .pipe(res);
    }
    return res.end(corpo);
  }

  return createServer((req, res) => {
    const soloTesta = req.method === 'HEAD';
    if (req.method !== 'GET' && !soloTesta) {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      return res.end();
    }
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');

    const spostamento = spostamenti.get(pathname);
    if (spostamento) return sposta(res, spostamento.codice, spostamento.a);

    if (tileFinto && TILE.test(pathname)) {
      return invia(res, pathname, 200, 'image/png', tileGrigio(), undefined, soloTesta);
    }

    const file = trovaFile(radice, pathname);
    if (file === 'cartella') return sposta(res, 308, `${pathname}/`);
    if (file) {
      const tipo = TIPI[extname(file)] ?? 'application/octet-stream';
      return invia(res, pathname, 200, tipo, undefined, file, soloTesta);
    }

    const errore = join(radice, '404.html');
    if (statSafe(errore)?.isFile()) {
      return invia(res, pathname, 404, TIPI['.html'], undefined, errore, soloTesta);
    }
    return invia(res, pathname, 404, TIPI['.txt'], 'Not found', undefined, soloTesta);
  });
}

/** @param {string} percorso */
function statSafe(percorso) {
  try {
    return statSync(percorso);
  } catch {
    return undefined;
  }
}

/**
 * The file a path points to inside `radice`; `'cartella'` for a folder with an index asked
 * without the final slash; undefined when there is nothing to serve (or the path tries to leave).
 * @param {string} radice
 * @param {string} pathname
 * @returns {string | 'cartella' | undefined}
 */
function trovaFile(radice, pathname) {
  let relativo;
  try {
    relativo = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
  if (relativo.includes('\0') || NON_SERVITI.has(relativo)) return undefined;
  const completo = resolve(radice, `.${relativo}`);
  if (completo !== radice && !completo.startsWith(radice + sep)) return undefined;

  const info = statSafe(completo);
  if (info?.isDirectory()) {
    if (!statSafe(join(completo, 'index.html'))?.isFile()) return undefined;
    return relativo.endsWith('/') ? join(completo, 'index.html') : 'cartella';
  }
  return info?.isFile() && !relativo.endsWith('/') ? completo : undefined;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: {
      dir: { type: 'string', default: 'dist' },
      port: { type: 'string', default: '4321' },
      'fake-tiles': { type: 'boolean', default: false },
    },
  });
  const server = creaServer({
    dist: values.dir,
    env: process.env,
    tileFinto: values['fake-tiles'],
  });
  server.listen(Number(values.port), '127.0.0.1', () => {
    const { port } = /** @type {import('node:net').AddressInfo} */ (server.address());
    console.log(`serve-dist: ${resolve(values.dir)} on http://127.0.0.1:${port}/`);
  });
  process.on('SIGINT', () => server.close(() => process.exit(0)));
}
