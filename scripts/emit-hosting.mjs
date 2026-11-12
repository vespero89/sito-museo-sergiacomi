// Writes `dist/_headers` and `dist/_redirects` (Cloudflare Pages) from config/hosting.mjs.
// Runs after `astro build` (see the build scripts in package.json). The mode (preview or
// production) comes from SITE_ENV and ALLOW_OPEN_ITEMS, read by `decidiModalita` through the hosting
// config. Cloudflare serves https only, so HSTS is allowed here (it still needs a production build).
//
// Usage: node scripts/emit-hosting.mjs [dist-folder]
import { existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaHosting, renderHeaders, renderRedirects } from '../config/hosting.mjs';

/**
 * @param {string} dist the built site
 * @param {Record<string, string | undefined>} env process.env or a test object
 */
export function emettiHosting(dist, env) {
  if (!existsSync(dist)) {
    throw new Error(`${dist} not found: build the site before emitting the hosting files`);
  }
  const { modalita, intestazioni, redirect } = creaHosting(env, { https: true });
  writeFileSync(join(dist, '_headers'), renderHeaders(intestazioni, modalita));
  writeFileSync(join(dist, '_redirects'), renderRedirects(redirect, modalita));
  return { modalita, regole: intestazioni.length, redirect: redirect.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const radice = fileURLToPath(new URL('..', import.meta.url));
  const dist = resolve(process.argv[2] ?? join(radice, 'dist'));
  const { modalita, regole, redirect } = emettiHosting(dist, process.env);
  console.log(
    `emit-hosting: ${regole} header rules and ${redirect} redirects in ${dist} ` +
      `(${modalita.anteprima ? 'preview' : 'production'})`,
  );
}
